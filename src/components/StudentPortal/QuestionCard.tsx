import React, { useState, useEffect } from 'react';
import { Question } from '../../types';
import { DrawingCanvas } from '../DrawingCanvas';
import { CheckCircle2, Circle, AlertCircle, HelpCircle, Lock } from 'lucide-react';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  currentAnswer: any;
  onAnswerChange: (ans: any) => void;
  showImmediateFeedback?: boolean;
  isAnswerSubmitted?: boolean;
  questionTimeSpentSeconds?: number;
  allowAnswerChange?: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  questionNumber,
  totalQuestions,
  currentAnswer,
  onAnswerChange,
  showImmediateFeedback = false,
  isAnswerSubmitted = false,
  questionTimeSpentSeconds = 0,
  allowAnswerChange = false,
}) => {
  // Matching local state
  const [matchingState, setMatchingState] = useState<{ [left: string]: string }>(currentAnswer || {});
  // Classify local state
  const [classifyState, setClassifyState] = useState<{ [category: string]: string[] }>(currentAnswer || {});

  const isAnswerGiven = (() => {
    if (currentAnswer === null || currentAnswer === undefined) return false;
    if (typeof currentAnswer === 'string') return currentAnswer.trim().length > 0;
    if (typeof currentAnswer === 'number' || typeof currentAnswer === 'boolean') return true;
    if (Array.isArray(currentAnswer)) return currentAnswer.length > 0;
    if (typeof currentAnswer === 'object') {
      const keys = Object.keys(currentAnswer);
      if (keys.length === 0) return false;
      return keys.some((k) => {
        const val = currentAnswer[k];
        if (typeof val === 'string') return val.trim().length > 0;
        if (Array.isArray(val)) return val.length > 0;
        return !!val;
      });
    }
    return !!currentAnswer;
  })();

  const isLocked = !allowAnswerChange && isAnswerGiven;

  useEffect(() => {
    if (question.type === 'matching' && currentAnswer) {
      setMatchingState(currentAnswer);
    }
    if (question.type === 'classify' && currentAnswer) {
      setClassifyState(currentAnswer);
    }
  }, [question.id, currentAnswer]);

  const handleMatchingSelect = (leftText: string, rightText: string) => {
    if (isLocked) return;
    const updated = { ...matchingState, [leftText]: rightText };
    setMatchingState(updated);
    onAnswerChange(updated);
  };

  const handleClassifyAssign = (category: string, itemText: string) => {
    if (isLocked) return;
    const updated = { ...classifyState };
    // Remove item from any existing category
    Object.keys(updated).forEach((cat) => {
      updated[cat] = (updated[cat] || []).filter((i) => i !== itemText);
    });
    if (!updated[category]) updated[category] = [];
    updated[category].push(itemText);
    setClassifyState(updated);
    onAnswerChange(updated);
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/90 dir-rtl my-4 space-y-6 transition-all">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-slate-900 text-white rounded-full text-xs font-bold">
            السؤال {questionNumber} من {totalQuestions}
          </span>
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
            {question.points} {question.points === 1 ? 'درجة' : 'درجات'}
          </span>
        </div>

        {/* Cognitive Time Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs font-mono font-bold rounded-xl shadow-xs">
          <span>⏱️ وقت السؤال:</span>
          <span className="text-indigo-600 font-extrabold">{questionTimeSpentSeconds}ث</span>
        </div>
      </div>

      {/* Answer Mode Notice Badge */}
      {isLocked ? (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-extrabold rounded-2xl animate-fadeIn">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>تم اعتماد إجابتك على هذا السؤال (غير مسموح بالتغيير أو إعادة الإجابة وفق إعدادات الاختبار).</span>
        </div>
      ) : allowAnswerChange && isAnswerGiven ? (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-2xl animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>يمكنك إعادة اختيار وتعديل إجابتك بحرية قبل التسليم النهائي.</span>
        </div>
      ) : null}

      {/* Question Text */}
      <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
        {question.questionText}
      </h3>

      {/* QUESTION TYPES IMPLEMENTATION */}

      {/* 1. Multiple Choice */}
      {question.type === 'multiple_choice' && (
        <div className="space-y-3">
          {(question.options || []).map((opt) => {
            const isSelected = currentAnswer === opt.text;
            const isCorrect = opt.isCorrect;

            let cardStyle = 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50';
            if (isSelected) cardStyle = 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-200';

            if (showImmediateFeedback && isAnswerSubmitted) {
              if (isCorrect) cardStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold';
              else if (isSelected && !isCorrect) cardStyle = 'border-red-500 bg-red-50 text-red-950 font-bold';
            }

            return (
              <button
                key={opt.id}
                type="button"
                disabled={isLocked}
                onClick={() => !isLocked && onAnswerChange(opt.text)}
                className={`w-full p-4 rounded-2xl border-2 text-right transition-all flex items-center justify-between gap-3 ${cardStyle} ${
                  isLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                }`}
              >
                <span className="text-sm font-bold">{opt.text}</span>
                {isSelected ? (
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 2. True / False */}
      {question.type === 'true_false' && (
        <div className="grid grid-cols-2 gap-4">
          {['صواب', 'خطأ'].map((val) => {
            const isSelected = currentAnswer === val;

            let btnStyle = val === 'صواب' ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900' : 'border-red-200 bg-red-50 hover:bg-red-100 text-red-900';
            if (isSelected) btnStyle += ' ring-4 ring-slate-800 font-extrabold shadow-lg';

            return (
              <button
                key={val}
                type="button"
                disabled={isLocked}
                onClick={() => !isLocked && onAnswerChange(val)}
                className={`py-6 rounded-2xl border-2 text-center text-lg font-extrabold transition-all ${btnStyle} ${
                  isLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                }`}
              >
                {val}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Fill in the blank */}
      {question.type === 'fill_in' && (
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-2">أدخل الكلمة أو العبارة الناقصة:</label>
          <input
            type="text"
            disabled={isLocked}
            readOnly={isLocked}
            value={currentAnswer || ''}
            onChange={(e) => !isLocked && onAnswerChange(e.target.value)}
            placeholder={isLocked ? 'تم تسجيل إجابتك' : 'اكتب إجابتك هنا...'}
            className={`w-full p-4 rounded-2xl border-2 border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none text-base font-bold text-slate-800 transition-all ${
              isLocked ? 'bg-slate-100/90 cursor-not-allowed' : ''
            }`}
          />
        </div>
      )}

      {/* 4. Matching (صل) */}
      {question.type === 'matching' && question.matchingPairs && (
        <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <p className="text-xs font-bold text-slate-600">اختر من القائمة المنسدلة للطرف الثاني ما يناسب كل عنصر:</p>
          <div className="space-y-3">
            {question.matchingPairs.map((pair) => (
              <div key={pair.id} className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
                <span className="font-extrabold text-slate-800 text-sm w-full sm:w-1/2">{pair.left}</span>
                <span className="text-slate-400 font-bold hidden sm:inline">←</span>
                <select
                  disabled={isLocked}
                  value={matchingState[pair.left] || ''}
                  onChange={(e) => !isLocked && handleMatchingSelect(pair.left, e.target.value)}
                  className={`w-full sm:w-1/2 p-2.5 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:border-indigo-500 outline-none ${
                    isLocked ? 'bg-slate-100 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="">-- اختر الطرف المناسب --</option>
                  {question.matchingPairs?.map((p) => (
                    <option key={p.id} value={p.right}>{p.right}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Classification (صنف) */}
      {question.type === 'classify' && question.classification && (
        <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <p className="text-xs font-bold text-slate-600">حدد الفئة التابعة لكل عنصر:</p>
          <div className="space-y-3">
            {question.classification.flatMap((c) => c.items).map((item, iIdx) => (
              <div key={iIdx} className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="font-bold text-slate-800 text-sm">{item}</span>
                <div className="flex flex-wrap items-center gap-2">
                  {question.classification?.map((cat) => {
                    const isAssigned = (classifyState[cat.category] || []).includes(item);

                    return (
                      <button
                        key={cat.category}
                        type="button"
                        disabled={isLocked}
                        onClick={() => !isLocked && handleClassifyAssign(cat.category, item)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          isAssigned
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                        } ${isLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                      >
                        {cat.category}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Drawing Canvas (ارسم) */}
      {question.type === 'drawing' && (
        <div>
          <p className="text-xs font-bold text-slate-600 mb-2">استخدم القلم الملوّن واللوحة أدناه للتعبير بالرسم:</p>
          <DrawingCanvas
            readOnly={isLocked}
            initialDataUrl={currentAnswer}
            onChange={(dataUrl) => !isLocked && onAnswerChange(dataUrl)}
          />
        </div>
      )}

      {/* 7. Essay / Explain / Direct Answer */}
      {(question.type === 'essay' || question.type === 'explain' || question.type === 'answer') && (
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-2">اكتب إجابتك الشاملة هنا:</label>
          <textarea
            rows={5}
            disabled={isLocked}
            readOnly={isLocked}
            value={currentAnswer || ''}
            onChange={(e) => !isLocked && onAnswerChange(e.target.value)}
            placeholder={isLocked ? 'تم تسجيل إجابتك' : 'اكتب التوضيح أو الشرح أو الشاهد هنا...'}
            className={`w-full p-4 rounded-2xl border-2 border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-slate-800 leading-relaxed transition-all ${
              isLocked ? 'bg-slate-100/90 cursor-not-allowed' : ''
            }`}
          />
        </div>
      )}

      {/* Explanation Feedback if available */}
      {showImmediateFeedback && isAnswerSubmitted && question.explanation && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-950 space-y-1 animate-fadeIn">
          <div className="font-bold flex items-center gap-1.5 text-indigo-900">
            <HelpCircle className="w-4 h-4 text-indigo-600" />
            التوضيح والشرح النموذجي للنموذج:
          </div>
          <p className="leading-relaxed">{question.explanation}</p>
        </div>
      )}
    </div>
  );
};
