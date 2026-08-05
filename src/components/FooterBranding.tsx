import React from 'react';

export const FooterBranding: React.FC = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 h-12 bg-white/95 backdrop-blur-md border-t border-slate-200 flex items-center justify-between px-3 sm:px-8 shadow-lg z-40 dir-rtl">
      {/* Center text */}
      <div className="text-slate-700 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-3 text-center mx-auto">
        <span>إعداد المستشار الإداري والتربوي إبراهيم دخان T-3</span>
        <span className="text-slate-300 hidden sm:inline">|</span>
        <span className="text-xs text-slate-500 hidden md:inline">منظومة الاختبارات التفاعلية الذكية PWA</span>
      </div>

      {/* WhatsApp Link directly embedded in bottom bar */}
      <a
        href="https://wa.me/967780804012"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="تواصل مع المستشار إبراهيم دخان عبر واتساب"
        title="تواصل مع الدعم الفني والمستشار إبراهيم دخان عبر واتساب"
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-xs font-bold shadow-md transition-all hover:scale-105 active:scale-95 shrink-0"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="white"
        >
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.438 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.438-9.89 9.886-.001 2.225.584 3.911 1.708 5.497l-.957 3.498 3.739-.981zM17.472 14.382c-.301-.15-1.767-.872-2.04-.971-.272-.099-.47-.15-.669.15-.199.299-.768.971-.941 1.17-.173.199-.347.225-.648.075-.301-.15-1.27-.468-2.42-1.493-.894-.798-1.496-1.783-1.672-2.083-.176-.3-.019-.462.13-.611.134-.133.3-.349.45-.523.15-.174.2-.299.3-.499.1-.2.05-.374-.025-.524-.075-.15-.669-1.611-.916-2.204-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.299-1.04 1.018-1.04 2.481 0 1.462 1.065 2.875 1.213 3.074.149.199 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.767-.721 2.015-1.419.247-.699.247-1.296.173-1.419-.074-.124-.272-.199-.573-.349z" />
        </svg>
        <span>واتساب</span>
      </a>
    </footer>
  );
};
