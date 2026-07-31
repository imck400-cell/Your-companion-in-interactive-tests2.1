import React, { useState } from 'react';
import { Question, QuestionType, Option, MatchingPair, ClassificationGroup } from '../../types';
import { Plus, Trash2, Edit2, ArrowUp, ArrowDown, HelpCircle, Check, ListChecks } from 'lucide-react';

interface FormQuestionBuilderProps {
  questions: Question[];
  onChange: (updatedQuestions: Question[]) => void;
}

export const FormQuestionBuilder: React.FC<FormQuestionBuilderProps> = ({
  questions,
  onChange,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const addNewQuestion = () => {
    const newQ: Question = {
      id: `q_manual_${Date.now()}`,
      type: 'multiple_choice',
      questionText: 'سؤال جديد...',
      points: 1,
      options: [
        { id: `opt_1_${Date.now()}`, text: 'خيار 1', isCorrect: true },
        { id: `opt_2_${Date.now()}`, text: 'خيار 2', isCorrect: false },
        { id: `opt_3_${Date.now()}`, text: 'خيار 3', isCorrect: false },
      ],
    };
    onChange([...questions, newQ]);
    setEditingId(newQ.id);
  };

  const deleteQuestion = (id: string) => {
    onChange(questions.filter((q) => q.id !== id));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...questions];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newQuestions.length) return;
    const temp = newQuestions[index];
    newQuestions[index] = newQuestions[targetIdx];
    newQuestions[targetIdx] = temp;
    onChange(newQuestions);
  };

  const updateQuestion = (id: string, updatedFields: Partial<Question>) => {
    onChange(
      questions.map((q) => (q.id === id ? { ...q, ...updatedFields } : q))
    );
  };

  const getTypeLabel = (type: QuestionType) => {
    switch (type) {
      case 'multiple_choice': return 'اختيار من متعدد';
      case 'true_false': return 'صواب وخطأ';
      case 'fill_in': return 'أكمل الفراغ';
      case 'essay': return 'مقالي';
      case 'matching': return 'صل (مطابقة)';
      case 'drawing': return 'ارسم (رسم تفاعلي)';
      case 'explain': return 'علل / بين السبب';
      case 'answer': return 'أجب بإيجاز';
      case 'classify': return 'صنف العناصر';
      default: return type;
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200/80 mb-6 dir-rtl">
      <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
            <ListChecks className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">قائمة الأسئلة المنظمة ({questions.length})</h3>
            <p className="text-xs text-slate-500">يمكنك تعديل الأسئلة المحللة أو إضافة وإعادة ترتيب أي سؤال بمرونة</p>
          </div>
        </div>

        <button
          type="button"
          onClick={addNewQuestion}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          إضافة سؤال جديد
        </button>
      </div>

      {questions.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 text-sm">
          لم يتم إضافة أي سؤال حتى الآن. استخدم محرر التفكيك النصي أعلاه أو انقر على "إضافة سؤال جديد".
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => {
            const isEditing = editingId === q.id;

            return (
              <div
                key={q.id}
                className={`p-4 rounded-xl border transition-all ${
                  isEditing
                    ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-100'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md">
                      {getTypeLabel(q.type)}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      ({q.points} {q.points === 1 ? 'درجة' : 'درجات'})
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveQuestion(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-30"
                      title="تحريك للأعلى"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveQuestion(idx, 'down')}
                      disabled={idx === questions.length - 1}
                      className="p-1 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-30"
                      title="تحريك للأسفل"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : q.id)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-indigo-600 font-bold text-xs flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      {isEditing ? 'إنهاء التعديل' : 'تعديل التفاصيل'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteQuestion(q.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-600"
                      title="حذف السؤال"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Text & Options Summary */}
                {!isEditing ? (
                  <div className="space-y-2 my-1">
                    <div className="text-sm font-bold text-slate-800">
                      {q.questionText}
                    </div>

                    {/* Display ALL options for Multiple Choice and True/False */}
                    {q.options && q.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                        {q.options.map((opt, oIdx) => {
                          const arabicLetter = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'][oIdx] || `${oIdx + 1}`;
                          return (
                            <div
                              key={opt.id || oIdx}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                                opt.isCorrect
                                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-black ring-1 ring-emerald-200'
                                  : 'bg-slate-50/80 border-slate-200 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-lg text-[11px] font-black flex items-center justify-center shrink-0 ${
                                  opt.isCorrect ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {arabicLetter}
                                </span>
                                <span>{opt.text}</span>
                              </div>
                              {opt.isCorrect && (
                                <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] rounded-md font-extrabold shrink-0 shadow-xs">
                                  الإجابة الصحيحة ✓
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Display Matching Pairs */}
                    {q.matchingPairs && q.matchingPairs.length > 0 && (
                      <div className="space-y-1.5 text-xs pt-1">
                        <span className="font-bold text-slate-500 block text-[11px]">أزواج التوصيل والمطابقة:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.matchingPairs.map((p, pIdx) => (
                            <div key={p.id || pIdx} className="p-2 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-center justify-between">
                              <span className="font-extrabold text-indigo-900">{p.left}</span>
                              <span className="text-indigo-400 font-bold">←</span>
                              <span className="font-bold text-slate-800">{p.right}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Display Classification Groups */}
                    {q.classification && q.classification.length > 0 && (
                      <div className="space-y-1.5 text-xs pt-1">
                        <span className="font-bold text-slate-500 block text-[11px]">مجموعات التصنيف:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.classification.map((cat, cIdx) => (
                            <div key={cIdx} className="p-2 bg-purple-50/60 border border-purple-100 rounded-xl">
                              <span className="font-extrabold text-purple-900 block mb-1">{cat.category}:</span>
                              <span className="text-slate-700 font-medium">{cat.items.join(' ، ')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Display Correct Answer for Fill-in / Short Answer / Explain */}
                    {q.correctAnswer && (!q.options || q.options.length === 0) && (
                      <div className="text-xs text-indigo-900 font-bold bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 inline-flex items-center gap-1.5">
                        <span className="text-indigo-600">الإجابة النموذجية:</span>
                        <span>{q.correctAnswer}</span>
                      </div>
                    )}

                    {/* Display Explanation if present */}
                    {q.explanation && (
                      <div className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="font-bold text-slate-700">التوضيح: </span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 mt-3 pt-3 border-t border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">نص السؤال</label>
                      <input
                        type="text"
                        value={q.questionText}
                        onChange={(e) => updateQuestion(q.id, { questionText: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-emerald-500 outline-none font-bold"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">نوع السؤال</label>
                        <select
                          value={q.type}
                          onChange={(e) => {
                            const newType = e.target.value as QuestionType;
                            let newOpts = q.options;
                            if (newType === 'multiple_choice' && (!newOpts || newOpts.length === 0)) {
                              newOpts = [
                                { id: `opt_1_${Date.now()}`, text: 'خيار 1', isCorrect: true },
                                { id: `opt_2_${Date.now()}`, text: 'خيار 2', isCorrect: false },
                                { id: `opt_3_${Date.now()}`, text: 'خيار 3', isCorrect: false },
                              ];
                            }
                            updateQuestion(q.id, { type: newType, options: newOpts });
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-bold"
                        >
                          <option value="multiple_choice">اختيار من متعدد</option>
                          <option value="true_false">صواب وخطأ</option>
                          <option value="fill_in">أكمل الفراغ</option>
                          <option value="essay">مقالي</option>
                          <option value="matching">صل (مطابقة)</option>
                          <option value="drawing">ارسم (رسم تفاعلي)</option>
                          <option value="explain">علل / بين السبب</option>
                          <option value="answer">أجب بإيجاز</option>
                          <option value="classify">صنف العناصر</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">الدرجة المخصصة</label>
                        <input
                          type="number"
                          min="1"
                          value={q.points}
                          onChange={(e) => updateQuestion(q.id, { points: parseInt(e.target.value || '1', 10) })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                        />
                      </div>
                    </div>

                    {/* Type specific editor options */}
                    {q.type === 'multiple_choice' && (
                      <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-extrabold text-slate-800">
                            خيارات الإجابة (حدد الإجابة الصحيحة بالـ Radio Button):
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const curOpts = q.options || [];
                              const newOpt: Option = {
                                id: `opt_${Date.now()}_${curOpts.length + 1}`,
                                text: `خيار ${curOpts.length + 1}`,
                                isCorrect: curOpts.length === 0,
                              };
                              updateQuestion(q.id, { options: [...curOpts, newOpt] });
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg flex items-center gap-1 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            إضافة خيار آخر
                          </button>
                        </div>

                        {(q.options || []).map((opt, optIdx) => (
                          <div key={opt.id || optIdx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct_${q.id}`}
                              checked={!!opt.isCorrect}
                              onChange={() => {
                                const newOpts = (q.options || []).map((o) => ({
                                  ...o,
                                  isCorrect: o.id === opt.id,
                                }));
                                updateQuestion(q.id, { options: newOpts });
                              }}
                              className="w-4 h-4 accent-emerald-600 cursor-pointer"
                              title="حدد هذا الخيار كإجابة صحيحة"
                            />
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => {
                                const newOpts = [...(q.options || [])];
                                newOpts[optIdx].text = e.target.value;
                                updateQuestion(q.id, { options: newOpts });
                              }}
                              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:border-emerald-500 outline-none bg-white"
                            />
                            {(q.options || []).length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newOpts = (q.options || []).filter((_, i) => i !== optIdx);
                                  if (opt.isCorrect && newOpts.length > 0) {
                                    newOpts[0].isCorrect = true;
                                  }
                                  updateQuestion(q.id, { options: newOpts });
                                }}
                                className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-all"
                                title="حذف هذا الخيار"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === 'true_false' && (
                      <div className="bg-slate-50 p-3 rounded-xl space-y-2">
                        <label className="block text-xs font-bold text-slate-700">الإجابة الصحيحة:</label>
                        <div className="flex items-center gap-4 text-xs font-bold">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`tf_${q.id}`}
                              checked={q.correctAnswer === 'صواب' || q.correctAnswer === 'صح'}
                              onChange={() => updateQuestion(q.id, { correctAnswer: 'صواب' })}
                              className="accent-emerald-600"
                            />
                            صواب
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`tf_${q.id}`}
                              checked={q.correctAnswer === 'خطأ'}
                              onChange={() => updateQuestion(q.id, { correctAnswer: 'خطأ' })}
                              className="accent-emerald-600"
                            />
                            خطأ
                          </label>
                        </div>
                      </div>
                    )}

                    {(q.type === 'fill_in' || q.type === 'explain' || q.type === 'answer') && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">النموذج الإرشادي للإجابة الصحيحة</label>
                        <input
                          type="text"
                          value={q.correctAnswer || ''}
                          onChange={(e) => updateQuestion(q.id, { correctAnswer: e.target.value })}
                          placeholder="أدخل الإجابة النموذجية..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">التغذية الراجعة / الشرح التوضيحي للطلاب</label>
                      <input
                        type="text"
                        value={q.explanation || ''}
                        onChange={(e) => updateQuestion(q.id, { explanation: e.target.value })}
                        placeholder="أدخل توضيح يظهر للطلاب بعد الحل..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
