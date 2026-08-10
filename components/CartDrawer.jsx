"use client";

import React, { useState } from "react";
import Image from 'next/image';
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  Send,
  CheckCircle2,
  UtensilsCrossed
} from "lucide-react";

import { useAppStore } from '@/lib/store';
import { fetchTableByNumber } from '@/lib/services/supabaseService';
import { getLocalizedProduct, getLocalizedText } from '@/lib/translations';
import { requestWalletPayment } from '@/lib/services/paymentService';

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

  const currentTable = tables.find(t => t.table_number?.toString() === tableNumber?.toString() || t.id === tableNumber) || { id: tableNumber, name: `Masa ${tableNumber}` };

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

  const totalPrice = items.reduce(
    (sum, item) => sum + calculateItemPrice(item),
    0
  );

  const handleResetOrder = () => {
    setOrderSubmitted(false);
    setKitchenNote("");
    setPaymentMethod('cash');
    if (typeof onClearCart === 'function') {
      onClearCart();
    }
    if (typeof onClose === 'function') {
      onClose();
    }
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
        setSubmitError(walletError?.message || 'Ödəniş ləğv edildi.');
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
        if (dbTable) {
          table = dbTable;
        }
      }

      const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      if (!table?.id || !isUuid(table.id)) {
        const message = `Table record not found for table number ${tableNumber}`;
        console.error(message);
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
        setSubmitError(error.message || 'Failed to submit order.');
        return;
      }

      if (typeof onClearCart === 'function') onClearCart();
      setOrderSubmitted(true);
    } catch (err) {
      console.error(err);
      setSubmitError(err?.message || 'Failed to submit order.');
    }
  };

  return (
    <div className="customer-theme fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md h-full bg-white border-l border-[#ECECEC] z-10 flex flex-col justify-between" style={{ boxShadow: '-24px 0 60px rgba(0,0,0,.12)' }}>

        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[#E8E8E8] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[var(--theme-primary)]" />
            <h2 className="text-lg sm:text-xl font-bold text-[#14151A]">
              {getLocalizedText("cartTitle", lang)} ({currentTable.name})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-[#F7F8FA] text-[#8A8F98] hover:text-[#14151A] transition-colors"
            id="cart-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {orderSubmitted ? (
          /* Success Screen after sending order */
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-[#34C759]/12 border-2 border-[#34C759] flex items-center justify-center text-[#218838] mb-6">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-[#14151A] mb-2">
              {getLocalizedText("orderSent", lang)}
            </h3>
            <p className="text-[#5A5F68] text-xs sm:text-sm max-w-xs leading-relaxed mb-6">
              <strong className="text-[var(--theme-primary)] font-bold">{currentTable.name}</strong> {getLocalizedText("orderSuccessDesc", lang)}
            </p>

            <div className="bg-[#F7F8FA] border border-[#E8E8E8] rounded-2xl p-4 w-full mb-6 text-left text-xs space-y-2">
              <div className="flex justify-between text-[#8A8F98]">
                <span>{getLocalizedText("table", lang)}</span>
                <span className="text-[#14151A] font-bold">{currentTable.name}</span>
              </div>
              <div className="flex justify-between text-[#8A8F98]">
                <span>{getLocalizedText("itemCount", lang)}</span>
                <span className="text-[#14151A] font-bold">{items.length} {getLocalizedText("piece", lang)}</span>
              </div>
              <div className="flex justify-between text-[#8A8F98] pt-2 border-t border-[#E8E8E8]">
                <span>{getLocalizedText("totalAmount", lang)}</span>
                <span className="text-[var(--theme-primary)] font-extrabold text-sm">{totalPrice.toFixed(2)} ₼</span>
              </div>
            </div>

            <button
              onClick={handleResetOrder}
              className="customer-btn-primary w-full h-auto py-3.5 text-xs"
            >
              {getLocalizedText("completeAndNewOrder", lang)}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="w-full max-w-xs customer-card p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F8FA] border border-[#E8E8E8] text-[#B4B8C0]">
                <UtensilsCrossed className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-[#14151A] mb-2">{getLocalizedText("cartEmpty", lang)}</h3>
              <p className="text-[#8A8F98] text-sm">{getLocalizedText("cartEmptyDesc", lang)}</p>
            </div>
          </div>
        ) : (
          /* Cart items list */
          <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">

            {/* Table info bar inside cart */}
            <div className="bg-[#F7F8FA] border border-[#E8E8E8] rounded-xl p-3 flex items-center justify-between text-xs mb-2">
              <span className="text-[#8A8F98] font-semibold">{getLocalizedText("yourTable", lang)}</span>
              <span className="bg-white text-[var(--theme-primary)] border border-[#E8E8E8] rounded-lg px-2 py-1 font-bold">{currentTable.name}</span>
            </div>

            {items.map((item) => {
              const localizedProduct = getLocalizedProduct(item.product, lang);
              return (
                <div
                  key={item.id}
                  className="bg-white border border-[#ECECEC] rounded-2xl p-3 flex gap-3 items-center justify-between"
                  style={{ boxShadow: '0 4px 16px rgba(0,0,0,.04)' }}
                >
                  <Image
                    src={localizedProduct?.image?.trim() || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"}
                    alt={localizedProduct?.name || "Məhsul"}
                    className="rounded-xl object-cover flex-shrink-0"
                    width={64}
                    height={64}
                    unoptimized
                  />

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-[#14151A] truncate">
                      {localizedProduct.name}
                    </h4>

                    {/* Selected options preview */}
                    {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                      <p className="text-[10px] text-[var(--theme-primary)] truncate">
                        {Object.values(item.selectedOptions).map(o => o.name).join(", ")}
                      </p>
                    )}

                    <input
                      type="text"
                      value={item.note || ""}
                      onChange={(e) => onUpdateNote && onUpdateNote(item.id, e.target.value)}
                      placeholder={getLocalizedText("specialRequestPlaceholder", lang)}
                      className="w-full bg-[#F7F8FA] border border-[#E8E8E8] rounded-md px-2 py-1 text-[10px] text-[#14151A] placeholder-[#B4B8C0] focus:outline-none focus:border-[var(--theme-primary)] mt-1"
                    />

                    <div className="text-xs font-extrabold text-[#14151A] mt-1">
                      {calculateItemPrice(item).toFixed(2)} {currencySymbol}
                    </div>
                  </div>

                  {/* Quantity Controls & Remove */}
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-[#B4B8C0] hover:text-rose-500 p-1"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1.5 bg-[#F7F8FA] border border-[#E8E8E8] rounded-lg p-1">
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        className="p-1 hover:text-[#14151A] text-[#8A8F98]"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-[#14151A] w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="p-1 hover:text-[#14151A] text-[#8A8F98]"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}

            {/* Note for kitchen input */}
            <div className="pt-2">
              <label className="text-[11px] font-semibold text-[#8A8F98] block mb-1">
                {getLocalizedText("tableNoteLabel", lang)}
              </label>
              <input
                type="text"
                value={kitchenNote}
                onChange={(e) => setKitchenNote(e.target.value)}
                placeholder={getLocalizedText("tableNotePlaceholder", lang)}
                className="w-full bg-[#F7F8FA] border border-[#E8E8E8] rounded-xl px-3 py-2 text-xs text-[#14151A] placeholder-[#B4B8C0] focus:outline-none focus:border-[var(--theme-primary)]"
              />
            </div>
            {submitError && (
              <div className="mt-3 rounded-2xl bg-rose-50 border border-rose-200 p-3 text-rose-600 text-xs font-semibold">
                {submitError}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!orderSubmitted && items.length > 0 && (
          <div className="p-4 sm:p-6 border-t border-[#E8E8E8] bg-white space-y-4" style={{ boxShadow: '0 -8px 24px rgba(0,0,0,.05)' }}>
            <div className="space-y-1.5 text-xs text-[#8A8F98]">
              <div className="flex justify-between">
                <span>{getLocalizedText("subtotal", lang)}</span>
                <span className="text-[#5A5F68]">{totalPrice.toFixed(2)} {currencySymbol}</span>
              </div>
              <div className="flex justify-between">
                <span>{getLocalizedText("serviceFee", lang)}</span>
                <span className="text-[#218838]">{getLocalizedText("free", lang)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-[#14151A] pt-2 border-t border-[#E8E8E8]">
                <span>{getLocalizedText("totalAmount", lang)}</span>
                <span className="text-[var(--theme-primary)] text-lg">{totalPrice.toFixed(2)} {currencySymbol}</span>
              </div>
            </div>

            {/* Payment method — cash/card just tag the order; Google/Apple
                Pay pop the native wallet sheet on submit (see handleSendOrder). */}
            <div>
              <label className="text-[11px] font-semibold text-[#8A8F98] block mb-1.5">
                {getLocalizedText("paymentType", lang)}
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setPaymentMethod(m.key)}
                    className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border py-2 text-[10px] font-bold transition-colors ${
                      paymentMethod === m.key
                        ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]'
                        : 'border-[#E8E8E8] bg-[#F7F8FA] text-[#5A5F68] hover:bg-[#EFEFF3]'
                    }`}
                  >
                    <span className="text-sm leading-none">{m.icon}</span>
                    <span className="truncate max-w-full">{m.label || getLocalizedText(m.labelKey, lang)}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSendOrder}
              disabled={items.length === 0 || walletAuthorizing}
              className={`customer-btn-primary w-full h-auto py-3.5 text-xs flex items-center justify-center gap-2 ${(items.length === 0 || walletAuthorizing) ? 'opacity-60 cursor-not-allowed' : ''}`}
              id="cart-submit-order-btn"
            >
              <Send className="w-4 h-4" />
              <span>{walletAuthorizing ? '...' : getLocalizedText("sendToWaiterAndKitchen", lang)}</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
