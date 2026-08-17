"use client";

import React, { useState } from "react";
import Image from 'next/image';
import { Trash2, Plus, Minus, ShoppingBag, Send, CheckCircle2, UtensilsCrossed } from "lucide-react";

import { useAppStore } from '@/lib/store';
import { fetchTableByNumber } from '@/lib/services/supabaseService';
import { getLocalizedProduct, getLocalizedText } from '@/lib/translations';
import { requestWalletPayment } from '@/lib/services/paymentService';
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
const PAYMENT_METHODS = [
  { key: 'cash', labelKey: 'cash', icon: '💵' },
  { key: 'card', labelKey: 'card', icon: '💳' },
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
  const tables = useAppStore(state => state.tables);
  const currencySymbol = useAppStore(state => state.settings?.currencySymbol) || '₼';
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [kitchenNote, setKitchenNote] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [walletAuthorizing, setWalletAuthorizing] = useState(false);

  const currentTable = tables.find(t => t.table_number?.toString() === tableNumber?.toString() || t.id === tableNumber) || { id: tableNumber, name: getLocalizedText('tableFallbackName', lang)(tableNumber) };

  if (!isOpen) return null;

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
    setOrderSubmitted(false);
    setKitchenNote("");
    setPaymentMethod('cash');
    if (typeof onClearCart === 'function') onClearCart();
    if (typeof onClose === 'function') onClose();
  };

  const paymentLabels = {
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
        const dbTable = await fetchTableByNumber(tableNumber);
        if (dbTable) table = dbTable;
      }

      const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      if (!table?.id || !isUuid(table.id)) {
        const message = getLocalizedText('tableRecordNotFound', lang)(tableNumber);
        console.error(`Table record not found for table number ${tableNumber}`);
        setSubmitError(message);
        return;
      }

      const { order, error } = await createOrder({
        tableId: table.id,
        total: totalPrice,
        items,
        note: kitchenNote,
        paymentMethod,
        paymentMethodLabel: paymentLabels[paymentMethod] || paymentMethod,
      });

      if (error) {
        console.error('createOrder error:', error);
        setSubmitError(error.message || getLocalizedText('orderSubmitFailed', lang));
        return;
      }

      if (typeof onClearCart === 'function') onClearCart();
      setOrderSubmitted(true);
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

      {orderSubmitted ? (
        /* Success screen */
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--k-success-soft)] text-[var(--k-success)]">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--k-text)]">
            {getLocalizedText("orderSent", lang)}
          </h3>
          <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[var(--k-text-3)]">
            <strong className="font-medium text-[var(--k-accent)]">{currentTable.name}</strong>{' '}
            {getLocalizedText("orderSuccessDesc", lang)}
          </p>

          <dl className="mt-6 w-full space-y-2.5 rounded-[var(--k-r)] border border-[var(--k-border)] bg-[var(--k-surface-2)] p-4 text-left text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--k-text-3)]">{getLocalizedText("table", lang)}</dt>
              <dd className="font-medium text-[var(--k-text)]">{currentTable.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--k-text-3)]">{getLocalizedText("itemCount", lang)}</dt>
              <dd className="k-nums font-medium text-[var(--k-text)]">
                {items.length} {getLocalizedText("piece", lang)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-[var(--k-border)] pt-2.5">
              <dt className="text-[var(--k-text-3)]">{getLocalizedText("totalAmount", lang)}</dt>
              <dd className="k-nums font-semibold text-[var(--k-accent)]">
                {totalPrice.toFixed(2)} {currencySymbol}
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
      {!orderSubmitted && items.length > 0 && (
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
            <div className="grid grid-cols-4 gap-1.5">
              {PAYMENT_METHODS.map((m) => {
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
