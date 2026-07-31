import React, { useState, useEffect } from 'react';
import { RefreshCw, Sparkles, DownloadCloud } from 'lucide-react';

export const PWAUpdatePrompt: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;

        // Check if there is already a waiting worker
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
          setUpdateAvailable(true);
        }

        // Listen for new service worker installing/waiting
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
              setUpdateAvailable(true);
            }
          });
        });
      });

      // Handle controller change (reload page after skipWaiting)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  const handleApplyUpdate = async () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }

    // Unregister and clear caches for clean refresh
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    window.location.reload();
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-4 rounded-2xl shadow-2xl border border-indigo-500/40 dir-rtl animate-bounce">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-600/50 rounded-xl border border-indigo-400/30 text-amber-300 shrink-0">
            <DownloadCloud className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-black text-amber-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              تحديث جديد للنظام متاح الان
            </h4>
            <p className="text-[11px] text-slate-300 font-medium">
              يتوفر إصدار جديد من المنصة مع تحسينات في السرعة والأداء.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleApplyUpdate}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl font-black text-xs shrink-0 flex items-center gap-1.5 shadow-md transition-all cursor-pointer transform hover:scale-105"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-950 animate-spin" />
          <span>تحديث الآن</span>
        </button>
      </div>
    </div>
  );
};
