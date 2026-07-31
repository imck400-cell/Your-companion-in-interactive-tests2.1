import { Question, QuestionType, Option, MatchingPair, ClassificationGroup } from '../types';

/**
 * Normalizes Arabic text by removing Tashkeel (diacritics), unifying Alif/Yaa/Taa-Marbouta variants,
 * and stripping extra whitespaces.
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    // Remove Arabic diacritics / Tashkeel
    .replace(/[\u064B-\u0652\u0640]/g, '')
    // Unify Alif variants (أ, إ, آ -> ا)
    .replace(/[أإآ]/g, 'ا')
    // Unify Taa Marbouta (ة -> ه)
    .replace(/ة/g, 'ه')
    // Unify Yaa (ى -> ي)
    .replace(/ى/g, 'ي')
    // Replace punctuation and symbols with space if needed or strip
    .replace(/[,\.\-\_\/\\|\:\;\!]/g, ' ')
    // Convert multiple whitespace/newlines to single space
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Evaluates a short answer (e.g. fill_in, direct answer, explain) against model answer(s).
 * Supports synonyms separated by '/' or ',' or '|' or 'أو'.
 */
export function evaluateShortAnswer(userAnswer: string, modelAnswer: string): boolean {
  if (!userAnswer || !modelAnswer) return false;

  const normalizedUser = normalizeArabicText(userAnswer);
  if (!normalizedUser) return false;

  // Split model answer by synonyms separators
  const synonyms = modelAnswer
    .split(/\s*(?:\/|\||,|أو)\s*/gi)
    .map((s) => normalizeArabicText(s))
    .filter(Boolean);

  if (synonyms.length === 0) return false;

  // Exact or partial synonym match
  return synonyms.some((syn) => {
    if (normalizedUser === syn) return true;
    // Allow fuzzy inclusions for longer answers
    if (syn.length > 3 && normalizedUser.includes(syn)) return true;
    if (normalizedUser.length > 3 && syn.includes(normalizedUser)) return true;
    return false;
  });
}

export interface ParseResult {
  questions: Question[];
  errors: string[];
  warnings: string[];
  rawStats: {
    totalParsed: number;
    typeCounts: Record<string, number>;
  };
}

export function parseTextToQuestions(text: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const questions: Question[] = [];
  const typeCounts: Record<string, number> = {};

  if (!text || !text.trim()) {
    return {
      questions: [],
      errors: ['النص المنسق فارغ. يرجى كتابة أو لصق الأسئلة حسب النسق الموضّح.'],
      warnings: [],
      rawStats: { totalParsed: 0, typeCounts: {} },
    };
  }

  // Split text into question blocks based on question headers [س] or [سؤال] or س1: or line starting with [س]
  const rawBlocks = text.split(/(?=\n(?:\[س\]|\[سؤال\]|س\d*[\:\-]|السؤال\s*\d*[\:\-]))/gi);

  for (let blockIndex = 0; blockIndex < rawBlocks.length; blockIndex++) {

    const blockText = rawBlocks[blockIndex].trim();
    if (!blockText) continue;

    const lines = blockText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const firstLine = lines[0];

    // Extract Question Text
    // Regex matches [س], [سؤال], س1:, السؤال الأول:, etc.
    let questionText = firstLine.replace(/^(?:\[س\]|\[سؤال\]|س\d*[\:\-]|السؤال\s*\d*[\:\-])\s*/i, '').trim();

    // Default parameters
    let qType: QuestionType | null = null;
    let points = 1;
    let explanation = '';
    let correctAnswer = '';
    const options: Option[] = [];
    const matchingPairs: MatchingPair[] = [];
    const categoryMap: Record<string, string[]> = {};

    // Check for explicit type in header line or subsequent lines e.g. [نوع: اختيارات]
    const typeMatch = blockText.match(/\[نوع\s*:\s*([^\]]+)\]/i);
    if (typeMatch) {
      const typeStr = typeMatch[1].trim().toLowerCase();
      if (typeStr.includes('اختيار') || typeStr.includes('متعدد') || typeStr.includes('mcq')) {
        qType = 'multiple_choice';
      } else if (typeStr.includes('صواب') || typeStr.includes('صح') || typeStr.includes('خطأ')) {
        qType = 'true_false';
      } else if (typeStr.includes('أكمل') || typeStr.includes('فراغ')) {
        qType = 'fill_in';
      } else if (typeStr.includes('صل') || typeStr.includes('مطابقة') || typeStr.includes('توصيل')) {
        qType = 'matching';
      } else if (typeStr.includes('رسم') || typeStr.includes('ارسم')) {
        qType = 'drawing';
      } else if (typeStr.includes('علل') || typeStr.includes('سبب')) {
        qType = 'explain';
      } else if (typeStr.includes('أجب') || typeStr.includes('إجابة')) {
        qType = 'answer';
      } else if (typeStr.includes('صنف') || typeStr.includes('تصنيف')) {
        qType = 'classify';
      } else if (typeStr.includes('مقالي')) {
        qType = 'essay';
      }
    }

    // Check for explicit points e.g. [درجة: 2] or (3 درجات)
    const pointsMatch = blockText.match(/(?:\[درجة\s*:\s*(\d+)\]|\[درجات\s*:\s*(\d+)\]|\((\d+)\s*درجة?s?\))/i);
    if (pointsMatch) {
      points = parseInt(pointsMatch[1] || pointsMatch[2] || pointsMatch[3] || '1', 10);
    }

    // Check for explanation e.g. [توضيح: ...] or [علل: ...]
    const expMatch = blockText.match(/\[توضيح\s*:\s*([^\]\n]+)\]/i);
    if (expMatch) {
      explanation = expMatch[1].trim();
    }

    // Check for correct answer e.g. [إجابة: ...] or [الإجابة: ...]
    const ansMatch = blockText.match(/\[الإجابة\s*:\s*([^\]\n]+)\]|\[إجابة\s*:\s*([^\]\n]+)\]/i);
    if (ansMatch) {
      correctAnswer = (ansMatch[1] || ansMatch[2]).trim();
    }

    // Parse line by line for choices, pairs, categories
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Ignore metadata lines already parsed
      if (/^\[نوع\s*:/i.test(line) || /^\[درجة\s*:/i.test(line) || /^\[توضيح\s*:/i.test(line) || /^\[إجابة\s*:/i.test(line)) {
        continue;
      }

      // Option line e.g., * الإجابة الصحيحة  or  - خيار عادي  or  1. خيار  or  أ) خيار
      if (/^[\*\-\+\•]\s*/.test(line) || /^[أبجد\d][\.\-\)]\s*/.test(line) || /^\([أبجد\d]\)\s*/.test(line)) {
        const isCorrect = line.startsWith('*') || line.includes('[صحيح]') || line.includes('(صح)') || line.includes('[الإجابة الصحيحة]');
        const cleanOptText = line
          .replace(/^[\*\-\+\•]\s*/, '')
          .replace(/^[أبجد\d][\.\-\)]\s*/, '')
          .replace(/^\([أبجد\d]\)\s*/, '')
          .replace(/\[صحيح\]|\(صح\)|\[الإجابة الصحيحة\]/gi, '')
          .trim();
        if (cleanOptText) {
          options.push({
            id: `opt_${blockIndex}_${options.length + 1}`,
            text: cleanOptText,
            isCorrect: isCorrect,
          });
        }
      }

      // Matching line e.g.,  عنصر 1 = عنصر 2   or   أ : ب  or  [صل] أ -> ب
      else if (line.includes('=') || line.includes('->') || line.includes('=>') || /^\[صل\]/.test(line)) {
        const cleanLine = line.replace(/^\[صل\]\s*/i, '');
        const delimiter = cleanLine.includes('=') ? '=' : cleanLine.includes('->') ? '->' : cleanLine.includes('=>') ? '=>' : ':';
        const parts = cleanLine.split(delimiter);
        if (parts.length >= 2) {
          matchingPairs.push({
            id: `pair_${blockIndex}_${matchingPairs.length + 1}`,
            left: parts[0].trim(),
            right: parts.slice(1).join(delimiter).trim(),
          });
        }
      }

      // Classify line e.g.,  [تصنيف] الفلزات : الحديد  or  الفئة -> العنصر
      else if (/^\[تصنيف\]/i.test(line) || (line.includes(':') && qType === 'classify')) {
        const cleanLine = line.replace(/^\[تصنيف\]\s*/i, '');
        const parts = cleanLine.split(/[:\-\>]+/);
        if (parts.length >= 2) {
          const category = parts[0].trim();
          const item = parts[1].trim();
          if (!categoryMap[category]) categoryMap[category] = [];
          categoryMap[category].push(item);
        }
      }
    }

    // Auto-detect question type if not explicitly tagged
    if (!qType) {
      if (matchingPairs.length > 0) {
        qType = 'matching';
      } else if (Object.keys(categoryMap).length > 0) {
        qType = 'classify';
      } else if (options.length > 0) {
        // Check if options are True/False
        const optTexts = options.map((o) => o.text.trim());
        if (
          optTexts.some((t) => t === 'صح' || t === 'خطأ' || t === 'صواب' || t === 'خطأ') &&
          optTexts.length <= 3
        ) {
          qType = 'true_false';
        } else {
          qType = 'multiple_choice';
        }
      } else if (/^ارسم|^وضح بالرسم/i.test(questionText)) {
        qType = 'drawing';
      } else if (/^علل|^اذكر السبب|^بين سبب/i.test(questionText)) {
        qType = 'explain';
      } else if (/__{2,}|\[فراغ\]|\.\.\./.test(questionText)) {
        qType = 'fill_in';
      } else if (/^أجب|^ما هو|^ما هي|^عرف/i.test(questionText)) {
        qType = 'answer';
      } else {
        qType = 'essay';
      }
    }

    // Process True/False auto-options
    if (qType === 'true_false' && options.length === 0) {
      const isTrue = correctAnswer === 'صح' || correctAnswer === 'صواب' || correctAnswer === 'true';
      options.push(
        { id: `opt_${blockIndex}_1`, text: 'صواب', isCorrect: isTrue },
        { id: `opt_${blockIndex}_2`, text: 'خطأ', isCorrect: !isTrue }
      );
    }

    // Build classification group array
    const classification: ClassificationGroup[] = Object.keys(categoryMap).map((cat) => ({
      category: cat,
      items: categoryMap[cat],
    }));

    // Ensure multiple choice has at least one correct option flagged
    if (qType === 'multiple_choice' && options.length > 0 && !options.some((o) => o.isCorrect)) {
      if (correctAnswer) {
        const found = options.find((o) => o.text.trim() === correctAnswer.trim());
        if (found) found.isCorrect = true;
        else options[0].isCorrect = true;
      } else {
        options[0].isCorrect = true; // Fallback
        warnings.push(`السؤال ${questions.length + 1}: لم تُحدد الخيار الصحيح بنجمة (*)، تم تحديد الخيار الأول تلقائياً.`);
      }
    }

    const questionObj: Question = {
      id: `q_${Date.now()}_${blockIndex + 1}`,
      type: qType,
      questionText: questionText || `سؤال ${questions.length + 1}`,
      options: options.length > 0 ? options : undefined,
      correctAnswer: correctAnswer || undefined,
      matchingPairs: matchingPairs.length > 0 ? matchingPairs : undefined,
      classification: classification.length > 0 ? classification : undefined,
      explanation: explanation || undefined,
      points: points,
    };

    questions.push(questionObj);
    typeCounts[qType] = (typeCounts[qType] || 0) + 1;
  }

  return {
    questions,
    errors,
    warnings,
    rawStats: {
      totalParsed: questions.length,
      typeCounts,
    },
  };
}

// Sample Comprehensive Quiz Text Templates for Teachers
export const SAMPLE_QUIZ_TEMPLATES = [
  {
    title: 'نموذج شامل لجميع أنواع الأسئلة (علوم)',
    text: `[س] ما هو الكوكب المسمى بالكوكب الأحمر؟ [نوع: اختيارات] [درجة: 2]
- الكوكب الأرض
- كوكب المشتري
* كوكب المريخ
- كوكب زحل
[توضيح: المريخ يسمى الكوكب الأحمر بسبب حديد الأكسيد على سطحه]

[س] تدور الأرض حول الشمس في مدار بيضاوي. [نوع: صواب_خطأ] [درجة: 1]
* صواب
- خطأ

[س] عاصمة المملكة العربية السعودية هي ___ [نوع: أكمل] [درجة: 2]
[إجابة: الرياض]

[س] صل العناصر التالية بما يناسبها من حالات المادة: [نوع: صل] [درجة: 3]
[صل] الماء = سائل
[صل] الحديد = صلب
[صل] الأكسجين = غاز

[س] صنف الكائنات التالية إلى برية وبحرية: [نوع: صنف] [درجة: 3]
[تصنيف] برية : الأسد
[تصنيف] برية : الغزال
[تصنيف] بحرية : الحوت
[تصنيف] بحرية : الدلفين

[س] ارسم الدورة الدموية المغلقة في جسم الإنسان موضحاً القلب والشرايين [نوع: ارسم] [درجة: 4]
[توضيح: يجب توضيح الأذينين والبطينين بالألوان]

[س] علل: حدوث ظاهرة الكسوف الشمسي [نوع: علل] [درجة: 2]
[إجابة: وقوع القمر بين الأرض والشمس على خط استقامة واحد]

[س] أجب بإيجاز: ما هو مفهوم البناء الضوئي في النبات؟ [نوع: أجب] [درجة: 2]

[س] اكتب مقالاً مصغراً عن أهمية الحفاظ على البيئة والتنوع البيولوجي [نوع: مقالي] [درجة: 5]`,
  },
  {
    title: 'اختبار اللغة العربية واللغويات',
    text: `[س] أين تقع الكعبة المشرفة؟ [نوع: اختيارات]
- في مدينة القدس
* في مكة المكرمة
- في المدينة المنورة

[س] الفعل الماضي دائماً مبني. [نوع: صواب_خطأ]
* صواب
- خطأ

[س] الأفعال الخمسة ترفع بـ ___ [نوع: أكمل]
[إجابة: ثبوت النون]

[س] صل الكلمة بمرادفها المناسب: [نوع: صل]
[صل] الشاهق = العالي
[صل] السقيم = المريض
[صل] الغيث = المطر`,
  }
];
