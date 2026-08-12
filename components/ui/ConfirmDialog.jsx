"use client";

import React, { useCallback, useState } from 'react';
import { Modal } from './Modal';

// Promoted from AdminApp's local `ConfirmModal` (Phase A already put it on
// the `Modal` primitive) — same API, same two shapes it already had to
// support: a real confirm (Cancel + destructive Confirm) and a plain alert
// (single "Tamam" button, `isAlert: true`, used e.g. when a category can't
// be deleted because it still has products). Nothing about the shape
// changed; only its location, so any dashboard can reach for it instead of
// `window.confirm()` — which is exactly the gap this phase closes:
// `components/superadmin/RestaurantsTab.jsx` used the raw native browser
// popup for deleting an entire restaurant (irreversible, cascades every
// product/order/table), and had NO confirmation at all before removing a
// user's admin/staff access.
export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, isAlert, confirmLabel, cancelLabel }) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="sm" stacked closeOnBackdropClick={false} ariaLabel={title}>
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-slate-400 mb-6 text-sm">{message}</p>

        <div className="flex gap-3">
          {!isAlert && (
            <button
              onClick={onCancel}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
            >
              {cancelLabel || 'Ləğv et'}
            </button>
          )}
          <button
            onClick={isAlert ? onCancel : onConfirm}
            className={`flex-1 py-3 text-white rounded-xl font-bold transition-colors ${
              isAlert ? 'bg-blue-600 hover:bg-blue-500' : 'bg-rose-600 hover:bg-rose-500'
            }`}
          >
            {confirmLabel || (isAlert ? 'Tamam' : 'Bəli, Sil')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Owns the {isOpen, title, message, onConfirm, isAlert} state every call
// site was otherwise hand-rolling (AdminApp had its own copy of exactly
// this). `confirm(...)` opens it; the returned `onConfirm` always closes the
// dialog itself after running the caller's action, which the original
// per-call-site version required each caller to remember to do —  removing
// that footgun is the one behavior change over the code being promoted.
export function useConfirmDialog() {
  const [state, setState] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isAlert: false, confirmLabel: undefined, cancelLabel: undefined });

  const confirm = useCallback(({ title, message, onConfirm, isAlert = false, confirmLabel, cancelLabel }) => {
    setState({ isOpen: true, title, message, onConfirm, isAlert, confirmLabel, cancelLabel });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const dialogProps = {
    isOpen: state.isOpen,
    title: state.title,
    message: state.message,
    isAlert: state.isAlert,
    confirmLabel: state.confirmLabel,
    cancelLabel: state.cancelLabel,
    onCancel: close,
    onConfirm: () => {
      state.onConfirm?.();
      close();
    },
  };

  return { confirm, close, dialogProps };
}
