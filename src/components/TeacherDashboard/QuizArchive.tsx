import React, { useState, useMemo } from 'react';
import { QuizMetadata, TeacherProfile, SUBJECT_CATEGORIES, CLASS_LEVELS } from '../../types';
import {
  Library,
  Search,
  Filter,
  Copy,
  Check,
  Eye,
  BarChart3,
  Edit3,
  QrCode,
  Globe,
  Lock,
  GraduationCap,
  BookOpen,
  School,
  Calendar,
  Layers,
  CopyPlus,
} from 'lucide-react';

interface QuizArchiveProps {
  quizzes: QuizMetadata[];
  teacherProfile: TeacherProfile | null;
  onSelectQuizToEdit: (quiz: QuizMetadata) => void;
  onCloneQuiz: (quiz: QuizMetadata) => void;
  onPreviewQuiz: (quiz: QuizMetadata) => void;
  onViewAnalytics: (quiz: QuizMetadata) => void;
}

export const QuizArchive: React.FC<QuizArchiveProps> = ({
  quizzes,
  teacherProfile,
  onSelectQuizToEdit,
  onCloneQuiz,
  onPreviewQuiz,
  onViewAnalytics,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('الكل');
  const [selectedMainSubject, setSelectedMainSubject] = useState('الكل');
  const [selectedSubSubject, setSelectedSubSubject] = useState('الكل');
  const [selectedVisibility, setSelectedVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [copiedQuizId, setCopiedQuizId] = useState<string | null>(null);
  const [qrModalQuiz, setQrModalQuiz] = useState<QuizMetadata | null>(null);

  // Available sub-subjects derived dynamically based on selected main subject (Cascading Dropdown)
  const availableSubSubjects = useMemo(() => {
    if (selectedMainSubject === 'الكل' || !SUBJECT_CATEGORIES[selectedMainSubject]) {
      return [];
    }
    return SUBJECT_CATEGORIES[selectedMainSubject];
  }, [selectedMainSubject]);

  // Reset sub-subject if main subject changes
  const handleMainSubjectChange = (subject: string) => {
    setSelectedMainSubject(subject);
    setSelectedSubSubject('الكل');
  };

  // Filter quizzes according to Privacy Rules + Cascading Dropdown Filters
  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((quiz) => {
      // 1. Privacy Authorization Logic:
      // Public quizzes are visible to all.
      // Private quizzes are ONLY visible if created by the current logged-in teacher.
      const isOwner =
        teacherProfile &&
        (quiz.teacherName === teacherProfile.teacherName ||
          (quiz.ownerTeacherCode && quiz.ownerTeacherCode === teacherProfile.teacherCode) ||
          (quiz.schoolName === teacherProfile.schoolName && quiz.teacherName === teacherProfile.teacherName));

      const isPublic = !quiz.visibility || quiz.visibility === 'public';

      if (!isPublic && !isOwner) {
        return false; // Hide private quiz created by other teachers
      }

      // 2. Filter by Visibility Selection
      if (selectedVisibility === 'public' && !isPublic) return false;
      if (selectedVisibility === 'private' && isPublic) return false;

      // 3. Filter by Grade / Class Level
      if (selectedGrade !== 'الكل') {
        const quizGrade = quiz.class_level || quiz.grade || '';
        if (quizGrade !== selectedGrade && !quizGrade.includes(selectedGrade)) {
          return false;
        }
      }

      // 4. Filter by Main Subject
      if (selectedMainSubject !== 'الكل') {
        const quizMain = quiz.main_subject || quiz.subject || '';
        if (quizMain !== selectedMainSubject && !quizMain.includes(selectedMainSubject)) {
          return false;
        }
      }

      // 5. Filter by Sub Subject
      if (selectedSubSubject !== 'الكل' && availableSubSubjects.length > 0) {
        const quizSub = quiz.sub_subject || '';
        if (quizSub !== selectedSubSubject && !quizSub.includes(selectedSubSubject)) {
          return false;
        }
      }

      // 6. Filter by Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchTitle = quiz.title?.toLowerCase().includes(q);
        const matchTeacher = quiz.teacherName?.toLowerCase().includes(q);
        const matchSchool = quiz.schoolName?.toLowerCase().includes(q);
        const matchSubject = (quiz.subject || quiz.main_subject || '').toLowerCase().includes(q);
        if (!matchTitle && !matchTeacher && !matchSchool && !matchSubject) {
          return false;
        }
      }

      return true;
    });
  }, [
    quizzes,
    teacherProfile,
    selectedVisibility,
    selectedGrade,
    selectedMainSubject,
    selectedSubSubject,
    searchQuery,
    availableSubSubjects,
  ]);

  const handleCopyLink = (quizId: string) => {
    const link = `${window.location.origin}${window.location.pathname}?quizId=${quizId}`;
    navigator.clipboard.writeText(link);
    setCopiedQuizId(quizId);
    setTimeout(() => setCopiedQuizId(null), 3000);
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200/80 mb-6 dir-rtl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md">
            <Library className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">أرشيف الاختبارات والمكتبة المركزية</h2>
            <p className="text-xs text-slate-500">
              تصفح، فلترة، وإعادة استخدام الاختبارات المتاحة حسب الصف والمادة والخصوصية
            </p>
          </div>
        </div>

        <div className="px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs font-bold text-indigo-900 flex items-center gap-2">
          <span>نتائج العرض: ({filteredQuizzes.length}) اختبار</span>
        </div>
      </div>

      {/* Cascading Filter Bar */}
      <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span>فلاتر البحث والتصنيف المترابط (Cascading Filters)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Grade Level Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
              الصف الدراسي
            </label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 text-xs font-semibold text-slate-800 bg-white"
            >
              {CLASS_LEVELS.map((grade) => (
                <option key={grade} value={grade}>
                  {grade === 'الكل' ? 'جميع الصفوف' : `الصف ${grade}`}
                </option>
              ))}
            </select>
          </div>

          {/* Main Subject Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              المادة الأساسية
            </label>
            <select
              value={selectedMainSubject}
              onChange={(e) => handleMainSubjectChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="الكل">جميع المواد الأساسية</option>
              {Object.keys(SUBJECT_CATEGORIES).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Sub Subject Filter (Cascading) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              فرع المادة (مترابط)
            </label>
            <select
              disabled={availableSubSubjects.length === 0}
              value={selectedSubSubject}
              onChange={(e) => setSelectedSubSubject(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 text-xs font-semibold text-slate-800 bg-white ${
                availableSubSubjects.length === 0 ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''
              }`}
            >
              <option value="الكل">
                {availableSubSubjects.length === 0 ? 'اختر مادة أولاً' : 'جميع الفروع'}
              </option>
              {availableSubSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* Visibility Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              نطاق الخصوصية
            </label>
            <select
              value={selectedVisibility}
              onChange={(e) => setSelectedVisibility(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="all">الكل (علني + خاص بي)</option>
              <option value="public">علني فقط (المكتبة العامة)</option>
              <option value="private">خاص بي فقط</option>
            </select>
          </div>
        </div>

        {/* Search Text Box */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث سريع برقم/عنوان الاختبار، اسم المعلم، أو المدرسة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 outline-none text-xs font-semibold text-slate-800 bg-white"
          />
        </div>
      </div>

      {/* Quizzes Grid */}
      {filteredQuizzes.length === 0 ? (
        <div className="p-10 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 text-sm space-y-2">
          <Library className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold">لا توجد اختبارات تطابق الفلاتر المحددة</p>
          <p className="text-xs text-slate-400">جرب تغيير الصف أو المادة أو كلمة البحث لرؤية النتائج</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuizzes.map((quiz) => {
            const isOwner =
              teacherProfile &&
              (quiz.teacherName === teacherProfile.teacherName ||
                (quiz.ownerTeacherCode && quiz.ownerTeacherCode === teacherProfile.teacherCode));

            const isPublic = !quiz.visibility || quiz.visibility === 'public';

            return (
              <div
                key={quiz.id}
                className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                        isPublic
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                      }`}
                    >
                      {isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {isPublic ? 'اختبار علني' : 'اختبار خاص'}
                    </span>

                    {quiz.class_level && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200">
                        الصف {quiz.class_level}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="font-black text-slate-900 text-base leading-snug mb-2">{quiz.title}</h3>

                  {/* Subject and Branch Meta */}
                  <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        {quiz.main_subject || quiz.subject || 'مادة عامة'}
                        {quiz.sub_subject ? ` (${quiz.sub_subject})` : ''}
                      </span>
                      <span className="text-slate-500 font-medium">{quiz.questions?.length || 0} سؤال</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-500 text-[11px] pt-1 border-t border-slate-200/60">
                      <School className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate">{quiz.schoolName || 'المدرسة غير حددة'}</span>
                      {quiz.branch && <span className="text-slate-400">({quiz.branch})</span>}
                    </div>

                    <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>{quiz.academic_year || quiz.schoolYear || '2026'}</span>
                      <span className="text-slate-300">|</span>
                      <span>المعلم: {quiz.teacherName || 'غير معروف'}</span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(quiz.id)}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs flex items-center gap-1 transition-all"
                      title="نسخ رابط الطالب"
                    >
                      {copiedQuizId === quiz.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          تم النسخ
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          الرابط
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setQrModalQuiz(quiz)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                      title="رمز QR"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onPreviewQuiz(quiz)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                      title="معاينة الاختبار كطالب"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onCloneQuiz(quiz)}
                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs flex items-center gap-1"
                      title="نسخ وتخصيص كاختبار جديد"
                    >
                      <CopyPlus className="w-3.5 h-3.5" />
                      نسخ جديد
                    </button>

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => onSelectQuizToEdit(quiz)}
                        className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs flex items-center gap-1"
                        title="تعديل هذا الاختبار بنفس الرابط"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        تعديل
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR Code Modal */}
      {qrModalQuiz && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-slate-200 animate-scaleUp dir-rtl">
            <h4 className="font-extrabold text-slate-900 text-lg">رمز الاستجابة السريعة (QR)</h4>
            <p className="text-xs text-slate-600">{qrModalQuiz.title}</p>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  `${window.location.origin}${window.location.pathname}?quizId=${qrModalQuiz.id}`
                )}`}
                alt="QR Code"
                className="w-48 h-48 rounded-xl shadow"
              />
            </div>

            <button
              type="button"
              onClick={() => setQrModalQuiz(null)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
