"use client";

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { modalBackdropVariants, modalPanelVariants } from './variants';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Replaces 5 hand-rolled `fixed inset-0 z-50 ...` overlays (3× in AdminApp —
// ProductModal/CategoryModal/ConfirmModal — plus ProductDetailModal and
// CartDrawer), none of which had a focus trap, Escape handling, scroll lock,
// or `aria-modal`. All four are added here once instead of five times.
//
// `position="right"` is the drawer shape CartDrawer needs — same primitive,
// not a second component, since the only real difference is where the panel
// sits and how the backdrop aligns it (see modalBackdropVariants/
// modalPanelVariants in variants.js).
export function Modal({
  isOpen,
  onClose,
  context = 'dark',
  position = 'center',
  size = 'md',
  stacked = false,
  closeOnBackdropClick = true,
  ariaLabel,
  labelledBy,
  panelClassName,
  children,
}) {
  const panelRef = useRef(null);
  const [entered, setEntered] = useState(false);
  const generatedId = useId();

  // Two-phase mount: the panel starts at opacity-0/scale-95 and flips to
  // opacity-100/scale-100 one frame later so the transition classes in
  // modalPanelVariants actually have something to animate between, instead
  // of the panel appearing already at its end state on first paint.
  // `motion-reduce:transition-none` on the panel (variants.js) turns this
  // into a plain instant-show for users who asked for less motion.
  useEffect(() => {
    if (!isOpen) {
      // Deferred the same way the opening branch below is (rAF vs. a 0ms
      // timer) rather than calling setEntered synchronously in the effect
      // body — react-hooks/set-state-in-effect flags the latter regardless
      // of which branch it's in.
      const timer = setTimeout(() => setEntered(false), 0);
      return () => clearTimeout(timer);
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  // Scroll lock + Escape + a real focus trap, scoped to the lifetime of an
  // open modal — restores focus to whatever triggered the modal on close.
  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = setTimeout(() => {
      const focusable = panelRef.current?.querySelectorAll(FOCUSABLE_SELECTOR);
      (focusable?.[0] || panelRef.current)?.focus();
    }, 0);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll(FOCUSABLE_SELECTOR);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const dialog = (
    <div
      className={cn(modalBackdropVariants({ context, position, stacked }))}
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : ariaLabel || 'Dialoq'}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        id={generatedId}
        className={cn(
          modalPanelVariants({ context, position, size }),
          entered ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
          panelClassName,
        )}
      >
        {children}
      </div>
    </div>
  );

  // Dark-context modals portal to <body> — safe because <body> itself
  // carries `.mf-dark` (app/layout.jsx), so var(--mf-*) still resolves
  // wherever in the DOM the portal lands.
  //
  // Customer-context modals do NOT portal. --theme-primary (the
  // per-restaurant accent every customer surface uses) is set via an INLINE
  // style on CustomerApp's own root div, not a CSS class — portaling to
  // <body> would escape that inline style and every var(--theme-primary) in
  // the dialog would resolve to nothing. Rendering in place (a normal child
  // in the React tree, same as before this migration) keeps that
  // inheritance intact; the focus-trap/Escape/scroll-lock behavior above
  // doesn't depend on portaling either way.
  if (context === 'customer' || typeof document === 'undefined') return dialog;
  return createPortal(dialog, document.body);
}

// Optional icon-only close button — kept separate from the panel itself
// because ConfirmModal has no close button by design (Cancel/Confirm are the
// only exits) while ProductDetailModal/CartDrawer/ProductModal/CategoryModal
// all want one in their header.
export function ModalCloseButton({ onClick, context = 'dark', className, ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Bağla"
      className={cn(
        'p-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 shrink-0',
        context === 'dark'
          ? 'bg-slate-800 text-slate-400 hover:text-white focus-visible:ring-[var(--mf-focus)] focus-visible:ring-offset-slate-900'
          : 'bg-[var(--mf-bg-secondary)] text-[var(--mf-text-muted)] hover:text-[var(--mf-text)] focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-white',
        className,
      )}
      {...props}
    >
      <X className="w-5 h-5" />
    </button>
  );
}
