import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, GraduationCap, School, Download, Sparkles, ShieldCheck, LogOut, Home, BookOpen } from 'lucide-react';
import { syncOfflineData } from '../services/firebase';

interface HeaderBarProps {
  currentRole: 'teacher' | 'student' | 'admin';
  onRoleChange: (role: 'teacher' | 'student' | 'admin') => void;
  onRefreshClick?: () => void;
  hideTeacherButton?: boolean;
  teacherProfile?: any;
  onOpenProfileModal?: () => void;
  onOpenLogoutModal?: () => void;
  onShowWelcomeScreen?: () => void;
  onOpenStudentArchive?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  currentRole,
  onRoleChange,
  onRefreshClick,
  hideTeacherButton = false,
  teacherProfile,
  onOpenProfileModal,
  onOpenLogoutModal,
  onShowWelcomeScreen,
  onOpenStudentArchive,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      handleManualSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleManualSync = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    setSyncStatusText('جاري المزامنة مع Firebase...');
    try {
      const res = await syncOfflineData();
      if (res.quizzesSynced > 0 || res.submissionsSynced > 0) {
        setSyncStatusText(`تمت مزامنة ${res.quizzesSynced} اختبار و ${res.submissionsSynced} مشاركة بنجاح!`);
      } else {
        setSyncStatusText('جميع البيانات متزامنة مسبقاً.');
      }
      if (onRefreshClick) onRefreshClick();
    } catch (err) {
      setSyncStatusText('حدث خطأ أثناء المزامنة.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusText(null), 4000);
    }
  };

  const installPwa = () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      setDeferredPrompt(null);
    });
  };

  return (
    <header className="w-full bg-indigo-900 text-white shadow-md sticky top-0 z-40 border-b border-indigo-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-900 font-extrabold text-xl shadow-sm shrink-0">
            R
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight italic">
              رفيقك في الاختبارات التفاعلية
            </h1>
            <p className="text-xs text-indigo-200 font-medium hidden sm:block">
              تطبيق PWA المعزز بقاعدة بيانات Firebase والدعم الكامل بدون إنترنت
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center flex-wrap gap-3">
          {/* Online/Offline Badge */}
          <div className="flex items-center gap-2 text-xs bg-indigo-800/90 px-3.5 py-1.5 rounded-full border border-indigo-700 shadow-inner">
            {isOnline ? (
              <>
                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
                <span className="text-emerald-200 font-medium hidden md:inline">متصل بمزامنة Firebase</span>
              </>
            ) : (
              <>
                <div className="w-2.5 h-2.5 bg-amber-400 rounded-full"></div>
                <span className="text-amber-200 font-medium">يعمل بدون إنترنت (محلي)</span>
              </>
            )}

            {isOnline && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="mr-1 p-1 hover:bg-indigo-700 rounded-full text-indigo-200 hover:text-white transition-all disabled:opacity-50"
                title="مزامنة فورية"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-300' : ''}`} />
              </button>
            )}
          </div>

          {/* Teacher Profile Quick Pill */}
          {currentRole === 'teacher' && teacherProfile && onOpenProfileModal && (
            <button
              type="button"
              onClick={onOpenProfileModal}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-indigo-800/80 hover:bg-indigo-700/90 text-white rounded-xl border border-indigo-700 text-xs font-bold transition-all"
              title="تعديل حساب المعلم والمدرسة"
            >
              <School className="w-3.5 h-3.5 text-amber-300" />
              <span className="truncate max-w-[120px]">{teacherProfile.teacherName}</span>
              <span className="text-[10px] text-indigo-200">({teacherProfile.schoolName})</span>
            </button>
          )}

          {/* Role Switcher Guards */}
          <div className="flex items-center p-1 bg-indigo-950/80 rounded-xl border border-indigo-800">
            {!hideTeacherButton && currentRole !== 'student' && (
              <button
                type="button"
                onClick={() => onRoleChange('teacher')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentRole === 'teacher'
                    ? 'bg-white text-indigo-900 shadow-md'
                    : 'text-indigo-200 hover:text-white hover:bg-indigo-800/50'
                }`}
              >
                <School className="w-3.5 h-3.5" />
                لوحة المعلم
              </button>
            )}

            <button
              type="button"
              onClick={() => onRoleChange('student')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                currentRole === 'student'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'text-indigo-200 hover:text-white hover:bg-indigo-800/50'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              بوابة الطالب
            </button>

            {currentRole === 'student' && onOpenStudentArchive && (
              <button
                type="button"
                onClick={onOpenStudentArchive}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-indigo-950 font-extrabold rounded-lg text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer border border-amber-300"
                title="تصفح أرشيف الاختبارات والتكاليف العامة"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-950" />
                <span>أرشيف الاختبارات والتكاليف</span>
              </button>
            )}

            {/* Admin button ONLY appears when currentRole is explicitly 'admin' and not student mode */}
            {currentRole === 'admin' && !hideTeacherButton && (
              <button
                type="button"
                onClick={() => onRoleChange('admin')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-purple-600 text-white shadow-md"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                المشرف العام
              </button>
            )}
          </div>

          {/* Welcome Screen Home Button */}
          {onShowWelcomeScreen && (
            <button
              type="button"
              onClick={onShowWelcomeScreen}
              className="p-2 bg-indigo-800/80 hover:bg-indigo-700 text-indigo-200 hover:text-white rounded-xl border border-indigo-700 text-xs font-bold transition-all flex items-center gap-1.5"
              title="شاشة الترحيب الرئيسية"
            >
              <Home className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline">الرئيسية</span>
            </button>
          )}

          {/* Logout Button (Strict requirement) */}
          {onOpenLogoutModal && (
            <button
              type="button"
              onClick={onOpenLogoutModal}
              className="px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all border border-red-500/50 cursor-pointer"
              title="تسجيل الخروج من النظام وتنظيف الجلسة"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل خروج</span>
            </button>
          )}

          {/* Install PWA Prompt */}
          {deferredPrompt && (
            <button
              type="button"
              onClick={installPwa}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-indigo-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              تثبيت التطبيق
            </button>
          )}
        </div>
      </div>

      {syncStatusText && (
        <div className="w-full bg-emerald-900/90 text-emerald-100 text-xs text-center py-1.5 px-4 font-medium border-t border-emerald-700 animate-fadeIn flex items-center justify-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          {syncStatusText}
        </div>
      )}
    </header>
  );
};
