import React, { useState, useEffect } from 'react';
import { TeacherProfile, RosterUser } from '../../types';
import { School, User, Building, Calendar, Key, Lock, Mail, LogIn, AlertTriangle, ShieldCheck } from 'lucide-react';
import { validateAndAcquireSessionForTeacher } from '../../services/sessionManager';
import apiClient from '../../services/apiClient';
import { normalizeDigits } from '../../utils/helpers';

interface TeacherLoginModalProps {
  isOpen: boolean;
  currentProfile: TeacherProfile | null;
  roster: RosterUser[];
  onLoginSuccess: (profile: TeacherProfile) => void;
  onClose?: () => void;
}

export const TeacherLoginModal: React.FC<TeacherLoginModalProps> = ({
  isOpen,
  currentProfile,
  roster,
  onLoginSuccess,
  onClose,
}) => {
  const [serialNumber, setSerialNumber] = useState(currentProfile?.serialNumber || '');
  const [code, setCode] = useState(currentProfile?.teacherCode || '');

  const [schoolName, setSchoolName] = useState(currentProfile?.schoolName || '');
  const [branch, setBranch] = useState(currentProfile?.branch || 'عام');
  const [teacherName, setTeacherName] = useState(currentProfile?.teacherName || '');
  const [email, setEmail] = useState(currentProfile?.email || '');

  const [academicYear, setAcademicYear] = useState('');
  const [sessionError, setSessionError] = useState<string | null>(null);
  
  const [matchedTeacher, setMatchedTeacher] = useState<RosterUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [guestName, setGuestName] = useState('');

  // Generate Automatic Hijri / Gregorian Academic Year string
  useEffect(() => {
    const now = new Date();
    const currentGregorianYear = now.getFullYear();
    // Approximate / Intl calculation for Hijri Year
    let hijriYearStr = '1448';
    try {
      const hijriFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { year: 'numeric' });
      const formatted = hijriFormatter.format(now);
      const match = formatted.match(/\d+/);
      if (match) hijriYearStr = match[0];
    } catch (e) {
      hijriYearStr = '1448';
    }
    const yearFormatted = `${hijriYearStr}هـ / ${currentGregorianYear} - ${currentGregorianYear + 1}م`;
    setAcademicYear(yearFormatted);
  }, []);

  // Look for match when serial and code changes (Local Roster Cache Only - NO API CALLS ON KEYSTROKES)
  useEffect(() => {
    const normSerial = normalizeDigits(serialNumber);
    const normCode = normalizeDigits(code);

    if (normSerial.length >= 1 && normCode.length >= 1) {
      // 1. Check local roster first
      const localFound = roster.find(
        (u) =>
          normalizeDigits(u.serialNumber) === normSerial &&
          (!u.code || !normCode || normalizeDigits(u.code) === normCode)
      );

      if (localFound) {
        setMatchedTeacher(localFound);
        setTeacherName(localFound.name);
        setSchoolName(localFound.schoolName || '');
        setBranch(localFound.branch || 'عام');
      } else {
        setMatchedTeacher(null);
        setTeacherName('');
        setSchoolName('');
        setBranch('');
      }
    } else {
      setMatchedTeacher(null);
      setTeacherName('');
      setSchoolName('');
      setBranch('');
    }
  }, [serialNumber, code, roster]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionError(null);

    const normSerial = normalizeDigits(serialNumber);
    const normCode = normalizeDigits(code);

    if (!normSerial || !normCode) {
      alert('الرقم التسلسلي أو الكود غير صحيح.');
      return;
    }

    setIsLoading(true);

    try {
      // Direct Laravel API Call (Fast, Single Request)
      const response = await apiClient.post('/auth/login', {
        serial_number: normSerial,
        code: normCode,
        role: 'teacher',
      });

      if (response.data && response.data.data) {
        const { token, user } = response.data.data;
        
        // Save tokens immediately
        if (token) {
          localStorage.setItem('sanctum_token', token);
          localStorage.setItem('auth_token', token);
        }

        const rawProfile: TeacherProfile = {
          ...currentProfile,
          schoolName: (user.school_name || schoolName).trim(),
          branch: (user.branch || branch).trim() || 'عام',
          academicYear: academicYear,
          teacherName: (user.name || teacherName).trim(),
          teacherCode: user.code,
          serialNumber: user.serial_number,
          email: email.trim() || undefined,
          grade: user.grade || 'جميع الصفوف',
          section: user.section || 'جميع الشعب',
          role: user.role || 'teacher',
        };

        // Single Active Session Check for Teachers
        const sessionRes = validateAndAcquireSessionForTeacher(rawProfile);
        if (!sessionRes.allowed) {
          setSessionError(sessionRes.errorMessage || 'تعذر تسجيل الدخول بسبب الحماية من الدخول المزدوج.');
          setIsLoading(false);
          return;
        }

        const activeProfile = sessionRes.updatedTeacher || rawProfile;
        localStorage.setItem('interactive_quiz_teacher_profile', JSON.stringify(activeProfile));

        // Immediate redirect to dashboard
        onLoginSuccess(activeProfile);
      } else {
        setSessionError('استجابة غير صالحة من السيرفر.');
      }
    } catch (error: any) {
      console.warn('Login error:', error?.response?.data || error.message);
      setSessionError(error?.response?.data?.message || 'فشلت عملية التحقق. تأكد من صحة البيانات أو اتصالك بالإنترنت.');
      setIsLoading(false);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionError(null);

    if (!guestName.trim()) {
      alert('الرجاء إدخال الاسم.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.post('/guest-login', {
        name: guestName.trim(),
      });

      if (response.data && response.data.data) {
        const { token, user } = response.data.data;
        
        if (token) {
          localStorage.setItem('sanctum_token', token);
          localStorage.setItem('auth_token', token);
        }

        const activeProfile: TeacherProfile = {
          teacherName: user.name,
          role: 'guest_teacher',
          schoolName: 'تجربة مؤقتة (ضيف)',
          branch: 'عام',
          academicYear: academicYear,
          teacherCode: user.code || '',
          serialNumber: user.serial_number || '',
        };

        localStorage.setItem('interactive_quiz_teacher_profile', JSON.stringify(activeProfile));
        onLoginSuccess(activeProfile);
      } else {
        setSessionError('استجابة غير صالحة من السيرفر.');
      }
    } catch (error: any) {
      console.warn('Guest login error:', error?.response?.data || error.message);
      setSessionError(error?.response?.data?.message || 'فشلت العملية. تأكد من اتصالك بالإنترنت.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 dir-rtl animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-11 h-11 bg-indigo-100 text-indigo-700 rounded-2xl mb-0.5 shadow-inner">
            <School className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="text-xl font-black text-slate-900">تسجيل دخول المعلم / الإدارة</h2>
          <p className="text-[11px] text-slate-500 font-medium">
            أدخل الرقم التسلسلي ورقم الكود للتحقق والدخول
          </p>
        </div>

        {/* SESSION ERROR BANNER */}
        {sessionError && (
          <div className="p-3 bg-red-500 text-white rounded-2xl border-2 border-red-600 text-xs font-black dir-rtl animate-shake shadow-md space-y-1">
            <div className="flex items-center gap-1.5 text-amber-200 font-extrabold text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>تنبيه: يمنع الدخول المزدوج من جهازين</span>
            </div>
            <p className="leading-relaxed text-[11px]">{sessionError}</p>
          </div>
        )}

        {!isGuestMode ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-purple-600" />
                الرقم التسلسلي <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="أدخل 9 أرقام"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 outline-none text-xs font-mono font-bold text-slate-800 transition-all bg-slate-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-purple-600" />
                رقم الكود <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                placeholder="أدخل 7 أرقام"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 outline-none text-xs font-mono font-bold text-slate-800 transition-all bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          {matchedTeacher && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 animate-fadeIn text-xs shadow-xs">
              <div className="text-[11px] font-black text-emerald-800 pb-1.5 border-b border-emerald-200/80 flex items-center justify-between">
                <span>تم العثور على البيانات ومطابقة المستخدم ✓</span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black shadow-2xs ${
                  matchedTeacher.role === 'admin'
                    ? 'bg-purple-700 text-white'
                    : 'bg-emerald-700 text-white'
                }`}>
                  {matchedTeacher.role === 'admin' ? 'مدير / مشرف النظام' : 'معلم / كادر تدريسي'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    اسم المستخدم / المعلم
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={teacherName}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-xs font-black cursor-not-allowed shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5 flex items-center gap-1">
                    <School className="w-3 h-3 text-slate-400" />
                    المدرسة
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={schoolName}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-xs font-bold cursor-not-allowed shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5 flex items-center gap-1">
                    <Building className="w-3 h-3 text-slate-400" />
                    الفرع
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={branch}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-xs font-bold cursor-not-allowed shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    السنة الدراسية
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={academicYear}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-xs font-bold cursor-not-allowed shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-indigo-600" />
                    الصف / المراحل
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={matchedTeacher.grade || 'جميع الصفوف'}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-xs font-bold cursor-not-allowed shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-indigo-600" />
                    الشعبة / الفصول
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={matchedTeacher.section || 'جميع الشعب'}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-xs font-bold cursor-not-allowed shadow-2xs"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              البريد الإلكتروني <span className="text-[10px] text-slate-400 font-normal">(اختياري)</span>
            </label>
            <input
              type="email"
              placeholder="teacher@school.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 outline-none text-xs text-slate-800 transition-all"
            />
          </div>

          <div className="pt-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all ${
                isLoading ? 'opacity-70 cursor-wait' : 'shadow-indigo-200 cursor-pointer'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  جاري الدخول...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  تسجيل الدخول
                </>
              )}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                إلغاء
              </button>
            )}
          </div>
          
          <div className="pt-4 border-t border-slate-100 flex justify-center">
             <button
                type="button"
                onClick={() => setIsGuestMode(true)}
                className="text-emerald-600 hover:text-emerald-700 font-bold text-xs underline decoration-emerald-600/30 underline-offset-4 cursor-pointer"
             >
                الدخول كضيف للتجربة (لمدة 30 يوماً)
             </button>
          </div>
        </form>
        ) : (
        <form onSubmit={handleGuestSubmit} className="space-y-3 animate-fadeIn">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              الاسم <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="أدخل اسمك"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 outline-none text-xs font-bold text-slate-800 transition-all bg-slate-50 focus:bg-white"
            />
          </div>
          
          <div className="pt-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full sm:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all ${
                isLoading ? 'opacity-70 cursor-wait' : 'shadow-emerald-200 cursor-pointer'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  جاري الدخول...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  ابدأ التجربة
                </>
              )}
            </button>
            <button
                type="button"
                onClick={() => setIsGuestMode(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
                العودة
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
