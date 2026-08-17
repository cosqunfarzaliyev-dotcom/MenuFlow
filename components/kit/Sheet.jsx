"use client";

// ---------------------------------------------------------------------------
// components/kit/Sheet.jsx — modal, right drawer and bottom sheet in one.
//
// The focus trap / Escape / scroll-lock / focus-restore logic is carried over
// deliberately from components/ui/Modal.jsx rather than rewritten: it is the
// most safety-critical, least visual code in the old kit and it works. What
// changed is the chrome (tokens, no blur-heavy scrim) and the addition of a
// `bottom` side for mobile — a customer on a phone should get a bottom sheet,
// not a centred dialog.
// ---------------------------------------------------------------------------
import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sheetScrimVariants, sheetPanelVariants, FOCUS } from './variants';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sheet({
  isOpen,
  onClose,
  side = 'center',
  size = 'md',
  stacked = false,
  closeOnScrimClick = true,
  ariaLabel,
  labelledBy,
  panelClassName,
  scrimClassName,
  /* Which theme scope the portalled panel should carry. Required because the
     portal escapes the panel root that declares --k-*: rendering into <body>
     would leave every var() unresolved. `null` renders in place instead of
     portalling — see the note at the bottom. */
  theme = 'dark',
  children,
}) {
  const panelRef = useRef(null);
  const [entered, setEntered] = useState(false);
  const id = useId();

  // Two-phase mount so the transition has something to animate between,
  // instead of the panel painting already at its end state. Deferred via
  // rAF/timer in both branches — a synchronous setState in an effect body
  // trips react-hooks/set-state-in-effect regardless of branch.
  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => setEntered(false), 0);
      return () => clearTimeout(t);
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = setTimeout(() => {
      const f = panelRef.current?.querySelectorAll(FOCUSABLE);
      (f?.[0] || panelRef.current)?.focus();
    }, 0);

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onClose?.(); return; }
      if (e.key !== 'Tab') return;
      const f = panelRef.current?.querySelectorAll(FOCUSABLE);
      if (!f || f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Closed-state transform per side, so the panel animates from where it lives.
  const closedTransform =
    side === 'right' ? 'translate-x-3 opacity-0'
      : side === 'bottom' ? 'translate-y-4 opacity-0'
        : 'scale-[0.98] opacity-0';

  const dialog = (
    <div
      className={cn(sheetScrimVariants({ side, stacked }), theme ? `kit-${theme}` : '', scrimClassName)}
      onClick={(e) => { if (closeOnScrimClick && e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : ariaLabel || 'Dialog'}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        id={id}
        className={cn(
          sheetPanelVariants({ side, size }),
          entered ? 'translate-x-0 translate-y-0 scale-100 opacity-100' : closedTransform,
          panelClassName,
        )}
      >
        {children}
      </div>
    </div>
  );

  // `theme={null}` renders in place. Needed when the dialog must inherit an
  // INLINE custom property from an ancestor — the customer surface sets
  // --theme-primary as an inline style on CustomerApp's root div, and a
  // portalled node would escape it, collapsing every accent to nothing.
  if (!theme || typeof document === 'undefined') return dialog;
  return createPortal(dialog, document.body);
}

export function SheetHeader({ title, description, onClose, className, children }) {
  return (
    <div className={cn('sticky top-0 z-10 flex items-start justify-between gap-3 bg-[var(--k-surface)] border-b border-[var(--k-border)] px-4 sm:px-5 py-3.5', className)}>
      {children ?? (
        <div className="min-w-0">
          {title && <h2 className="text-[15px] font-semibold text-[var(--k-text)] truncate">{title}</h2>}
          {description && <p className="text-xs text-[var(--k-text-3)] mt-0.5">{description}</p>}
        </div>
      )}
      {onClose && <SheetClose onClick={onClose} />}
    </div>
  );
}

export function SheetBody({ className, ...props }) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />;
}

export function SheetFooter({ className, ...props }) {
  return (
    <div className={cn('sticky bottom-0 bg-[var(--k-surface)] border-t border-[var(--k-border)] px-4 sm:px-5 py-3.5', className)} {...props} />
  );
}

export function SheetClose({ onClick, className, ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className={cn(
        'shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-[var(--k-r-sm)]',
        'text-[var(--k-text-3)] hover:text-[var(--k-text)] hover:bg-[var(--k-surface-2)]',
        'transition-colors duration-[var(--k-dur)]',
        FOCUS,
        className,
      )}
      {...props}
    >
      <X className="w-4 h-4" />
    </button>
  );
}
