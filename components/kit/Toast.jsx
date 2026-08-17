"use client";

// ---------------------------------------------------------------------------
// components/kit/Toast.jsx — same provider/hook contract as the older
// components/ui/Toast (notify(message, type)) so a panel can switch kits
// without touching a single call site. What changed: tokens instead of the
// `.sa-toast .sa-card .sa-caption` SuperAdmin classes it used to borrow, and
// aria-live so a screen reader actually announces it.
// ---------------------------------------------------------------------------
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Check, TriangleAlert, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ToastContext = createContext(null);

const TONE = {
  success: { cls: 'text-[var(--k-success)]', Icon: Check },
  error: { cls: 'text-[var(--k-danger)]', Icon: TriangleAlert },
  info: { cls: 'text-[var(--k-info)]', Icon: Info },
};

export function ToastProvider({ children, duration = 3200 }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const notify = useCallback((message, type = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, duration);
    timers.current.set(id, timer);
  }, [duration]);

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* polite, not assertive — a toast must not interrupt what the screen
          reader is currently saying, and must never steal focus. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed top-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)]"
      >
        {toasts.map((t) => {
          const { cls, Icon } = TONE[t.type] || TONE.info;
          return (
            <div
              key={t.id}
              className={cn(
                'k-anim-in pointer-events-auto flex items-start gap-2.5 w-80 max-w-full',
                'rounded-[var(--k-r)] border border-[var(--k-border)] bg-[var(--k-surface-2)]',
                'px-3.5 py-3 text-[13px] text-[var(--k-text)]',
              )}
            >
              <Icon className={cn('w-4 h-4 shrink-0 mt-px', cls)} />
              <span className="flex-1 min-w-0 break-words">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Close"
                className="shrink-0 -mr-1 -mt-0.5 p-1 rounded text-[var(--k-text-3)] hover:text-[var(--k-text)] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// Returns the notify function directly (not an object) — matches the older
// kit's `const notify = useToast()` usage exactly.
export function useToast() {
  const ctx = useContext(ToastContext);
  // No-op outside a provider so a component can be rendered in isolation
  // (or in a test) without exploding.
  return ctx || (() => {});
}
