"use client";

import React, { useMemo, useState } from "react";
import Image from 'next/image';
import { Trash2, Plus, Minus, ShoppingBag, Send, CheckCircle2, UtensilsCrossed } from "lucide-react";

import { useAppStore } from '@/lib/store';
import { fetchTableByNumber } from '@/lib/services/supabaseService';
import { getLocalizedProduct, getLocalizedText } from '@/lib/translations';
import { requestWalletPayment } from '@/lib/services/paymentService';
import { FEATURES, hasFeature } from '@/lib/services/entitlementService';
import { Sheet, SheetHeader, Button, Input, Field, Tag, Banner, EmptyState } from '@/components/kit';
import { cn } from '@/lib/utils';

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80";

// Shown for every customer regardless of browser/device — feature-detecting
// window.PaymentRequest/ApplePaySession beforehand just makes the buttons
// invisible on browsers that report those APIs late or inconsistently
// (common in in-app webviews). Tapping the button is itself the capability
// check: if the wallet genuinely isn't available, requestWalletPayment()
// below returns a clear error instead of silently charging nothing.
// 'later' first and default-selected: paying is now voluntary at order time
// (0025_order_payment_status.sql / the customer-facing "Hesab" flow) — a
// customer who never touches this radiogroup used to silently submit as
// 'cash', which was a payment INTENT masquerading as a payment FACT. 'later'
// sends no payment_method at all (see handleSendOrder), leaving the order
// genuinely unspecified until staff settles it.
// cash/card have NO separate icon here — lib/translations.js's `cash`/`card`
// strings ("💵 Nəğd"/"💳 Kart") already carry their own emoji prefix, so an
// icon field here would render it twice (confirmed live: "💵💵 Nəğd"). The
// other three labels don't come from getLocalizedText, so they still need one.
const PAYMENT_METHODS = [
  { key: 'later', labelKey: 'payLater', icon: '🕒' },
  { key: 'cash', labelKey: 'cash' },
  { key: 'card', labelKey: 'card' },
  { key: 'google_pay', label: 'Google Pay', icon: '🅖' },
  { key: 'apple_pay', label: 'Apple Pay', icon: '' },
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
  const [walletAuthorizing, setWalletAuthorizing] = useState(false);

  const currentTable = tables.find(t => t.table_number?.toString() === tableNumber?.toString() || t.id === tableNumber) || { id: tableNumber, name: getLocalizedText('tableFallbackName', lang)(tableNumber) };

  // Wallet methods ride the same entitlement gate as the "Hesab" bill modal
  // in CustomerApp.jsx (hasFeature(restaurant, FEATURES.GOOGLE_PAY/APPLE_PAY))
  // — cash/card are never gated. Without this, a restaurant with the wallet
  // switches turned off in SuperAdmin still had them selectable at checkout.
  const availablePaymentMethods = useMemo(
    () =>
      PAYMENT_METHODS.filter((m) => {
        if (m.key === 'google_pay') return hasFeature(restaurant, FEATURES.GOOGLE_PAY);
        if (m.key === 'apple_pay') return hasFeature(restaurant, FEATURES.APPLE_PAY);
        return true;
      }),
    [restaurant],
  );
  // 5 buttons in a row is too tight on a phone with icon+text — 3 columns
  // wraps a 4th/5th button to a second row instead of shrinking every button.
  const PAYMENT_GRID_COLS = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-3', 5: 'grid-cols-3' };

  if (!isOpen) return null;

  // If the previously selected method just got filtered out (e.g. the
  // restaurant's wallet entitlement resolved to off after mount), fall back
  // to 'later' (always present, like cash/card) instead of silently
  // submitting a method that's no longer offered.
  if (!availablePaymentMethods.some((m) => m.key === paymentMethod) && paymentMethod !== 'later') {
    setPaymentMethod('later');
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
    setPaymentMethod('later');
    if (typeof onClearCart === 'function') onClearCart();
    if (typeof onClose === 'function') onClose();
  };

  const paymentLabels = {
    later: getLocalizedText('payLater', lang),
    cash: getLocalizedText('cash', lang),
    card: getLocalizedText('card', lang),
    google_pay: 'Google Pay',
    apple_pay: 'Apple Pay',
  };

  const handleSendOrder = async () => {
    setSubmitError("");

    // Wallet methods need the native Payment Request sheet approved before
    // the order is created — cash/card just tag the order and send.
    if (paymentMethod === 'google_pay' || paymentMethod === 'apple_pay') {
      setWalletAuthorizing(true);
      const { token, error: walletError } = await requestWalletPayment({
        method: paymentMethod,
        amount: totalPrice || 0,
        label: getLocalizedText('cartTitle', lang) || 'MenuFlow sifariş',
      });
      setWalletAuthorizing(false);
      if (!token) {
        setSubmitError(walletError?.message || getLocalizedText('paymentCancelled', lang));
        return;
      }
    }

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
      if (!isPayingLater) {
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
      setSubmittedOrder({
        tableName: currentTable.name,
        itemCount: items.length,
        total: totalPrice,
        paymentLabel: isPayingLater ? null : (paymentLabels[paymentMethod] || paymentMethod),
      });

      if (typeof onClearCart === 'function') onClearCart();
    } catch (err) {
      console.error(err);
      setSubmitError(err?.message || getLocalizedText('orderSubmitFailed', lang));
    }
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
            {getLocalizedText("orderSuccessDesc", lang)}
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

          <Button variant="primary" size="block" onClick={handleResetOrder} className="mt-6">
            {getLocalizedText("completeAndNewOrder", lang)}
          </Button>
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

          {/* Payment method — cash/card just tag the order; Google/Apple
              Pay pop the native wallet sheet on submit (see handleSendOrder). */}
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
          </div>

          <Button
            variant="primary"
            size="block"
            onClick={handleSendOrder}
            disabled={items.length === 0 || walletAuthorizing}
            loading={walletAuthorizing}
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
