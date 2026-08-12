"use client";

// Promoted from components/superadmin/Toast.jsx into the shared primitive
// kit — content unchanged (verbatim move, not a rewrite). It still renders
// with the SuperAdmin `.sa-toast`/`.sa-card` classes rather than the new
// `.mf-dark` primitives; genericizing its visuals is a separate decision,
// not bundled into relocating the file. components/superadmin/Toast.jsx now
// just re-exports from here so the one existing importer (SuperAdminApp.jsx)
// is unaffected.

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message, type = 'success') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => dismiss(id), 3200);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`sa-toast sa-card flex items-start gap-2.5 px-4 py-3 shadow-2xl ${
              t.type === 'error' ? 'border-rose-500/30' : 'border-emerald-500/30'
            }`}
          >
            {t.type === 'error' ? (
              <XCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <p className="sa-caption text-white flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-slate-500 hover:text-white shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return () => {};
  return ctx;
}
