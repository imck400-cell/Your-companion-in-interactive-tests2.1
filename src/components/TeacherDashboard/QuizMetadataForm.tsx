import React from 'react';
import { QuizMetadata, SUBJECT_CATEGORIES, CLASS_LEVELS } from '../../types';
import { BookOpen, Calendar, GraduationCap, School, ShieldCheck, User, Clock, Award, Globe, Lock, Layers, Hash } from 'lucide-react';

interface QuizMetadataFormProps {
  metadata: Partial<QuizMetadata>;
  onChange: (updated: Partial<QuizMetadata>) => void;
}

export const QuizMetadataForm: React.FC<QuizMetadataFormProps> = ({ metadata, onChange }) => {
  const handleChange = (field: keyof QuizMetadata, value: any) => {
    onChange({ ...metadata, [field]: value });
  };

  const currentMainSubject = metadata.main_subject || metadata.subject || 'اللغة العربية';
  const availableSubSubjects = SUBJECT_CATEGORIES[currentMainSubject] || [];

  const handleMainSubjectSelect = (main: string) => {
    const defaultSub = SUBJECT_CATEGORIES[main]?.[0] || 'عام';
    onChange({
      ...metadata,
      main_subject: main,
      subject: main,
      sub_subject: defaultSub,
    });
  };

  // Helper to format today's date in YYYY-MM-DD
  const getTodayDateISO = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to extract Arabic day name from date string
  const getArabicDayOfWeek = (dateStr?: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dateObj = new Date(year, month, day);
      if (!isNaN(dateObj.getTime())) {
        const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        return days[dateObj.getDay()];
      }
    }
    const dateObj = new Date(dateStr);
    if (!isNaN(dateObj.getTime())) {
      const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      return days[dateObj.getDay()];
    }
    return '';
  };

  const currentDateValue = (() => {
    if (!metadata.createdAt) return getTodayDateISO();
    if (/^\d{4}-\d{2}-\d{2}$/.test(metadata.createdAt)) {
      return metadata.createdAt;
    }
    const d = new Date(metadata.createdAt);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return getTodayDateISO();
  })();

  const currentDayName = getArabicDayOfWeek(currentDateValue);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200/80 mb-6 dir-rtl">
      <div className="flex items-center justify-between gap-2 mb-5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">بيانات الاختبار الوصفية والخصوصية</h3>
            <p className="text-xs text-slate-500">أدخل المعطيات الأساسية، الصف، المادة، ونطاق خصوصية الاختبار</p>
          </div>
        </div>

        {/* Privacy Status Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${
              (metadata.visibility || 'public') === 'public'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
            }`}
          >
            {(metadata.visibility || 'public') === 'public' ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            {(metadata.visibility || 'public') === 'public' ? 'اختبار علني' : 'اختبار خاص'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Title */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
          <label className="block text-xs font-bold text-slate-700 mb-1.5">عنوان الاختبار / الدرس الرئيسي <span className="text-red-500">*</span></label>
          <input
            type="text"
            required
            placeholder="مثال: اختبار الوحدة الأولى - الخلية ووظائفها"
            value={metadata.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm text-slate-800 transition-all"
          />
        </div>

        {/* Lesson Number */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-1">
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
            <Hash className="w-3.5 h-3.5 text-emerald-600" />
            رقم الدرس
          </label>
          <select
            value={metadata.lesson_number || metadata.lessonNumber || ''}
            onChange={(e) => {
              const val = e.target.value;
              const numVal = val ? parseInt(val, 10) : undefined;
              onChange({
                ...metadata,
                lesson_number: numVal,
                lessonNumber: numVal,
              });
            }}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-semibold text-slate-800 transition-all bg-white cursor-pointer"
          >
            <option value="">اختر رقم الدرس (اختياري)</option>
            {Array.from({ length: 50 }, (_, i) => i + 1).map((num) => (
              <option key={num} value={num}>
                الدرس {num}
              </option>
            ))}
          </select>
        </div>

        {/* Privacy Visibility Dropdown */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1 text-emerald-700">
            <Globe className="w-3.5 h-3.5" />
            حالة الاختبار (الخصوصية)
          </label>
          <select
            value={metadata.visibility || 'public'}
            onChange={(e) => handleChange('visibility', e.target.value as 'public' | 'private')}
            className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-bold text-slate-800 transition-all bg-emerald-50/30"
          >
            <option value="public">علني (متاح في المكتبة العامة والخاصة)</option>
            <option value="private">خاص (يظهر لي فقط في لوحة تحكمي)</option>
          </select>
        </div>

        {/* Grade / Class Level */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
            الصف الدراسي
          </label>
          <select
            value={metadata.class_level || metadata.grade || '12'}
            onChange={(e) => {
              onChange({
                ...metadata,
                class_level: e.target.value,
                grade: e.target.value
              });
            }}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-xs font-extrabold text-slate-800 transition-all bg-white cursor-pointer"
          >
            {CLASS_LEVELS.map((level) => {
              const labelText = level === 'تمهيدي' ? 'تمهيدي' : level === 'الكل' ? 'الكل' : level;
              return (
                <option key={level} value={level}>
                  {labelText}
                </option>
              );
            })}
          </select>
        </div>

        {/* Main Subject */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
            المادة الأساسية
          </label>
          <select
            value={currentMainSubject}
            onChange={(e) => handleMainSubjectSelect(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm text-slate-800 transition-all bg-white font-semibold"
          >
            {Object.keys(SUBJECT_CATEGORIES).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Sub Subject (Cascading) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            فرع المادة
          </label>
          <select
            value={metadata.sub_subject || availableSubSubjects[0] || 'عام'}
            onChange={(e) => handleChange('sub_subject', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm text-slate-800 transition-all bg-white font-semibold"
          >
            {availableSubSubjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>

        {/* Section (Multi-Select Dropdown & Pills) */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-700">
              الشعبة / الفصل (يمكن اختيار أكثر من شعبة)
            </label>
            <div className="flex items-center gap-1.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => handleChange('section', 'أ، ب، ج، د، هـ، و، ز، ح، ط، ي')}
                className="text-indigo-600 hover:underline"
              >
                تحديد الكل
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => handleChange('section', '')}
                className="text-slate-500 hover:underline"
              >
                مسح
              </button>
            </div>
          </div>

          {/* Quick Dropdown Preset */}
          <select
            value={metadata.section || ''}
            onChange={(e) => handleChange('section', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-xs font-semibold text-slate-800 transition-all bg-white mb-2"
          >
            <option value="">-- اختر من الشعب المتاحة --</option>
            <option value="أ، ب، ج، د، هـ، و، ز، ح، ط، ي">جميع الشعب (أ - ي)</option>
            {['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط، ي'].map((sec) => (
              <option key={sec} value={`شعبة ${sec}`}>
                شعبة {sec}
              </option>
            ))}
            {metadata.section && !['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط، ي'].includes(metadata.section) && (
              <option value={metadata.section}>محدد حالياً: {metadata.section}</option>
            )}
          </select>

          {/* Interactive Multi-Select Letter Pills */}
          <div className="flex flex-wrap gap-1 p-2 bg-slate-50 rounded-xl border border-slate-200">
            {['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي'].map((letter) => {
              const currentVal = metadata.section || '';
              const isSelected = currentVal.includes(letter);

              const toggleLetter = () => {
                let currentList = currentVal
                  ? currentVal.split(/[\,\،\s]+/).map((s) => s.trim().replace(/^شعبة\s*/, '')).filter(Boolean)
                  : [];

                if (isSelected) {
                  currentList = currentList.filter((item) => item !== letter);
                } else {
                  currentList.push(letter);
                }

                // Sort according to original order
                const sortedList = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي'].filter((l) =>
                  currentList.includes(l)
                );

                handleChange('section', sortedList.join('، '));
              };

              return (
                <button
                  key={letter}
                  type="button"
                  onClick={toggleLetter}
                  className={`px-2.5 py-1 text-xs font-extrabold rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs scale-105'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title={`تحديد شعبة ${letter}`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>

        {/* Teacher Name */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-emerald-600" />
            اسم المعلم / المعلمة
          </label>
          <input
            type="text"
            placeholder="أدخل اسم المعلم"
            value={metadata.teacherName || ''}
            onChange={(e) => handleChange('teacherName', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm text-slate-800 transition-all"
          />
        </div>

        {/* School Name */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
            <School className="w-3.5 h-3.5 text-emerald-600" />
            اسم المدرسة / المعهد
          </label>
          <input
            type="text"
            placeholder="أدخل اسم المدرسة"
            value={metadata.schoolName || ''}
            onChange={(e) => handleChange('schoolName', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm text-slate-800 transition-all"
          />
        </div>

        {/* Branch */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">الفرع / المسار</label>
          <select
            value={metadata.branch || 'عام'}
            onChange={(e) => handleChange('branch', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm text-slate-800 transition-all bg-white"
          >
            <option value="عام">عام</option>
            <option value="علمي">علمي</option>
            <option value="أدبي">أدبي</option>
            <option value="تكنولوجي">تكنولوجي</option>
            <option value="شرعي">شرعي</option>
            <option value="تجاري">تجاري / إداري</option>
          </select>
        </div>

        {/* Academic / School Year */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            العام الدراسي
          </label>
          <input
            type="text"
            placeholder="مثال: 1448هـ / 2026 - 2027 م"
            value={metadata.academic_year || metadata.schoolYear || '1448هـ / 2026 - 2027 م'}
            onChange={(e) => {
              handleChange('academic_year', e.target.value);
              handleChange('schoolYear', e.target.value);
            }}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm text-slate-800 transition-all"
          />
        </div>

        {/* Quiz Creation Date & Automatic Day Indicator */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              تاريخ إعداد الاختبار
            </span>
            {currentDayName && (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-extrabold border border-emerald-200">
                يوم {currentDayName}
              </span>
            )}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={currentDateValue}
              onChange={(e) => handleChange('createdAt', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-semibold text-slate-800 transition-all bg-white"
            />
            <div className="shrink-0 px-3 py-2.5 bg-emerald-50 text-emerald-800 font-extrabold rounded-xl text-xs border border-emerald-200 flex items-center justify-center min-w-22 shadow-xs">
              {currentDayName ? `يوم ${currentDayName}` : 'اختر التاريخ'}
            </div>
          </div>
        </div>

        {/* Feedback Option */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            توقيت التغذية الراجعة للطلاب
          </label>
          <select
            value={metadata.showFeedback || 'immediate'}
            onChange={(e) => handleChange('showFeedback', e.target.value as 'immediate' | 'end')}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm text-slate-800 transition-all bg-white"
          >
            <option value="immediate">تغذية راجعة فورية (تظهر الصواب والخطأ عند حل كل سؤال)</option>
            <option value="end">تغذية راجعة نهائية (تظهر النتيجة والتفاصيل بعد تسليم الاختبار)</option>
          </select>
        </div>

        {/* Time Limit */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            زمن الاختبار (بالدقائق)
          </label>
          <input
            type="number"
            min="0"
            placeholder="0 = بدون حد زمني"
            value={metadata.timeLimitMinutes ?? 0}
            onChange={(e) => handleChange('timeLimitMinutes', parseInt(e.target.value || '0', 10))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm text-slate-800 transition-all"
          />
        </div>

        {/* Pass Percentage */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-emerald-600" />
            نسبة النجاح المطلوب تحققها (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="50"
            value={metadata.passPercentage ?? 50}
            onChange={(e) => handleChange('passPercentage', parseInt(e.target.value || '50', 10))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm text-slate-800 transition-all"
          />
        </div>

        {/* Allow Student to Change/Retry Answer */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 mt-1">
          <label className="flex items-start sm:items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!metadata.allowAnswerChange}
              onChange={(e) => handleChange('allowAnswerChange', e.target.checked)}
              className="w-5 h-5 accent-emerald-600 rounded-md cursor-pointer shrink-0 mt-0.5 sm:mt-0"
            />
            <div>
              <span className="text-sm font-extrabold text-slate-900 block">
                يسمح للطالب بأن يعيد الإجابة على السؤال
              </span>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {metadata.allowAnswerChange
                  ? 'مفعل: يتمكن الطالب من الاختيار للإجابة أكثر من مرة وتغيير اختياره بحرية.'
                  : 'غير مفعل (الافتراضي): بمجرد أن يختار الطالب إجابة ما يتم اعتمادها فوراً ويُمنع من إعادة الاختيار أو التعديل.'}
              </p>
            </div>
          </label>
        </div>

        {/* Allow Full Quiz Retake */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <label className="flex items-start sm:items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!metadata.allowFullQuizRetake}
              onChange={(e) => handleChange('allowFullQuizRetake', e.target.checked)}
              className="w-5 h-5 accent-emerald-600 rounded-md cursor-pointer shrink-0 mt-0.5 sm:mt-0"
            />
            <div>
              <span className="text-sm font-extrabold text-slate-900 block">
                السماح بإعادة الاختبار كاملا
              </span>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {metadata.allowFullQuizRetake
                  ? 'مفعل: عند تسليم الإجابة، يتم السماح للطالب بأن يعيد الاختبار مرة أخرى وتظهر له زر (أعد المحاولة - تصفير الإجابات وخلط الأسئلة).'
                  : 'غير مفعل (الافتراضي): عدم إعادة الاختبار مرة أخرى بعد تسليم الإجابة وعندها لا يظهر له زر أعد المحاولة (تصفير الإجابات وخلط الأسئلة).'}
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};
