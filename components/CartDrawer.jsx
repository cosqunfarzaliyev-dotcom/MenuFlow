"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from 'next/image';
import { Trash2, Plus, Minus, ShoppingBag, Send, CheckCircle2, UtensilsCrossed } from "lucide-react";

import { useAppStore } from '@/lib/store';
import { fetchTableByNumber } from '@/lib/services/supabaseService';
import { getLocalizedProduct, getLocalizedText } from '@/lib/translations';
import { detectWalletBrand } from '@/lib/services/paymentService';
import { getServiceRules } from '@/lib/services/serviceModelService';
import { Sheet, SheetHeader, Button, Input, Field, Tag, Banner, EmptyState } from '@/components/kit';
import { useEpointWalletPayment } from '@/hooks/useEpointWalletPayment';
import { cn } from '@/lib/utils';

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80";

// 'later' first and default-selected: paying is now voluntary at order time
// (0025_order_payment_status.sql / the customer-facing "Hesab" flow) — a
// customer who never touches this radiogroup used to silently submit as
// 'cash', which was a payment INTENT masquerading as a payment FACT. 'later'
// sends no payment_method at all (see handleSendOrder), leaving the order
// genuinely unspecified until staff settles it.
// cash/card have NO separate icon here — lib/translations.js's `cash`/`card`
// strings ("💵 Nəğd"/"💳 Kart") already carry their own emoji prefix, so an
// icon field here would render it twice (confirmed live: "💵💵 Nəğd").
//
// No fake google_pay/apple_pay entries here anymore (they used to trigger the
// native wallet sheet via the W3C Payment Request API and just discard the
// resulting token — see paymentService.js's own header for why that never
// charged anyone). The only wallet option is `wallet`, appended by
// availablePaymentMethods below ONLY when the restaurant has a real Epoint
// gateway connected — see that useMemo.
const PAYMENT_METHODS = [
  { key: 'later', labelKey: 'payLater', icon: '🕒' },
  { key: 'cash', labelKey: 'cash' },
  { key: 'card', labelKey: 'card' },
];

export const CartDrawer = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onUpdateNote,
  onRemoveItem,
  onClearCart,
  tableNumber,
  lang = "az",
}) => {
  const createOrder = useAppStore(state => state.createOrder);
  const createAlert = useAppStore(state => state.createAlert);
  const tables = useAppStore(state => state.tables);
  const restaurant = useAppStore(state => state.restaurant);
  const qrToken = useAppStore(state => state.qrToken);
  const currencySymbol = useAppStore(state => state.settings?.currencySymbol) || '₼';
  // A SNAPSHOT of what was just sent, not a boolean. `items`/`totalPrice`
  // come from the parent's cart state, and handleSendOrder clears that cart
  // (onClearCart) before flipping to the success screen — so by the time the
  // screen rendered, it was reading an already-empty array and always showed
  // "0 ədəd / 0.00 ₼". Capturing the values before the clear is what makes
  // the confirmation actually show the order that was placed.
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [kitchenNote, setKitchenNote] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState('later');
  // Same "compute once on mount, not inline during render" reasoning as
  // CustomerApp.jsx's own walletBrand state — detectWalletBrand() reads
  // navigator/window, which would be an impure render otherwise.
  const [walletBrand, setWalletBrand] = useState('both');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWalletBrand(detectWalletBrand());
  }, []);

  const currentTable = tables.find(t => t.table_number?.toString() === tableNumber?.toString() || t.id === tableNumber) || { id: tableNumber, name: getLocalizedText('tableFallbackName', lang)(tableNumber) };

  // 'later' is gated by the restaurant's SERVICE MODEL (0045), not an
  // entitlement — cash/card are never gated. Only a waiter-service venue that
  // settles up afterwards has any use for "I'll pay later" — see
  // serviceModelService.js for the rule table and for why an operating mode
  // is not something a plan sells. getServiceRules() falls back to the
  // default model for a null/unknown value, so offline mode
  // (supabaseReady === false, the data/menu.json seed) keeps the option
  // exactly as before.
  const serviceRules = getServiceRules(restaurant);
  const payLaterEnabled = serviceRules.payLaterAllowed;
  const selfPickup = serviceRules.selfPickup;
  const epointEnabled = Boolean(restaurant?.epoint_payment_enabled);
  const availablePaymentMethods = useMemo(() => {
    const base = PAYMENT_METHODS.filter((m) => (m.key === 'later' ? payLaterEnabled : true));
    if (epointEnabled) {
      base.push({
        key: 'wallet',
        label: walletBrand === 'apple' ? 'Apple Pay' : walletBrand === 'google' ? 'Google Pay' : 'Apple Pay / Google Pay',
        icon: walletBrand === 'apple' ? '' : walletBrand === 'google' ? '🅖' : '💳',
      });
    }
    return base;
  }, [payLaterEnabled, epointEnabled, walletBrand]);

  // Real Epoint charge at checkout — shared state machine with CustomerApp.
  // jsx's bill modal, see useEpointWalletPayment's own header. Unlike the
  // bill modal, the order here is created FIRST (handleSendOrder below), then
  // payment starts for it — cancelling or failing does not un-send the order
  // (already at the kitchen), it only means the customer pays later via the
  // existing "Hesabı ödə" flow. pendingOrderSnapshotRef holds what the
  // success screen should show once onSettled fires — set right before
  // pay() is called, read back inside onSettled (which runs well after
  // handleSendOrder's own scope has returned).
  const pendingOrderSnapshotRef = useRef(null);
  const {
    creating: walletCreating,
    widgetUrl: walletWidgetUrl,
    amount: walletAmount,
    pay: payWithWallet,
    cancel: cancelWalletPayment,
  } = useEpointWalletPayment({
    restaurantId: restaurant?.id,
    tableId: currentTable?.id,
    qrToken,
    onSettled: ({ status }) => {
      const snapshot = pendingOrderSnapshotRef.current;
      pendingOrderSnapshotRef.current = null;
      if (!snapshot) return; // defensive — should never fire with nothing pending
      setSubmittedOrder({ ...snapshot, paymentIncomplete: status !== 'success' });
      if (typeof onClearCart === 'function') onClearCart();
    },
  });

  // With 'later' gone there is no neutral "haven't decided" option left, so
  // nothing is preselected and the send button stays locked until the customer
  // picks one — deliberately one extra tap, rather than silently declaring
  // "cash" on behalf of someone who never looked at the row.
  const fallbackMethod = payLaterEnabled ? 'later' : null;
  // 5 buttons in a row is too tight on a phone with icon+text — 3 columns
  // wraps a 4th/5th button to a second row instead of shrinking every button.
  const PAYMENT_GRID_COLS = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-3', 5: 'grid-cols-3' };

  if (!isOpen) return null;

  // If the previously selected method just got filtered out (e.g. the
  // restaurant's entitlements resolved after mount), fall back rather than
  // silently submitting a method that's no longer offered.
  //
  // The `!== null` guard is load-bearing: null is never in the list, so
  // without it this would setState on every render once pay-later is off.
  // The old code used `paymentMethod !== 'later'` for exactly that job, which
  // only worked while 'later' could never itself be filtered out.
  if (paymentMethod !== null && !availablePaymentMethods.some((m) => m.key === paymentMethod)) {
    setPaymentMethod(fallbackMethod);
  }

  const calculateItemPrice = (item) => {
    let base = Number(item.product.price || 0);
    if (item.selectedOptions) {
      Object.values(item.selectedOptions).forEach((opt) => {
        base += Number(opt?.extraPrice || 0);
      });
    }
    return base * item.quantity;
  };

  const totalPrice = items.reduce((sum, item) => sum + calculateItemPrice(item), 0);

  const handleResetOrder = () => {
    setSubmittedOrder(null);
    setKitchenNote("");
    setPaymentMethod(fallbackMethod);
    if (typeof onClearCart === 'function') onClearCart();
    if (typeof onClose === 'function') onClose();
  };

  const paymentLabels = {
    later: getLocalizedText('payLater', lang),
    cash: getLocalizedText('cash', lang),
    card: getLocalizedText('card', lang),
    wallet: walletBrand === 'apple' ? 'Apple Pay' : walletBrand === 'google' ? 'Google Pay' : 'Apple Pay / Google Pay',
  };

  const handleSendOrder = async () => {
    setSubmitError("");

    // Pay-later is off for this service model and nothing is picked yet. The button is already
    // disabled in that state; this is the belt-and-suspenders half, so a
    // keyboard/programmatic submit can't send an order with no declared
    // method on a restaurant that requires one.
    if (paymentMethod === null) return;

    try {
      let table = tables.find((t) =>
        t.table_number?.toString() === tableNumber || t.id === tableNumber,
      );

      const isFallback = table && (table.id === table.table_number?.toString() || !table.table_number);

      if (!table || isFallback) {
        // restaurant.id MUST be passed here: table_number is only unique
        // *within* a restaurant (every tenant's tables start at 1), so an
        // unscoped lookup can throw once a second restaurant exists, or —
        // worse — resolve to a different restaurant's table row entirely.
        const dbTable = await fetchTableByNumber(tableNumber, restaurant?.id);
        if (dbTable) table = dbTable;
      }

      const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      if (!table?.id || !isUuid(table.id)) {
        const message = getLocalizedText('tableRecordNotFound', lang)(tableNumber);
        console.error(`Table record not found for table number ${tableNumber}`);
        setSubmitError(message);
        return;
      }

      // 'later' means the customer genuinely hasn't decided yet — send no
      // payment_method at all (place_order() stores whatever it's given
      // verbatim) rather than a fake 'later' string that would leak into
      // staff-side payment-method reporting downstream.
      const isPayingLater = paymentMethod === 'later';

      const { order, error } = await createOrder({
        tableId: table.id,
        total: totalPrice,
        items,
        note: kitchenNote,
        paymentMethod: isPayingLater ? null : paymentMethod,
        paymentMethodLabel: isPayingLater ? null : (paymentLabels[paymentMethod] || paymentMethod),
      });

      if (error) {
        console.error('createOrder error:', error);
        setSubmitError(error.message || getLocalizedText('orderSubmitFailed', lang));
        return;
      }

      // Sifariş uğurla yaradıldı. Müştəri real ödəniş üsulu seçibsə (later
      // yox), "Hesab" axınının yaratdığı EYNİ 'bill' tipli alerti yarat —
      // StaffApp-ın Alerts tabında zəng çalıb "Ödənişi Təsdiqlə" kartı açan
      // yeganə mexanizm budur (handleRequestBill, CustomerApp.jsx). Fire-
      // and-forget: sifariş artıq uğurludur, bu heç vaxt submitError-a
      // toxunmamalı və uğur ekranını gecikdirməməlidir — o cümlədən
      // upsert_alert-in gözlənilən 5 saniyəlik eyni-masa cooldown-u
      // (0012_upsert_alert_token_fix.sql), ikinci sifariş bir neçə saniyə
      // sonra göndəriləndə.
      //
      // Özünəxidmətdə (0045/0046) göndərilmir: orada ödənişi təsdiqləmək üçün
      // ayrıca bildiriş yoxdur — personal sifarişi təhvil verəndə hand_over_
      // order() eyni tranzaksiyada ödənişi də bağlayır, Bildirişlər tabı isə
      // ümumiyyətlə gizlidir. Göndərilsəydi, hər sifariş görünməyən bir sətir
      // və "Hesab tələbi" başlıqlı push bildirişi yaradardı (0030-un
      // alerts_push_notify trigger-i).
      // 'wallet' is excluded here too — epoint-confirm-payment settles (and
      // resolves any active bill alert) automatically on success, same
      // reasoning as the bill modal's Epoint path (CustomerApp.jsx). There is
      // nothing for staff to "confirm" for a method that settles itself.
      if (!isPayingLater && !selfPickup && paymentMethod !== 'wallet') {
        createAlert({
          tableId: table.id,
          type: 'bill',
          paymentMethod,
          paymentMethodLabel: paymentLabels[paymentMethod] || paymentMethod,
          note: getLocalizedText('checkoutPaymentDeclaredNote', lang),
        }).then(({ error: alertError }) => {
          if (alertError) console.error('createAlert (checkout payment) failed:', alertError);
        }).catch((err) => {
          console.error('createAlert (checkout payment) threw:', err);
        });
      }

      // Snapshot BEFORE onClearCart() — see the submittedOrder useState note.
      const snapshot = {
        tableName: currentTable.name,
        itemCount: items.length,
        total: totalPrice,
        paymentLabel: isPayingLater ? null : (paymentLabels[paymentMethod] || paymentMethod),
      };

      if (paymentMethod === 'wallet') {
        // The order is already sent — it can't be un-sent by a payment
        // outcome. Hold the snapshot for the widget overlay branch below;
        // onSettled (wired above) shows the success screen once payment
        // concludes, whatever the outcome.
        pendingOrderSnapshotRef.current = snapshot;
        const { error: payError } = await payWithWallet(table.id);
        if (payError) {
          pendingOrderSnapshotRef.current = null;
          // Order already went through — same "sent regardless" reasoning,
          // just skip straight to the success screen with the incomplete
          // note instead of getting stuck with no visible next step.
          setSubmittedOrder({ ...snapshot, paymentIncomplete: true });
          if (typeof onClearCart === 'function') onClearCart();
        }
        return;
      }

      setSubmittedOrder(snapshot);
      if (typeof onClearCart === 'function') onClearCart();
    } catch (err) {
      console.error(err);
      setSubmitError(err?.message || getLocalizedText('orderSubmitFailed', lang));
    }
  };

  // Manual close of the wallet widget overlay. Unlike CustomerApp.jsx's bill
  // modal, where nothing exists yet at that point and a plain cancel() is
  // enough, here the order was ALREADY sent before the widget opened —
  // cancelling payment must still land on the success screen (same "sent
  // regardless" reasoning as handleSendOrder's payError branch), not
  // silently strand the customer on what would otherwise look like an
  // untouched cart with no visible next step.
  const handleWalletWidgetCancel = () => {
    cancelWalletPayment();
    const snapshot = pendingOrderSnapshotRef.current;
    pendingOrderSnapshotRef.current = null;
    if (!snapshot) return;
    setSubmittedOrder({ ...snapshot, paymentIncomplete: true });
    if (typeof onClearCart === 'function') onClearCart();
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      side="right"
      ariaLabel={`${getLocalizedText("cartTitle", lang)} — ${currentTable.name}`}
      /* Renders in place, not portalled — see ProductDetailModal for why
         (--theme-primary is an inline style on CustomerApp's root). */
      theme={null}
      panelClassName="kit-light max-w-md flex flex-col"
      /* Stops the scrim (and, since the panel stretches to fill it, the
         panel itself) short of the viewport bottom by exactly the fixed
         bottom nav's real measured height — CustomerApp.jsx sets
         --customer-nav-h from the nav's own getBoundingClientRect(), so
         this lands flush against the nav's top edge with no gap and no
         overlap, instead of a guessed flat number. That keeps the nav
         visible and clickable while the cart is open instead of getting
         painted over by the scrim's z-[60] (nav is z-50). All four sides
         must be spelled out: tailwind-merge treats `inset` as conflicting
         with `top`/`right`/`bottom`/`left`, so a bare `bottom-[...]` would
         strip `inset-0` entirely and leave the other three sides unset. */
      scrimClassName="top-0 right-0 left-0 bottom-[var(--customer-nav-h,4.5rem)]"
    >
      <SheetHeader onClose={onClose}>
        <div className="flex min-w-0 items-center gap-2.5">
          <ShoppingBag className="w-4 h-4 shrink-0 text-[var(--k-accent)]" />
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-[var(--k-text)]">
              {getLocalizedText("cartTitle", lang)}
            </h2>
            <p className="truncate text-xs text-[var(--k-text-3)]">{currentTable.name}</p>
          </div>
        </div>
      </SheetHeader>

      {submittedOrder ? (
        /* Success screen */
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--k-success-soft)] text-[var(--k-success)]">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--k-text)]">
            {getLocalizedText("orderSent", lang)}
          </h3>
          <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[var(--k-text-3)]">
            <strong className="font-medium text-[var(--k-accent)]">{submittedOrder.tableName}</strong>{' '}
            {/* The default copy literally says "delivered to the waiter" — the
                one thing that does not happen in a self-service venue, where
                the customer collects it from the counter themselves. */}
            {getLocalizedText(selfPickup ? "orderSuccessDescSelfService" : "orderSuccessDesc", lang)}
          </p>

          <dl className="mt-6 w-full space-y-2.5 rounded-[var(--k-r)] border border-[var(--k-border)] bg-[var(--k-surface-2)] p-4 text-left text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--k-text-3)]">{getLocalizedText("table", lang)}</dt>
              <dd className="font-medium text-[var(--k-text)]">{submittedOrder.tableName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--k-text-3)]">{getLocalizedText("itemCount", lang)}</dt>
              <dd className="k-nums font-medium text-[var(--k-text)]">
                {submittedOrder.itemCount} {getLocalizedText("piece", lang)}
              </dd>
            </div>
            {/* Only when a method was actually chosen — a "Sonra ödəyəcəyəm"
                order has none, and showing a blank row (or the word "later"
                as if it were a method) would just be noise. */}
            {submittedOrder.paymentLabel && (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--k-text-3)]">{getLocalizedText("paymentType", lang)}</dt>
                <dd className="font-medium text-[var(--k-text)]">{submittedOrder.paymentLabel}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 border-t border-[var(--k-border)] pt-2.5">
              <dt className="text-[var(--k-text-3)]">{getLocalizedText("totalAmount", lang)}</dt>
              <dd className="k-nums font-semibold text-[var(--k-accent)]">
                {submittedOrder.total.toFixed(2)} {currencySymbol}
              </dd>
            </div>
          </dl>

          {/* Only for the 'wallet' method, and only when it didn't actually
              succeed (cancelled/failed/timed out) — the order is sent either
              way (see handleSendOrder), this just points them at the
              existing "Hesabı ödə" flow for a retry instead of leaving the
              unpaid state invisible. */}
          {submittedOrder.paymentIncomplete && (
            <Banner tone="warning" className="mt-3 text-left">
              {getLocalizedText('walletPaymentIncompleteNote', lang)}
            </Banner>
          )}

          <Button variant="primary" size="block" onClick={handleResetOrder} className="mt-6">
            {getLocalizedText("completeAndNewOrder", lang)}
          </Button>
        </div>
      ) : walletWidgetUrl ? (
        // Real Epoint charge — the order above was ALREADY sent (see
        // handleSendOrder's 'wallet' branch); this only covers payment,
        // never a page redirect (see useEpointWalletPayment's own header).
        // Same JSX shape as CustomerApp.jsx's bill modal — same translation
        // keys, same allow="payment" requirement for the wallet sheet to
        // work inside a cross-origin iframe.
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-[13px] text-[var(--k-text-3)] mb-2">
            {getLocalizedText('walletWidgetTitle', lang)}
          </p>
          {walletAmount != null && (
            <p className="k-nums mb-2 text-lg font-semibold text-[var(--k-accent)]">
              {Number(walletAmount).toFixed(2)} {currencySymbol}
            </p>
          )}
          <div className="rounded-[var(--k-r)] overflow-hidden border border-[var(--k-border)] bg-[var(--k-surface)]" style={{ height: 420 }}>
            <iframe
              src={walletWidgetUrl}
              allow="payment"
              title="Apple Pay / Google Pay"
              className="w-full h-full border-0"
            />
          </div>
          <p className="mt-2.5 text-[12px] text-[var(--k-text-3)]">
            {getLocalizedText('walletCheckingStatus', lang)}
          </p>
          <button
            onClick={handleWalletWidgetCancel}
            className="mt-3 text-[13px] font-medium text-[var(--k-text-3)] transition-colors hover:text-[var(--k-text)] focus-visible:outline-none focus-visible:underline"
          >
            {getLocalizedText('cancel', lang)}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<UtensilsCrossed className="w-5 h-5" />}
            title={getLocalizedText("cartEmpty", lang)}
            description={getLocalizedText("cartEmptyDesc", lang)}
          />
        </div>
      ) : (
        /* Cart items */
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {items.map((item) => {
            const localizedProduct = getLocalizedProduct(item.product, lang);
            return (
              <div
                key={item.id}
                className="flex gap-3 rounded-[var(--k-r)] border border-[var(--k-border)] bg-[var(--k-surface)] p-2.5"
              >
                <Image
                  src={localizedProduct?.image?.trim() || FALLBACK_IMAGE}
                  alt={localizedProduct?.name || getLocalizedText('productAltFallback', lang)}
                  className="h-16 w-16 shrink-0 rounded-[var(--k-r-sm)] object-cover"
                  width={64}
                  height={64}
                  unoptimized
                />

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="truncate text-[13px] font-semibold text-[var(--k-text)]">
                      {localizedProduct.name}
                    </h4>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="-mr-0.5 -mt-0.5 shrink-0 rounded p-1 text-[var(--k-text-3)] transition-colors hover:text-[var(--k-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)]"
                      title={getLocalizedText('removeItemTitle', lang)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                    <p className="truncate text-[11px] text-[var(--k-accent)]">
                      {Object.values(item.selectedOptions).map(o => o.name).join(", ")}
                    </p>
                  )}

                  {/* Per-item note. Unlabeled by design (the placeholder is the
                      label here) — Field still wires id/aria. */}
                  <Field>
                    {(id, a11y) => (
                      <Input
                        id={id} {...a11y}
                        size="sm"
                        type="text"
                        value={item.note || ""}
                        onChange={(e) => onUpdateNote && onUpdateNote(item.id, e.target.value)}
                        placeholder={getLocalizedText("specialRequestPlaceholder", lang)}
                        className="h-7 rounded-[var(--k-r-sm)] px-2 text-[11px] bg-[var(--k-surface-2)]"
                      />
                    )}
                  </Field>

                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="k-nums text-[13px] font-semibold text-[var(--k-text)]">
                      {calculateItemPrice(item).toFixed(2)} {currencySymbol}
                    </span>

                    <div className="flex items-center gap-0.5 rounded-[var(--k-r-sm)] border border-[var(--k-border)] bg-[var(--k-surface-2)] p-0.5">
                      <Button
                        variant="ghost" size="iconSm"
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        aria-label="-"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="k-nums w-5 text-center text-xs font-semibold text-[var(--k-text)]">
                        {item.quantity}
                      </span>
                      <Button
                        variant="ghost" size="iconSm"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        aria-label="+"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Table-wide kitchen note */}
          <div className="pt-1.5">
            <Field label={getLocalizedText("tableNoteLabel", lang)}>
              {(id, a11y) => (
                <Input
                  id={id} {...a11y}
                  size="sm"
                  type="text"
                  value={kitchenNote}
                  onChange={(e) => setKitchenNote(e.target.value)}
                  placeholder={getLocalizedText("tableNotePlaceholder", lang)}
                />
              )}
            </Field>
          </div>

          {submitError && (
            <Banner tone="danger" className="mt-1">{submitError}</Banner>
          )}
        </div>
      )}

      {/* Footer */}
      {!submittedOrder && items.length > 0 && (
        <div className="shrink-0 space-y-4 border-t border-[var(--k-border)] bg-[var(--k-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <dl className="space-y-1.5 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--k-text-3)]">{getLocalizedText("subtotal", lang)}</dt>
              <dd className="k-nums text-[var(--k-text-2)]">{totalPrice.toFixed(2)} {currencySymbol}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--k-text-3)]">{getLocalizedText("serviceFee", lang)}</dt>
              <dd className="text-[var(--k-success)]">{getLocalizedText("free", lang)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-[var(--k-border)] pt-2.5">
              <dt className="text-sm font-semibold text-[var(--k-text)]">{getLocalizedText("totalAmount", lang)}</dt>
              <dd className="k-nums text-lg font-semibold text-[var(--k-accent)]">
                {totalPrice.toFixed(2)} {currencySymbol}
              </dd>
            </div>
          </dl>

          {/* Payment method — cash/card just tag the order; `wallet` (real
              Epoint charge, only present when the restaurant has connected
              the gateway) opens the widget overlay after the order is sent,
              see handleSendOrder's own comment. */}
          <div role="radiogroup" aria-label={getLocalizedText("paymentType", lang)}>
            <p className="mb-1.5 text-[13px] font-medium text-[var(--k-text-2)]">
              {getLocalizedText("paymentType", lang)}
            </p>
            <div className={cn('grid gap-1.5', PAYMENT_GRID_COLS[availablePaymentMethods.length] || 'grid-cols-4')}>
              {availablePaymentMethods.map((m) => {
                const active = paymentMethod === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPaymentMethod(m.key)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 rounded-[var(--k-r)] border py-2 text-[10px] font-medium transition-colors duration-[var(--k-dur)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)]',
                      active
                        ? 'border-[var(--k-accent)] bg-[var(--k-accent-soft)] text-[var(--k-accent)]'
                        : 'border-[var(--k-border)] bg-[var(--k-surface-2)] text-[var(--k-text-3)] hover:border-[var(--k-border-2)]',
                    )}
                  >
                    <span className="text-sm leading-none">{m.icon}</span>
                    <span className="max-w-full truncate">{m.label || getLocalizedText(m.labelKey, lang)}</span>
                  </button>
                );
              })}
            </div>
            {/* Only reachable when the service model forbids pay-later (0045) — with
                "Sonra ödəyəcəyəm" available, something is always selected. */}
            {paymentMethod === null && (
              <p className="mt-1.5 text-[11px] text-[var(--k-text-3)]">
                {getLocalizedText("selectPaymentMethodRequired", lang)}
              </p>
            )}
          </div>

          <Button
            variant="primary"
            size="block"
            onClick={handleSendOrder}
            disabled={items.length === 0 || walletCreating || paymentMethod === null}
            loading={walletCreating}
            icon={<Send className="w-4 h-4" />}
            id="cart-submit-order-btn"
          >
            {getLocalizedText("sendToWaiterAndKitchen", lang)}
          </Button>
        </div>
      )}
    </Sheet>
  );
};
