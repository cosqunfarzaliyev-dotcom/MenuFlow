"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createEpointPayment, confirmEpointPayment } from "@/lib/services/supabaseService";

// Shared Epoint Apple Pay/Google Pay widget state machine — extracted from
// CustomerApp.jsx's original inline implementation (bill modal) so
// CartDrawer.jsx (checkout) can run the exact same real-charge flow without
// duplicating it. Nothing about the LOGIC changed in the extraction, only
// where it lives; see epoint-create-payment/index.ts and epoint-confirm-
// payment/index.ts for the server-side protocol this drives.
//
// Deliberately NOT a page redirect anywhere in here. createEpointPayment()
// returns a widget_url (Epoint's Apple Pay/Google Pay TOKEN WIDGET) that the
// caller embeds as an <iframe> — the customer never leaves menuflow's own
// page. The widget has no redirect/callback of its own, so the outcome is
// learned two ways at once while it's open:
//   1. postMessage — the widget's own page posts {status:'success', ...} to
//      its parent the moment the customer finishes (Epoint's official API
//      doc, "Apple Pay & Google Pay" section). Fast path.
//   2. A 3s poll of confirmEpointPayment (Epoint's own 1/get-status) as a
//      bounded (~5 min) fallback for a context that never posts the message.
// Both paths funnel through the SAME confirmEpointPayment call — postMessage
// only ever decides WHEN to ask, never trusted as the outcome itself (only
// Epoint's own server-to-server get-status response is allowed to settle
// anything). confirmEpointPayment is idempotent (0048/0049), so the poll and
// the message handler racing each other is harmless.
//
// Usage:
//   const { creating, widgetUrl, amount, pay, cancel } = useEpointWalletPayment({
//     restaurantId, tableId, qrToken,
//     onSettled: ({ status }) => { ... 'success' | 'error' | 'pending' ... },
//   });
export function useEpointWalletPayment({ restaurantId, tableId, qrToken, onSettled }) {
  const [creating, setCreating] = useState(false);
  const [widget, setWidget] = useState(null); // { url, transactionId, amount } | null

  // Ref so the polling effect below always calls the LATEST onSettled without
  // needing it in the effect's own dependency array (callers typically pass a
  // fresh closure every render). Updated in its own effect (no deps — runs
  // after every render), never written during render itself.
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  });

  // Accepts an optional table id override for callers that only learn the
  // real (resolved) table id synchronously inside their own submit handler
  // (CartDrawer.jsx — table resolution can require an extra fetchTableByNumber
  // call before the id is known) and cannot wait for a setState to flush and
  // re-render this hook with an updated `tableId` prop before calling pay().
  const pay = useCallback(async (overrideTableId) => {
    const effectiveTableId = overrideTableId || tableId;
    if (creating || widget || !restaurantId || !effectiveTableId) {
      return { error: new Error('Ödəniş artıq başladılıb.') };
    }
    setCreating(true);
    const { result, error } = await createEpointPayment({ restaurantId, tableId: effectiveTableId, qrToken });
    setCreating(false);
    if (error || !result?.widgetUrl) return { error };
    setWidget({ url: result.widgetUrl, transactionId: result.transactionId, amount: result.amount ?? null });
    return { error: null };
  }, [creating, widget, restaurantId, tableId, qrToken]);

  // Manual close — the customer changed their mind or the widget is stuck.
  // Leaves the transaction row 'pending' server-side (harmless — a fresh
  // 'wallet' tap next time just creates a new transaction row, the stale one
  // is simply abandoned, same as an unfinished cash/card intent already is
  // in this app); does not touch orders/payment_status.
  const cancel = useCallback(() => setWidget(null), []);

  useEffect(() => {
    if (!widget) return undefined;
    const { transactionId } = widget;
    const widgetOrigin = (() => {
      try {
        return new URL(widget.url).origin;
      } catch {
        return null;
      }
    })();
    const MAX_ATTEMPTS = 100;
    let attempts = 0;
    let cancelled = false;
    let checking = false;

    const finish = (status, error) => {
      if (cancelled) return;
      cancelled = true;
      setWidget(null);
      onSettledRef.current?.({ status, error: error || null });
    };

    // Shared by both the message handler and the interval tick — never runs
    // two overlapping confirm calls at once (checking guard), which would
    // otherwise both be in flight if a postMessage arrives right as a poll
    // tick fires.
    const checkStatus = async () => {
      if (checking || cancelled) return;
      checking = true;
      attempts += 1;
      const { result, error } = await confirmEpointPayment({ transactionId });
      checking = false;
      if (cancelled) return;

      if (result?.status === 'success') {
        finish('success');
        return;
      }
      if (result?.status === 'error') {
        finish('error');
        return;
      }
      // 'pending' (still on Epoint's side) or a transient error on this one
      // check — keep waiting rather than failing the whole flow on a single
      // network hiccup, but not forever.
      if (attempts >= MAX_ATTEMPTS) {
        finish(error ? 'error' : 'pending', error);
      }
    };

    const handleMessage = (event) => {
      // Never trust a postMessage from anywhere but the widget's own iframe
      // origin — this only decides WHEN to re-check, checkStatus() above
      // still requires Epoint's own get-status response to actually settle
      // anything.
      if (widgetOrigin && event.origin !== widgetOrigin) return;
      if (event.data?.status) checkStatus();
    };
    window.addEventListener('message', handleMessage);

    const intervalId = setInterval(checkStatus, 3000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener('message', handleMessage);
    };
  }, [widget]);

  return {
    creating,
    widgetUrl: widget?.url ?? null,
    amount: widget?.amount ?? null,
    pay,
    cancel,
  };
}
