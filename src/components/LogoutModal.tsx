import React, { useState } from 'react';
import { LogOut, AlertTriangle, Trash2, Check, X } from 'lucide-react';
import { clearAllIndexedDBSessions } from '../services/offlineDb';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmLogout: () => void;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({
  isOpen,
  onClose,
  onConfirmLogout,
}) => {
  const [isClearing, setIsClearing] = useState(false);

  if (!isOpen) return null;

  const handleLogout = async () => {
    setIsClearing(true);
    try {
      // 1. Clear IndexedDB Student Drafts & Temporary Sessions
      await clearAllIndexedDBSessions();
      // 2. Clear Session localStorage
      localStorage.removeItem('interactive_quiz_student_session');
      // 3. Trigger parent logout cleanup callback
      onConfirmLogout();
    } catch (err) {
      console.error('Error during logout session cleanup:', err);
      onConfirmLogout();
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 dir-rtl animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-6">
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center shadow-inner">
            <LogOut className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-slate-900">
            تأكيد تسجيل الخروج
          </h3>
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            هل أنت متأكد من رغبتك في تسجيل الخروج من النظام؟
          </p>
        </div>

        {/* Warning info box */}
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold block mb-0.5">تنويه الأمان وتنظيف الجلسة:</span>
            سيتم تنظيف الذاكرة المحلية الجارية (IndexedDB Session Clear) للعينات والمسودات لضمان خصوصية الحساب واستقراره.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isClearing}
            className="w-1/2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isClearing}
            className="w-1/2 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-2xl text-xs shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isClearing ? (
              <span>جاري خروج الجلسة...</span>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                تأكيد تسجيل الخروج
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
