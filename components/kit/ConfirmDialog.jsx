"use client";

// ---------------------------------------------------------------------------
// components/kit/ConfirmDialog.jsx — same API as the older
// components/ui/ConfirmDialog (`useConfirmDialog()` -> { confirm, close,
// dialogProps }), so migrating a panel is an import swap, not a rewrite of its
// delete flows. Two shapes, both already relied on: a real confirm
// (Cancel + destructive Confirm) and a plain alert (single OK, `isAlert`).
// ---------------------------------------------------------------------------
import React, { useCallback, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Sheet, SheetBody } from './Sheet';
import { Button } from './primitives';

export function ConfirmDialog({
  isOpen, title, message, onConfirm, onCancel, isAlert,
  confirmLabel, cancelLabel, theme = 'dark',
}) {
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onCancel}
      size="sm"
      stacked
      closeOnScrimClick={false}
      ariaLabel={title}
      theme={theme}
    >
      <SheetBody className="text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--k-r)] bg-[var(--k-danger-soft)] text-[var(--k-danger)]">
          <TriangleAlert className="w-5 h-5" />
        </div>
        {title && <h2 className="text-[15px] font-semibold text-[var(--k-text)]">{title}</h2>}
        {message && <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--k-text-3)]">{message}</p>}

        <div className="mt-6 flex gap-2.5">
          {!isAlert && (
            <Button variant="secondary" onClick={onCancel} className="flex-1">
              {cancelLabel || 'Ləğv et'}
            </Button>
          )}
          <Button
            variant={isAlert ? 'primary' : 'danger'}
            onClick={isAlert ? onCancel : onConfirm}
            className="flex-1"
          >
            {confirmLabel || (isAlert ? 'Tamam' : 'Bəli, Sil')}
          </Button>
        </div>
      </SheetBody>
    </Sheet>
  );
}

export function useConfirmDialog() {
  const [state, setState] = useState({
    isOpen: false, title: '', message: '', onConfirm: null,
    isAlert: false, confirmLabel: undefined, cancelLabel: undefined,
  });

  const confirm = useCallback(({ title, message, onConfirm, isAlert = false, confirmLabel, cancelLabel }) => {
    setState({ isOpen: true, title, message, onConfirm, isAlert, confirmLabel, cancelLabel });
  }, []);

  const close = useCallback(() => setState((p) => ({ ...p, isOpen: false })), []);

  const dialogProps = {
    isOpen: state.isOpen,
    title: state.title,
    message: state.message,
    isAlert: state.isAlert,
    confirmLabel: state.confirmLabel,
    cancelLabel: state.cancelLabel,
    onCancel: close,
    // Closing here (rather than in each caller's onConfirm) is carried over
    // from the older hook — it removed a real footgun where a caller forgot.
    onConfirm: () => { state.onConfirm?.(); close(); },
  };

  return { confirm, close, dialogProps };
}
