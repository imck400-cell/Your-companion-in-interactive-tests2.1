import React, { useState, useEffect } from 'react';
import { User, GraduationCap, School, ArrowLeft, Sparkles, Key, Lock, CheckCircle2, ShieldCheck, Mail, AlertTriangle, BadgeCheck } from 'lucide-react';
import { QuizMetadata, RosterUser } from '../../types';
import { validateAndAcquireSessionForRosterUser } from '../../services/sessionManager';
import { normalizeDigits } from '../../utils/helpers';
import apiClient from '../../services/apiClient';
import { getOrCreateGuestDeviceUuid, getGuestLockedIdentity, saveGuestLockedIdentity } from '../../services/deviceFingerprint';

interface StudentLoginFormProps {
  quiz: QuizMetadata;
  roster?: RosterUser[];
  onStartQuiz: (studentInfo: { name: string; grade: string; section: string; schoolName?: string; branch?: string; email?: string; serialNumber?: string; guestDeviceUuid?: string }) => void;
  onUpdateRosterUser?: (updatedUser: RosterUser) => void;
}

export const StudentLoginForm: React.FC<StudentLoginFormProps> = ({
  quiz,
  roster = [],
  onStartQuiz,
  onUpdateRosterUser,
}) => {
  const [loginMode, setLoginMode] = useState<'normal' | 'serial' | 'email'>('serial');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(quiz.grade || '1');
  const [section, setSection] = useState(quiz.section || 'أ');
  const [schoolName, setSchoolName] = useState(quiz.schoolName || '');
  const [branch, setBranch] = useState(quiz.branch || '');

  // Serial & Code login
  const [serialNumber, setSerialNumber] = useState('');
  const [code, setCode] = useState('');
  const [matchedUser, setMatchedUser] = useState<RosterUser | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  // Email Binding & Email Login
  const [emailInput, setEmailInput] = useState('');
  const [bindEmailInput, setBindEmailInput] = useState('');
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Guest Direct Login Fingerprinting & Identity Lock
  const [isGuestLocked, setIsGuestLocked] = useState<boolean>(false);
  const [guestDeviceUuid, setGuestDeviceUuid] = useState<string>('');
  const [showConfirmGuestModal, setShowConfirmGuestModal] = useState<boolean>(false);

  // Load guest identity lock when switching to direct login or on mount
  useEffect(() => {
    if (loginMode === 'normal') {
      const locked = getGuestLockedIdentity();
      if (locked) {
        setName(locked.name);
        setGrade(locked.grade);
        setSection(locked.section);
        if (locked.schoolName) setSchoolName(locked.schoolName);
        if (locked.branch) setBranch(locked.branch);
        setGuestDeviceUuid(locked.guestDeviceUuid);
        setIsGuestLocked(true);
      } else {
        const uuid = getOrCreateGuestDeviceUuid();
        setGuestDeviceUuid(uuid);
        setIsGuestLocked(false);
      }
    }
  }, [loginMode]);

  const [isVerifying, setIsVerifying] = useState(false);

  // Clear matched user if inputs change, requiring re-verification
  useEffect(() => {
    setMatchedUser(null);
    setMatchError(null);
  }, [serialNumber, code, loginMode]);

  // Live Email Lookup for Email Mode
  useEffect(() => {
    setSessionError(null);
    if (loginMode !== 'email') return;

    const trimmedEmail = emailInput.trim().toLowerCase();
    if (!trimmedEmail) {
      setMatchedUser(null);
      setMatchError(null);
      return;
    }

    const found = roster.find(
      (u) => u.email && u.email.trim().toLowerCase() === trimmedEmail
    );

    if (found) {
      setMatchedUser(found);
      setName(found.name);
      setGrade(found.grade || quiz.grade || 'الصف العام');
      setSection(found.section || quiz.section || 'أ');
      setSchoolName(found.schoolName || quiz.schoolName || '');
      setBranch(found.branch || quiz.branch || '');
      setMatchError(null);
    } else if (trimmedEmail.includes('@') && trimmedEmail.length > 5) {
      setMatchedUser(null);
      setMatchError('لم يتم العثور على طالب مرتبط بهذا البريد الإلكتروني. يمكنك الدخول بالرقم التسلسلي والكود لربطه أول مرة.');
    } else {
      setMatchedUser(null);
      setMatchError(null);
    }
  }, [emailInput, roster, quiz, loginMode]);

  const handleConfirmAndLockGuestIdentity = () => {
    const uuid = guestDeviceUuid || getOrCreateGuestDeviceUuid();
    const identity = {
      name: name.trim(),
      grade: grade.trim() || 'الصف العام',
      section: section.trim() || 'أ',
      schoolName: schoolName.trim() || quiz.schoolName,
      branch: branch.trim() || quiz.branch,
      guestDeviceUuid: uuid,
    };
    saveGuestLockedIdentity(identity);
    setIsGuestLocked(true);
    setShowConfirmGuestModal(false);
    onStartQuiz(identity);
  };

  const handleVerifyAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionError(null);

    if (!matchedUser && loginMode === 'normal') {
      if (!name.trim()) return;

      if (isGuestLocked) {
        onStartQuiz({
          name: name.trim(),
          grade: grade.trim() || 'الصف العام',
          section: section.trim() || 'أ',
          schoolName: schoolName.trim() || quiz.schoolName,
          branch: branch.trim() || quiz.branch,
          guestDeviceUuid: guestDeviceUuid || getOrCreateGuestDeviceUuid(),
        });
      } else {
        setShowConfirmGuestModal(true);
      }
      return;
    }

    if (loginMode === 'serial') {
      if (!matchedUser) {
        // Step 1: Verify from server (No longer live)
        setIsVerifying(true);
        try {
          const response = await apiClient.post('/auth/login', {
            serial_number: normalizeDigits(serialNumber),
            code: normalizeDigits(code),
            role: 'student',
          });
          
          if (response.data && response.data.data) {
            const { token, user } = response.data.data;
            if (token) {
              localStorage.setItem('sanctum_token', token);
              localStorage.setItem('auth_token', token);
            }
            const u: RosterUser = {
              id: String(user.id),
              name: user.name,
              role: user.role,
              serialNumber: user.serial_number,
              code: user.code,
              schoolName: user.school_name,
              branch: user.branch,
              grade: user.grade,
              section: user.section,
            };
            setMatchedUser(u);
            setName(u.name);
            setGrade(u.grade || quiz.grade || 'الصف العام');
            setSection(u.section || quiz.section || 'أ');
            setSchoolName(u.schoolName || quiz.schoolName || '');
            setBranch(u.branch || quiz.branch || '');
            if (u.email) setBindEmailInput(u.email);
            setMatchError(null);
          } else {
             setMatchError('استجابة غير صالحة من السيرفر.');
          }
        } catch (error: any) {
          setMatchError(error?.response?.data?.message || 'فشلت المصادقة باستخدام الرقم التسلسلي والكود.');
        } finally {
          setIsVerifying(false);
        }
        return; // Wait for user to confirm in Step 2
      }
    }

    if (!matchedUser) {
      setMatchError('يرجى التأكد من كتابة الرقم التسلسلي ورقم الكود بشكل صحيح.');
      return;
    }

    // Email Binding check on Serial Login
    let currentUser = matchedUser;
    if (!currentUser.email && bindEmailInput.trim()) {
      currentUser = {
        ...currentUser,
        email: bindEmailInput.trim().toLowerCase(),
      };
      if (onUpdateRosterUser) {
        onUpdateRosterUser(currentUser);
      }
    }

    // Single Active Session Check
    const sessionRes = validateAndAcquireSessionForRosterUser(currentUser);

    if (!sessionRes.allowed) {
      setSessionError(sessionRes.errorMessage || 'تعذر تسجيل الدخول.');
      return;
    }

    const activeUser = sessionRes.updatedUser || currentUser;
    try {
      if (activeUser.id && !activeUser.id.startsWith('temp_')) {
        await apiClient.put(`/roster/${activeUser.id}`, activeUser);
      }
    } catch(e) {
      console.warn("Failed to update user locally/remotely:", e);
    }
    if (onUpdateRosterUser) {
      onUpdateRosterUser(activeUser);
    }

    onStartQuiz({
      name: activeUser.name,
      grade: activeUser.grade || grade || 'الصف العام',
      section: activeUser.section || section || 'أ',
      schoolName: activeUser.schoolName || schoolName || quiz.schoolName,
      branch: activeUser.branch || branch || quiz.branch,
      email: activeUser.email,
      serialNumber: activeUser.serialNumber,
    });
  };

  return (
    <div className="max-w-md mx-auto my-8 p-6 bg-white rounded-3xl shadow-xl border border-slate-200/80 dir-rtl space-y-5">
      {/* Quiz Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <GraduationCap className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">{quiz.title}</h2>
        <p className="text-xs text-slate-500 font-medium">
          المادة: <span className="font-bold text-slate-700">{quiz.subject}</span> | المعلم: <span className="font-bold text-slate-700">{quiz.teacherName}</span>
        </p>
        {quiz.schoolName && (
          <p className="text-xs text-slate-400">{quiz.schoolName} - {quiz.schoolYear}</p>
        )}
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center p-1 bg-slate-100 rounded-2xl text-xs font-bold border border-slate-200">
        <button
          type="button"
          onClick={() => { setLoginMode('serial'); setMatchedUser(null); setSessionError(null); }}
          className={`flex-1 py-2 rounded-xl transition-all text-center flex items-center justify-center gap-1 ${
            loginMode === 'serial' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
          بالرقم والكود
        </button>

        <button
          type="button"
          onClick={() => { setLoginMode('email'); setMatchedUser(null); setSessionError(null); }}
          className={`flex-1 py-2 rounded-xl transition-all text-center flex items-center justify-center gap-1 ${
            loginMode === 'email' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Mail className="w-3.5 h-3.5 text-indigo-200" />
          بالإيميل المربوط
        </button>

        <button
          type="button"
          onClick={() => { setLoginMode('normal'); setMatchedUser(null); setSessionError(null); }}
          className={`flex-1 py-2 rounded-xl transition-all text-center ${
            loginMode === 'normal' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          مباشر بالاسم
        </button>
      </div>

      {/* SINGLE ACTIVE SESSION ERROR BANNER (الاستئصال اللطيف) */}
      {sessionError && (
        <div className="p-4 bg-red-500 text-white rounded-2xl border-2 border-red-600 text-xs font-black dir-rtl animate-shake shadow-lg space-y-1">
          <div className="flex items-center gap-2 text-amber-200 font-extrabold text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>تنبيــه: يمنع الدخول المزدوج من جهازين</span>
          </div>
          <p className="leading-relaxed">{sessionError}</p>
        </div>
      )}

      {/* MODE 1: SERIAL & CODE LOGIN WITH EMAIL BINDING */}
      {loginMode === 'serial' && (
        <form onSubmit={handleVerifyAndStart} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-purple-600" />
              الرقم التسلسلي (9 أرقام) *
            </label>
            <input
              type="text"
              required
              placeholder="أدخل الرقم التسلسلي..."
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-purple-600 outline-none text-xs font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-purple-600" />
              رقم الكود (7 أرقام) *
            </label>
            <input
              type="password"
              required
              placeholder="أدخل رقم الكود..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-purple-600 outline-none text-xs font-mono font-bold"
            />
          </div>

          {/* MATCHED STUDENT VERIFIED CARD & EMAIL BINDING STEP */}
          {matchedUser ? (
            <div className="p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-300 text-xs text-emerald-950 space-y-3 animate-fadeIn shadow-sm">
              <div className="flex items-center justify-between font-black text-sm text-emerald-800">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>التحقق الحي: تم العثور على حساب الطالب بنجاح!</span>
                </div>
                {matchedUser.public_ref_id && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-mono">
                    {matchedUser.public_ref_id}
                  </span>
                )}
              </div>

              <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 space-y-1.5">
                <div className="font-black text-slate-900 text-sm flex items-center justify-between">
                  <span>👤 الطالب: {matchedUser.name}</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3 text-emerald-600" />
                    هوية رسمية ثابتة (Read-Only)
                  </span>
                </div>
                <div className="text-slate-700">🏫 المدرسة: <span className="font-bold text-indigo-900">{matchedUser.schoolName}</span></div>
                <div className="text-slate-700">🌿 الفرع والشعبة: <span className="font-bold text-indigo-900">{matchedUser.branch} - ({matchedUser.grade} / {matchedUser.section})</span></div>
              </div>

              {/* EMAIL BINDING INPUT PROMPT IF NOT BOUND YET */}
              {!matchedUser.email ? (
                <div className="p-3 bg-indigo-50/90 rounded-xl border border-indigo-200 space-y-1.5">
                  <label className="block text-xs font-extrabold text-indigo-900 flex items-center gap-1">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    ربط البريد الإلكتروني للحساب لأول مرة (اختياري):
                  </label>
                  <input
                    type="email"
                    placeholder="مثال: student@school.edu"
                    value={bindEmailInput}
                    onChange={(e) => setBindEmailInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-indigo-300 focus:border-indigo-600 outline-none text-xs bg-white font-medium"
                  />
                  <p className="text-[10px] text-indigo-700">
                    اختياري - سيسمح لك هذا البريد بتسجيل الدخول السريع في المرات القادمة.
                  </p>
                </div>
              ) : (
                <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-200 text-xs text-indigo-900 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <span className="font-bold">البريد الإلكتروني المربوط: </span>
                    <span className="font-mono text-indigo-800 dir-ltr inline-block">{matchedUser.email}</span>
                  </div>
                </div>
              )}
            </div>
          ) : matchError ? (
            <div className="p-3 bg-red-50 text-red-800 rounded-xl border border-red-200 text-xs font-bold animate-fadeIn">
              {matchError}
            </div>
          ) : serialNumber.trim().length > 0 ? (
            <div className="p-3 bg-indigo-50/80 text-indigo-800 rounded-xl border border-indigo-200 text-[11px] font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
              <span>جاري التحقق الحي من الرقم التسلسلي والكود...</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={(!serialNumber || !code) || isVerifying}
            className={`w-full py-3.5 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all ${
              (serialNumber && code)
                ? 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer shadow-emerald-600/30'
                : 'bg-slate-400 cursor-not-allowed opacity-70'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-300" />
            {isVerifying ? 'جاري التحقق...' : matchedUser ? 'تأكيد الدخول الآمن لبوابة الاختبار' : 'أدخل الرقم التسلسلي والكود للتحقق'}
          </button>
        </form>
      )}

      {/* MODE 2: EMAIL FAST DIRECT LOGIN */}
      {loginMode === 'email' && (
        <form onSubmit={handleVerifyAndStart} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-indigo-600" />
              البريد الإلكتروني المربوط بالحساب *
            </label>
            <input
              type="email"
              required
              placeholder="أدخل بريدك الإلكتروني المربوط..."
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-medium"
            />
          </div>

          {matchedUser ? (
            <div className="p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-300 text-xs text-emerald-950 space-y-2 animate-fadeIn shadow-sm">
              <div className="flex items-center gap-1.5 font-black text-sm text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>تم التكتشف التلقائي للحساب المربوط!</span>
              </div>
              <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 space-y-1">
                <div className="font-extrabold text-slate-900 text-sm">👤 الطالب: {matchedUser.name}</div>
                <div className="text-slate-700">🏫 المدرسة: <span className="font-bold text-indigo-900">{matchedUser.schoolName}</span></div>
                <div className="text-slate-700">🎓 الصف: <span className="font-bold text-slate-900">{matchedUser.grade} - {matchedUser.section}</span></div>
              </div>
            </div>
          ) : matchError ? (
            <div className="p-3 bg-red-50 text-red-800 rounded-xl border border-red-200 text-xs font-bold animate-fadeIn">
              {matchError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!matchedUser}
            className={`w-full py-3.5 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all ${
              matchedUser
                ? 'bg-indigo-600 hover:bg-indigo-500 cursor-pointer shadow-indigo-600/30'
                : 'bg-slate-400 cursor-not-allowed opacity-70'
            }`}
          >
            <Mail className="w-4 h-4 text-amber-300" />
            {matchedUser ? 'الدخول السريع بحساب الإيميل' : 'أدخل بريدك المربوط لتأكيد الهوية'}
          </button>
        </form>
      )}

      {/* MODE 3: NORMAL DIRECT NAME ENTRY */}
      {loginMode === 'normal' && (
        <form onSubmit={handleVerifyAndStart} className="space-y-4">
          {isGuestLocked && (
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>تم تثبيت واعتماد هويتك على هذا الجهاز (هوية مقفلة لحماية نزاهة النتائج).</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                اسم الطالب الثلاثي <span className="text-red-500">*</span>
              </span>
              {isGuestLocked && (
                <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> هوية ثنائية التثبيت
                </span>
              )}
            </label>
            <input
              type="text"
              required
              disabled={isGuestLocked}
              readOnly={isGuestLocked}
              placeholder="أدخل اسمك الكامل..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-bold text-slate-800 transition-all disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                الصف الدراسي
              </label>
              <select
                value={grade}
                disabled={isGuestLocked}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-bold text-slate-800 transition-all bg-white disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="تمهيدي">تمهيدي</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
                <option value="11">11</option>
                <option value="12">12</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <School className="w-3.5 h-3.5 text-indigo-600" />
                الشعبة / الفصل
              </label>
              <select
                value={section}
                disabled={isGuestLocked}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-bold text-slate-800 transition-all bg-white disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="أ">أ</option>
                <option value="ب">ب</option>
                <option value="ج">ج</option>
                <option value="د">د</option>
                <option value="هـ">هـ</option>
                <option value="و">و</option>
                <option value="ز">ز</option>
                <option value="ح">ح</option>
                <option value="ط">ط</option>
                <option value="ي">ي</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-indigo-50/80 rounded-2xl border border-indigo-100 text-xs text-indigo-900 space-y-1">
            <div className="font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              معلومات الاختبار:
            </div>
            <div>• عدد الأسئلة: {quiz.questions?.length || 0} سؤالاً.</div>
            <div>• نظام التغذية الراجعة: {quiz.showFeedback === 'immediate' ? 'فورياً أثناء الحل' : 'في نهاية الاختبار'}.</div>
            {quiz.timeLimitMinutes ? <div>• الزمن المحدد: {quiz.timeLimitMinutes} دقيقة.</div> : <div>• الاختبار بدون حد زمني.</div>}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-extrabold rounded-2xl shadow-lg shadow-indigo-600/20 text-sm flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01]"
          >
            ابدأ حل الاختبار التفاعلي الآن
            <ArrowLeft className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* STRICT CONFIRMATION MODAL FOR DIRECT GUEST IDENTITY LOCK */}
      {showConfirmGuestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 dir-rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-scaleUp">
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-slate-900">تأكيد تثبيت الهوية للجهاز</h3>
              <p className="text-sm text-slate-700 leading-relaxed font-semibold bg-amber-50/90 p-4 rounded-2xl border border-amber-200">
                تنبيه: هل أنت متأكد من تثبيت هذا الاسم والصف والشعبة؟ سيتم اعتماد هذه البيانات كـ (هوية ثابتة) لك على هذا الهاتف لجميع الاختبارات، ولن تتمكن من تغييرها لاحقاً.
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1 font-bold">
              <div>• الاسم: <span className="text-indigo-700">{name}</span></div>
              <div>• الصف: <span className="text-indigo-700">{grade}</span> | الشعبة: <span className="text-indigo-700">{section}</span></div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleConfirmAndLockGuestIdentity}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <CheckCircle2 className="w-4 h-4" />
                موافق وتثبيت
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmGuestModal(false)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                إلغاء وتعديل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


