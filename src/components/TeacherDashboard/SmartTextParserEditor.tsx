import React, { useState, useEffect } from 'react';
import { parseTextToQuestions, SAMPLE_QUIZ_TEMPLATES, ParseResult } from '../../services/quizParser';
import { Question } from '../../types';
import { FileCode, Sparkles, HelpCircle, CheckCircle2, AlertTriangle, Wand2, BookOpen, Bot, Copy, Eye, Table, X } from 'lucide-react';

interface SmartTextParserEditorProps {
  initialText?: string;
  onQuestionsParsed: (questions: Question[], rawText: string) => void;
}

export const SmartTextParserEditor: React.FC<SmartTextParserEditorProps> = ({
  initialText = '',
  onQuestionsParsed,
}) => {
  const [text, setText] = useState(initialText || SAMPLE_QUIZ_TEMPLATES[0].text);
  const [parseResult, setParseResult] = useState<ParseResult>(() => parseTextToQuestions(text));
  const [showSyntaxGuide, setShowSyntaxGuide] = useState(false);

  // States for Prompt Generator
  const [showAiModal, setShowAiModal] = useState(false);
  const [tfCount, setTfCount] = useState<number | ''>(0);
  const [mcqCount, setMcqCount] = useState<number | ''>(0);
  const [completeCount, setCompleteCount] = useState<number | ''>(0);
  const [explainCount, setExplainCount] = useState<number | ''>(0);
  const [matchingCount, setMatchingCount] = useState<number | ''>(0);
  const [categorizeCount, setCategorizeCount] = useState<number | ''>(0);
  const [drawCount, setDrawCount] = useState<number | ''>(0);
  const [directCount, setDirectCount] = useState<number | ''>(0);
  const [generatedPrompt, setGeneratedPrompt] = useState('');

  // States for Preview Table
  const [showPreview, setShowPreview] = useState(false);

  const generatePrompt = () => {
    let promptText = `دورك:
أنت خبير متمرس في التصميم التعليمي والقياس والتقويم التربوي.

المهمة الأساسية:
اقرأ الملف المرفق أو النص المقدم بعناية تامة. مطلوب منك استخراج أهم المعلومات وتحويلها إلى اختبار شامل ومتنوع. يجب أن تكون مخرجاتك عبارة عن نص خام (Raw Text) فقط، ولا تقم بإنشاء روابط تفاعلية بأي شكل من الأشكال.

معايير صياغة الأسئلة (الجانب المعرفي):
- يجب أن تقيس الأسئلة مهارات التفكير العليا: الفهم، التحليل، الاستنتاج، التفكير الناقد، وسرعة البديهة.
- تجنب أسئلة الحفظ والتلقين المباشر تماماً، وذلك لتعزيز بيئة التعلم النشط.
- تنبيه حاسم (في حال وجود أسئلة جاهزة): إذا تضمن الملف المرفق أسئلة جاهزة مسبقاً، يجب عليك اعتمادها كما هي دون تغيير أو تعديل في صياغتها، ولكن يُطلب منك فقط إعادة تنسيقها هيكلياً لتطابق "شروط التنسيق البرمجي" المذكورة أدناه.

شروط التنسيق البرمجي (إلزامية، صارمة، وغير قابلة للتفاوض):
يجب إخراج الأسئلة بنسق نصي محدد جداً ليتم قراءته عبر محرك برمجي (Regex Parser). ممنوع استخدام أي تنسيقات (مثل: الجداول، الخط العريض Bold، القوائم النقطية، أو أي تنسيقات Markdown). استخدم النص الخام فقط وفق القواعد التالية حرفياً:

- بداية السؤال: يجب أن يبدأ كل سؤال بالرمز [س] يتبعه نص السؤال.
- الخيار الصحيح: يجب أن يسبقه علامة النجمة * مباشرة (بدون مسافة).
- الخيارات الخاطئة: يجب أن يسبقها علامة الشرطة - مباشرة (بدون مسافة).
- التوضيح (للإجابة الصحيحة): يتم وضع التوضيح بعد إجابة كل سؤال في سطر مستقل، ويوضع بين معكوفتين بهذا الشكل تماماً: [توضيح : ]. (تأكد أن كلمة "توضيح" تأتي بعد المعكوفة الأولى مباشرة دون مسافات).

أمثلة تطبيقية للتنسيق المطلوب (يجب محاكاتها حرفياً):
1. لأسئلة الاختيار من متعدد:
[س] ما هي العاصمة الرسمية لليمن؟
-عدن
-تعز
*صنعاء
-الحديدة
[توضيح : صنعاء هي العاصمة السياسية والتاريخية للجمهورية اليمنية.]

2. لأسئلة الصواب والخطأ:
[س] تشرق الشمس من جهة الغرب؟
-صواب
*خطأ
[توضيح : تشرق الشمس دائماً من جهة الشرق بسبب دوران الأرض حول محورها من الغرب إلى الشرق.]

3. لأسئلة (أكمل، علل، مقالي، مصطلحات):
(ابدأ الإجابة بـ [نص] ثم علامة * وإذا كان هناك عدة إجابات محتملة افصل بينها بـ / ثم أضف التوضيح في النهاية).
[س] علل: حدوث ظاهرة الفصول الأربعة؟
[نص] *بسبب ميل محور الأرض / دوران الأرض حول الشمس / ميل محور الأرض أثناء دورانها
[توضيح : دوران الأرض حول الشمس مع ميل محورها يسبب اختلاف زاوية سقوط أشعة الشمس على الأرض.]

التعليمات النهائية: التزم بهذا النسق حرفياً في كل سؤال يتم توليده أو إعادة صياغته، ولا تضف أي مقدمات أو خاتمات خارج هذا النطاق.`;

    const requiredQuestions: string[] = [];
    if (Number(mcqCount) > 0) requiredQuestions.push(`- عدد أسئلة الاختيار من متعدد: ${mcqCount}`);
    if (Number(tfCount) > 0) requiredQuestions.push(`- عدد أسئلة الصواب والخطأ: ${tfCount}`);
    if (Number(completeCount) > 0) requiredQuestions.push(`- عدد أسئلة أكمل الفراغ: ${completeCount}`);
    if (Number(explainCount) > 0) requiredQuestions.push(`- عدد أسئلة التعليل والتفسير: ${explainCount}`);
    if (Number(matchingCount) > 0) requiredQuestions.push(`- عدد أسئلة التوصيل: ${matchingCount}`);
    if (Number(categorizeCount) > 0) requiredQuestions.push(`- عدد أسئلة صنف: ${categorizeCount}`);
    if (Number(drawCount) > 0) requiredQuestions.push(`- عدد أسئلة ارسم: ${drawCount}`);
    if (Number(directCount) > 0) requiredQuestions.push(`- عدد أسئلة سؤال مباشر: ${directCount}`);

    if (requiredQuestions.length > 0) {
      promptText += `\n\nبناءً على المعطيات التالية، قم بتوليد الأسئلة:\n` + requiredQuestions.join('\n');
    }

    setGeneratedPrompt(promptText);
  };

  const copyToClipboard = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt);
      alert('تم النسخ إلى الحافظة!');
    }
  };

  useEffect(() => {
    const res = parseTextToQuestions(text);
    setParseResult(res);
  }, [text]);

  const handleImport = () => {
    if (parseResult.questions.length > 0) {
      onQuestionsParsed(parseResult.questions, text);
    }
  };

  const loadTemplate = (templateText: string) => {
    setText(templateText);
  };

  const getQuestionTypeArabicLabel = (type: string): string => {
    switch (type) {
      case 'multiple_choice':
      case 'اختيارات':
        return 'اختيار من متعدد';
      case 'true_false':
      case 'صواب_خطأ':
        return 'صواب وخطأ';
      case 'fill_in':
      case 'fill_in_blank':
      case 'أكمل':
        return 'أكمل الفراغ';
      case 'essay':
      case 'مقالي':
        return 'مقالي';
      case 'matching':
      case 'صل':
        return 'صل (مطابقة)';
      case 'drawing':
      case 'ارسم':
        return 'ارسم (رسم تفاعلي)';
      case 'explain':
      case 'علل':
        return 'علل / بين السبب';
      case 'answer':
      case 'أجب':
        return 'أجب بإيجاز';
      case 'classify':
      case 'صنف':
        return 'صنف العناصر';
      default:
        return type;
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200/80 mb-6 dir-rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">محرر التفكيك النصي الذكي (Regex Text-to-Quiz Parser)</h3>
            <p className="text-xs text-slate-500">
              اكتب أو الصق الأسئلة مباشرة دون استخدام أي ذكاء اصطناعي خارجي - يقوم الكود بتحويلها تلقائياً إلى أسئلة تفاعلية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAiModal(true)}
            className="px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl flex items-center gap-1.5 shadow-md shadow-purple-600/20 transition-all"
          >
            <Bot className="w-4 h-4" />
            توليد الأسئلة بالذكاء الاصطناعي
          </button>
          <button
            type="button"
            onClick={() => setShowSyntaxGuide(!showSyntaxGuide)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1 transition-all"
          >
            <HelpCircle className="w-4 h-4 text-indigo-600" />
            {showSyntaxGuide ? 'إخفاء دليل النسق' : 'كيف أكتب الأسئلة؟'}
          </button>
        </div>
      </div>

      {/* Syntax Cheatsheet Accordion */}
      {showSyntaxGuide && (
        <div className="mb-4 p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-slate-700 space-y-2">
          <h4 className="font-bold text-indigo-900 text-sm mb-2 flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            قواعد كتابة الأسئلة للـ Parser القياسي:
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 leading-relaxed">
            <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
              <span className="font-bold text-indigo-800 block mb-1">1. بداية السؤال:</span>
              ابدأ السطر بـ <code className="bg-indigo-100 px-1 py-0.5 rounded text-indigo-900 font-bold">[س]</code> أو <code className="bg-indigo-100 px-1 py-0.5 rounded text-indigo-900 font-bold">س:</code> متبوعاً بنص السؤال.
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
              <span className="font-bold text-indigo-800 block mb-1">2. تحديد الخيارات والإجابة الصحيحة:</span>
              ضع نجمة <code className="bg-amber-100 px-1.5 py-0.5 rounded text-amber-900 font-bold">*</code> بداية السطر المخصص للإجابة الصحيحة، وشرطة <code className="bg-slate-100 px-1.5 py-0.5 rounded font-bold">-</code> للخيارات الأخرى.
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
              <span className="font-bold text-indigo-800 block mb-1">3. أنواع الأسئلة المتاحة:</span>
              <code className="bg-slate-100 p-0.5 rounded">[نوع: اختيارات]</code>, <code className="bg-slate-100 p-0.5 rounded">[نوع: صواب_خطأ]</code>, <code className="bg-slate-100 p-0.5 rounded">[نوع: أكمل]</code>, <code className="bg-slate-100 p-0.5 rounded">[نوع: صل]</code>, <code className="bg-slate-100 p-0.5 rounded">[نوع: صنف]</code>, <code className="bg-slate-100 p-0.5 rounded">[نوع: ارسم]</code>, <code className="bg-slate-100 p-0.5 rounded">[نوع: علل]</code>, <code className="bg-slate-100 p-0.5 rounded">[نوع: مقالي]</code>.
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
              <span className="font-bold text-indigo-800 block mb-1">4. الدرجات والتوضيحات:</span>
              استخدم <code className="bg-slate-100 px-1 rounded">[درجة: 2]</code> للدرجة، و <code className="bg-slate-100 px-1 rounded">[توضيح: الشرح]</code> للتغذية الراجعة الشارحة.
            </div>
          </div>
        </div>
      )}

      {/* Quick Template Inserters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
          <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
          تحميل نموذج جاهز للربط الفوري:
        </span>
        {SAMPLE_QUIZ_TEMPLATES.map((tmpl, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => loadTemplate(tmpl.text)}
            className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-all flex items-center gap-1"
          >
            <BookOpen className="w-3 h-3" />
            {tmpl.title}
          </button>
        ))}
      </div>

      {/* Main Textarea */}
      <div className="relative mb-3">
        <textarea
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب أسئلتك هنا بأسلوب نسق الـ Parser..."
          className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-slate-800 font-mono leading-relaxed transition-all shadow-inner bg-slate-50/50"
        />
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-indigo-700 shadow-sm flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          عدد الأسئلة المكتشفة: {parseResult.rawStats.totalParsed}
        </div>
      </div>

      {/* Realtime Parser Summary / Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-700">توزُّع الأسئلة:</span>
          {Object.entries(parseResult.rawStats.typeCounts).map(([type, count]) => (
            <span key={type} className="px-2.5 py-1 bg-indigo-100 text-indigo-900 rounded-lg font-extrabold flex items-center gap-1 border border-indigo-200">
              {getQuestionTypeArabicLabel(type)}: <span className="text-emerald-700">{count}</span>
            </span>
          ))}
          {parseResult.rawStats.totalParsed === 0 && (
            <span className="text-slate-400">لم يتم اكتشاف أي سؤال حتى الآن</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowPreview(true)}
          disabled={parseResult.questions.length === 0}
          className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Eye className="w-4 h-4" />
          معاينة الأسئلة قبل الحفظ ({parseResult.questions.length})
        </button>
      </div>

      {/* Warnings / Errors */}
      {parseResult.warnings.length > 0 && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
          {parseResult.warnings.map((w, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Preview Safe Table Modal/Section */}
      {showPreview && (
        <div className="mt-6 border-t-2 border-slate-200 pt-6 animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Table className="w-5 h-5 text-indigo-600" />
              المعاينة الآمنة للأسئلة
            </h3>
            <button
              onClick={() => setShowPreview(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
            >
              إخفاء المعاينة
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-center w-12">#</th>
                  <th className="px-4 py-3 w-32">نوع السؤال</th>
                  <th className="px-4 py-3 w-1/2">نص السؤال</th>
                  <th className="px-4 py-3 w-1/4">الإجابة الصحيحة / النموذجية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parseResult.questions.map((q, idx) => {
                  const isChoiceOrTF = q.type === 'multiple_choice' || q.type === 'true_false';
                  const hasCorrectChoice = q.options?.some(o => o.isCorrect);
                  const isMissingCorrect = isChoiceOrTF && !hasCorrectChoice && !q.correctAnswer;
                  
                  return (
                    <tr key={idx} className={`transition-colors ${isMissingCorrect ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-3 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-indigo-700">
                        {getQuestionTypeArabicLabel(q.type)}
                      </td>
                      <td className="px-4 py-3 text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                        {q.questionText}
                      </td>
                      <td className="px-4 py-3">
                        {isMissingCorrect ? (
                          <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            مفقودة (لم يتم وضع *)
                          </span>
                        ) : (
                          <div className="text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">
                            {q.correctAnswer && <div>{q.correctAnswer}</div>}
                            {q.options?.filter(o => o.isCorrect).map((o, i) => (
                              <div key={i} className="text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> {o.text}
                              </div>
                            ))}
                            {q.matchingPairs && q.matchingPairs.map((p, i) => (
                              <div key={i} className="text-xs border-b border-slate-100 last:border-0 pb-1 mb-1">
                                <span className="font-bold">{p.left}</span> = <span className="text-emerald-700">{p.right}</span>
                              </div>
                            ))}
                            {q.classification && q.classification.map((c, i) => (
                              <div key={i} className="text-xs border-b border-slate-100 last:border-0 pb-1 mb-1">
                                <span className="font-bold">{c.category}:</span> <span className="text-emerald-700">{c.items.join('، ')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {parseResult.questions.some(q => (q.type === 'multiple_choice' || q.type === 'true_false') && !q.options?.some(o => o.isCorrect) && !q.correctAnswer) && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 font-bold text-sm flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              السؤال المظلل بالأحمر يفتقد لتحديد الإجابة الصحيحة بعلامة النجمة (*). يرجى التعديل قبل الحفظ النهائي
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleImport}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
            >
              <CheckCircle2 className="w-5 h-5" />
              حفظ واعتماد الأسئلة النهائية
            </button>
          </div>
        </div>
      )}

      {/* AI Prompt Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 dir-rtl">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scaleUp">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-center justify-between z-10">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Bot className="w-6 h-6 text-purple-600" />
                مولد برومبت الذكاء الاصطناعي (AI Prompt Generator)
              </h2>
              <button
                onClick={() => setShowAiModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-purple-50 text-purple-900 p-4 rounded-2xl border border-purple-100 text-sm font-semibold flex items-start gap-3 leading-relaxed">
                <Sparkles className="w-6 h-6 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  هذه الأداة تساعدك في إنشاء "أمر برمجي" (Prompt) جاهز للنسخ، لتطلبه من ChatGPT أو Gemini وغيرها. سيقوم الذكاء الاصطناعي بكتابة الأسئلة بالتنسيق الدقيق المطلوب ليقرأه النظام لدينا مباشرة دون أخطاء.
                </div>
              </div>

              {/* Counts */}
              <div>
                <h3 className="font-bold text-slate-700 mb-3 text-sm">توزيع عدد الأسئلة المطلوبة (اضغط على الحقل لتعديل العدد مباشرة):</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">الصواب والخطأ</label>
                    <input
                      type="number"
                      min={0}
                      value={tfCount}
                      onChange={(e) => setTfCount(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">الاختيار من متعدد</label>
                    <input
                      type="number"
                      min={0}
                      value={mcqCount}
                      onChange={(e) => setMcqCount(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">أكمل الفراغ</label>
                    <input
                      type="number"
                      min={0}
                      value={completeCount}
                      onChange={(e) => setCompleteCount(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">علل</label>
                    <input
                      type="number"
                      min={0}
                      value={explainCount}
                      onChange={(e) => setExplainCount(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">التوصيل</label>
                    <input
                      type="number"
                      min={0}
                      value={matchingCount}
                      onChange={(e) => setMatchingCount(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">صنف</label>
                    <input
                      type="number"
                      min={0}
                      value={categorizeCount}
                      onChange={(e) => setCategorizeCount(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ارسم</label>
                    <input
                      type="number"
                      min={0}
                      value={drawCount}
                      onChange={(e) => setDrawCount(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">سؤال مباشر</label>
                    <input
                      type="number"
                      min={0}
                      value={directCount}
                      onChange={(e) => setDirectCount(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={generatePrompt}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-purple-600/20 transition-all text-sm"
                >
                  <Wand2 className="w-5 h-5" />
                  إنشاء نص البرومبت
                </button>
              </div>

              {/* Result Prompt */}
              {generatedPrompt && (
                <div className="border border-purple-200 bg-purple-50/50 rounded-2xl p-4 animate-fadeIn space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-purple-900">البرومبت الجاهز (انسخه وضعه في ChatGPT):</span>
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      className="px-4 py-2 bg-white border border-purple-200 hover:bg-purple-50 text-purple-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Copy className="w-4 h-4" />
                      نسخ (Copy to Clipboard)
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={generatedPrompt}
                    rows={12}
                    className="w-full p-4 rounded-xl border border-purple-200 bg-white text-slate-800 text-xs font-mono leading-relaxed outline-none resize-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
