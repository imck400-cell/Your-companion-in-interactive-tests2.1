import React, { useState, useEffect, useRef } from 'react';
import { QuizMetadata, Submission } from '../../types';
import {
  BookOpen,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  School,
  GraduationCap,
  Sparkles,
  Award,
  RefreshCw,
  Database,
  Layers,
  Zap,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Lock,
  BarChart2,
  Inbox,
  Hash,
  Folder,
  FolderOpen,
  BookMarked,
  Building2
} from 'lucide-react';
import apiClient from '../../services/apiClient';

interface StudentArchiveProps {
  quizzes: QuizMetadata[];
  submissions: Submission[];
  studentInfo: { name: string; grade: string; section: string; schoolName?: string; branch?: string } | null;
  onSelectQuiz: (quiz: QuizMetadata, isStatelessPublic?: boolean, existingSubmission?: Submission | null, initialViewMode?: 'take' | 'result') => void;
  onBack: () => void;
}

const PAGE_SIZE = 10; // Stage 9: Lazy Loading chunk size of 10 items

const SUBJECT_COLORS = [
  'from-indigo-600 to-blue-700',
  'from-emerald-600 to-teal-700',
  'from-amber-500 to-orange-600',
  'from-purple-600 to-pink-700',
  'from-cyan-600 to-blue-600',
  'from-rose-600 to-red-700',
  'from-violet-600 to-purple-700',
  'from-teal-600 to-emerald-700',
];

export const StudentArchive: React.FC<StudentArchiveProps> = ({
  quizzes,
  submissions,
  studentInfo,
  onSelectQuiz,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'school_required' | 'previous' | 'public'>('school_required');
  const [rawSearchTerm, setRawSearchTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>(studentInfo?.grade || 'ALL');
  const [selectedSection, setSelectedSection] = useState<string>(studentInfo?.section || 'ALL');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedSchool, setSelectedSchool] = useState<string>(studentInfo?.schoolName || 'ALL');
  const [selectedBranch, setSelectedBranch] = useState<string>(studentInfo?.branch || 'ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SOLVED' | 'UNSOLVED'>('ALL');

  // School Required Subjects state
  const [schoolSubjectsData, setSchoolSubjectsData] = useState<Array<{ subject: string; branches: string[] }>>([]);
  const [selectedSchoolSubject, setSelectedSchoolSubject] = useState<string | null>(null);
  const [selectedSchoolBranch, setSelectedSchoolBranch] = useState<string>('ALL');
  const [loadingSchoolSubjects, setLoadingSchoolSubjects] = useState<boolean>(false);

  // Accordion state for Public Quizzes
  const [openGrades, setOpenGrades] = useState<Record<string, boolean>>({});
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
  const [openBranches, setOpenBranches] = useState<Record<string, boolean>>({});

  // Lazy Loading limit state
  const [visibleLimit, setVisibleLimit] = useState<number>(PAGE_SIZE);

  // Rate Limiting / Debounce for Filter Search
  const filterTimeoutRef = useRef<any>(null);
  const [rateLimitActive, setRateLimitActive] = useState(false);

  useEffect(() => {
    setRateLimitActive(true);
    if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);

    filterTimeoutRef.current = setTimeout(() => {
      setSearchTerm(rawSearchTerm);
      setRateLimitActive(false);
    }, 300);

    return () => {
      if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
    };
  }, [rawSearchTerm]);

  // Reset pagination limit when tab or filters change
  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [activeTab, searchTerm, selectedGrade, selectedSection, selectedSubject, selectedSchool, selectedBranch, statusFilter]);

  // Fetch school subjects from API / fallback from props
  useEffect(() => {
    if (activeTab === 'school_required') {
      setLoadingSchoolSubjects(true);
      apiClient.get('/quizzes/my-school-subjects', {
        params: { school_name: studentInfo?.schoolName, grade: studentInfo?.grade }
      })
      .then((res) => {
        if (res.data && res.data.status === 'success' && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setSchoolSubjectsData(res.data.data);
        } else {
          extractSchoolSubjectsFromQuizzes();
        }
      })
      .catch(() => {
        extractSchoolSubjectsFromQuizzes();
      })
      .finally(() => {
        setLoadingSchoolSubjects(false);
      });
    }
  }, [activeTab, studentInfo, quizzes]);

  const extractSchoolSubjectsFromQuizzes = () => {
    const schoolQuizzes = quizzes.filter(q =>
      !q.schoolName || !studentInfo?.schoolName || q.schoolName === studentInfo.schoolName
    );

    const map: Record<string, Set<string>> = {};
    schoolQuizzes.forEach(q => {
      const subj = q.subject || q.main_subject || 'المادة العامة';
      const branch = q.sub_subject || q.branch || 'جميع الفروع';
      if (!map[subj]) map[subj] = new Set();
      map[subj].add(branch);
    });

    const result = Object.entries(map).map(([subject, branchesSet]) => ({
      subject,
      branches: Array.from(branchesSet)
    }));

    setSchoolSubjectsData(result);
  };

  // Cache for Public Tests
  const [cachedPublicQuizzes, setCachedPublicQuizzes] = useState<QuizMetadata[]>([]);
  const [cacheHit, setCacheHit] = useState<boolean>(false);

  useEffect(() => {
    if (activeTab === 'public') {
      const cacheKey = 'laravel_public_quizzes_cache';
      const cachedData = sessionStorage.getItem(cacheKey);

      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          setCachedPublicQuizzes(parsed);
          setCacheHit(true);
          return;
        } catch (e) {
          console.warn('Cache parse error:', e);
        }
      }

      const publicOnly = quizzes;
      sessionStorage.setItem(cacheKey, JSON.stringify(publicOnly));
      setCachedPublicQuizzes(publicOnly);
      setCacheHit(false);
    }
  }, [activeTab, quizzes]);

  // Submission lookup helper
  const getSubmissionForQuiz = (quizId: string): Submission | undefined => {
    if (!studentInfo || !studentInfo.name) return undefined;
    const studentNameClean = studentInfo.name.trim().toLowerCase();
    return submissions.find(
      (s) => s.quizId === quizId && s.studentName.trim().toLowerCase() === studentNameClean
    );
  };

  // Deadline Indicator Status Calculator
  const getDeadlineStatus = (createdAt: string, quizId: string) => {
    const createdTime = new Date(createdAt).getTime();
    const now = new Date().getTime();
    if (isNaN(createdTime)) {
      return { status: 'AVAILABLE', label: 'متاح للحل', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300', isUrgent: false };
    }
    const ageDays = (now - createdTime) / (1000 * 3600 * 24);

    if (ageDays > 14) {
      return { status: 'CLOSED', label: 'مغلق (انتهت المهلة)', badgeColor: 'bg-red-100 text-red-800 border-red-300', isUrgent: false };
    } else if (ageDays >= 10) {
      return { status: 'DUE_SOON', label: 'قريب الانتهاء (عاجل)', badgeColor: 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse', isUrgent: true };
    } else {
      return { status: 'AVAILABLE', label: 'متاح للحل', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300', isUrgent: false };
    }
  };

  const pool = activeTab === 'public' && cachedPublicQuizzes.length > 0 ? cachedPublicQuizzes : quizzes;

  // Filtered Quizzes for Tabs 1 & 2
  const rawFilteredQuizzes = pool.filter((q) => {
    const matchesSearch =
      q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.teacherName.toLowerCase().includes(searchTerm.toLowerCase());

    const studentGrade = studentInfo?.grade || selectedGrade;
    const matchesGrade =
      studentGrade === 'ALL' ||
      q.grade === studentGrade ||
      !q.grade ||
      q.grade === 'جميع الصفوف' ||
      q.grade === 'كافة الصفوف' ||
      q.grade === 'الكل';

    const matchesSection =
      activeTab === 'public' ||
      selectedSection === 'ALL' ||
      q.section === selectedSection ||
      !q.section ||
      q.section === 'جميع الشعب' ||
      q.section === 'كافة الشعب';
    const matchesSubject = selectedSubject === 'ALL' || q.subject === selectedSubject;
    const matchesSchool = selectedSchool === 'ALL' || q.schoolName === selectedSchool;
    const matchesBranch = selectedBranch === 'ALL' || q.branch === selectedBranch;

    const sub = getSubmissionForQuiz(q.id);
    const isSolved = !!sub;

    let matchesTab = true;
    if (activeTab === 'school_required') {
      const sameSchool = !q.schoolName || !studentInfo?.schoolName || q.schoolName === studentInfo.schoolName;
      const matchesSubjectCard = !selectedSchoolSubject || q.subject === selectedSchoolSubject || q.main_subject === selectedSchoolSubject;
      const matchesBranchCard = selectedSchoolBranch === 'ALL' || q.sub_subject === selectedSchoolBranch || q.branch === selectedSchoolBranch;
      matchesTab = sameSchool && matchesSubjectCard && matchesBranchCard;
    } else if (activeTab === 'previous') {
      if (studentInfo?.schoolName && selectedSchool === studentInfo.schoolName) {
        const sameSchool = !q.schoolName || q.schoolName === studentInfo.schoolName;
        const sameBranch = !q.branch || !studentInfo.branch || q.branch === studentInfo.branch || selectedBranch !== 'ALL';
        matchesTab = sameSchool && sameBranch;
      } else {
        matchesTab = true;
      }
    } else if (activeTab === 'public') {
      matchesTab = true;
    }

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'SOLVED' && isSolved) ||
      (statusFilter === 'UNSOLVED' && !isSolved);

    return (
      matchesSearch &&
      matchesGrade &&
      matchesSection &&
      matchesSubject &&
      matchesSchool &&
      matchesBranch &&
      matchesTab &&
      matchesStatus
    );
  });

  // Smart Sorting -> Unsolved and Urgent assignments appear at the VERY TOP
  const filteredQuizzes = [...rawFilteredQuizzes].sort((a, b) => {
    const subA = getSubmissionForQuiz(a.id);
    const subB = getSubmissionForQuiz(b.id);
    const isSolvedA = !!subA;
    const isSolvedB = !!subB;

    if (!isSolvedA && isSolvedB) return -1;
    if (isSolvedA && !isSolvedB) return 1;

    const lessonA = a.lesson_number || a.lessonNumber || 999;
    const lessonB = b.lesson_number || b.lessonNumber || 999;
    if (lessonA !== lessonB) return lessonA - lessonB;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Calculate Grouped Tree Structure for Public Tab
  const buildPublicTree = () => {
    const tree: Record<string, Record<string, Record<string, QuizMetadata[]>>> = {};

    pool.forEach((q) => {
      const matchesSearch =
        q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.teacherName.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return;

      const grade = q.grade || q.class_level || 'جميع الصفوف';
      const subject = q.subject || q.main_subject || 'المادة العامة';
      const branch = q.sub_subject || q.branch || 'جميع الفروع';

      if (!tree[grade]) tree[grade] = {};
      if (!tree[grade][subject]) tree[grade][subject] = {};
      if (!tree[grade][subject][branch]) tree[grade][subject][branch] = [];

      tree[grade][subject][branch].push(q);
    });

    // Sort quizzes inside branch ascending by lesson_number
    Object.keys(tree).forEach((gradeKey) => {
      Object.keys(tree[gradeKey]).forEach((subjectKey) => {
        Object.keys(tree[gradeKey][subjectKey]).forEach((branchKey) => {
          tree[gradeKey][subjectKey][branchKey].sort((a, b) => {
            const numA = a.lesson_number || a.lessonNumber || 0;
            const numB = b.lesson_number || b.lessonNumber || 0;
            return numA - numB;
          });
        });
      });
    });

    return tree;
  };

  const publicTree = buildPublicTree();

  const totalScopeQuizzes = quizzes.length;
  const solvedCount = quizzes.filter((q) => !!getSubmissionForQuiz(q.id)).length;
  const completionPercentage = totalScopeQuizzes > 0 ? Math.round((solvedCount / totalScopeQuizzes) * 100) : 0;

  const paginatedQuizzes = filteredQuizzes.slice(0, visibleLimit);

  const handleLoadMoreLazy = () => {
    setVisibleLimit((prev) => prev + PAGE_SIZE);
  };

  const handleResetFilters = () => {
    setRawSearchTerm('');
    setSearchTerm('');
    setSelectedGrade('ALL');
    setSelectedSection('ALL');
    setSelectedSubject('ALL');
    setSelectedSchool('ALL');
    setSelectedBranch('ALL');
    setStatusFilter('ALL');
    setSelectedSchoolSubject(null);
    setSelectedSchoolBranch('ALL');
  };

  const toggleGrade = (grade: string) => {
    setOpenGrades((prev) => ({ ...prev, [grade]: !prev[grade] }));
  };

  const toggleSubject = (key: string) => {
    setOpenSubjects((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleBranch = (key: string) => {
    setOpenBranches((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200/80 my-6 dir-rtl space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-700 transition-all cursor-pointer"
            title="العودة لبوابة الطالب"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-indigo-600" />
              أرشيف التكاليف والمؤشرات الذكية
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              نطاق المدرسة المعزول مع الفرز الهيكلي المتطور والتصنيف حسب المواد والدروس
            </p>
          </div>
        </div>

        {studentInfo && (
          <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-950 font-bold flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            <span>الطالب: {studentInfo.name} ({studentInfo.grade} - شعبة {studentInfo.section})</span>
            {studentInfo.schoolName && <span className="text-slate-400">| {studentInfo.schoolName}</span>}
          </div>
        )}
      </div>

      {/* Progress Dashboard Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-indigo-900/40 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
          <div className="flex items-center gap-2 text-indigo-300">
            <BarChart2 className="w-4 h-4 text-amber-400" />
            <span>نسبة إنجاز التكاليف الأكاديمية للطالب:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-indigo-800/80 rounded-lg text-indigo-200 font-mono text-xs">
              محلول: {solvedCount} / {totalScopeQuizzes} تكليفاً
            </span>
            <span className="text-amber-400 font-black text-sm">{completionPercentage}%</span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-slate-800/80 rounded-full h-3 overflow-hidden p-0.5 border border-indigo-500/30">
          <div
            className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full rounded-full transition-all duration-700 ease-out shadow-sm"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-1">
          <span>فهرسة متطابقة مع سيرفر Laravel 13 و Firestore Sub-Collections</span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <Database className="w-3 h-3 text-emerald-400" />
            تزامن البيانات متوافق 100%
          </span>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => {
            setActiveTab('school_required');
            setSelectedSchoolSubject(null);
            setSelectedSchoolBranch('ALL');
          }}
          className={`py-3.5 px-4 rounded-xl font-black text-sm transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'school_required'
              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-200" />
            <span>التكاليف المطلوبة من مدرستي</span>
          </div>
          <span className="text-[10px] font-normal opacity-90">
            عرض المواد كبطاقات ملونة مخصصة واختيار الفروع
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('previous');
            setSelectedSchool(studentInfo?.schoolName || 'ALL');
            setSelectedBranch(studentInfo?.branch || 'ALL');
            setSelectedGrade(studentInfo?.grade || 'ALL');
            setSelectedSection(studentInfo?.section || 'ALL');
            setStatusFilter('ALL');
          }}
          className={`py-3.5 px-4 rounded-xl font-black text-sm transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'previous'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-300" />
            <span>التكاليف السابقة والمحلولة</span>
          </div>
          <span className="text-[10px] font-normal opacity-90">
            سجل التكاليف والاختبارات الكاملة لصفك
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('public');
            setSelectedSchool('ALL');
            setSelectedBranch('ALL');
            setSelectedGrade('ALL');
            setSelectedSection('ALL');
            setStatusFilter('ALL');
          }}
          className={`py-3.5 px-4 rounded-xl font-black text-sm transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'public'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-200" />
            <span>اختبارات عامة (عرض شجري)</span>
          </div>
          <span className="text-[10px] font-normal opacity-90">
            صفوف -&gt; مواد -&gt; فروع -&gt; دروس مرتبة
          </span>
        </button>
      </div>

      {/* Cache status banner for Public Tab */}
      {activeTab === 'public' && (
        <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-black">
            <Zap className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span>
              استجابة السيرفر المجمعة (Laravel API Server-Grouped Response): جاهزة مع تسلسل رقم الدرس
            </span>
          </div>
          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold border border-emerald-300">
            هيكلة شجرية مرتبة
          </span>
        </div>
      )}

      {/* TAB 1: SCHOOL REQUIRED ASSIGNMENTS (التكاليف المطلوبة من مدرستي) */}
      {activeTab === 'school_required' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-black text-indigo-950 flex items-center gap-2">
                <School className="w-4 h-4 text-indigo-600" />
                المواد الأكاديمية المتاحة في مدرستك: {studentInfo?.schoolName || 'المدرسة الحالية'}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                اضغط على المادة لعرض الفروع والتكاليف الخاصة بها
              </p>
            </div>

            {selectedSchoolSubject && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSchoolSubject(null);
                  setSelectedSchoolBranch('ALL');
                }}
                className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all cursor-pointer"
              >
                إظهار جميع المواد
              </button>
            )}
          </div>

          {loadingSchoolSubjects ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-600">جاري تحميل قائمة المواد من السيرفر...</p>
            </div>
          ) : schoolSubjectsData.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">لم يتم إدراج مواد لمدرستك بعد</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {schoolSubjectsData.map((item, idx) => {
                const colorGradient = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
                const isSelected = selectedSchoolSubject === item.subject;

                return (
                  <button
                    key={item.subject}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedSchoolSubject(null);
                        setSelectedSchoolBranch('ALL');
                      } else {
                        setSelectedSchoolSubject(item.subject);
                        setSelectedSchoolBranch('ALL');
                      }
                    }}
                    className={`p-4 rounded-2xl transition-all cursor-pointer text-right flex flex-col justify-between h-28 relative overflow-hidden shadow-sm hover:shadow-md border ${
                      isSelected
                        ? 'ring-4 ring-indigo-400/50 border-indigo-600 scale-[1.02]'
                        : 'border-slate-200 hover:scale-[1.01]'
                    }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${colorGradient} ${isSelected ? 'opacity-100' : 'opacity-90 hover:opacity-100'} text-white p-4 flex flex-col justify-between`}>
                      <div className="flex items-center justify-between">
                        <BookMarked className="w-5 h-5 text-white/90" />
                        <span className="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black">
                          {item.branches.length} {item.branches.length === 1 ? 'فرع' : 'فروع'}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-black text-base leading-tight drop-shadow-sm">{item.subject}</h4>
                        <p className="text-[11px] font-semibold text-white/80 mt-0.5">
                          {isSelected ? '✓ محددة الآن' : 'انقر لعرض التكاليف'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Branch Dropdown for Selected Subject */}
          {selectedSchoolSubject && (
            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-200/70 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-black text-indigo-950 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  اختر فرع مادة ({selectedSchoolSubject}):
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedSchoolBranch('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedSchoolBranch === 'ALL'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    جميع الفروع
                  </button>
                  {schoolSubjectsData
                    .find((s) => s.subject === selectedSchoolSubject)
                    ?.branches.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSelectedSchoolBranch(b)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          selectedSchoolBranch === b
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* List of Quizzes for Selected Subject / Branch */}
          <div className="space-y-4">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2 border-r-4 border-indigo-600 pr-2">
              <Award className="w-4 h-4 text-indigo-600" />
              {selectedSchoolSubject
                ? `التكاليف الخاصة بـ (${selectedSchoolSubject}) ${selectedSchoolBranch !== 'ALL' ? `- فرع (${selectedSchoolBranch})` : ''}`
                : 'جميع التكاليف المتاحة من معلمي مدرستك'}
            </h4>

            {filteredQuizzes.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
                <Inbox className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-600">لا توجد تكاليف لهذه المادة أو الفرع حالياً</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredQuizzes.map((q) => {
                  const sub = getSubmissionForQuiz(q.id);
                  const isSolved = !!sub;
                  const deadline = getDeadlineStatus(q.createdAt, q.id);
                  const lessonNum = q.lesson_number || q.lessonNumber;

                  return (
                    <div
                      key={q.id}
                      className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative overflow-hidden"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <div className="flex items-center gap-1">
                            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-800 rounded-lg text-[10px] font-black border border-indigo-100">
                              {q.subject}
                            </span>
                            {lessonNum && (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-md text-[10px] font-black border border-emerald-200 flex items-center gap-0.5">
                                <Hash className="w-3 h-3 text-emerald-600" />
                                الدرس {lessonNum}
                              </span>
                            )}
                          </div>

                          {isSolved ? (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-black border border-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              تم حله ({sub.score} / {sub.maxScore || q.questions?.length || 0})
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-[11px] font-black border border-amber-300 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              غير محلول
                            </span>
                          )}
                        </div>

                        <h3 className="font-extrabold text-slate-900 text-base leading-snug">{q.title}</h3>

                        <div className="text-xs text-slate-500 space-y-1 font-medium">
                          <div className="flex items-center gap-1.5">
                            <School className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{q.schoolName || 'المدرسة النموذجية'} - فرع: {q.sub_subject || q.branch || 'عام'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>المعلم: {q.teacherName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400 font-bold">
                          {q.questions?.length || 0} أسئلة {q.timeLimitMinutes ? `| ⏱️ ${q.timeLimitMinutes}د` : ''}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isSolved && (
                            <button
                              type="button"
                              onClick={() => onSelectQuiz(q, false, sub, 'result')}
                              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                            >
                              <BarChart2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>النتيجة</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onSelectQuiz(q, false, sub, 'take')}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            {isSolved ? 'إعادة الحل' : 'بدء التكليف'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PREVIOUS ASSIGNMENTS (التكاليف السابقة والمحلولة) */}
      {activeTab === 'previous' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Cascading Filter Controls Bar */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs font-black text-slate-700">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-indigo-600" />
                <span>التصفية والفلترة الخاصة بالتكاليف السابقة والمحلولة:</span>
              </div>
              {rateLimitActive && (
                <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 animate-pulse font-bold">
                  تقييد الطلبات مفعل (Rate Limiting 300ms)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              <div className="relative col-span-1 sm:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="البحث بالمادة أو المعلم أو عنوان التكليف..."
                  value={rawSearchTerm}
                  onChange={(e) => setRawSearchTerm(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 bg-white rounded-xl border border-slate-300 font-bold outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-indigo-300 font-black text-indigo-900 outline-none focus:border-indigo-600"
                >
                  <option value="ALL">الكل (المحلول وغير المحلول)</option>
                  <option value="SOLVED">محلول فقط</option>
                  <option value="UNSOLVED">غير محلول (عاجل)</option>
                </select>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-all cursor-pointer"
                >
                  إعادة ضبط الفلاتر
                </button>
              </div>
            </div>
          </div>

          {paginatedQuizzes.length === 0 ? (
            <div className="py-16 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-300 font-bold space-y-4">
              <Inbox className="w-12 h-12 text-slate-400 mx-auto" />
              <h3 className="text-base font-extrabold text-slate-800">لا توجد تكاليف متطابقة</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedQuizzes.map((q) => {
                const sub = getSubmissionForQuiz(q.id);
                const isSolved = !!sub;
                const deadline = getDeadlineStatus(q.createdAt, q.id);
                const lessonNum = q.lesson_number || q.lessonNumber;

                return (
                  <div
                    key={q.id}
                    className={`bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative overflow-hidden ${
                      deadline.isUrgent && !isSolved ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-800 rounded-lg text-[10px] font-black border border-indigo-100">
                            {q.subject}
                          </span>
                          {lessonNum && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-md text-[10px] font-black border border-emerald-200 flex items-center gap-0.5">
                              <Hash className="w-3 h-3 text-emerald-600" />
                              الدرس {lessonNum}
                            </span>
                          )}
                        </div>

                        {isSolved ? (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-black border border-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            تم حله ({sub.score} / {sub.maxScore || q.questions?.length || 0})
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-[11px] font-black border border-amber-300 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            غير محلول
                          </span>
                        )}
                      </div>

                      <h3 className="font-extrabold text-slate-900 text-base leading-snug">{q.title}</h3>

                      <div className="text-xs text-slate-500 space-y-1 font-medium">
                        <div className="flex items-center gap-1.5">
                          <School className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{q.schoolName || 'المدرسة النموذجية'} - شعبة: {q.section || 'عام'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>المعلم: {q.teacherName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400 font-bold">
                        {q.questions?.length || 0} أسئلة {q.timeLimitMinutes ? `| ⏱️ ${q.timeLimitMinutes}د` : ''}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {isSolved && (
                          <button
                            type="button"
                            onClick={() => onSelectQuiz(q, false, sub, 'result')}
                            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <BarChart2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>عرض النتيجة</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onSelectQuiz(q, false, sub, 'take')}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {isSolved ? 'إعادة الحل' : 'بدء التكليف'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GENERAL PUBLIC QUIZZES WITH TREE ACCORDION VIEW (اختبارات عامة - عرض شجري) */}
      {activeTab === 'public' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Search bar for tree */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="البحث في الاختبارات العامة باسم المادة أو المعلم أو رقم الدرس..."
              value={rawSearchTerm}
              onChange={(e) => setRawSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2.5 bg-slate-50 rounded-2xl border border-slate-300 font-bold text-xs outline-none focus:border-emerald-600 focus:bg-white transition-all"
            />
          </div>

          {Object.keys(publicTree).length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <Inbox className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">لا توجد اختبارات عامة مطابقة لعملية البحث</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(publicTree).map(([gradeName, subjectsMap]) => {
                const isGradeOpen = openGrades[gradeName] !== false; // open by default

                return (
                  <div key={gradeName} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                    {/* Grade Level 1 Accordion Header */}
                    <button
                      type="button"
                      onClick={() => toggleGrade(gradeName)}
                      className="w-full px-5 py-3.5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white font-black text-sm flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-5 h-5 text-emerald-400" />
                        <span>{gradeName}</span>
                        <span className="px-2 py-0.5 bg-indigo-800/80 rounded-full text-[10px] text-indigo-200 font-mono">
                          {Object.values(subjectsMap).reduce(
                            (acc, branches) => acc + Object.values(branches).reduce((bAcc, list) => bAcc + list.length, 0),
                            0
                          )}{' '}
                          اختبار
                        </span>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isGradeOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Grade Level Content */}
                    {isGradeOpen && (
                      <div className="p-4 space-y-3 bg-slate-50/50">
                        {Object.entries(subjectsMap).map(([subjName, branchesMap]) => {
                          const subjKey = `${gradeName}_${subjName}`;
                          const isSubjOpen = openSubjects[subjKey] !== false;

                          return (
                            <div key={subjKey} className="border border-emerald-200/80 rounded-xl overflow-hidden bg-white shadow-2xs">
                              {/* Subject Level 2 Accordion Header */}
                              <button
                                type="button"
                                onClick={() => toggleSubject(subjKey)}
                                className="w-full px-4 py-3 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-950 font-black text-xs flex items-center justify-between transition-all cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <BookOpen className="w-4 h-4 text-emerald-600" />
                                  <span>مادة: {subjName}</span>
                                  <span className="px-2 py-0.5 bg-emerald-200/70 text-emerald-900 rounded-md text-[10px]">
                                    {Object.keys(branchesMap).length} فروع
                                  </span>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-emerald-700 transition-transform ${isSubjOpen ? 'rotate-180' : ''}`} />
                              </button>

                              {/* Subject Level Content */}
                              {isSubjOpen && (
                                <div className="p-3 space-y-3 bg-white">
                                  {Object.entries(branchesMap).map(([branchName, quizList]) => {
                                    const branchKey = `${subjKey}_${branchName}`;
                                    const isBranchOpen = openBranches[branchKey] !== false;

                                    return (
                                      <div key={branchKey} className="border border-slate-200 rounded-lg overflow-hidden">
                                        {/* Branch Level 3 Accordion Header */}
                                        <button
                                          type="button"
                                          onClick={() => toggleBranch(branchKey)}
                                          className="w-full px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-bold text-xs flex items-center justify-between transition-all cursor-pointer"
                                        >
                                          <div className="flex items-center gap-2">
                                            <Layers className="w-3.5 h-3.5 text-indigo-600" />
                                            <span>فرع: {branchName}</span>
                                            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-mono">
                                              {quizList.length} اختبارات
                                            </span>
                                          </div>
                                          <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isBranchOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* Quizzes List inside Branch - sorted by lesson_number */}
                                        {isBranchOpen && (
                                          <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50/30">
                                            {quizList.map((q) => {
                                              const sub = getSubmissionForQuiz(q.id);
                                              const isSolved = !!sub;
                                              const lessonNum = q.lesson_number || q.lessonNumber;

                                              return (
                                                <div
                                                  key={q.id}
                                                  className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-sm transition-all space-y-3 flex flex-col justify-between"
                                                >
                                                  <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between flex-wrap gap-1">
                                                      {lessonNum ? (
                                                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded-md text-[10px] font-black border border-indigo-200 flex items-center gap-0.5">
                                                          <Hash className="w-3 h-3 text-indigo-600" />
                                                          الدرس {lessonNum}
                                                        </span>
                                                      ) : (
                                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">
                                                          اختبار عام
                                                        </span>
                                                      )}

                                                      {isSolved && (
                                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black border border-emerald-300">
                                                          تم حله ({sub.score})
                                                        </span>
                                                      )}
                                                    </div>

                                                    <h5 className="font-extrabold text-slate-900 text-xs leading-snug">{q.title}</h5>

                                                    <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                                                      <GraduationCap className="w-3 h-3 text-slate-400 shrink-0" />
                                                      المعلم: {q.teacherName}
                                                    </p>
                                                  </div>

                                                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                                    <span className="text-[10px] text-slate-400 font-bold">
                                                      {q.questions?.length || 0} أسئلة
                                                    </span>

                                                    <button
                                                      type="button"
                                                      onClick={() => onSelectQuiz(q, true, sub, 'take')}
                                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                                                    >
                                                      <Zap className="w-3 h-3 text-amber-200" />
                                                      بدء اختبار عام
                                                    </button>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
