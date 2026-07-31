import React from 'react';
import { Sparkles, ShieldCheck, School, GraduationCap, ArrowLeft, CheckCircle2, Lock, MonitorCheck, Zap } from 'lucide-react';
import { FooterBranding } from './FooterBranding';

interface WelcomeScreenProps {
  onEnterSystem: () => void;
  onSelectRole: (role: 'student' | 'teacher' | 'admin') => void;
  isStudentOnlyMode?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onEnterSystem,
  onSelectRole,
  isStudentOnlyMode = false,
}) => {
  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans dir-rtl flex flex-col justify-between relative overflow-hidden selection:bg-indigo-500 selection:text-white">
      {/* Background Decorative Gradients & Glows */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-900/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Navigation */}
      <header className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-indigo-500/30">
            R
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">
              منظومة التقييم والاختبارات الذكية
            </h1>
            <p className="text-xs text-indigo-300 font-medium">
              المنصة الرقمية المتكاملة للمعلمين والطلاب والمشرفين
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <span className="px-3.5 py-1.5 bg-indigo-950/80 text-indigo-300 text-xs font-extrabold rounded-full border border-indigo-800/60 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            نظام حراسات الأمان المعزول
          </span>
        </div>
      </header>

      {/* Main Content Hero */}
      <main className="relative z-10 max-w-5xl mx-auto w-full px-6 py-12 my-auto flex flex-col items-center text-center space-y-10">
        
        {/* Sub-Title Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-900/60 text-indigo-200 rounded-full border border-indigo-700/60 shadow-lg text-xs font-bold animate-pulse">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>مرحبًا بكم في الجيل الجديد للتقييم الأكاديمي</span>
        </div>

        {/* System Summary Headline */}
        <div className="space-y-4 max-w-3xl">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white">
            منظومة تفاعلية متكاملة لإعداد وإدارة الاختبارات الذكية
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-normal">
            منصة متطورة تدعم التصحيح التلقائي، التحليل اللحظي للنتائج، والعمل الكامل بدون إنترنت مع مزامنة سحابية آمنة للمؤسسات التعليمية والمدارس.
          </p>
        </div>

        {/* Featured Prominent Highlight Box (Strict requirement) */}
        <div className="w-full max-w-3xl bg-gradient-to-r from-indigo-900/90 via-slate-900/90 to-purple-900/90 border-2 border-indigo-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-emerald-400 via-indigo-500 to-purple-500" />
          
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-indigo-500/20 text-emerald-400 rounded-2xl border border-indigo-500/30 mb-1">
              <Zap className="w-7 h-7 animate-bounce" />
            </div>
            
            <p className="text-lg sm:text-2xl font-black text-amber-300 leading-snug tracking-wide text-center drop-shadow-md">
              "نسعد كثيرا بالارتقاء بكم ومعكم من خلال هذا التقدم التكنولوجي والمتابعات الدقيقة."
            </p>
            
            <p className="text-xs text-indigo-200 font-bold">
              إدارة المنظومة التعليمية الرقمية الشاملة
            </p>
          </div>
        </div>

        {/* Big Enter Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md pt-4">
          <button
            type="button"
            onClick={onEnterSystem}
            className="w-full py-4 px-8 bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-indigo-600/30 transition-all transform hover:scale-105 flex items-center justify-center gap-3 border border-indigo-400/30 group cursor-pointer"
          >
            <span>الدخول للنظام الآن</span>
            <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Quick Direct Guard Selectors */}
        <div className="pt-6 w-full max-w-3xl border-t border-slate-800/80">
          <p className="text-xs font-bold text-slate-400 mb-4">اختر بوابة الدخول المباشرة للنظام حسب صلاحيتك:</p>
          <div className={`grid grid-cols-1 ${isStudentOnlyMode ? 'sm:grid-cols-1 max-w-xs mx-auto' : 'sm:grid-cols-3'} gap-3`}>
            
            {/* Student Guard */}
            <button
              type="button"
              onClick={() => onSelectRole('student')}
              className="p-4 bg-slate-800/60 hover:bg-slate-800 text-white rounded-2xl border border-slate-700/80 hover:border-emerald-500/50 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-sm">بوابة الطالب</span>
              <span className="text-[11px] text-slate-400">تقديم الاختبارات وعرض السجل</span>
            </button>

            {!isStudentOnlyMode && (
              <>
                {/* Teacher Guard */}
                <button
                  type="button"
                  onClick={() => onSelectRole('teacher')}
                  className="p-4 bg-slate-800/60 hover:bg-slate-800 text-white rounded-2xl border border-slate-700/80 hover:border-indigo-500/50 transition-all flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <School className="w-5 h-5" />
                  </div>
                  <span className="font-extrabold text-sm">بوابة المعلم</span>
                  <span className="text-[11px] text-slate-400">إعداد الاختبارات والتحليلات</span>
                </button>

                {/* Admin Guard */}
                <button
                  type="button"
                  onClick={() => onSelectRole('admin')}
                  className="p-4 bg-slate-800/60 hover:bg-slate-800 text-white rounded-2xl border border-slate-700/80 hover:border-purple-500/50 transition-all flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <div className="w-10 h-10 bg-purple-500/20 text-purple-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Lock className="w-5 h-5" />
                  </div>
                  <span className="font-extrabold text-sm">لوحة المشرف العام</span>
                  <span className="text-[11px] text-slate-400">الإعدادات والتحكم بقاعدة البيانات</span>
                </button>
              </>
            )}

          </div>
        </div>

      </main>

      {/* Footer System Branding & Floating WhatsApp */}
      <FooterBranding />
    </div>
  );
};
