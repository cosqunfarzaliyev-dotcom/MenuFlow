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
import { EmptyState } from '@/components/ui';

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
    if (typeof onClearCart === 'function') {
      onClearCart();
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  };

const handleSendOrder = async () => {
    setSubmitError("");
    try {
      let table = tables.find((t) =>
        t.table_number?.toString() === tableNumber || t.id === tableNumber,
      );

      if (!table) {
        table = await fetchTableByNumber(tableNumber);
      }

      if (!table?.id) {
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
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md h-full bg-slate-950 border-l border-slate-800 shadow-xl z-10 flex flex-col justify-between">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-400" />
            <h2 className="font-serif-title text-lg sm:text-xl font-bold text-white">
              {getLocalizedText("cartTitle", lang)} ({currentTable.name})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
            id="cart-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {orderSubmitted ? (
          /* Success Screen after sending order */
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mb-6 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="font-serif-title text-2xl font-bold text-white mb-2">
              {getLocalizedText("orderSent", lang)}
            </h3>
            <p className="text-slate-300 text-xs sm:text-sm max-w-xs leading-relaxed mb-6">
              <strong className="text-blue-400 font-bold">{currentTable.name}</strong> {getLocalizedText("orderSuccessDesc", lang)}
            </p>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-full mb-6 text-left text-xs space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>{getLocalizedText("table", lang)}</span>
                <span className="text-white font-bold">{currentTable.name}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{getLocalizedText("itemCount", lang)}</span>
                <span className="text-white font-bold">{items.length} {getLocalizedText("piece", lang)}</span>
              </div>
              <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-800">
                <span>{getLocalizedText("totalAmount", lang)}</span>
                <span className="text-blue-400 font-extrabold text-sm">{totalPrice.toFixed(2)} ₼</span>
              </div>
            </div>

            <button
              onClick={handleResetOrder}
              className="w-full py-3.5 rounded-xl glass-button-blue text-white font-bold text-xs"
            >
              {getLocalizedText("completeAndNewOrder", lang)}
            </button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed className="w-8 h-8 text-slate-300" />}
            title={getLocalizedText("cartEmpty", lang)}
            description={getLocalizedText("cartEmptyDesc", lang)}
          />
        ) : (
          /* Cart items list */
          <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
            
            {/* Table info bar inside cart */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs mb-2">
              <span className="text-slate-400 font-semibold">{getLocalizedText("yourTable", lang)}</span>
              <span className="bg-slate-950 text-blue-400 border border-slate-800 rounded-lg px-2 py-1 font-bold">{currentTable.name}</span>
            </div>

            {items.map((item) => {
              const localizedProduct = getLocalizedProduct(item.product, lang);
              return (
                <div
                  key={item.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex gap-3 items-center justify-between"
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
                    <h4 className="font-bold text-xs text-white truncate">
                      {localizedProduct.name}
                    </h4>
                    
                    {/* Selected options preview */}
                    {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                      <p className="text-[10px] text-blue-400 truncate">
                        {Object.values(item.selectedOptions).map(o => o.name).join(", ")}
                      </p>
                    )}

                    <input 
                      type="text" 
                      value={item.note || ""} 
                      onChange={(e) => onUpdateNote && onUpdateNote(item.id, e.target.value)}
                      placeholder={getLocalizedText("specialRequestPlaceholder", lang)}
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-md px-2 py-1 text-[10px] text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 mt-1"
                    />

                    <div className="text-xs font-extrabold text-blue-400 mt-1">
                      {calculateItemPrice(item).toFixed(2)} {currencySymbol}
                    </div>
                  </div>

                  {/* Quantity Controls & Remove */}
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1">
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        className="p-1 hover:text-white text-slate-400"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-white w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="p-1 hover:text-white text-slate-400"
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
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                {getLocalizedText("tableNoteLabel", lang)}
              </label>
              <input
                type="text"
                value={kitchenNote}
                onChange={(e) => setKitchenNote(e.target.value)}
                placeholder={getLocalizedText("tableNotePlaceholder", lang)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            {submitError && (
              <div className="mt-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3 text-rose-200 text-xs font-semibold">
                {submitError}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!orderSubmitted && items.length > 0 && (
          <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950 space-y-4">
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>{getLocalizedText("subtotal", lang)}</span>
                <span className="text-slate-200">{totalPrice.toFixed(2)} {currencySymbol}</span>
              </div>
              <div className="flex justify-between">
                <span>{getLocalizedText("serviceFee", lang)}</span>
                <span className="text-emerald-400">{getLocalizedText("free", lang)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-slate-800">
                <span>{getLocalizedText("totalAmount", lang)}</span>
                <span className="text-blue-400 text-lg">{totalPrice.toFixed(2)} {currencySymbol}</span>
              </div>
            </div>

            <button
              onClick={handleSendOrder}
              disabled={items.length === 0}
              className={`w-full py-3.5 rounded-xl glass-button-blue text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-transform active:scale-95 ${items.length === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
              id="cart-submit-order-btn"
            >
              <Send className="w-4 h-4" />
              <span>{getLocalizedText("sendToWaiterAndKitchen", lang)}</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
