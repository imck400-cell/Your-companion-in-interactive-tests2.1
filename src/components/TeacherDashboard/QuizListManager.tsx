import React, { useState } from 'react';
import { QuizMetadata, Submission } from '../../types';
import { deleteLocalQuiz } from '../../services/offlineDb';
import apiClient from '../../services/apiClient';
import { BookOpen, Copy, Eye, BarChart3, Trash2, Check, QrCode, Edit3, Wifi, WifiOff, RefreshCw, Loader2 } from 'lucide-react';

interface QuizListManagerProps {
  quizzes: QuizMetadata[];
  submissions?: Submission[];
  onSelectQuiz: (quiz: QuizMetadata) => void;
  onPreviewQuiz: (quiz: QuizMetadata) => void;
  onViewAnalytics: (quiz: QuizMetadata) => void;
  onDeleteSuccess: () => void;
  onRefresh?: () => void;
}

export const QuizListManager: React.FC<QuizListManagerProps> = ({
  quizzes,
  submissions = [],
  onSelectQuiz,
  onPreviewQuiz,
  onViewAnalytics,
  onDeleteSuccess,
  onRefresh,
}) => {
  const [copiedQuizId, setCopiedQuizId] = useState<string | null>(null);
  const [qrModalQuiz, setQrModalQuiz] = useState<QuizMetadata | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleCopyLink = (quizId: string) => {
    const link = `${window.location.origin}${window.location.pathname}?quizId=${quizId}`;
    navigator.clipboard.writeText(link);
    setCopiedQuizId(quizId);
    setTimeout(() => setCopiedQuizId(null), 3000);
  };

  const handleDelete = async (quizId: string) => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف هذا الاختبار؟')) {
      setIsDeleting(quizId);
      try {
        await apiClient.delete(`/quizzes/${quizId}`);
        await deleteLocalQuiz(quizId);
        onDeleteSuccess();
      } catch (error: any) {
        if (!error.response && !navigator.onLine) {
          alert('لا يوجد اتصال بالإنترنت لإتمام عملية الحذف. حاول لاحقاً.');
        } else {
          alert(error?.response?.data?.message || 'حدث خطأ أثناء محاولة الحذف.');
        }
      } finally {
        setIsDeleting(null);
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200/80 mb-6 dir-rtl">
      <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">سجل الاختبارات المتاحة ({quizzes.length})</h3>
            <p className="text-xs text-slate-500">إدارة ومشاركة ورصد نتائج الاختبارات النشطة والمعطلة</p>
          </div>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
            title="جلب أحدث التغييرات يدوياً"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
            <span>تحديث القائمة</span>
          </button>
        )}
      </div>

      {quizzes.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 text-sm">
          لا توجد اختبارات مسجلة حالياً. قم بإنشاء وحفظ أول اختبار من النموذج أعلاه.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.map((quiz) => {
            const quizSubs = (submissions || []).filter((s) => s.quizId === quiz.id);
            const answeredCount = quizSubs.length;
            const passThreshold = quiz.passPercentage || 50;
            const passCount = quizSubs.filter((s) => {
              const pct = (s.score / (s.maxScore || 1)) * 100;
              return pct >= passThreshold;
            }).length;
            const passRate = answeredCount > 0 ? Math.round((passCount / answeredCount) * 100) : 0;

            return (
              <div
                key={quiz.id}
                className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Header info */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-extrabold text-slate-900 text-base leading-snug">
                      {quiz.title}
                    </h4>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shrink-0 ${
                        quiz.synced
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {quiz.synced ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      {quiz.synced ? 'متزامن سحابياً' : 'محفوظ محلياً'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1.5 mb-3">
                    <div className="flex items-center gap-3">
                      <span><strong>المادة:</strong> {quiz.subject || 'غير محدد'}</span>
                      <span><strong>الصف:</strong> {quiz.grade || 'جميع الصفوف'}</span>
                      {quiz.section && <span><strong>الشعبة:</strong> {quiz.section}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-slate-500">
                      <span><strong>عدد الأسئلة:</strong> {quiz.questions?.length || 0}</span>
                      <span><strong>المعلم:</strong> {quiz.teacherName || 'غير محدد'}</span>
                    </div>

                    {/* Compact Quiz Response & Pass Rate Info */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold pt-2 border-t border-slate-100">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200/70">
                        أجاب عنه: <span className="text-slate-900 font-extrabold">{answeredCount}</span>
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200/70">
                        نسبة الاجتياز والنجاح: <span className="text-emerald-900 font-extrabold">{passRate}%</span>
                      </span>
                    </div>
                  </div>
                </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
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
                        نسخ رابط الطالب
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setQrModalQuiz(quiz)}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                    title="عرض رمز QR"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectQuiz(quiz)}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs flex items-center gap-1 transition-all"
                    title="تعديل هذا الاختبار والأسئلة بنفس الرابط"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    تعديل
                  </button>

                  <button
                    type="button"
                    onClick={() => onViewAnalytics(quiz)}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs flex items-center gap-1"
                    title="نتائج الطلاب والإحصائيات"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    الإحصائيات
                  </button>

                  <button
                    type="button"
                    onClick={() => onPreviewQuiz(quiz)}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                    title="معاينة كطالب"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(quiz.id)}
                    disabled={isDeleting === quiz.id}
                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl disabled:opacity-50"
                    title="حذف الاختبار"
                  >
                    {isDeleting === quiz.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
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

            <p className="text-xs text-slate-500">امسح الرمز بواسطة كاميرا الهاتف للانتقال المباشر للاختبار</p>

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
