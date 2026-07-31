import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, MessageCircle, Clock, Calendar, CheckCircle2, ArrowRight } from 'lucide-react';
import { TeacherProfile } from '../types';

interface SubscriptionExpirationModalProps {
  teacherProfile?: TeacherProfile | null;
  subscriptionEndDate?: string;
  userType?: 'teacher' | 'student' | 'admin';
}

export const SubscriptionExpirationModal: React.FC<SubscriptionExpirationModalProps> = ({
  teacherProfile,
  subscriptionEndDate,
  userType = 'teacher',
}) => {
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  useEffect(() => {
    // Determine target subscription date
    let rawDateStr = subscriptionEndDate || teacherProfile?.subscription_end_date;

    // Default: If no end date set yet, set 1 year from now for demonstration
    if (!rawDateStr) {
      const defaultDate = new Date();
      defaultDate.setFullYear(defaultDate.getFullYear() + 1);
      rawDateStr = defaultDate.toISOString().split('T')[0];
    }

    const targetTime = new Date(rawDateStr).getTime();
    const nowTime = new Date().getTime(); // System / server time check
    const diffMs = targetTime - nowTime;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    setDaysRemaining(diffDays);

    if (diffDays <= 0) {
      setIsExpired(true);
    } else if (diffDays <= 30) {
      // Trigger modal alert for 30, 15, 7, <= 3 days
      setShowWarningModal(true);
    }
  }, [subscriptionEndDate, teacherProfile]);

  const teacherName = teacherProfile?.teacherName || 'المعلم';
  const schoolName = teacherProfile?.schoolName || 'المدرسة';

  // Construct WhatsApp Renewal Link
  const whatsappNumber = '967780804012';
  const whatsappMessage = encodeURIComponent(
    `مرحباً، أنا المعلم [${teacherName}] من [${schoolName}]، أود تجديد اشتراكي في النظام.`
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  // IF EXPIRED: BLOCK SYSTEM USAGE
  if (isExpired) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 dir-rtl animate-fadeIn">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl border-2 border-red-500 p-6 text-center space-y-5">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl mx-auto flex items-center justify-center border border-red-200 shadow-inner">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>

          <div>
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-black">
              تنبيه حظر التراخيص
            </span>
            <h2 className="text-xl font-black text-slate-900 mt-2">
              انتهت فترة ترخيص الاشتراك للنظام
            </h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              تنبيه: لقد انتهت فترة الصلاحية المحددة لاستخدام المنصة. يرجى التواصل مع الدعم الفني لتجديد الاشتراك واستعادة صلاحية الوصول لكافة البيانات والخدمات.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 text-right space-y-1 font-semibold">
            <div>👤 المعلم: <span className="font-bold text-slate-900">{teacherName}</span></div>
            <div>🏫 المدرسة: <span className="font-bold text-indigo-900">{schoolName}</span></div>
            <div>📅 تاريخ انتهاء الصلاحية: <span className="font-bold text-red-600 dir-ltr inline-block">{subscriptionEndDate || teacherProfile?.subscription_end_date || 'منتهي'}</span></div>
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer transform hover:scale-[1.02]"
          >
            <MessageCircle className="w-5 h-5 fill-current" />
            <span>التواصل عبر الواتساب لتجديد الاشتراك فوراً</span>
          </a>

          <p className="text-[11px] text-slate-400 font-medium">
            رقم خدمة العملاء والاشتراكات: 967780804012+
          </p>
        </div>
      </div>
    );
  }

  // GRADUATED WARNING MODAL (30, 15, 7, <=3 DAYS)
  if (showWarningModal && !isDismissed && daysRemaining !== null) {
    let warningTitle = 'تنبيه اقتراب انتهاء الاشتراك';
    let urgencyBadge = 'تنبيه مبكر (باقي شهر)';
    let badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';

    if (daysRemaining <= 3) {
      warningTitle = 'تنبيه عاجل جداً: باقي أقل من 3 أيام على الانتهاء!';
      urgencyBadge = 'تنبيه طارئ يومي';
      badgeColor = 'bg-red-100 text-red-800 border-red-300 animate-pulse';
    } else if (daysRemaining <= 7) {
      warningTitle = 'تنبيه هام: باقي أسبوع واحد فقط على انتهاء الاشتراك!';
      urgencyBadge = 'تنبيه أسبوعي';
      badgeColor = 'bg-orange-100 text-orange-800 border-orange-300';
    } else if (daysRemaining <= 15) {
      warningTitle = 'تنبيه تذكيري: باقي نصف شهر على تجديد الاشتراك';
      urgencyBadge = 'تنبيه نصف شهري';
      badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
    }

    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl animate-fadeIn">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-amber-300 p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl mx-auto flex items-center justify-center border border-amber-200">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div>
            <span className={`px-3 py-1 rounded-full text-[11px] font-black border ${badgeColor}`}>
              {urgencyBadge}
            </span>
            <h3 className="text-base font-black text-slate-900 mt-2">
              {warningTitle}
            </h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              تصلك هذه الرسالة التذكيرية التلقائية لتسهيل تجديد الاشتراك قبل توقف الخدمات. المتبقي لك حالياً: <strong className="text-amber-700 text-sm">{daysRemaining} يوم</strong>.
            </p>
          </div>

          <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs text-amber-950 text-right space-y-1">
            <div className="flex items-center justify-between">
              <span>👤 الحساب: <strong>{teacherName}</strong></span>
              <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md font-mono">
                {teacherProfile?.public_ref_id || 'REF-ACTIVE'}
              </span>
            </div>
            <div>🏫 المدرسة: <strong>{schoolName}</strong></div>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>تجديد الاشتراك عبر الواتساب (967780804012)</span>
            </a>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>قرأت ذلك (متابعة استخدام المنصة)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
