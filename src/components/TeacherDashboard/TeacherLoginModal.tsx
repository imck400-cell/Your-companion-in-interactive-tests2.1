import React, { useState, useEffect } from 'react';
import { TeacherProfile, RosterUser } from '../../types';
import { School, User, Building, Calendar, Key, Lock, Mail, LogIn, AlertTriangle, ShieldCheck } from 'lucide-react';
import { validateAndAcquireSessionForTeacher } from '../../services/sessionManager';
import { normalizeDigits, verifyTeacherLogin, loginWithSerialAndPasscode, findUserAndSchoolBySerial, saveSingleRosterUserToFirebase } from '../../services/firebase';

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

  // Look for match when serial and code changes
  useEffect(() => {
    let isSubscribed = true;
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
        // 2. Query Firestore directly if not yet present in local state
        verifyTeacherLogin(normSerial, normCode).then((remoteFound) => {
          if (isSubscribed) {
            if (remoteFound) {
              setMatchedTeacher(remoteFound);
              setTeacherName(remoteFound.name);
              setSchoolName(remoteFound.schoolName || '');
              setBranch(remoteFound.branch || 'عام');
            } else {
              setMatchedTeacher(null);
              setTeacherName('');
              setSchoolName('');
              setBranch('');
            }
          }
        });
      }
    } else {
      setMatchedTeacher(null);
      setTeacherName('');
      setSchoolName('');
      setBranch('');
    }

    return () => {
      isSubscribed = false;
    };
  }, [serialNumber, code, roster]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionError(null);

    const normSerial = normalizeDigits(serialNumber);
    const normCode = normalizeDigits(code);

    if (!matchedTeacher && (!normSerial || !normCode)) {
      alert('الرقم التسلسلي أو الكود غير صحيح، أو المعلم/المستخدم غير مسجل في النظام.');
      return;
    }

    // 1. Firebase Auth Trick (Serial + Passcode) with Session Persistence
    let effectiveTeacher = matchedTeacher;
    const authRes = await loginWithSerialAndPasscode(serialNumber, code);
    
    if (authRes.success) {
      // 2. Discover School & User via Collection Group Query across /schools/{school_id}/users
      const discovered = await findUserAndSchoolBySerial(serialNumber);
      if (discovered?.user) {
        effectiveTeacher = discovered.user;
      }
    } else if (!matchedTeacher) {
      setSessionError(authRes.error || 'فشلت المصادقة السحابية باستخدام الرقم التسلسلي والكود.');
      return;
    }

    if (!effectiveTeacher) {
      alert('لم يتم العثور على سجل المستخدم في المدارس المسجلة.');
      return;
    }

    const rawProfile: TeacherProfile = {
      ...currentProfile,
      schoolName: (effectiveTeacher.schoolName || schoolName).trim(),
      branch: (effectiveTeacher.branch || branch).trim() || 'عام',
      academicYear: academicYear,
      teacherName: (effectiveTeacher.name || teacherName).trim(),
      teacherCode: code.trim(),
      serialNumber: serialNumber.trim(),
      email: email.trim() || undefined,
      grade: effectiveTeacher.grade || 'جميع الصفوف',
      section: effectiveTeacher.section || 'جميع الشعب',
      role: effectiveTeacher.role || 'teacher',
    };

    // Single Active Session Check for Teachers
    const sessionRes = validateAndAcquireSessionForTeacher(rawProfile);
    if (!sessionRes.allowed) {
      setSessionError(sessionRes.errorMessage || 'تعذر تسجيل الدخول.');
      return;
    }

    const activeProfile = sessionRes.updatedTeacher || rawProfile;
    localStorage.setItem('interactive_quiz_teacher_profile', JSON.stringify(activeProfile));

    if (effectiveTeacher) {
      await saveSingleRosterUserToFirebase({
        ...effectiveTeacher,
        active_session_id: activeProfile.active_session_id || '',
        last_activity_at: activeProfile.last_activity_at || Date.now(),
      });
    }

    onLoginSuccess(activeProfile);
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
              disabled={!matchedTeacher}
              className={`flex-1 py-2.5 px-4 text-white font-black rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                matchedTeacher 
                  ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 hover:shadow-indigo-200' 
                  : 'bg-slate-400 cursor-not-allowed'
              }`}
            >
              <LogIn className="w-4 h-4" />
              الدخول للنظام
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
        </form>
      </div>
    </div>
  );
};
