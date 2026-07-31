import React, { useState } from 'react';
import { ShieldCheck, Key, Lock, AlertCircle, UserCheck, X } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdminLoginSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onAdminLoginSuccess,
}) => {
  const [serialNumber, setSerialNumber] = useState('');
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedSerial = serialNumber.trim();
    const trimmedCode = code.trim();

    // Strict Admin Credentials Verification
    if (trimmedSerial === '772324000' && trimmedCode === '780804012a') {
      onAdminLoginSuccess();
    } else {
      setErrorMsg('الرقم التسلسلي أو رقم الكود غير صحيح. يُسمح بدخول المشرف العام المعتمد فقط.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md z-50 flex items-center justify-center p-4 dir-rtl animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-purple-200 space-y-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 left-5 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 text-purple-700 rounded-2xl mb-1 shadow-inner">
            <ShieldCheck className="w-9 h-9 text-purple-700" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">تسجيل دخول المشرف العام</h2>
          <p className="text-xs text-slate-500 font-medium">
            الوصول المعزول برمجياً لحساب المشرف العام وبوابة التحكم بقواعد البيانات
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-50 text-red-800 rounded-2xl border border-red-200 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Serial Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-purple-600" />
              الرقم التسلسلي للمشرف <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="أدخل الرقم التسلسلي الخاص بك..."
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none text-sm font-extrabold text-slate-900 tracking-wider bg-slate-50/50 focus:bg-white transition-all"
            />
          </div>

          {/* Code */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-purple-600" />
              رقم الكود <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              placeholder="أدخل رقم الكود الخاص بك..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none text-sm font-extrabold text-slate-900 tracking-wider bg-slate-50/50 focus:bg-white transition-all"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 px-6 bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-600 hover:to-indigo-700 text-white font-black rounded-2xl text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserCheck className="w-5 h-5 text-amber-300" />
              تأكيد الدخول كـ (المشرف العام)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
