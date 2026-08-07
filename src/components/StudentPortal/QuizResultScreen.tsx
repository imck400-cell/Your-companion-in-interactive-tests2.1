import React, { useEffect } from 'react';
import { Submission } from '../../types';
import confetti from 'canvas-confetti';
import { Award, CheckCircle2, XCircle, SkipForward, RefreshCw, WifiOff, ArrowRight } from 'lucide-react';

interface QuizResultScreenProps {
  submission: Submission;
  isStatelessPublic?: boolean;
  onRetry?: () => void;
  onRestart: () => void;
  offlineSyncMessage?: string;
}

export const QuizResultScreen: React.FC<QuizResultScreenProps> = ({
  submission,
  isStatelessPublic = false,
  onRetry,
  onRestart,
  offlineSyncMessage,
}) => {
  const percentage = Math.round((submission.score / (submission.maxScore || 1)) * 100);
  const isPassed = percentage >= 50;

  useEffect(() => {
    if (isPassed) {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (err) {
        // Fallback
      }
    }
  }, [isPassed]);

  return (
    <div className="max-w-3xl mx-auto my-8 p-6 sm:p-8 bg-white rounded-3xl shadow-2xl border border-slate-200 dir-rtl space-y-6">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center shadow-xl ${
          isPassed
            ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-emerald-500/30'
            : 'bg-gradient-to-tr from-amber-500 to-red-500 text-white shadow-amber-500/30'
        }`}>
          <Award className="w-10 h-10 stroke-[2.5]" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
          {isPassed ? 'مبارك! أتممت الاختبار بنجاح' : 'أحسنت صنعاً! انتهيت من الاختبار'}
        </h2>
        <p className="text-xs text-slate-500">
          اسم الطالب: <span className="font-bold text-slate-800">{submission.studentName}</span> | الصف: <span className="font-bold text-slate-800">{submission.grade} ({submission.section})</span>
        </p>

        {!submission.synced && (
          <div className="inline-flex flex-col items-center gap-2 px-6 py-4 bg-amber-50 text-amber-900 border-2 border-amber-300 rounded-2xl text-sm font-black animate-pulse shadow-md">
            <div className="flex items-center gap-2">
              <WifiOff className="w-5 h-5 text-amber-600" />
              <span>{offlineSyncMessage || 'تم حفظ النتيجة محلياً بدون إنترنت، وستتم المزامنة تلقائياً عند الاتصال بالشبكة'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Stateless Notice Badge */}
      {isStatelessPublic && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 font-extrabold flex items-center justify-between gap-2">
          <span>اختبار عام لامركزي (Stateless): تم التقييم والتصحيح بالكامل محلياً (Client-Side JS) دون إرسال طلبات POST للخادم.</span>
          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg text-[10px]">Stateless Local</span>
        </div>
      )}

      {/* Main Score Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div className="text-center p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-extrabold text-slate-900">{submission.score} / {submission.maxScore}</div>
          <div className="text-xs font-bold text-slate-500 mt-1">الدرجة النهائية</div>
        </div>

        <div className="text-center p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-extrabold text-emerald-600">{submission.correctCount}</div>
          <div className="text-xs font-bold text-slate-500 mt-1 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            إجابة صحيحة
          </div>
        </div>

        <div className="text-center p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-extrabold text-red-600">{submission.incorrectCount}</div>
          <div className="text-xs font-bold text-slate-500 mt-1 flex items-center justify-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            إجابة خاطئة
          </div>
        </div>

        <div className="text-center p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-extrabold text-amber-600">{submission.skippedCount}</div>
          <div className="text-xs font-bold text-slate-500 mt-1 flex items-center justify-center gap-1">
            <SkipForward className="w-3.5 h-3.5 text-amber-600" />
            سؤال متخطي
          </div>
        </div>
      </div>

      {/* Breakdown per question */}
      <div className="space-y-3">
        <h3 className="font-extrabold text-slate-900 text-base">تقرير الأسئلة والإجابات النموذجية:</h3>
        {submission.details.map((item, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-2xl border text-xs space-y-2 ${
              item.isCorrect
                ? 'border-emerald-200 bg-emerald-50/40'
                : item.skipped
                ? 'border-amber-200 bg-amber-50/40'
                : 'border-red-200 bg-red-50/40'
            }`}
          >
            <div className="flex items-center justify-between font-bold text-slate-900 text-sm">
              <span>السؤال {idx + 1}: {item.questionText}</span>
              <span className={`px-2 py-0.5 rounded ${
                item.isCorrect ? 'bg-emerald-100 text-emerald-800' : item.skipped ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
              }`}>
                {item.earnedPoints} / {item.points} درجة
              </span>
            </div>

            <div className="text-slate-700 space-y-1">
              <div>
                <strong>إجابتك:</strong>{' '}
                {typeof item.studentAnswer === 'string' && item.studentAnswer.startsWith('data:image') ? (
                  <img src={item.studentAnswer} alt="رسمك" className="max-h-24 rounded border mt-1" />
                ) : (
                  <span>{JSON.stringify(item.studentAnswer || 'لم يُجب (تخطي)')}</span>
                )}
              </div>

              {item.correctAnswer && (
                <div className="text-emerald-800 font-bold">
                  <strong>الإجابة النموذجية:</strong> {JSON.stringify(item.correctAnswer)}
                </div>
              )}

              {item.explanation && (
                <div className="text-indigo-900 bg-indigo-50/80 p-2 rounded-lg border border-indigo-100 mt-2">
                  <strong>التوضيح:</strong> {item.explanation}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            أعد المحاولة (تصفير الإجابات وخلط الأسئلة محلياً)
          </button>
        )}
        <button
          type="button"
          onClick={onRestart}
          className="flex-1 py-3.5 bg-slate-900 text-white font-extrabold rounded-2xl text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          العودة إلى أرشيف الاختبارات
        </button>
      </div>
    </div>
  );
};
