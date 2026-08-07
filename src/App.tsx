import React, { useState, useEffect, useMemo } from 'react';
import { QuizMetadata, Question, TeacherProfile, RosterUser, Submission, StudentInfo } from './types';
import { HeaderBar } from './components/HeaderBar';
import { FooterBranding } from './components/FooterBranding';
import { WelcomeScreen } from './components/WelcomeScreen';
import { LogoutModal } from './components/LogoutModal';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLoginModal } from './components/AdminLoginModal';
import { RosterManager } from './components/TeacherDashboard/RosterManager';
import { QuizMetadataForm } from './components/TeacherDashboard/QuizMetadataForm';
import { SmartTextParserEditor } from './components/TeacherDashboard/SmartTextParserEditor';
import { FormQuestionBuilder } from './components/TeacherDashboard/FormQuestionBuilder';
import { QuizListManager } from './components/TeacherDashboard/QuizListManager';
import { QuizArchive } from './components/TeacherDashboard/QuizArchive';
import { TeacherLoginModal } from './components/TeacherDashboard/TeacherLoginModal';
import { AnalyticsDashboard } from './components/TeacherDashboard/AnalyticsDashboard';
import { StudentLoginForm } from './components/StudentPortal/StudentLoginForm';
import { StudentQuizContainer } from './components/StudentPortal/StudentQuizContainer';
import { StudentArchive } from './components/StudentPortal/StudentArchive';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import { SubscriptionExpirationModal } from './components/SubscriptionExpirationModal';
import { GuestExpirationModal } from './components/GuestExpirationModal';
import { fetchAllSubmissions, fetchAllRosterUsers, syncRosterToFirebase, subscribeToRoster, subscribeToSubmissions, saveSingleRosterUserToFirebase, auth, generateDeterministicUserId } from './services/adminService';
import apiClient from './services/apiClient';
import { SmartCache } from './services/smartCache';
import { saveLocalQuiz } from './services/offlineDb';
import { PlusCircle, BookOpen, BarChart3, GraduationCap, Sparkles, CheckCircle2, Library, UserCheck, ShieldCheck, Users, Archive, Loader2 } from 'lucide-react';

export default function App() {
  const [role, setRole] = useState<'teacher' | 'student' | 'admin'>('teacher');
  const [showWelcomeScreen, setShowWelcomeScreen] = useState<boolean>(true);
  const [isStudentOnlyMode, setIsStudentOnlyMode] = useState<boolean>(false);
  const [teacherTab, setTeacherTab] = useState<'create' | 'manage' | 'archive' | 'analytics' | 'roster'>('create');

  // Roster State (Excel imported students & teachers)
  const [roster, setRoster] = useState<RosterUser[]>(() => {
    const saved = localStorage.getItem('interactive_quiz_roster');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse roster from storage', e);
      }
    }
    return [
      {
        id: 'usr-seed-1',
        name: 'أحمد محمد العلي',
        role: 'student',
        schoolName: 'مدرسة التميز التفاعلية',
        branch: 'عام',
        grade: 'الثالث الثانوي',
        section: 'أ',
        serialNumber: '982341052',
        code: '6109234',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr-seed-2',
        name: 'سارة عبد الله خالد',
        role: 'student',
        schoolName: 'مدرسة التميز التفاعلية',
        branch: 'عام',
        grade: 'الثاني الثانوي',
        section: 'ب',
        serialNumber: '912837465',
        code: '5281039',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr-seed-3',
        name: 'أ. إبراهيم دخان',
        role: 'teacher',
        schoolName: 'مدرسة التميز التفاعلية',
        branch: 'عام',
        serialNumber: '772324000',
        code: '7808040',
        createdAt: new Date().toISOString(),
      }
    ];
  });

  const handleUpdateRoster = (newRoster: RosterUser[]) => {
    setRoster(newRoster);
    localStorage.setItem('interactive_quiz_roster', JSON.stringify(newRoster));
    SmartCache.invalidate(`roster_list_${teacherProfile?.schoolName || 'all'}`);
  };

  const handleUpdateSingleRosterUser = (updatedUser: RosterUser) => {
    const exists = roster.some(u => u.id === updatedUser.id);
    const newRoster = exists 
      ? roster.map((u) => (u.id === updatedUser.id ? updatedUser : u))
      : [...roster, updatedUser];
    
    setRoster(newRoster);
    localStorage.setItem('interactive_quiz_roster', JSON.stringify(newRoster));
    saveSingleRosterUserToFirebase(updatedUser);
    SmartCache.invalidate(`roster_list_${teacherProfile?.schoolName || 'all'}`);
  };

  // Teacher Profile & Login Modal
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
  const [isTeacherLoginModalOpen, setIsTeacherLoginModalOpen] = useState<boolean>(false);
  const [isGuestExpired, setIsGuestExpired] = useState<boolean>(false);
  const [guestDaysRemaining, setGuestDaysRemaining] = useState<number>(30);

  // Impersonation State (Super Admin viewing as School Manager)
  const [impersonatedSchool, setImpersonatedSchool] = useState<{ id: string; name: string; branch: string } | null>(null);

  const handleImpersonateSchool = (school: { id: string; name: string; branch: string }) => {
    setImpersonatedSchool(school);
    setRole('teacher');
    setShowWelcomeScreen(false);
    setTeacherProfile({
      teacherName: 'مدير المدرسة (معاينة إشرافية)',
      teacherCode: 'ADMIN_IMPERSONATE',
      schoolName: school.name,
      branch: school.branch,
      academicYear: '1448هـ / 2026م',
    });
  };

  // Admin Security Guard State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState<boolean>(false);

  // Logout Modal State
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState<boolean>(false);

  // Teacher Creation State
  const [currentQuizMeta, setCurrentQuizMeta] = useState<Partial<QuizMetadata>>({
    title: 'اختبار تقويمي شامل',
    subject: 'اللغة العربية',
    main_subject: 'اللغة العربية',
    sub_subject: 'نحو',
    class_level: '12',
    grade: '12',
    section: 'أ',
    teacherName: 'أ. إبراهيم دخان',
    schoolName: 'مدرسة التميز التفاعلية',
    branch: 'عام',
    academic_year: '1448هـ / 2026 - 2027 م',
    schoolYear: '1448هـ / 2026 - 2027 م',
    visibility: 'public',
    showFeedback: 'immediate',
    timeLimitMinutes: 0,
    passPercentage: 50,
    createdAt: new Date().toISOString().split('T')[0],
  });
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);
  const [savedQuizzes, setSavedQuizzes] = useState<QuizMetadata[]>([]);
  const [quizzesPage, setQuizzesPage] = useState<number>(1);
  const [quizzesTotalPages, setQuizzesTotalPages] = useState<number>(1);
  
  const [rosterPage, setRosterPage] = useState<number>(1);
  const [rosterTotalPages, setRosterTotalPages] = useState<number>(1);
  const [selectedQuizForAnalytics, setSelectedQuizForAnalytics] = useState<QuizMetadata | null>(null);
  const [isQuizzesLoading, setIsQuizzesLoading] = useState<boolean>(false);
  const [isSavingQuiz, setIsSavingQuiz] = useState<boolean>(false);

  // Check if current user has Manager / Admin permission
  const isSchoolAdmin = useMemo(() => {
    if (isAdminAuthenticated) return true;
    if (teacherProfile?.role === 'admin' || teacherProfile?.teacherCode === 'ADMIN_IMPERSONATE') return true;
    if (teacherProfile?.serialNumber || teacherProfile?.teacherCode) {
      const match = roster.find(
        (u) =>
          (teacherProfile.serialNumber && u.serialNumber === teacherProfile.serialNumber) ||
          (teacherProfile.teacherCode && u.code === teacherProfile.teacherCode)
      );
      if (match && match.role === 'admin') return true;
    }
    return false;
  }, [isAdminAuthenticated, teacherProfile, roster]);

  useEffect(() => {
    if (teacherTab === 'roster' && !isSchoolAdmin) {
      setTeacherTab('create');
    }
  }, [teacherTab, isSchoolAdmin]);

  // Filter quizzes owned by current user/teacher for "إدارة وسجل اختباراتي"
  const myQuizzes = useMemo(() => {
    return savedQuizzes.filter((quiz) => {
      if (!teacherProfile) return true;
      const isOwner =
        (quiz.teacherName && teacherProfile.teacherName && quiz.teacherName === teacherProfile.teacherName) ||
        (quiz.ownerTeacherCode && teacherProfile.teacherCode && quiz.ownerTeacherCode === teacherProfile.teacherCode) ||
        (quiz.schoolName && teacherProfile.schoolName && quiz.schoolName === teacherProfile.schoolName && quiz.teacherName === teacherProfile.teacherName);
      return isOwner;
    });
  }, [savedQuizzes, teacherProfile]);

  // Student Flow State
  const [activeStudentQuiz, setActiveStudentQuiz] = useState<QuizMetadata | null>(null);
  const [isStatelessSelectedQuiz, setIsStatelessSelectedQuiz] = useState<boolean>(false);
  const [activeExistingSubmission, setActiveExistingSubmission] = useState<Submission | null>(null);
  const [studentQuizInitialViewMode, setStudentQuizInitialViewMode] = useState<'take' | 'result'>('take');
  const [studentInfo, setStudentInfo] = useState<{ name: string; grade: string; section: string; schoolName?: string; branch?: string; email?: string; serialNumber?: string; guestDeviceUuid?: string } | null>(null);
  const [showStudentArchive, setShowStudentArchive] = useState<boolean>(false);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);


  const loadRosterFromFirebase = async (forceRefresh: boolean = false, page: number = rosterPage) => {
    try {
      const cacheKey = `roster_list_${teacherProfile?.schoolName || 'all'}_page_${page}`;
      if (!forceRefresh) {
        const cachedRoster = SmartCache.get<any>(cacheKey);
        if (cachedRoster) {
          setRoster(cachedRoster.data);
          setRosterTotalPages(cachedRoster.last_page);
          return;
        }
      }

      // We pass page to fetchAllRosterUsers
      const response = await fetchAllRosterUsers(teacherProfile?.schoolName, forceRefresh, page);
      const fetchedRoster = response?.data || [];
      if (fetchedRoster && fetchedRoster.length > 0) {
        setRoster(fetchedRoster);
        setRosterTotalPages(response?.last_page || 1);
        SmartCache.set(cacheKey, {
          data: fetchedRoster,
          last_page: response?.last_page || 1
        });
      }
    } catch (err) {
      console.error('Error loading roster users:', err);
    }
  };

  const loadSubmissions = async () => {
    try {
      const subs = await fetchAllSubmissions();
      setAllSubmissions(subs);
    } catch (e) {
      console.error('Failed to fetch submissions:', e);
    }
  };

  useEffect(() => {
    loadQuizzes();
    loadSubmissions();
    loadRosterFromFirebase();

    // REQUIREMENT 5: Sync Freeze - If school/account is suspended, freeze onSnapshot listeners to save Firebase quotas
    if (teacherProfile?.is_suspended) {
      console.warn('ACCOUNT SUSPENDED: Real-time onSnapshot listeners frozen.');
      return;
    }

    // Targeted Subscribe to live Firestore roster updates for isolated school & branch
    const unsubscribeRoster = subscribeToRoster(
      (remoteRoster) => {
        setRoster(remoteRoster);
      },
      {
        schoolName: teacherProfile?.schoolName,
        branch: teacherProfile?.branch,
        grade: teacherProfile?.grade,
        section: teacherProfile?.section,
      }
    );



    // Targeted Subscribe to live Firestore submissions updates
    const unsubscribeSubmissions = subscribeToSubmissions((remoteSubs) => {
      setAllSubmissions(remoteSubs);
    });

    // Load saved teacher profile
    const savedProfileStr = localStorage.getItem('interactive_quiz_teacher_profile');
    if (savedProfileStr && !teacherProfile) {
      try {
        const prof = JSON.parse(savedProfileStr) as TeacherProfile;
        setTeacherProfile(prof);
        updateQuizMetaFromProfile(prof);
      } catch (e) {
        console.error('Failed to parse teacher profile', e);
      }
    }

    // Check Guest Expiration
    if (teacherProfile?.role === 'guest_teacher') {
      apiClient.get('/auth/me').then((res) => {
         const createdAt = new Date(res.data.created_at || res.data.data?.created_at || Date.now());
         const now = new Date();
         const diffTime = Math.abs(now.getTime() - createdAt.getTime());
         const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
         const remaining = 30 - diffDays;
         setGuestDaysRemaining(remaining);
         if (remaining <= 0) {
            setIsGuestExpired(true);
         }
      }).catch(console.error);
    }

    // Check if student arrived via direct link ?quizId=... or ?mode=student
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('quizId');
    const mode = urlParams.get('mode');
    
    if (quizId || mode === 'student') {
      setRole('student');
      setShowWelcomeScreen(false);
      setIsStudentOnlyMode(true);
      if (quizId) {
        apiClient.get(`/quizzes/${quizId}`)
          .then(res => { if (res.data?.data) setActiveStudentQuiz(res.data.data); })
          .catch(err => console.warn('Failed to fetch quiz by id', err));
      }
    }

    return () => {
      unsubscribeRoster();
      unsubscribeSubmissions();
    };
  }, [teacherProfile?.schoolName, teacherProfile?.branch, teacherProfile?.teacherCode]);

  // Show login modal if switching role or accessing guards
  const handleRoleChange = (newRole: 'teacher' | 'student' | 'admin') => {
    setRole(newRole);

    if (newRole === 'admin') {
      if (!isAdminAuthenticated) {
        setIsAdminLoginModalOpen(true);
      } else {
        setShowWelcomeScreen(false);
      }
    } else if (newRole === 'teacher') {
      if (!teacherProfile) {
        setIsTeacherLoginModalOpen(true);
      } else {
        setShowWelcomeScreen(false);
      }
    } else if (newRole === 'student') {
      setShowWelcomeScreen(false);
      if (savedQuizzes.length > 0 && !activeStudentQuiz) {
        setActiveStudentQuiz(savedQuizzes[0]);
      }
    }
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    setIsAdminLoginModalOpen(false);
    setShowWelcomeScreen(false);
    setRole('admin');
    setSaveMessage('مرحباً بك: إبراهيم دخان المشرف العام. تم الاتصال بقاعدة البيانات المعزولة admin_connection بنجاح!');
    setTimeout(() => setSaveMessage(null), 5000);
  };

  const handleConfirmLogout = async () => {
    // 1. Sign out from Firebase Auth
    try {
      await auth.signOut();
    } catch (e) {
      console.warn('Auth sign out warning:', e);
    }

    // 2. Clear state and local session storage
    setIsAdminAuthenticated(false);
    setTeacherProfile(null);
    setStudentInfo(null);
    setActiveStudentQuiz(null);
    localStorage.removeItem('interactive_quiz_teacher_profile');
    
    setShowWelcomeScreen(true);
    setIsLogoutModalOpen(false);
    setSaveMessage('تم تسجيل الخروج بنجاح وتنظيف جلسة الذاكرة وحساب المصادقة (Auth Session Cleared).');
    setTimeout(() => setSaveMessage(null), 4000);
  };

  const updateQuizMetaFromProfile = (prof: TeacherProfile) => {
    setCurrentQuizMeta((prev) => ({
      ...prev,
      teacherName: prof.teacherName,
      schoolName: prof.schoolName,
      branch: prof.branch,
      academic_year: prof.academicYear,
      schoolYear: prof.academicYear,
      ownerTeacherCode: prof.teacherCode || prof.teacherName,
    }));
  };

  const handleTeacherLoginSuccess = (profile: TeacherProfile) => {
    setTeacherProfile(profile);
    updateQuizMetaFromProfile(profile);
    setIsTeacherLoginModalOpen(false);
    setShowWelcomeScreen(false);
    setSaveMessage(`مرحباً بك أ/ ${profile.teacherName} في نظام لوحة التحكم. تم تسجيل الدخول بنجاح!`);
    setTimeout(() => setSaveMessage(null), 4000);
  };

  const loadQuizzes = async (forceRefresh = false, page = quizzesPage) => {
    setIsQuizzesLoading(true);
    try {
      const cacheKey = `quizzes_list_page_${page}`;
      if (!forceRefresh) {
        const cachedQuizzes = SmartCache.get<any>(cacheKey);
        if (cachedQuizzes) {
          setSavedQuizzes(cachedQuizzes.data);
          setQuizzesTotalPages(cachedQuizzes.last_page);
          setIsQuizzesLoading(false);
          return;
        }
      }

      const response = await apiClient.get(`/quizzes?page=${page}`);
      if (response.data?.data) {
        setSavedQuizzes(response.data.data);
        setQuizzesTotalPages(response.data.last_page || 1);
        SmartCache.set(cacheKey, {
          data: response.data.data,
          last_page: response.data.last_page || 1
        });
      }
    } catch (e: any) {
      console.warn('Failed to load quizzes via API:', e);
    } finally {
      setIsQuizzesLoading(false);
    }
  };

  const handleQuestionsParsed = (questions: Question[]) => {
    setParsedQuestions(questions);
    setSaveMessage(`تم تحليل وتحديث ${questions.length} سؤال بنجاح في القائمة.`);
    setTimeout(() => setSaveMessage(null), 4000);
  };

  const handleSaveQuiz = async () => {
    if (!currentQuizMeta.title || !currentQuizMeta.subject) {
      alert('يرجى تعبئة عنوان الاختبار والمادة على الأقل.');
      return;
    }
    if (parsedQuestions.length === 0) {
      alert('يرجى إضافة أو تحليل سؤال واحد على الأقل قبل الحفظ.');
      return;
    }

    const isUpdating = currentQuizMeta.id && !currentQuizMeta.id.startsWith('temp_');
    const quizId = currentQuizMeta.id || `temp_${Date.now()}`;
    const newQuiz: QuizMetadata = {
      id: quizId,
      title: currentQuizMeta.title || 'اختبار تفاعلي',
      subject: currentQuizMeta.subject || currentQuizMeta.main_subject || 'مادة علمية',
      grade: currentQuizMeta.grade || currentQuizMeta.class_level || 'جميع الصفوف',
      section: currentQuizMeta.section || 'عام',
      teacherName: currentQuizMeta.teacherName || teacherProfile?.teacherName || 'اسم المعلم',
      schoolName: currentQuizMeta.schoolName || teacherProfile?.schoolName || '',
      branch: currentQuizMeta.branch || teacherProfile?.branch || 'عام',
      schoolYear: currentQuizMeta.academic_year || currentQuizMeta.schoolYear || '1448هـ / 2026 - 2027 م',
      createdAt: currentQuizMeta.createdAt || new Date().toISOString(),
      showFeedback: currentQuizMeta.showFeedback || 'immediate',
      timeLimitMinutes: currentQuizMeta.timeLimitMinutes || 0,
      passPercentage: currentQuizMeta.passPercentage || 50,
      questions: parsedQuestions,
      updatedAt: new Date().toISOString(),
      visibility: currentQuizMeta.visibility || 'public',
      class_level: currentQuizMeta.class_level || currentQuizMeta.grade || '12',
      main_subject: currentQuizMeta.main_subject || currentQuizMeta.subject || 'اللغة العربية',
      sub_subject: currentQuizMeta.sub_subject || 'عام',
      academic_year: currentQuizMeta.academic_year || currentQuizMeta.schoolYear || '1448هـ / 2026 - 2027 م',
      ownerTeacherCode: teacherProfile?.teacherCode || currentQuizMeta.teacherName,
      allowAnswerChange: !!currentQuizMeta.allowAnswerChange,
      allowFullQuizRetake: !!currentQuizMeta.allowFullQuizRetake,
    };

    setIsSavingQuiz(true);
    try {
      let response;
      if (isUpdating) {
        response = await apiClient.put(`/quizzes/${currentQuizMeta.id}`, newQuiz);
      } else {
        const payload = { ...newQuiz, id: undefined };
        response = await apiClient.post('/quizzes', payload);
      }
      
      const serverQuiz = response.data?.data;
      if (serverQuiz) {
        setSavedQuizzes(prev => {
          if (isUpdating) return prev.map(q => q.id === serverQuiz.id ? serverQuiz : q);
          return [serverQuiz, ...prev];
        });
        await saveLocalQuiz(serverQuiz, false);
        setSaveMessage('تم حفظ الاختبار واعتماده بنجاح!');
        setTeacherTab('manage');
        
        // Smart Cache Invalidation for Quizzes
        SmartCache.invalidate('quizzes_list');
      }
    } catch (error: any) {
      if (!error.response && !navigator.onLine) {
        newQuiz.synced = false;
        await saveLocalQuiz(newQuiz, true);
        setSavedQuizzes(prev => [newQuiz, ...prev]);
        setSaveMessage('تم الحفظ محلياً لعدم توفر إنترنت. ستتم المزامنة تلقائياً عند عودة الاتصال');
        setTeacherTab('manage');
      } else {
        const errors = error.response?.data?.errors;
        const msgs = errors ? Object.values(errors).flat().join('\n') : error.response?.data?.message || 'فشل حفظ الاختبار.';
        alert(msgs);
      }
    } finally {
      setIsSavingQuiz(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  if (showWelcomeScreen) {
    return (
      <>
        <WelcomeScreen
          isStudentOnlyMode={isStudentOnlyMode}
          onEnterSystem={() => {
            setIsTeacherLoginModalOpen(true);
          }}
          onSelectRole={(selectedRole) => handleRoleChange(selectedRole)}
        />

        {/* Teacher / Admin Login Modal */}
        <TeacherLoginModal
          isOpen={isTeacherLoginModalOpen}
          currentProfile={teacherProfile}
          roster={roster}
          onLoginSuccess={handleTeacherLoginSuccess}
          onClose={() => {
            setIsTeacherLoginModalOpen(false);
            setShowWelcomeScreen(true);
          }}
        />

        {/* Admin Security Guard Login Modal */}
        <AdminLoginModal
          isOpen={isAdminLoginModalOpen}
          onClose={() => {
            setIsAdminLoginModalOpen(false);
            setShowWelcomeScreen(true);
          }}
          onAdminLoginSuccess={handleAdminLoginSuccess}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased dir-rtl selection:bg-indigo-500 selection:text-white">
      {/* Teacher Login / Profile Modal */}
      <TeacherLoginModal
        isOpen={isTeacherLoginModalOpen}
        currentProfile={teacherProfile}
        roster={roster}
        onLoginSuccess={handleTeacherLoginSuccess}
        onClose={() => {
          setIsTeacherLoginModalOpen(false);
          if (!teacherProfile) {
            setShowWelcomeScreen(true);
          }
        }}
      />

      {/* Admin Security Guard Login Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={() => {
          setIsAdminLoginModalOpen(false);
          if (!isAdminAuthenticated) {
            setShowWelcomeScreen(true);
          }
        }}
        onAdminLoginSuccess={handleAdminLoginSuccess}
      />

      {/* Logout Confirmation Modal with Session Clearing */}
      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirmLogout={handleConfirmLogout}
      />

      <GuestExpirationModal 
        isOpen={isGuestExpired} 
        onLogout={handleConfirmLogout} 
      />

      {/* Header Bar */}
      <HeaderBar
        currentRole={role}
        hideTeacherButton={isStudentOnlyMode}
        onRoleChange={handleRoleChange}
        onRefreshClick={loadQuizzes}
        teacherProfile={teacherProfile}
        onOpenProfileModal={() => setIsTeacherLoginModalOpen(true)}
        onOpenLogoutModal={() => setIsLogoutModalOpen(true)}
        onShowWelcomeScreen={() => setShowWelcomeScreen(true)}
        onOpenStudentArchive={() => setShowStudentArchive(true)}
      />

      {/* Persistent Guest Banner */}
      {teacherProfile?.role === 'guest_teacher' && (
        <div className="bg-emerald-500 text-slate-950 font-black px-4 py-2 flex flex-wrap items-center justify-center gap-2 text-xs shadow-md dir-rtl sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-slate-950 animate-pulse shrink-0" />
            <span>
              وضع التجربة (المعلم الضيف) — متبقي لك {Math.max(0, guestDaysRemaining)} أيام من أصل 30 يوم.
            </span>
          </div>
        </div>
      )}

      {/* Persistent Impersonation Banner for Super Admin */}
      {impersonatedSchool && (
        <div className="bg-amber-500 text-slate-950 font-black px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs border-b border-amber-600 shadow-md dir-rtl sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-950 animate-bounce shrink-0" />
            <span>
              ⚠️ أنت تتصفح النظام حالياً كمدير لمدرسة: <strong>{impersonatedSchool.name}</strong> ({impersonatedSchool.branch}) — وضع المعاينة والحل التقني
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setImpersonatedSchool(null);
              setRole('admin');
            }}
            className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm"
          >
            <span>العودة للوضع الإشرافي (Admin Mode)</span>
          </button>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-16">
        {/* Save/Notification Alert */}
        {saveMessage && (
          <div className="mb-6 p-4 bg-emerald-600 text-white font-extrabold rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-fadeIn dir-rtl">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
              <span>{saveMessage}</span>
            </div>
            <button type="button" onClick={() => setSaveMessage(null)} className="text-xs opacity-80 hover:opacity-100">
              إغلاق
            </button>
          </div>
        )}

        {/* ADMIN CONTROL DASHBOARD MODE */}
        {role === 'admin' && (
          <div>
            {!isAdminAuthenticated ? (
              <div className="p-8 bg-white rounded-3xl shadow-xl border border-purple-200 text-center space-y-4 max-w-lg mx-auto my-12">
                <div className="w-16 h-16 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900">حساب المشرف العام محمي برمجياً</h3>
                <p className="text-xs text-slate-500 font-medium">
                  يتطلب الوصول إلى لوحة المشرف العام إدخال الرقم التسلسلي والكود المعتمد.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAdminLoginModalOpen(true)}
                  className="px-6 py-3 bg-purple-700 hover:bg-purple-600 text-white font-black rounded-2xl text-xs shadow-md transition-all"
                >
                  فتح شاشة الدخول كـ (المشرف العام)
                </button>
              </div>
            ) : (
              <AdminDashboard
                onLogout={() => setIsLogoutModalOpen(true)}
                roster={roster}
                onUpdateRoster={handleUpdateRoster}
                teacherProfile={teacherProfile}
                onUpdateTeacherProfile={(updatedProf) => {
                  setTeacherProfile(updatedProf);
                  localStorage.setItem('interactive_quiz_teacher_profile', JSON.stringify(updatedProf));
                }}
                onImpersonate={handleImpersonateSchool}
              />
            )}
          </div>
        )}

        {/* TEACHER DASHBOARD MODE */}
        {role === 'teacher' && (
          <div>
            {/* Teacher Header Banner Info */}
            {teacherProfile && (
              <div className="mb-4 px-5 py-3 bg-indigo-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2 text-xs">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span className="font-extrabold">المعلم: {teacherProfile.teacherName}</span>
                  <span className="text-indigo-200">| {teacherProfile.schoolName} ({teacherProfile.branch})</span>
                  <span className="text-indigo-300 font-semibold hidden md:inline">| العام: {teacherProfile.academicYear}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTeacherLoginModalOpen(true)}
                  className="px-3 py-1 bg-indigo-800 hover:bg-indigo-700 text-indigo-100 rounded-xl text-xs font-bold transition-all"
                >
                  تعديل الملف / تغيير الحساب
                </button>
              </div>
            )}

            {/* Teacher Sub-Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 mb-6 p-1.5 bg-white rounded-2xl shadow-sm border border-slate-200/80">
              <button
                type="button"
                onClick={() => setTeacherTab('create')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  teacherTab === 'create'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                إعداد وإنشاء اختبار جديد
              </button>

              <button
                type="button"
                onClick={() => setTeacherTab('manage')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  teacherTab === 'manage'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <BookOpen className="w-4 h-4 text-indigo-400" />
                إدارة وسجل اختباراتي ({myQuizzes.length})
              </button>

              <button
                type="button"
                onClick={() => setTeacherTab('archive')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  teacherTab === 'archive'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Library className="w-4 h-4 text-purple-400" />
                أرشيف الاختبارات والمكتبة المركزية
              </button>

              {isSchoolAdmin && (
                <button
                  type="button"
                  onClick={() => setTeacherTab('roster')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    teacherTab === 'roster'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Users className="w-4 h-4 text-emerald-400" />
                  إدارة الطلاب والمعلمين (Excel) ({roster.length})
                </button>
              )}

              <button
                type="button"
                onClick={() => setTeacherTab('analytics')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  teacherTab === 'analytics'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-amber-400" />
                رصد وإحصائيات الطلاب
              </button>
            </div>

            {/* Tab 1: Create Quiz */}
            {teacherTab === 'create' && (
              <div className="space-y-6 animate-fadeIn relative">
                {isQuizzesLoading && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl border border-slate-100">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                    <span className="text-slate-600 text-sm font-bold">جاري جلب الاختبارات...</span>
                  </div>
                )}
                <QuizMetadataForm
                  metadata={currentQuizMeta}
                  onChange={setCurrentQuizMeta}
                />

                <SmartTextParserEditor
                  onQuestionsParsed={handleQuestionsParsed}
                />

                <FormQuestionBuilder
                  questions={parsedQuestions}
                  onChange={setParsedQuestions}
                />

                {/* Save Bar (Static at bottom of creation form) */}
                <div className="p-5 bg-white rounded-2xl shadow-md border border-slate-200 flex flex-wrap items-center justify-between gap-3 mt-6">
                  <div className="text-xs font-bold text-slate-700">
                    عدد الأسئلة الجاهزة للحفظ: <span className="text-emerald-600 text-sm font-extrabold">{parsedQuestions.length}</span> سؤالاً
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveQuiz}
                    disabled={parsedQuestions.length === 0 || isSavingQuiz}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 disabled:opacity-50 transition-all transform hover:scale-105"
                  >
                    {isSavingQuiz ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isSavingQuiz ? 'جاري الحفظ...' : 'حفظ الاختبار نهائياً (مزامنة واحدة)'}
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Manage Quizzes */}
            {teacherTab === 'manage' && (
              <QuizListManager
                quizzes={myQuizzes}
                submissions={allSubmissions}
                onSelectQuiz={(quiz) => {
                  setCurrentQuizMeta(quiz);
                  setParsedQuestions(quiz.questions || []);
                  setTeacherTab('create');
                  setSaveMessage(`تم تحميل اختبار (${quiz.title}) في نموذج التعديل لتمكينك من تحديثه وإعادة حفظه بنفس الرابط.`);
                  setTimeout(() => setSaveMessage(null), 5000);
                }}
                onPreviewQuiz={(quiz) => {
                  setActiveStudentQuiz(quiz);
                  setRole('student');
                }}
                onViewAnalytics={(quiz) => {
                  setSelectedQuizForAnalytics(quiz);
                  setTeacherTab('analytics');
                }}
                onDeleteSuccess={() => {
                  SmartCache.invalidateAll();
                  loadQuizzes(true);
                }}
                onRefresh={() => loadQuizzes(true)}
                currentPage={quizzesPage}
                totalPages={quizzesTotalPages}
                onPageChange={(p) => {
                  setQuizzesPage(p);
                  loadQuizzes(false, p);
                }}
              />
            )}

            {/* Tab 3: Quiz Archive & Library */}
            {teacherTab === 'archive' && (
              <QuizArchive
                quizzes={savedQuizzes}
                teacherProfile={teacherProfile}
                onSelectQuizToEdit={(quiz) => {
                  setCurrentQuizMeta(quiz);
                  setParsedQuestions(quiz.questions || []);
                  setTeacherTab('create');
                  setSaveMessage(`تم تحميل اختبار (${quiz.title}) للتعديل بنفس الرابط.`);
                  setTimeout(() => setSaveMessage(null), 5000);
                }}
                onCloneQuiz={(quiz) => {
                  const cloned: Partial<QuizMetadata> = {
                    ...quiz,
                    id: undefined,
                    title: `${quiz.title} (نسخة جديدة)`,
                    createdAt: new Date().toISOString().split('T')[0],
                    teacherName: teacherProfile?.teacherName || quiz.teacherName,
                    schoolName: teacherProfile?.schoolName || quiz.schoolName,
                    branch: teacherProfile?.branch || quiz.branch,
                  };
                  setCurrentQuizMeta(cloned);
                  setParsedQuestions(quiz.questions || []);
                  setTeacherTab('create');
                  setSaveMessage(`تم إنشاء نسخة جديدة من اختبار (${quiz.title}) في المحرر. يمكنك تعديله وحفظه كاختبار جديد تماماً.`);
                  setTimeout(() => setSaveMessage(null), 5000);
                }}
                onPreviewQuiz={(quiz) => {
                  setActiveStudentQuiz(quiz);
                  setRole('student');
                }}
                onViewAnalytics={(quiz) => {
                  setSelectedQuizForAnalytics(quiz);
                  setTeacherTab('analytics');
                }}
              />
            )}

            {/* Tab 4: Analytics */}
            {teacherTab === 'analytics' && (
              <AnalyticsDashboard
                quiz={selectedQuizForAnalytics}
                quizzes={myQuizzes}
                roster={roster}
                allSubmissions={allSubmissions}
                teacherProfile={teacherProfile}
                onBack={() => setTeacherTab('manage')}
              />
            )}

            {/* Tab 5: Roster Management (Excel Import & ID Generation) */}
            {teacherTab === 'roster' && (
              <RosterManager
                roster={roster}
                onUpdateRoster={handleUpdateRoster}
                currentSchoolName={teacherProfile?.schoolName}
                currentBranch={teacherProfile?.branch}
                currentGrade={teacherProfile?.grade}
                currentSection={teacherProfile?.section}
                teacherProfile={teacherProfile}
                isAdmin={isAdminAuthenticated}
                onRefreshRoster={() => {
                  SmartCache.invalidateAll();
                  loadRosterFromFirebase(true);
                }}
                currentPage={rosterPage}
                totalPages={rosterTotalPages}
                onPageChange={(p) => {
                  setRosterPage(p);
                  loadRosterFromFirebase(false, p);
                }}
              />
            )}
          </div>
        )}

        {/* STUDENT PORTAL MODE */}
        {role === 'student' && (
          <div>
            {showStudentArchive ? (
              <StudentArchive
                quizzes={savedQuizzes}
                submissions={allSubmissions}
                studentInfo={studentInfo}
                onSelectQuiz={(q, isStateless, existingSub, viewMode) => {
                  setActiveStudentQuiz(q);
                  setIsStatelessSelectedQuiz(!!isStateless);
                  setActiveExistingSubmission(existingSub || null);
                  setStudentQuizInitialViewMode(viewMode || 'take');
                  setShowStudentArchive(false);
                }}
                onBack={() => setShowStudentArchive(false)}
              />
            ) : !activeStudentQuiz ? (
              <div className="max-w-xl mx-auto bg-white rounded-3xl p-6 shadow-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-8 h-8 text-indigo-600" />
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">بوابة الطالب التفاعلية واللامركزية</h3>
                      <p className="text-xs text-slate-500">اختر الاختبار التفاعلي أو التدريب العام بدون إجهاد الخادم</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowStudentArchive(true)}
                    className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    <span>أرشيف التكاليف والاختبارات العامة</span>
                  </button>
                </div>

                {savedQuizzes.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                    <p>لا يوجد أي اختبار نشط متاح حالياً. يرجى طلب رابط الاختبار من المعلم.</p>
                    <button
                      type="button"
                      onClick={() => setShowStudentArchive(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs cursor-pointer"
                    >
                      تصفح أرشيف الاختبارات والمدرسة
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedQuizzes.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          setActiveStudentQuiz(q);
                          setIsStatelessSelectedQuiz(false);
                        }}
                        className="w-full p-4 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded-2xl text-right transition-all flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <div className="font-extrabold text-slate-900 text-sm">{q.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {q.subject} - الصف: {q.grade} | المعلم: {q.teacherName}
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm">
                          ابدأ الحل
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : !studentInfo ? (
              <StudentLoginForm
                quiz={activeStudentQuiz}
                roster={roster}
                onStartQuiz={setStudentInfo}
                onUpdateRosterUser={handleUpdateSingleRosterUser}
              />
            ) : (
              <StudentQuizContainer
                quiz={activeStudentQuiz}
                studentInfo={studentInfo}
                isStatelessPublic={isStatelessSelectedQuiz}
                existingSubmission={activeExistingSubmission}
                initialViewMode={studentQuizInitialViewMode}
                onFinish={() => {
                  setStudentInfo(null);
                  setActiveStudentQuiz(null);
                  setIsStatelessSelectedQuiz(false);
                  setActiveExistingSubmission(null);
                  setStudentQuizInitialViewMode('take');
                  loadSubmissions();
                  if (!isStudentOnlyMode) {
                    setRole('teacher');
                  }
                }}
              />
            )}
          </div>
        )}
      </main>

      {/* Mandatory Footer Branding */}
      <FooterBranding />

      {/* PWA Update Listener & Forced Update Notification */}
      <PWAUpdatePrompt />

      {/* Stage 17: License Expiration & Smart Warning Modal System */}
      <SubscriptionExpirationModal
        teacherProfile={teacherProfile}
        userType={role}
      />
    </div>
  );
}
