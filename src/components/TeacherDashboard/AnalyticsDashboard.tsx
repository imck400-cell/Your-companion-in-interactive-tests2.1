import React, { useState, useEffect } from 'react';
import { QuizMetadata, Submission, RosterUser, TeacherProfile } from '../../types';
import { fetchSubmissionsForQuiz } from '../../services/firebase';
import apiClient from '../../services/apiClient';
import {
  BarChart3,
  Users,
  CheckCircle2,
  XCircle,
  Award,
  Search,
  Download,
  Printer,
  ArrowRight,
  Eye,
  AlertTriangle,
  ArrowUpDown,
  Share2,
  Copy,
  Check,
  ChevronDown,
  BookOpen,
  Layers,
  Sparkles,
  Trophy,
  Building2,
  GraduationCap,
  MessageSquare,
  Hash,
  RefreshCw,
  ExternalLink,
  BookMarked
} from 'lucide-react';

interface AnalyticsDashboardProps {
  quiz?: QuizMetadata | null;
  quizzes?: QuizMetadata[];
  roster?: RosterUser[];
  allSubmissions?: Submission[];
  teacherProfile?: TeacherProfile | null;
  onBack: () => void;
  onSelectQuiz?: (quiz: QuizMetadata) => void;
}

interface TopFailedQuestion {
  question_id: string;
  question_text: string;
  quiz_id?: string;
  quiz_title: string;
  total_attempts: number;
  failed_count: number;
  skipped_count?: number;
  failure_rate: number;
}

interface TopStudent {
  student_id?: string | number;
  student_name: string;
  serial_number?: string;
  grade: string;
  section: string;
  school_name?: string;
  total_score: number;
  total_max_score: number;
  quizzes_completed: number;
  average_percentage: number;
}

interface TreeQuizItem {
  quiz_id: string;
  title: string;
  lesson_number: number;
  subject: string;
  branch: string;
  grade?: string;
  section?: string;
  teacher_name?: string;
  total_required_students: number;
  answered_students_count: number;
  unanswered_students_count: number;
  answered_students: Array<{
    student_id?: string;
    name: string;
    serial_number?: string;
    grade?: string;
    section?: string;
    score: number;
    max_score: number;
    percentage: number;
    passed?: boolean;
    submitted_at?: string;
  }>;
  unanswered_students: Array<{
    id?: string;
    name: string;
    serial_number?: string;
    grade?: string;
    section?: string;
  }>;
}

interface CollectiveReminderStudent {
  student_name: string;
  serial_number?: string;
  grade: string;
  section: string;
  missing_quizzes: Array<{
    quiz_id: string;
    title: string;
    subject: string;
    branch: string;
    lesson_number: number;
  }>;
  missing_quizzes_count: number;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  quiz: initialQuiz,
  quizzes = [],
  roster = [],
  allSubmissions: initialAllSubmissions = [],
  teacherProfile,
  onBack,
  onSelectQuiz,
}) => {
  const [selectedQuiz, setSelectedQuiz] = useState<QuizMetadata | null>(initialQuiz || quizzes[0] || null);
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'quiz_detail' | 'collective'>('hierarchy');

  // Submissions state for selected quiz
  const [quizSubmissions, setQuizSubmissions] = useState<Submission[]>([]);
  const [loadingQuizSubmissions, setLoadingQuizSubmissions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'SCORE_DESC' | 'SCORE_ASC' | 'NAME' | 'TIME'>('SCORE_DESC');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  // Top 5 Performance Data State
  const [topFailedQuestions, setTopFailedQuestions] = useState<TopFailedQuestion[]>([]);
  const [topStudents, setTopStudents] = useState<TopStudent[]>([]);
  const [loadingTopPerf, setLoadingTopPerf] = useState(false);

  // Hierarchy Data State
  const [hierarchyData, setHierarchyData] = useState<Record<string, Record<string, TreeQuizItem[]>>>({});
  const [collectiveReminders, setCollectiveReminders] = useState<CollectiveReminderStudent[]>([]);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);

  // Accordion Expand/Collapse State
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
  const [openBranches, setOpenBranches] = useState<Record<string, boolean>>({});

  // Modals state
  const [answeredModalQuiz, setAnsweredModalQuiz] = useState<TreeQuizItem | null>(null);
  const [unansweredModalQuiz, setUnansweredModalQuiz] = useState<TreeQuizItem | null>(null);

  // Student Profile Analytics Modal state
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<{
    name: string;
    grade?: string;
    section?: string;
    serialNumber?: string;
  } | null>(null);

  // WhatsApp Group Message Modal & Copy Feedback state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [generatedWhatsAppMessage, setGeneratedWhatsAppMessage] = useState('');

  // Synchronize initial quiz prop
  useEffect(() => {
    if (initialQuiz) {
      setSelectedQuiz(initialQuiz);
    }
  }, [initialQuiz]);

  // Load submissions whenever selectedQuiz changes
  useEffect(() => {
    if (selectedQuiz) {
      loadQuizSubmissions(selectedQuiz.id);
    }
  }, [selectedQuiz]);

  // Load Analytics Backend APIs on Mount
  useEffect(() => {
    fetchTopPerformance();
    fetchGeneralStats();
  }, [teacherProfile]);

  const loadQuizSubmissions = async (quizId: string) => {
    setLoadingQuizSubmissions(true);
    try {
      const subs = await fetchSubmissionsForQuiz(quizId);
      setQuizSubmissions(subs);
    } catch (err) {
      console.warn('Fallback to prop submissions:', err);
      const propSubs = initialAllSubmissions.filter((s) => s.quizId === quizId);
      setQuizSubmissions(propSubs);
    } finally {
      setLoadingQuizSubmissions(false);
    }
  };

  // 1. Fetch Top 5 Failed Questions and Top 5 Students
  const fetchTopPerformance = async () => {
    setLoadingTopPerf(true);
    try {
      const schoolName = teacherProfile?.schoolName;
      const res = await apiClient.get('/analytics/top-performance', {
        params: { school_name: schoolName }
      });

      if (res.data && res.data.status === 'success' && res.data.data) {
        setTopFailedQuestions(res.data.data.top_failed_questions || []);
        setTopStudents(res.data.data.top_students || []);
      } else {
        calculateTopPerformanceClientFallback();
      }
    } catch (e) {
      calculateTopPerformanceClientFallback();
    } finally {
      setLoadingTopPerf(false);
    }
  };

  // Client-side Fallback calculation for Top Performance
  const calculateTopPerformanceClientFallback = () => {
    if (initialAllSubmissions.length === 0 && quizSubmissions.length === 0) return;
    const pool = initialAllSubmissions.length > 0 ? initialAllSubmissions : quizSubmissions;

    // Student performance aggregation
    const studentMap: Record<string, TopStudent> = {};
    pool.forEach((s) => {
      const key = s.studentName.trim().toLowerCase();
      if (!studentMap[key]) {
        studentMap[key] = {
          student_name: s.studentName,
          serial_number: s.serialNumber || '-',
          grade: s.grade || 'عام',
          section: s.section || 'عام',
          total_score: 0,
          total_max_score: 0,
          quizzes_completed: 0,
          average_percentage: 0,
        };
      }
      studentMap[key].total_score += s.score || 0;
      studentMap[key].total_max_score += s.maxScore || 100;
      studentMap[key].quizzes_completed += 1;
    });

    const studentList = Object.values(studentMap).map((st) => {
      const avg = st.total_max_score > 0 ? Math.round((st.total_score / st.total_max_score) * 100) : 0;
      return { ...st, average_percentage: avg };
    });

    studentList.sort((a, b) => b.total_score - a.total_score);
    setTopStudents(studentList.slice(0, 5));

    // Question failure rate aggregation
    const qMap: Record<string, TopFailedQuestion> = {};
    pool.forEach((s) => {
      s.details?.forEach((dt, idx) => {
        const qId = dt.questionId || `${s.quizId}_${idx}`;
        const quizObj = quizzes.find((q) => q.id === s.quizId);
        const quizTitle = quizObj?.title || s.quizTitle || 'اختبار مدرسة';

        if (!qMap[qId]) {
          qMap[qId] = {
            question_id: qId,
            question_text: dt.questionText || `سؤال #${idx + 1}`,
            quiz_title: quizTitle,
            total_attempts: 0,
            failed_count: 0,
            failure_rate: 0,
          };
        }
        qMap[qId].total_attempts += 1;
        if (!dt.isCorrect) {
          qMap[qId].failed_count += 1;
        }
      });
    });

    const qList = Object.values(qMap).map((q) => {
      const rate = q.total_attempts > 0 ? Math.round((q.failed_count / q.total_attempts) * 100) : 0;
      return { ...q, failure_rate: rate };
    });

    qList.sort((a, b) => b.failed_count - a.failed_count || b.failure_rate - a.failure_rate);
    setTopFailedQuestions(qList.slice(0, 5));
  };

  // 2. Fetch General Stats Hierarchy
  const fetchGeneralStats = async () => {
    setLoadingHierarchy(true);
    try {
      const schoolName = teacherProfile?.schoolName;
      const res = await apiClient.get('/analytics/general-stats', {
        params: { school_name: schoolName }
      });

      if (res.data && res.data.status === 'success' && res.data.data) {
        setHierarchyData(res.data.data.hierarchy || {});
        setCollectiveReminders(res.data.data.collective_reminders || []);
      } else {
        calculateHierarchyClientFallback();
      }
    } catch (e) {
      calculateHierarchyClientFallback();
    } finally {
      setLoadingHierarchy(false);
    }
  };

  // Client-side Fallback calculation for General Stats Hierarchy
  const calculateHierarchyClientFallback = () => {
    if (quizzes.length === 0) return;

    const studentList = roster.filter((u) => u.role === 'student');
    const hierarchy: Record<string, Record<string, TreeQuizItem[]>> = {};
    const missingMap: Record<string, CollectiveReminderStudent> = {};

    quizzes.forEach((quiz) => {
      const subject = quiz.subject || quiz.main_subject || 'المادة العامة';
      const branch = quiz.sub_subject || quiz.branch || 'جميع الفروع';
      const lessonNum = quiz.lesson_number || quiz.lessonNumber || 0;

      const quizSubs = initialAllSubmissions.filter((s) => s.quizId === quiz.id);

      const answeredList: TreeQuizItem['answered_students'] = quizSubs.map((s) => ({
        student_id: s.studentId,
        name: s.studentName,
        serial_number: s.serialNumber,
        grade: s.grade,
        section: s.section,
        score: s.score,
        max_score: s.maxScore || 10,
        percentage: Math.round((s.score / (s.maxScore || 1)) * 100),
        passed: s.score >= (quiz.passPercentage || 50),
        submitted_at: s.submittedAt,
      }));

      // Target students for this quiz
      const targetStudents = studentList.filter((u) =>
        !quiz.grade || quiz.grade === 'جميع الصفوف' || u.grade === quiz.grade
      );

      const unansweredList: TreeQuizItem['unanswered_students'] = targetStudents
        .filter((u) => !quizSubs.some((s) => s.studentName.trim().toLowerCase() === u.name.trim().toLowerCase()))
        .map((u) => ({
          id: u.id,
          name: u.name,
          serial_number: u.serialNumber,
          grade: u.grade,
          section: u.section,
        }));

      // Update missing map for collective reminder
      unansweredList.forEach((u) => {
        const key = u.serial_number || u.name.trim().toLowerCase();
        if (!missingMap[key]) {
          missingMap[key] = {
            student_name: u.name,
            serial_number: u.serial_number,
            grade: u.grade || 'عام',
            section: u.section || 'عام',
            missing_quizzes: [],
            missing_quizzes_count: 0,
          };
        }
        missingMap[key].missing_quizzes.push({
          quiz_id: quiz.id,
          title: quiz.title,
          subject,
          branch,
          lesson_number: lessonNum,
        });
        missingMap[key].missing_quizzes_count = missingMap[key].missing_quizzes.length;
      });

      const treeItem: TreeQuizItem = {
        quiz_id: quiz.id,
        title: quiz.title,
        lesson_number: lessonNum,
        subject,
        branch,
        grade: quiz.grade,
        section: quiz.section,
        teacher_name: quiz.teacherName,
        total_required_students: targetStudents.length || quizSubs.length,
        answered_students_count: answeredList.length,
        unanswered_students_count: unansweredList.length,
        answered_students: answeredList,
        unanswered_students: unansweredList,
      };

      if (!hierarchy[subject]) hierarchy[subject] = {};
      if (!hierarchy[subject][branch]) hierarchy[subject][branch] = [];
      hierarchy[subject][branch].push(treeItem);
    });

    // Sort quizzes by lesson_number ascending inside each branch
    Object.keys(hierarchy).forEach((subjKey) => {
      Object.keys(hierarchy[subjKey]).forEach((brKey) => {
        hierarchy[subjKey][brKey].sort((a, b) => a.lesson_number - b.lesson_number);
      });
    });

    setHierarchyData(hierarchy);

    const collectiveList = Object.values(missingMap).sort((a, b) => b.missing_quizzes_count - a.missing_quizzes_count);
    setCollectiveReminders(collectiveList);
  };

  // Generate Group WhatsApp Message (Literal required structure)
  const handleGenerateGroupWhatsAppMessage = () => {
    let msg = `تنبيه هام وإخلاء مسؤولية حول متابعة التكاليف والاختبارات المدرسية:\n`;
    msg += `أولياء الأمور الأعزاء والطلاب الكرام، نسترعي انتباهكم إلى ضرورة إنجاز التكاليف والدروس المطلوبة لضمان استمرار التحصيل العلمي وتجنب خصم درجات الأعمال.\n\n`;
    msg += `الطلاب التالية أسماؤهم لم يحلوا التكاليف التالية:\n\n`;

    if (collectiveReminders.length === 0) {
      msg += `جميع الطلاب أتموا كافة التكاليف بنجاح! شكراً لاجتهادكم.\n`;
    } else {
      collectiveReminders.forEach((st, idx) => {
        msg += `- ${st.student_name} (الصف: ${st.grade} - شعبة: ${st.section}):\n`;
        st.missing_quizzes.forEach((mq) => {
          msg += `  • ${mq.title} - المادة: ${mq.subject} (الدرس ${mq.lesson_number || 1})\n`;
        });
        msg += `\n`;
      });
    }

    if (teacherProfile?.schoolName) {
      msg += `إدارة مدرسة: ${teacherProfile.schoolName}\n`;
    }
    if (teacherProfile?.teacherName) {
      msg += `المعلم/ة: ${teacherProfile.teacherName}`;
    }

    setGeneratedWhatsAppMessage(msg);
    setShowWhatsAppModal(true);
  };

  // Copy WhatsApp message to clipboard
  const handleCopyWhatsAppText = () => {
    navigator.clipboard.writeText(generatedWhatsAppMessage);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 3000);
  };

  // Filter & Sort Logic for Selected Quiz
  const filteredSubmissions = quizSubmissions
    .filter((sub) => {
      const matchesName = sub.studentName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSection = sectionFilter === 'ALL' || sub.section === sectionFilter;
      return matchesName && matchesSection;
    })
    .sort((a, b) => {
      if (sortBy === 'SCORE_DESC') {
        return (b.score / (b.maxScore || 1)) - (a.score / (a.maxScore || 1));
      }
      if (sortBy === 'SCORE_ASC') {
        return (a.score / (a.maxScore || 1)) - (b.score / (b.maxScore || 1));
      }
      if (sortBy === 'NAME') {
        return a.studentName.localeCompare(b.studentName, 'ar');
      }
      if (sortBy === 'TIME') {
        return (a.totalTimeSpentSeconds || 0) - (b.totalTimeSpentSeconds || 0);
      }
      return 0;
    });

  // Aggregated Stats for Selected Quiz
  const totalQuizStudents = filteredSubmissions.length;
  const avgScore = totalQuizStudents > 0
    ? (filteredSubmissions.reduce((acc, s) => acc + (s.score / (s.maxScore || 1)) * 100, 0) / totalQuizStudents).toFixed(1)
    : 0;
  const highestScore = totalQuizStudents > 0
    ? Math.max(...filteredSubmissions.map((s) => (s.score / (s.maxScore || 1)) * 100)).toFixed(0)
    : 0;
  const passCount = filteredSubmissions.filter((s) => ((s.score / (s.maxScore || 1)) * 100) >= (selectedQuiz?.passPercentage || 50)).length;
  const passRate = totalQuizStudents > 0 ? ((passCount / totalQuizStudents) * 100).toFixed(0) : 0;

  // Export Results to CSV
  const exportToCSV = () => {
    if (filteredSubmissions.length === 0) return;
    const headers = [
      'اسم الطالب',
      'الصف',
      'الشعبة',
      'تاريخ التسليم',
      'الدرجة الحاصل عليها',
      'الدرجة العظمى',
      'النسبة المئوية',
      'الإجابات الصحيحة',
      'الإجابات الخاطئة',
      'الأسئلة المتخطاة',
      'الوقت المستغرق (ثواني)',
    ];

    const rows = filteredSubmissions.map((s) => [
      `"${s.studentName}"`,
      `"${s.grade}"`,
      `"${s.section}"`,
      `"${s.submittedAt}"`,
      s.score,
      s.maxScore,
      `"${((s.score / (s.maxScore || 1)) * 100).toFixed(1)}%"`,
      s.correctCount,
      s.incorrectCount,
      s.skippedCount,
      s.totalTimeSpentSeconds || 0,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `نتائج_اختبار_${(selectedQuiz?.title || 'عام').replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Toggle Accordion handlers
  const toggleSubject = (subjKey: string) => {
    setOpenSubjects((prev) => ({ ...prev, [subjKey]: !prev[subjKey] }));
  };

  const toggleBranch = (branchKey: string) => {
    setOpenBranches((prev) => ({ ...prev, [branchKey]: !prev[branchKey] }));
  };

  // Calculate detailed profile stats for a specific student
  const getStudentProfileStats = (studentName: string) => {
    const sNameClean = studentName.trim().toLowerCase();

    // Solved quizzes
    const solvedList = initialAllSubmissions.filter(
      (s) => s.studentName.trim().toLowerCase() === sNameClean
    );

    // Solved quiz IDs
    const solvedQuizIds = new Set(solvedList.map((s) => s.quizId));

    // Missing quizzes
    const missingQuizzesList = quizzes.filter((q) => !solvedQuizIds.has(q.id));

    const totalSolvedScore = solvedList.reduce((acc, curr) => acc + curr.score, 0);
    const totalMaxScore = solvedList.reduce((acc, curr) => acc + (curr.maxScore || 10), 0);
    const avgPercentage = totalMaxScore > 0 ? Math.round((totalSolvedScore / totalMaxScore) * 100) : 0;

    return {
      solvedList,
      missingQuizzesList,
      avgPercentage,
      solvedCount: solvedList.length,
      missingCount: missingQuizzesList.length,
    };
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200/80 my-6 dir-rtl space-y-6 animate-fadeIn">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-700 transition-all cursor-pointer"
            title="العودة"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-indigo-600" />
              لوحة التحليلات والإحصاءات الشاملة
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              مزامنة فورية مع Laravel Backend &amp; Firestore Sub-Collections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleGenerateGroupWhatsAppMessage}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-2xl text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer transform hover:scale-105"
          >
            <Share2 className="w-4 h-4 text-emerald-100" />
            <span>نسخ رسالة المقصرين لجروب الواتساب</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            طباعة
          </button>
        </div>
      </div>

      {/* TOP 5 WIDGETS SECTION (لوحة الشرف ونقاط الضعف) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WIDGET 1: Top 5 Failed Questions (أكثر 5 أسئلة صعوبة) */}
        <div className="bg-gradient-to-br from-rose-50 via-red-50 to-orange-50/50 rounded-3xl p-5 border border-red-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-red-950 flex items-center gap-2">
              <div className="p-2 bg-red-600 text-white rounded-xl shadow-xs">
                <AlertTriangle className="w-4 h-4" />
              </div>
              أكثر 5 أسئلة واجهت الطلاب صعوبة (نقاط الضعف)
            </h3>
            <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-[10px] font-black border border-red-200">
              تحليل إجابات الطلاب
            </span>
          </div>

          {loadingTopPerf ? (
            <div className="py-8 text-center text-xs text-red-800 font-bold flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-red-600" />
              جاري تحليل الأسئلة...
            </div>
          ) : topFailedQuestions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 font-medium bg-white/60 rounded-2xl border border-dashed border-red-200">
              لا توجد بيانات تعثر كافية حالياً
            </div>
          ) : (
            <div className="space-y-2.5">
              {topFailedQuestions.map((item, idx) => (
                <div
                  key={item.question_id || idx}
                  className="bg-white rounded-2xl p-3.5 border border-red-100 shadow-2xs hover:shadow-xs transition-all space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 font-black text-slate-900 text-xs">
                      <span className="w-5 h-5 rounded-full bg-red-100 text-red-800 flex items-center justify-center text-[10px] shrink-0 font-mono">
                        {idx + 1}
                      </span>
                      <span className="line-clamp-2">{item.question_text}</span>
                    </div>

                    <span className="px-2.5 py-1 bg-red-600 text-white rounded-xl text-[10px] font-black shrink-0 shadow-xs">
                      {item.failure_rate}% خلل
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-1 border-t border-slate-100">
                    <span className="text-indigo-900 font-bold">{item.quiz_title}</span>
                    <span className="text-red-700 font-bold">
                      تعثر: {item.failed_count} من {item.total_attempts} محاولات
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WIDGET 2: Honor Roll Top 5 Students (لوحة الشرف: أفضل 5 طلاب) */}
        <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-indigo-50/50 rounded-3xl p-5 border border-emerald-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-emerald-950 flex items-center gap-2">
              <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                <Trophy className="w-4 h-4 text-amber-300" />
              </div>
              لوحة الشرف: أفضل 5 طلاب أجابوا بامتياز
            </h3>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black border border-emerald-200">
              أعلى درجات المجموع التراكمي
            </span>
          </div>

          {loadingTopPerf ? (
            <div className="py-8 text-center text-xs text-emerald-800 font-bold flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              جاري حساب لوحة الشرف...
            </div>
          ) : topStudents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 font-medium bg-white/60 rounded-2xl border border-dashed border-emerald-200">
              لم تسجل إجابات طلاب حتى الآن
            </div>
          ) : (
            <div className="space-y-2.5">
              {topStudents.map((st, idx) => {
                const rankBadges = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                return (
                  <button
                    key={st.student_id || idx}
                    type="button"
                    onClick={() =>
                      setSelectedStudentForProfile({
                        name: st.student_name,
                        grade: st.grade,
                        section: st.section,
                        serialNumber: st.serial_number,
                      })
                    }
                    className="w-full bg-white rounded-2xl p-3.5 border border-emerald-100 shadow-2xs hover:shadow-xs transition-all text-right cursor-pointer hover:bg-emerald-50/30 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{rankBadges[idx] || '⭐'}</span>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                          {st.student_name}
                          {st.serial_number && st.serial_number !== '-' && (
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              ({st.serial_number})
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {st.grade} - شعبة ({st.section}) | أُنْجِزَ {st.quizzes_completed} تكليفاً
                        </p>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-950 font-black text-xs rounded-xl border border-emerald-300 block">
                        {st.average_percentage}%
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold mt-0.5 block">
                        {st.total_score} / {st.total_max_score}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('hierarchy')}
          className={`py-3 px-5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'hierarchy'
              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>الإحصاءات العامة للتكاليف (عرض شجري)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('quiz_detail')}
          className={`py-3 px-5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'quiz_detail'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-amber-300" />
          <span>تحليل تفصيلي لاختبار محدد</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('collective')}
          className={`py-3 px-5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'collective'
              ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-600/20'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Users className="w-4 h-4 text-rose-200" />
          <span>تقرير المقصرين المجمّع ({collectiveReminders.length})</span>
        </button>
      </div>

      {/* TAB 1: GENERAL STATS HIERARCHY (المادة > الفرع > الدرس) */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-black text-indigo-950 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                الهيكلة الشجرية للتكاليف العامة والمدرسية
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                تصفح التكاليف حسب المادة والفرع مرتبة تصاعدياً برقم الدرس مع أزرار الإجابات الشاغرة والمكتملة
              </p>
            </div>

            <button
              type="button"
              onClick={fetchGeneralStats}
              className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHierarchy ? 'animate-spin' : ''}`} />
              تحديث البيانات
            </button>
          </div>

          {loadingHierarchy ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-600">جاري تحميل الهيكلة الشجرية من سيرفر Laravel...</p>
            </div>
          ) : Object.keys(hierarchyData).length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
              <BookMarked className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-700">لا توجد مواضيع أو تكاليف مسجلة حتى الآن</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(hierarchyData).map(([subjName, branchesMap]) => {
                const subjKey = `subj_${subjName}`;
                const isSubjOpen = openSubjects[subjKey] !== false; // open by default

                // Total quiz count in subject
                const totalSubjectQuizzes = Object.values(branchesMap).reduce(
                  (acc, list) => acc + list.length,
                  0
                );

                return (
                  <div key={subjKey} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                    {/* Level 1 Accordion Header: Subject */}
                    <button
                      type="button"
                      onClick={() => toggleSubject(subjKey)}
                      className="w-full px-5 py-3.5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white font-black text-sm flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-indigo-400" />
                        <span>المادة: {subjName}</span>
                        <span className="px-2 py-0.5 bg-indigo-800/80 rounded-full text-[10px] text-indigo-200 font-mono">
                          {totalSubjectQuizzes} تكاليف
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-5 h-5 text-slate-400 transition-transform ${
                          isSubjOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Level 1 Content: Branches */}
                    {isSubjOpen && (
                      <div className="p-4 space-y-3 bg-slate-50/50">
                        {Object.entries(branchesMap).map(([branchName, quizList]) => {
                          const branchKey = `${subjKey}_br_${branchName}`;
                          const isBranchOpen = openBranches[branchKey] !== false;

                          return (
                            <div
                              key={branchKey}
                              className="border border-indigo-200/80 rounded-xl overflow-hidden bg-white shadow-2xs"
                            >
                              {/* Level 2 Accordion Header: Branch */}
                              <button
                                type="button"
                                onClick={() => toggleBranch(branchKey)}
                                className="w-full px-4 py-3 bg-indigo-50/90 hover:bg-indigo-100/90 text-indigo-950 font-black text-xs flex items-center justify-between transition-all cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-indigo-600" />
                                  <span>الفرع: {branchName}</span>
                                  <span className="px-2 py-0.5 bg-indigo-200/70 text-indigo-900 rounded-md text-[10px]">
                                    {quizList.length} دروس
                                  </span>
                                </div>
                                <ChevronDown
                                  className={`w-4 h-4 text-indigo-700 transition-transform ${
                                    isBranchOpen ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>

                              {/* Level 3 Content: Lessons / Quizzes sorted by lesson_number */}
                              {isBranchOpen && (
                                <div className="p-3 space-y-2 bg-white">
                                  {quizList.map((q) => (
                                    <div
                                      key={q.quiz_id}
                                      className="p-4 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                                    >
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md text-[10px] font-black border border-emerald-300 flex items-center gap-0.5">
                                            <Hash className="w-3 h-3 text-emerald-700" />
                                            الدرس {q.lesson_number || 1}
                                          </span>
                                          <h4 className="font-extrabold text-slate-900 text-sm">
                                            {q.title}
                                          </h4>
                                        </div>
                                        <p className="text-[11px] text-slate-500 font-medium">
                                          {q.grade ? `الصف: ${q.grade}` : ''}{' '}
                                          {q.teacher_name ? `| المعلم: ${q.teacher_name}` : ''}
                                        </p>
                                      </div>

                                      {/* Colored Counters: Answered (Green) | Unanswered (Red) */}
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {/* Answered Button Badge */}
                                        <button
                                          type="button"
                                          onClick={() => setAnsweredModalQuiz(q)}
                                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs hover:scale-105"
                                          title="انقر لعرض قائمة أبطالنا الذين أناروا درب العلم"
                                        >
                                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                          <span>أجابوا: {q.answered_students_count} طالب</span>
                                        </button>

                                        {/* Unanswered Button Badge */}
                                        <button
                                          type="button"
                                          onClick={() => setUnansweredModalQuiz(q)}
                                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-300 text-red-900 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs hover:scale-105"
                                          title="انقر لعرض قائمة الطلاب الذين لم يجيبوا بعد"
                                        >
                                          <XCircle className="w-4 h-4 text-red-600" />
                                          <span>لم يجيبوا: {q.unanswered_students_count} طالب</span>
                                        </button>

                                        {/* View Specific Detail Button */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const foundMeta = quizzes.find((meta) => meta.id === q.quiz_id);
                                            if (foundMeta) {
                                              setSelectedQuiz(foundMeta);
                                              setActiveTab('quiz_detail');
                                            }
                                          }}
                                          className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 transition-all cursor-pointer"
                                          title="عرض إحصائيات هذا الاختبار بالكامل"
                                        >
                                          <BarChart3 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
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

      {/* TAB 2: QUIZ SPECIFIC ANALYTICS */}
      {activeTab === 'quiz_detail' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Quiz Selector */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <label className="text-xs font-black text-slate-800">اختر الاختبار المراد تحليله:</label>
            </div>

            <select
              value={selectedQuiz?.id || ''}
              onChange={(e) => {
                const q = quizzes.find((item) => item.id === e.target.value);
                if (q) setSelectedQuiz(q);
              }}
              className="px-3 py-2 bg-white rounded-xl border border-slate-300 font-extrabold text-xs text-indigo-950 outline-none focus:border-indigo-600 max-w-md"
            >
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title} ({q.subject} - {q.grade || 'عام'})
                </option>
              ))}
            </select>
          </div>

          {selectedQuiz && (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3">
                  <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-indigo-900">إجمالي الطلاب المشاركين</div>
                    <div className="text-xl font-extrabold text-indigo-950">{totalQuizStudents} طالب</div>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                  <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-900">متوسط الدرجات</div>
                    <div className="text-xl font-extrabold text-emerald-950">{avgScore}%</div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-3">
                  <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-blue-900">نسبة الاجتياز والنجاح</div>
                    <div className="text-xl font-extrabold text-blue-950">{passRate}%</div>
                  </div>
                </div>

                <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl flex items-center gap-3">
                  <div className="p-3 bg-purple-600 text-white rounded-xl shadow-md">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-purple-900">أعلى درجة محققة</div>
                    <div className="text-xl font-extrabold text-purple-950">{highestScore}%</div>
                  </div>
                </div>
              </div>

              {/* Submissions Table Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <div className="relative w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="البحث باسم الطالب..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pr-9 pl-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:border-indigo-500 outline-none font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportToCSV}
                    disabled={filteredSubmissions.length === 0}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    تصدير Excel CSV
                  </button>
                </div>
              </div>

              {/* Submissions Table */}
              {loadingQuizSubmissions ? (
                <div className="py-12 text-center text-slate-500 text-sm">جاري تحميل سجلات الطلاب...</div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  لم تسجل أي إجابات طلاب بعد لهذا الاختبار
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-900 text-white font-bold">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">اسم الطالب</th>
                        <th className="p-3">الصف والشعبة</th>
                        <th className="p-3">تاريخ التسليم</th>
                        <th className="p-3 text-center">الإجابات الصحيحة</th>
                        <th className="p-3 text-center">الدرجة النهائية</th>
                        <th className="p-3 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium text-slate-800 bg-white">
                      {filteredSubmissions.map((sub, idx) => {
                        const percentage = Math.round((sub.score / (sub.maxScore || 1)) * 100);
                        const isPassed = percentage >= (selectedQuiz.passPercentage || 50);

                        return (
                          <tr key={sub.id} className="hover:bg-slate-50 transition-all">
                            <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-extrabold text-slate-900">{sub.studentName}</td>
                            <td className="p-3 text-slate-600">
                              {sub.grade} {sub.section ? `- شعبة (${sub.section})` : ''}
                            </td>
                            <td className="p-3 text-slate-500 font-sans">{sub.submittedAt}</td>
                            <td className="p-3 text-center font-bold text-emerald-600">
                              {sub.correctCount}
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                                  isPassed ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
                                }`}
                              >
                                {sub.score} / {sub.maxScore} ({percentage}%)
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedSubmission(sub)}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer mx-auto"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>عرض التفاصيل</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 3: COLLECTIVE REMINDERS TABLE */}
      {activeTab === 'collective' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-black text-rose-950 flex items-center gap-2">
                <Users className="w-4 h-4 text-rose-600" />
                تقرير المقصرين المجمّع لكافة المواد والدروس
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                قائمة بأولئك الطلاب الذين لديهم تكاليف شاغرة مع أسمائها ودروسها
              </p>
            </div>

            <button
              type="button"
              onClick={handleGenerateGroupWhatsAppMessage}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm cursor-pointer transition-all"
            >
              <Share2 className="w-4 h-4" />
              توليد رسالة الواتساب المقصرين
            </button>
          </div>

          {collectiveReminders.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">جميع الطلاب قاموا بحل التكاليف المطلوبة كلياً!</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 text-white font-bold">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">اسم الطالب</th>
                    <th className="p-3">الصف والشعبة</th>
                    <th className="p-3 text-center">عدد التكاليف غير المحلولة</th>
                    <th className="p-3">التكاليف والدروس المتبقية</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-slate-800 bg-white">
                  {collectiveReminders.map((st, idx) => (
                    <tr key={st.serial_number || idx} className="hover:bg-slate-50 transition-all">
                      <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-extrabold text-slate-900">{st.student_name}</td>
                      <td className="p-3 text-slate-600">
                        {st.grade} - شعبة ({st.section})
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-1 bg-rose-100 text-rose-900 font-black rounded-full text-xs">
                          {st.missing_quizzes_count} تكليفاً
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          {st.missing_quizzes.map((mq, mqIdx) => (
                            <div key={mqIdx} className="text-[11px] text-slate-700 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                              <span>{mq.title} ({mq.subject} - الدرس {mq.lesson_number || 1})</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedStudentForProfile({
                              name: st.student_name,
                              grade: st.grade,
                              section: st.section,
                              serialNumber: st.serial_number,
                            })
                          }
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                        >
                          إحصائيات الطالب
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ANSWERED STUDENTS HERO MODAL (أبطالنا الذين أناروا درب العلم) */}
      {answeredModalQuiz && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl border border-emerald-200 dir-rtl animate-fadeIn">
            {/* Hero Header */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-5 rounded-2xl shadow-md space-y-2 text-center relative overflow-hidden">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-300 animate-bounce" />
                <h3 className="text-lg font-black drop-shadow-sm">
                  أبطالنا الذين أناروا درب العلم وحققوا التميز! 🌟
                </h3>
              </div>
              <p className="text-xs text-emerald-100 font-medium">
                تتقدم إدارة المعلم بأسمى عبارات الشكر والثناء لجهودكم الرائعة في حل درس ({answeredModalQuiz.title}) - مادة ({answeredModalQuiz.subject})
              </p>
            </div>

            {/* Answered Students List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-slate-700 px-1">
                <span>قائمة الطلاب المتميزين الذين أنجزوا التكليف:</span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  العدد: {answeredModalQuiz.answered_students_count} طالب
                </span>
              </div>

              {answeredModalQuiz.answered_students.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">لم يحل أي طالب هذا الاختبار بعد</div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {answeredModalQuiz.answered_students.map((st, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setSelectedStudentForProfile({
                          name: st.name,
                          grade: st.grade,
                          section: st.section,
                          serialNumber: st.serial_number,
                        })
                      }
                      className="w-full bg-emerald-50/50 hover:bg-emerald-100/60 p-3 rounded-2xl border border-emerald-200/80 flex items-center justify-between gap-3 text-right cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-xs">{st.name}</h4>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {st.grade || 'الصف'} - شعبة ({st.section || 'عام'})
                          </p>
                        </div>
                      </div>

                      <div className="text-left">
                        <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-xl text-xs font-black">
                          {st.score} / {st.max_score} ({st.percentage}%)
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setAnsweredModalQuiz(null)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-2xl text-xs transition-all cursor-pointer"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: UNANSWERED STUDENTS WARNING MODAL (نافذة المقصرين) */}
      {unansweredModalQuiz && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl border border-red-200 dir-rtl animate-fadeIn">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white p-5 rounded-2xl shadow-md space-y-2 text-center relative overflow-hidden">
              <div className="flex items-center justify-center gap-2">
                <AlertTriangle className="w-6 h-6 text-amber-300" />
                <h3 className="text-lg font-black drop-shadow-sm">
                  تنبيه ومتابعة تربوية: الطلاب المطالبين بإكمال هذا التكليف
                </h3>
              </div>
              <p className="text-xs text-red-100 font-medium">
                نحث طلابنا الكرام وأولياء أمورهم على سرعة إنجاز درس ({unansweredModalQuiz.title}) - مادة ({unansweredModalQuiz.subject})
              </p>
            </div>

            {/* Unanswered Students List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-slate-700 px-1">
                <span>أسماء الطلاب المقصرين في تسليم الحل:</span>
                <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                  العدد: {unansweredModalQuiz.unanswered_students_count} طالب
                </span>
              </div>

              {unansweredModalQuiz.unanswered_students.length === 0 ? (
                <div className="py-8 text-center text-xs text-emerald-600 font-bold">
                  ممتاز! جميع الطلاب أنجزوا هذا التكليف بدون أي تقصير.
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {unansweredModalQuiz.unanswered_students.map((st, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setSelectedStudentForProfile({
                          name: st.name,
                          grade: st.grade,
                          section: st.section,
                          serialNumber: st.serial_number,
                        })
                      }
                      className="w-full bg-red-50/50 hover:bg-red-100/60 p-3 rounded-2xl border border-red-200/80 flex items-center justify-between gap-3 text-right cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-xs">{st.name}</h4>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {st.grade || 'الصف'} - شعبة ({st.section || 'عام'})
                          </p>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 bg-red-100 text-red-900 rounded-xl text-[11px] font-black border border-red-300">
                        لم يُحل بعد
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setUnansweredModalQuiz(null)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-2xl text-xs transition-all cursor-pointer"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: STUDENT PERSONAL PROFILE ANALYTICS (إحصائيات الطالب الشاملة) */}
      {selectedStudentForProfile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl border border-slate-200 dir-rtl animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-100 text-indigo-700 rounded-2xl">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">{selectedStudentForProfile.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    الصف: {selectedStudentForProfile.grade || 'عام'} - الشعبة: ({selectedStudentForProfile.section || 'عام'})
                    {selectedStudentForProfile.serialNumber && ` | الرقم التسلسلي: ${selectedStudentForProfile.serialNumber}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudentForProfile(null)}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {(() => {
              const stats = getStudentProfileStats(selectedStudentForProfile.name);

              return (
                <div className="space-y-4">
                  {/* Overview Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                      <div className="text-xs font-bold text-emerald-900">التكاليف التي قام بحلها</div>
                      <div className="text-xl font-black text-emerald-950 mt-1">
                        {stats.solvedCount} تكليفاً (متوسط: {stats.avgPercentage}%)
                      </div>
                    </div>

                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                      <div className="text-xs font-bold text-rose-900">التكاليف غير المحلولة</div>
                      <div className="text-xl font-black text-rose-950 mt-1">
                        {stats.missingCount} تكليفاً شاغراً
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Solved Quizzes */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 border-r-4 border-emerald-600 pr-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      سجل التكاليف التي أنجزها الطالب:
                    </h4>

                    {stats.solvedList.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                        لم يحل الطالب أي تكليف حتى الآن
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[160px] overflow-y-auto">
                        {stats.solvedList.map((s, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-extrabold text-slate-900">{s.quizTitle || 'تكليف أونلاين'}</span>
                              <span className="text-[10px] text-slate-500 font-medium block">
                                المادة: {s.subject || 'عام'} - تاريخ التسليم: {s.submittedAt}
                              </span>
                            </div>

                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-950 font-black rounded-lg">
                              {s.score} / {s.maxScore || 10}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Missing Quizzes */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 border-r-4 border-rose-600 pr-2">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      التكاليف غير المحلولة المطلوبة منه:
                    </h4>

                    {stats.missingQuizzesList.length === 0 ? (
                      <div className="p-4 text-center text-xs text-emerald-600 font-bold bg-emerald-50 rounded-xl">
                        لا توجد أي تكاليف متبقية على الطالب!
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[160px] overflow-y-auto">
                        {stats.missingQuizzesList.map((mq) => (
                          <div
                            key={mq.id}
                            className="p-3 bg-rose-50/60 rounded-xl border border-rose-200 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-extrabold text-slate-900">{mq.title}</span>
                              <span className="text-[10px] text-slate-500 font-medium block">
                                المادة: {mq.subject} ({mq.branch || 'عام'}) - الدرس: {mq.lesson_number || 1}
                              </span>
                            </div>

                            <span className="px-2.5 py-1 bg-rose-100 text-rose-900 font-black rounded-lg">
                              شاغر
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <button
              type="button"
              onClick={() => setSelectedStudentForProfile(null)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-2xl text-xs transition-all cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: GROUP WHATSAPP MESSAGE GENERATOR PREVIEW MODAL */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl border border-emerald-200 dir-rtl animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 text-emerald-950 font-black text-base">
                <Share2 className="w-5 h-5 text-emerald-600" />
                <span>مولّد رسالة الواتساب الجماعية للمقصرين</span>
              </div>
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block">
                معاينة النص الجاهز للنسخ إلى جروب الواتساب:
              </label>
              <textarea
                readOnly
                value={generatedWhatsAppMessage}
                className="w-full p-4 bg-slate-50 border border-slate-300 rounded-2xl font-mono text-xs text-slate-800 leading-relaxed outline-none min-h-[220px]"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleCopyWhatsAppText}
                className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  copiedSuccess
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                }`}
              >
                {copiedSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>تم النسخ للحافظة بنجاح!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>نسخ النص للحافظة الآن</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  const encoded = encodeURIComponent(generatedWhatsAppMessage);
                  window.open(`https://wa.me/?text=${encoded}`, '_blank');
                }}
                className="py-3 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs flex items-center gap-2 shadow-md cursor-pointer transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>فتح واتساب مباشـرة</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
