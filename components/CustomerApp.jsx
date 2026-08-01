"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from 'next/image';
import Link from "next/link";
import { ORDER_STATUS, useAppStore } from "@/lib/store";
import { subscribeOrders, subscribeProducts } from '@/lib/services/realtime';
import { ProductCard } from "@/components/ProductCard";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { CartDrawer } from "@/components/CartDrawer";
import { Bell, Receipt, ShoppingCart, UtensilsCrossed, CheckCircle2, Clock, QrCode, Shield, UserSquare2 } from "lucide-react";
import { getLocalizedText, getLocalizedCategoryName, getLocalizedProduct } from "@/lib/translations";

export function CustomerApp() {
  const {
    products: PRODUCTS,
    categories: CATEGORIES,
    orders,
    createAlert,
    loadMenuData,
    loadOrders,
    loadAlerts,
    loadTables,
    tables,
    settings: rawSettings,
  } = useAppStore();

  const settings = rawSettings || {
    restaurantName: 'MenuFlow',
    restaurantLogo: '',
    currencySymbol: '₼',
    tableCount: 50,
    tagline: 'Rəqəmsal QR Menyu və İdarəetmə Sistemi'
  };

  const [lang, setLang] = useState("az");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  
  const [tableId, setTableId] = useState("1"); 
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const loadAppData = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const tableNumber = searchParams.get("table") || "1";
      setTableId(tableNumber);

      await Promise.all([loadMenuData(), loadOrders(), loadAlerts(), loadTables()]);
    };

    loadAppData();
  }, [loadMenuData, loadOrders, loadAlerts, loadTables]);

  useEffect(() => {
    let sub;
    if (!tableId) return undefined;

    const startSub = async () => {
      try {
        sub = await subscribeOrders(({ event, table, record }) => {
          const recTable = record?.table_id ?? record?.table;
          if (recTable && recTable.toString() === tableId.toString()) {
            // refresh orders from Supabase via store
            loadOrders();
          }
        });
      } catch (err) {
        // ignore subscription errors
        // eslint-disable-next-line no-console
        console.warn('Failed to subscribe to orders realtime:', err);
      }
    };

    startSub();

    return () => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    };
  }, [tableId, loadOrders]);

  useEffect(() => {
    let prodSub;
    const start = async () => {
      try {
        prodSub = await subscribeProducts(() => {
          loadMenuData();
        });
      } catch (err) {
        console.warn('Failed to subscribe to products realtime:', err);
      }
    };
    start();
    return () => {
      if (prodSub && typeof prodSub.unsubscribe === 'function') prodSub.unsubscribe();
    };
  }, [loadMenuData]);

  const currentTable = tables.find(t => t.id === tableId) || { id: "1", name: "Masa 1" };

  const activeOrders = orders.filter(o => o.table === tableId);

  // Cart Handlers
  const handleAddToCart = (product, quantity = 1, options = {}, note = "") => {
    setCartItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing && Object.keys(options).length === 0) {
        return prev.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...prev, { id: `${product.id}-${Date.now()}`, product, quantity, selectedOptions: options, note }];
    });
    setIsCartOpen(true);
  };

  const handleUpdateCartQuantity = (id, qty) => {
    if (qty <= 0) {
      setCartItems(prev => prev.filter(item => item.id !== id));
      return;
    }
    setCartItems(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item));
  };

  const handleUpdateItemNote = (id, note) => {
    setCartItems(prev => prev.map(item => item.id === id ? { ...item, note } : item));
  };

  const handleCallWaiter = async () => {
    await createAlert({
      tableId: currentTable.id,
      type: 'waiter',
      note: getLocalizedText('waiterRequestNote', lang),
    });
    alert(getLocalizedText("waiterCalled", lang));
  };

  const [isBillModalOpen, setIsBillModalOpen] = useState(false);

  const handleRequestBill = async (methodKey) => {
    const paymentLabel = methodKey === 'cash' ? getLocalizedText('cash', lang) : getLocalizedText('card', lang);

    await createAlert({
      tableId: currentTable.id,
      type: 'bill',
      paymentMethod: methodKey,
      paymentMethodLabel: paymentLabel,
      note: getLocalizedText('billRequestNote', lang),
    });

    alert(getLocalizedText("billRequested", lang));
    setIsBillModalOpen(false);
  };

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "all") return PRODUCTS;
    return PRODUCTS.filter(p => p.category === selectedCategory);
  }, [selectedCategory, PRODUCTS]);

  const cartTotalQty = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const statusMap = {
    [ORDER_STATUS.PENDING]: { label: getLocalizedText("statusPending", lang), icon: <Clock className="w-4 h-4 text-amber-400" /> },
    [ORDER_STATUS.ACCEPTED]: { label: getLocalizedText("statusPreparing", lang), icon: <Clock className="w-4 h-4 text-blue-400" /> },
    [ORDER_STATUS.PREPARING]: { label: getLocalizedText("statusPreparing", lang), icon: <UtensilsCrossed className="w-4 h-4 text-blue-400" /> },
    [ORDER_STATUS.READY]: { label: getLocalizedText("statusCompleted", lang), icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> },
    [ORDER_STATUS.SERVED]: { label: getLocalizedText("statusCompleted", lang), icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> },
    [ORDER_STATUS.CANCELLED]: { label: getLocalizedText("statusCompleted", lang), icon: <CheckCircle2 className="w-4 h-4 text-rose-400" /> }
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32">
      {/* Header - Table Info, Language Switcher & Service Buttons */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3 sm:px-6 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
          
          {/* Left Brand & Table Group */}
          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2.5 sm:gap-4">
            
            {/* Restaurant Brand Logo */}
            <div className="flex items-center gap-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white px-4 py-2 rounded-2xl font-black text-sm sm:text-base shadow-lg shadow-blue-600/25 tracking-tight shrink-0 ring-1 ring-white/20">
              {settings.restaurantLogo ? (
                <Image
                  src={settings.restaurantLogo}
                  alt="Logo"
                  className="w-5 h-5 object-contain rounded-lg bg-white/10 p-0.5"
                  width={20}
                  height={20}
                  unoptimized
                />
              ) : (
                <QrCode className="w-5 h-5 text-white" />
              )}
              <span className="truncate max-w-[140px] sm:max-w-none">{settings.restaurantName || "MenuFlow"}</span>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center bg-slate-900/90 border border-slate-800/90 rounded-2xl p-1 gap-1 shadow-inner shrink-0">
              <button
                onClick={() => setLang('az')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  lang === 'az'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
                id="lang-btn-az"
              >
                AZ
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  lang === 'en'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
                id="lang-btn-en"
              >
                EN
              </button>
              <button
                onClick={() => setLang('ru')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  lang === 'ru'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
                id="lang-btn-ru"
              >
                RU
              </button>
            </div>

            <div className="h-7 w-px bg-slate-800/80 hidden lg:block"></div>

            {/* Active Table Badge */}
            <div className="flex items-center gap-2.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl px-3 py-1.5 shrink-0">
              <div className="relative flex items-center justify-center">
                <div className="w-8 h-8 bg-blue-500/15 border border-blue-500/30 rounded-xl flex items-center justify-center font-black text-xs text-blue-400 shadow-sm">
                  {tableId}
                </div>
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] font-extrabold uppercase tracking-widest leading-none">{getLocalizedText("activeTable", lang)}</p>
                <h1 className="font-bold text-xs sm:text-sm text-white mt-0.5 leading-tight">{currentTable.name}</h1>
              </div>
            </div>

          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button 
              onClick={handleCallWaiter} 
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gradient-to-b from-amber-500/15 to-amber-600/5 hover:from-amber-500/25 hover:to-amber-600/10 border border-amber-500/30 hover:border-amber-500/50 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all duration-200 text-amber-200 shadow-lg shadow-amber-500/5 active:scale-[0.98]"
            >
              <Bell className="w-4 h-4 text-amber-400 animate-bounce" /> 
              <span>{getLocalizedText("callWaiter", lang)}</span>
            </button>
            
            <button 
              onClick={() => setIsBillModalOpen(true)} 
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gradient-to-b from-emerald-500/15 to-emerald-600/5 hover:from-emerald-500/25 hover:to-emerald-600/10 border border-emerald-500/30 hover:border-emerald-500/50 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all duration-200 text-emerald-200 shadow-lg shadow-emerald-500/5 active:scale-[0.98]"
            >
              <Receipt className="w-4 h-4 text-emerald-400" /> 
              <span>{getLocalizedText("requestBill", lang)}</span>
            </button>
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-8">
        
        {/* Categories */}
        <section>
          <div className="flex overflow-x-auto no-scrollbar gap-3 pb-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl whitespace-nowrap transition-all border ${
                selectedCategory === "all"
                  ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20" 
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <span className="font-bold text-sm">{getLocalizedText("allMenu", lang)}</span>
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl whitespace-nowrap transition-all border ${
                  selectedCategory === cat.id 
                    ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20" 
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <span>{cat.icon}</span>
                <span className="font-bold text-sm">{getLocalizedCategoryName(cat, lang)}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Products */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onOpenDetail={setSelectedProduct}
              onAddToCart={handleAddToCart}
              isFavorite={false}
              onToggleFavorite={() => {}}
              lang={lang}
            />
          ))}
        </section>

        {/* Active Orders */}
        {activeOrders.length > 0 && (
          <section className="pt-8 border-t border-slate-800">
            <h2 className="font-serif-title font-bold text-xl mb-4 text-white">{getLocalizedText("activeOrders", lang)}</h2>
            <div className="space-y-4">
              {activeOrders.map(order => (
                <div key={order.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl flex flex-col sm:flex-row gap-4 justify-between sm:items-center shadow-lg">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-slate-400 text-xs font-mono">
                        {new Date(order.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-slate-600 text-xs">•</span>
                      <span className="font-bold text-sm text-blue-400">{order.total} ₼</span>
                    </div>
                    <div className="space-y-1">
                      {order.items.map((item, idx) => {
                        const locItem = getLocalizedProduct(item.product, lang);
                        return (
                          <div key={idx} className="text-sm text-slate-300">
                            <span className="font-bold text-white mr-2">{item.quantity}x</span> 
                            {locItem.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold w-full sm:w-auto ${
                    order.status === ORDER_STATUS.SERVED || order.status === ORDER_STATUS.READY ? 'bg-emerald-500/10 text-emerald-400' :
                    order.status === ORDER_STATUS.PREPARING || order.status === ORDER_STATUS.ACCEPTED ? 'bg-blue-500/10 text-blue-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>
                    {statusMap[order.status]?.icon}
                    {statusMap[order.status]?.label}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-900 py-8 px-4 text-center">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            {settings.restaurantLogo ? (
              <Image
                src={settings.restaurantLogo}
                alt="Logo"
                className="w-4 h-4 object-contain rounded"
                width={16}
                height={16}
                unoptimized
              />
            ) : (
              <QrCode className="w-4 h-4 text-blue-500" />
            )}
            <span className="text-xs font-semibold tracking-wide text-slate-400">
              {getLocalizedText("poweredBy", lang)} <strong className="text-white font-bold">{settings.restaurantName || "MenuFlow"}</strong>
            </span>
          </div>
          <p className="text-[11px] text-slate-600 font-medium">
            {settings.tagline || getLocalizedText("tagline", lang)}
          </p>


        </div>
      </footer>

      {/* Floating Cart Button */}
      {cartTotalQty > 0 && (
        <div className="fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-40">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-2xl shadow-xl shadow-blue-600/30 flex items-center gap-3 transition-transform hover:scale-105"
          >
            <div className="relative">
              <ShoppingCart className="w-6 h-6" />
              <span className="absolute -top-2 -right-2 bg-white text-blue-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">
                {cartTotalQty}
              </span>
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">{getLocalizedText("yourCart", lang)}</div>
              <div className="text-sm font-bold">{getLocalizedText("checkout", lang)}</div>
            </div>
          </button>
        </div>
      )}

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCartWithOptions={handleAddToCart}
        isFavorite={false}
        onToggleFavorite={() => {}}
        lang={lang}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onUpdateNote={handleUpdateItemNote}
        onRemoveItem={(id) => setCartItems(prev => prev.filter(i => i.id !== id))}
        onClearCart={() => setCartItems([])}
        tableNumber={tableId}
        setTableNumber={() => {}}
        lang={lang}
      />

      {/* Bill Modal */}
      {isBillModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-xl text-center">
            <h2 className="text-xl font-bold text-white mb-2">{getLocalizedText("paymentType", lang)}</h2>
            <p className="text-slate-400 mb-6 text-sm">{getLocalizedText("paymentPrompt", lang)}</p>
            
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => handleRequestBill('cash')}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors border border-slate-700 hover:border-slate-600"
              >
                {getLocalizedText("cash", lang)}
              </button>
              <button 
                type="button"
                onClick={() => handleRequestBill('card')}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20"
              >
                {getLocalizedText("card", lang)}
              </button>
            </div>
            
            <button 
              onClick={() => setIsBillModalOpen(false)}
              className="mt-4 text-slate-500 hover:text-slate-300 text-sm font-semibold transition-colors"
            >
              {getLocalizedText("cancel", lang)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
