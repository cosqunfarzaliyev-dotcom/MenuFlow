"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ORDER_STATUS, useAppStore } from "@/lib/store";
import { subscribeOrders, subscribeProducts } from '@/lib/services/realtime';
import { ProductCard } from "@/components/ProductCard";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { CartDrawer } from "@/components/CartDrawer";
import { Bell, ShoppingCart, UtensilsCrossed, CheckCircle2, Clock, QrCode, Home, CreditCard, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { getLocalizedText, getLocalizedCategoryName, getLocalizedProduct } from "@/lib/translations";
import { applyDiscounts } from "@/lib/services/promotionsService";
import { requestWalletPayment } from "@/lib/services/paymentService";

// Only ever render admin-supplied banner links as a real navigable <a href>
// if they're http(s) — blocks javascript:/data: URI injection via a
// compromised or malicious admin account (banners are admin-controlled
// content shown to every customer of that restaurant).
const isSafeUrl = (url) => {
  if (!url) return false;
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://menuflow.local';
    const parsed = new URL(url, base);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

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
    restaurant,
    loadRestaurantBySlug,
    banners,
    loadBanners,
    discounts,
    loadDiscounts,
    setQrToken,
  } = useAppStore();

  const settings = restaurant
    ? {
        restaurantName: restaurant.name,
        restaurantLogo: restaurant.logo || '',
        currencySymbol: restaurant.currency_symbol || '₼',
        tableCount: restaurant.table_count || 50,
        tagline: restaurant.tagline || '',
      }
    : rawSettings || {
        restaurantName: 'MenuFlow',
        restaurantLogo: '',
        currencySymbol: '₼',
        tableCount: 50,
        tagline: 'Rəqəmsal QR Menyu və İdarəetmə Sistemi'
      };

  const params = useParams();
  const searchParams = useSearchParams();

  const [lang, setLang] = useState("az");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);

  const [tableId, setTableId] = useState(() => params?.table || searchParams?.get('table') || "1");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    const loadAppData = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const routeTable = params?.table;
        const queryTable = searchParams?.get('table');
        const tableNumber = routeTable || queryTable || "1";
        setTableId(tableNumber);

        // Imzalı QR token (?t=...) — sifariş/çağırış RLS insert policy-ləri
        // bunu tələb edir (bax: supabase/migrations/0008_qr_token_verification.sql).
        // Linkdə token yoxdursa (köhnə/əl ilə yığılmış link), sadəcə boş
        // qalır və server tərəf sifarişi rədd edəcək — spoof qorunması budur.
        setQrToken(searchParams?.get('t') || null);

        const slug = params?.restaurant;
        if (slug) {
          const found = await loadRestaurantBySlug(slug);
          if (!found) {
            setLoadError('Bu restoran tapılmadı və ya deaktivdir.');
            setLoading(false);
            return;
          }
        }

        await Promise.all([loadMenuData(), loadOrders(), loadAlerts(), loadTables(), loadBanners(), loadDiscounts()]);
      } catch (err) {
        console.error('CustomerApp load error', err);
        setLoadError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    loadAppData();
  }, [params, searchParams, loadMenuData, loadOrders, loadAlerts, loadTables, loadRestaurantBySlug, loadBanners, loadDiscounts]);

  useEffect(() => {
    let sub;
    if (!tableId) return undefined;

    const startSub = async () => {
      try {
        sub = await subscribeOrders(({ event, table, record }) => {
          const recTable = record?.table_id ?? record?.table;
          if (recTable && recTable.toString() === tableId.toString()) {
            loadOrders();
          }
        });
      } catch (err) {
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

  const currentTable = tables.find(t => t.table_number?.toString() === tableId?.toString() || t.id === tableId) || { id: tableId, name: `Masa ${tableId}` };

  const activeOrders = orders.filter(
    (o) => o.table === tableId && ![ORDER_STATUS.SERVED, ORDER_STATUS.CANCELLED].includes(o.status),
  );

  // Cart Handlers
  const handleAddToCart = (product, quantity = 1, options = {}, note = "") => {
    setCartItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing && Object.keys(options).length === 0) {
        return prev.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...prev, { id: `${product.id}-${Date.now()}`, product, quantity, selectedOptions: options, note }];
    });
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

  const [waiterCalling, setWaiterCalling] = useState(false);
  const handleCallWaiter = async () => {
    setWaiterCalling(true);
    const { error } = await createAlert({
      tableId: currentTable.id,
      type: 'waiter',
      note: getLocalizedText('waiterRequestNote', lang),
    });
    setWaiterCalling(false);
    alert(error ? (error.message || getLocalizedText('genericError', lang) || 'Xəta baş verdi.') : getLocalizedText("waiterCalled", lang));
  };

  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [walletPaying, setWalletPaying] = useState(null); // 'google_pay' | 'apple_pay' | null
  const billTotal = activeOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const handleRequestBill = async (methodKey) => {
    const paymentLabels = {
      cash: getLocalizedText('cash', lang),
      card: getLocalizedText('card', lang),
      google_pay: 'Google Pay',
      apple_pay: 'Apple Pay',
    };
    const paymentLabel = paymentLabels[methodKey] || methodKey;

    const { error } = await createAlert({
      tableId: currentTable.id,
      type: 'bill',
      paymentMethod: methodKey,
      paymentMethodLabel: paymentLabel,
      note: getLocalizedText('billRequestNote', lang),
    });

    alert(error ? (error.message || getLocalizedText('genericError', lang) || 'Xəta baş verdi.') : getLocalizedText("billRequested", lang));
    setIsBillModalOpen(false);
  };

  // Google Pay / Apple Pay: opens the real native wallet sheet (Payment
  // Request API) for the current bill total, then records the order as
  // paid-by-wallet. Actually settling funds requires a payment processor
  // (Stripe etc.) wired in on the backend — see lib/services/paymentService.js.
  const handleWalletPay = async (methodKey) => {
    setWalletPaying(methodKey);
    const { token, error } = await requestWalletPayment({ method: methodKey, amount: billTotal || 0 });
    setWalletPaying(null);
    if (token) {
      await handleRequestBill(methodKey);
    } else if (error) {
      alert(error.message || 'Ödəniş ləğv edildi.');
    }
  };

  // Endirimlər: aktiv endirimləri məhsul qiymətlərinə avtomatik tətbiq edir
  // (bütün menyuya və ya seçilmiş məhsula tətbiq oluna bilər).
  const pricedProducts = useMemo(() => {
    return PRODUCTS.map((product) => {
      const { price, discount } = applyDiscounts(product, discounts);
      if (!discount) return product;
      return { ...product, price, originalPrice: product.price, activeDiscount: discount };
    });
  }, [PRODUCTS, discounts]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "all") return pricedProducts;
    return pricedProducts.filter(p => p.category === selectedCategory);
  }, [selectedCategory, pricedProducts]);

  const cartTotalQty = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const statusMap = {
    [ORDER_STATUS.PENDING]: { label: getLocalizedText("statusPending", lang), icon: <Clock className="w-4 h-4" />, cls: 'bg-[#FFB020]/12 text-[#B4790C]' },
    [ORDER_STATUS.ACCEPTED]: { label: getLocalizedText("statusPreparing", lang), icon: <Clock className="w-4 h-4" />, cls: 'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]' },
    [ORDER_STATUS.PREPARING]: { label: getLocalizedText("statusPreparing", lang), icon: <UtensilsCrossed className="w-4 h-4" />, cls: 'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]' },
    [ORDER_STATUS.READY]: { label: getLocalizedText("statusCompleted", lang), icon: <CheckCircle2 className="w-4 h-4" />, cls: 'bg-[#34C759]/12 text-[#218838]' },
    [ORDER_STATUS.SERVED]: { label: getLocalizedText("statusCompleted", lang), icon: <CheckCircle2 className="w-4 h-4" />, cls: 'bg-[#34C759]/12 text-[#218838]' },
    [ORDER_STATUS.CANCELLED]: { label: getLocalizedText("statusCompleted", lang), icon: <CheckCircle2 className="w-4 h-4" />, cls: 'bg-rose-100 text-rose-600' },
  };

  if (loading) {
    return (
      <div className="customer-theme min-h-screen flex items-center justify-center px-4 py-8" style={{ background: '#F7F8FA' }}>
        <div className="w-full max-w-md customer-card p-8 text-center">
          <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-[#F7F8FA] border border-[#E8E8E8] flex items-center justify-center text-[var(--theme-primary)] animate-spin">
            <Loader2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#14151A] mb-2">Menyu yüklənir…</h2>
          <p className="text-[#8A8F98] text-sm">Menyu və masa məlumatları hazırlanır</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="customer-theme min-h-screen flex items-center justify-center px-4 py-8" style={{ background: '#F7F8FA' }}>
        <div className="w-full max-w-md customer-card p-8 text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#14151A] mb-2">Yükləmə xətası</h2>
          <p className="text-[#8A8F98] text-sm mb-6">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="customer-btn-primary inline-flex items-center justify-center gap-2 px-5 h-11 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Təkrar cəhd et
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="customer-theme min-h-screen pb-28"
      style={{
        background: '#F7F8FA',
        '--theme-primary': restaurant?.theme_primary_color || '#6C4CFF',
        '--theme-secondary': restaurant?.theme_secondary_color || '#14151A',
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-[#E8E8E8] px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">

          {/* Brand */}
          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2.5 sm:gap-4">
            <div
              className="flex items-center gap-2.5 text-white px-4 py-2 rounded-2xl font-extrabold text-sm sm:text-base tracking-tight shrink-0"
              style={{ background: 'linear-gradient(180deg, #7B61FF 0%, #5B3DF5 100%)', boxShadow: '0 8px 20px -6px rgba(108,76,255,.45)' }}
            >
              {settings.restaurantLogo ? (
                <Image
                  src={settings.restaurantLogo}
                  alt="Logo"
                  className="w-5 h-5 object-contain rounded-lg bg-white/15 p-0.5"
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
            <div className="flex items-center bg-[#F7F8FA] border border-[#E8E8E8] rounded-2xl p-1 gap-1 shrink-0">
              {['az', 'en', 'ru'].map((code) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all duration-200 ${
                    lang === code ? 'text-white' : 'text-[#8A8F98] hover:text-[#14151A]'
                  }`}
                  style={lang === code ? { background: 'linear-gradient(180deg, #7B61FF 0%, #5B3DF5 100%)' } : undefined}
                  id={`lang-btn-${code}`}
                >
                  {code}
                </button>
              ))}
            </div>

            <div className="h-7 w-px bg-[#E8E8E8] hidden lg:block" />

            {/* Active Table Badge */}
            <div className="flex items-center gap-2.5 bg-[#F7F8FA] border border-[#E8E8E8] rounded-2xl px-3 py-1.5 shrink-0">
              <div className="relative flex items-center justify-center">
                <div className="w-8 h-8 bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/25 rounded-xl flex items-center justify-center font-black text-xs text-[var(--theme-primary)]">
                  {tableId}
                </div>
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34C759] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#34C759]" />
                </span>
              </div>
              <div>
                <p className="text-[#8A8F98] text-[10px] font-extrabold uppercase tracking-widest leading-none">{getLocalizedText("activeTable", lang)}</p>
                <h1 className="font-bold text-xs sm:text-sm text-[#14151A] mt-0.5 leading-tight">{currentTable.name}</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-8">

        {/* Banners (Banner sistemi) */}
        {banners.filter((b) => b.is_active).length > 0 && (
          <section className="flex gap-4 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {banners.filter((b) => b.is_active).map((banner) => {
              const content = (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={banner.image_url}
                  alt={banner.title || 'banner'}
                  className="w-full h-full object-cover"
                />
              );
              return (
                <div
                  key={banner.id}
                  className="relative shrink-0 w-[280px] sm:w-[360px] h-32 sm:h-40 rounded-3xl overflow-hidden shadow-md border border-[#E8E8E8]"
                >
                  {isSafeUrl(banner.link_url) ? (
                    <a href={banner.link_url} target="_blank" rel="noreferrer" className="block w-full h-full">
                      {content}
                    </a>
                  ) : (
                    content
                  )}
                  {(banner.title || banner.subtitle) && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      {banner.title && <p className="text-white font-bold text-sm leading-tight">{banner.title}</p>}
                      {banner.subtitle && <p className="text-white/80 text-xs leading-tight">{banner.subtitle}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* Categories */}
        <section>
          <div className="flex overflow-x-auto no-scrollbar gap-2.5 pb-1">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl whitespace-nowrap transition-all border ${
                selectedCategory === "all"
                  ? "text-white border-transparent shadow-md"
                  : "bg-white border-[#E8E8E8] text-[#5A5F68] hover:border-[var(--theme-primary)]/40"
              }`}
              style={selectedCategory === "all" ? { background: 'linear-gradient(180deg, #7B61FF 0%, #5B3DF5 100%)', boxShadow: '0 8px 20px -6px rgba(108,76,255,.4)' } : undefined}
            >
              <span className="font-bold text-sm">{getLocalizedText("allMenu", lang)}</span>
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl whitespace-nowrap transition-all border ${
                  selectedCategory === cat.id
                    ? "text-white border-transparent shadow-md"
                    : "bg-white border-[#E8E8E8] text-[#5A5F68] hover:border-[var(--theme-primary)]/40"
                }`}
                style={selectedCategory === cat.id ? { background: 'linear-gradient(180deg, #7B61FF 0%, #5B3DF5 100%)', boxShadow: '0 8px 20px -6px rgba(108,76,255,.4)' } : undefined}
              >
                <span>{cat.icon}</span>
                <span className="font-bold text-sm">{getLocalizedCategoryName(cat, lang)}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Products */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredProducts.length > 0 ? filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onOpenDetail={setSelectedProduct}
              onAddToCart={handleAddToCart}
              isFavorite={false}
              onToggleFavorite={() => {}}
              lang={lang}
            />
          )) : (
            <div className="col-span-full">
              <div className="w-full max-w-xl mx-auto customer-card p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F8FA] border border-[#E8E8E8] text-[var(--theme-primary)]">
                  <ShoppingCart className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-[#14151A] mb-2">Məhsul tapılmadı</h3>
                <p className="text-[#8A8F98] text-sm mb-6">Seçilmiş kateqoriyaya uyğun məhsul yoxdur. Daha geniş kateqoriya üçün bütün məhsullara qayıdın.</p>
                <button type="button" onClick={() => setSelectedCategory('all')} className="customer-btn-primary px-5 h-11 text-sm">
                  Hamısına qayıt
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Active Orders */}
        {activeOrders.length > 0 ? (
          <section className="pt-6 border-t border-[#E8E8E8]">
            <h2 className="font-bold text-xl mb-4 text-[#14151A]">{getLocalizedText("activeOrders", lang)}</h2>
            <div className="space-y-4">
              {activeOrders.map(order => (
                <div key={order.id} className="customer-card p-5 flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[#8A8F98] text-xs font-mono">
                        {new Date(order.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[#D9DBE3] text-xs">•</span>
                      <span className="font-bold text-sm text-[var(--theme-primary)]">{order.total} {settings.currencySymbol}</span>
                    </div>
                    <div className="space-y-1">
                      {order.items.map((item, idx) => {
                        const locItem = getLocalizedProduct(item.product, lang);
                        return (
                          <div key={idx} className="text-sm text-[#5A5F68]">
                            <span className="font-bold text-[#14151A] mr-2">{item.quantity}x</span>
                            {locItem.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold w-full sm:w-auto ${statusMap[order.status]?.cls || 'bg-[#F7F8FA] text-[#5A5F68]'}`}>
                    {statusMap[order.status]?.icon}
                    {statusMap[order.status]?.label}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div className="pt-6">
            <div className="w-full customer-card p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#34C759]/10 border border-[#34C759]/20 text-[#218838]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-[#14151A] mb-2">Aktiv sifariş yoxdur</h3>
              <p className="text-[#8A8F98] text-sm">Masanız üçün heç bir açıq sifariş yoxdur. Yeni sifariş verdikdə burada görünəcək.</p>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-[#E8E8E8] py-8 px-4 text-center">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-2 text-[#8A8F98]">
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
              <QrCode className="w-4 h-4 text-[var(--theme-primary)]" />
            )}
            <span className="text-xs font-semibold tracking-wide">
              {getLocalizedText("poweredBy", lang)} <strong className="text-[#14151A] font-bold">{settings.restaurantName || "MenuFlow"}</strong>
            </span>
          </div>
          <p className="text-[11px] text-[#B4B8C0] font-medium">
            {settings.tagline || getLocalizedText("tagline", lang)}
          </p>
        </div>
      </footer>

      {/* Bottom Navigation */}
      <nav className="customer-bottom-nav fixed bottom-0 inset-x-0 z-50 px-3 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1 py-2">
          <BottomNavButton icon={<Home className="w-5 h-5" />} label="Menu" active onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
          <BottomNavButton icon={<ShoppingCart className="w-5 h-5" />} label="Səbət" badge={cartTotalQty > 0 ? cartTotalQty : null} onClick={() => setIsCartOpen(true)} />
          <BottomNavButton icon={<Bell className="w-5 h-5" />} label="Garson" loading={waiterCalling} onClick={handleCallWaiter} />
          <BottomNavButton icon={<CreditCard className="w-5 h-5" />} label="Hesab" onClick={() => setIsBillModalOpen(true)} />
        </div>
      </nav>

      {/* Product Detail Modal */}
      <ProductDetailModal
        key={selectedProduct?.id || 'product-modal'}
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCartWithOptions={handleAddToCart}
        isFavorite={false}
        onToggleFavorite={() => {}}
        lang={lang}
      />

      {/* Cart Drawer */}
      <CartDrawer
        key={isCartOpen ? 'open' : 'closed'}
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onUpdateNote={handleUpdateItemNote}
        onRemoveItem={(id) => setCartItems(prev => prev.filter(i => i.id !== id))}
        onClearCart={() => setCartItems([])}
        tableNumber={tableId}
        lang={lang}
      />

      {/* Bill Modal */}
      {isBillModalOpen && (
        <div className="customer-theme fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-[#ECECEC] rounded-3xl w-full max-w-sm p-6 shadow-xl text-center" style={{ boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
            <h2 className="text-xl font-bold text-[#14151A] mb-2">{getLocalizedText("paymentType", lang)}</h2>
            <p className="text-[#8A8F98] mb-6 text-sm">{getLocalizedText("paymentPrompt", lang)}</p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleRequestBill('cash')}
                className="flex-1 py-3 bg-[#F7F8FA] hover:bg-[#EFEFF3] text-[#14151A] rounded-xl font-bold transition-colors border border-[#E8E8E8]"
              >
                {getLocalizedText("cash", lang)}
              </button>
              <button
                type="button"
                onClick={() => handleRequestBill('card')}
                className="customer-btn-primary flex-1 h-auto py-3 text-sm"
              >
                {getLocalizedText("card", lang)}
              </button>
            </div>

            {/* Always shown to customers — feature-detecting the wallet APIs
                up front hid these buttons on browsers/webviews that report
                PaymentRequest/ApplePaySession late or inconsistently.
                Tapping is itself the capability check: requestWalletPayment
                (lib/services/paymentService.js) returns a clear error if the
                wallet genuinely isn't available on this device. */}
            <div className="flex gap-3 mt-3">
              <button
                type="button"
                disabled={walletPaying === 'google_pay'}
                onClick={() => handleWalletPay('google_pay')}
                className="flex-1 py-3 bg-black hover:bg-[#1a1a1a] disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-colors"
              >
                {walletPaying === 'google_pay' ? '...' : 'G Pay'}
              </button>
              <button
                type="button"
                disabled={walletPaying === 'apple_pay'}
                onClick={() => handleWalletPay('apple_pay')}
                className="flex-1 py-3 bg-black hover:bg-[#1a1a1a] disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-colors"
              >
                {walletPaying === 'apple_pay' ? '...' : ' Pay'}
              </button>
            </div>

            <button
              onClick={() => setIsBillModalOpen(false)}
              className="mt-4 text-[#8A8F98] hover:text-[#14151A] text-sm font-semibold transition-colors"
            >
              {getLocalizedText("cancel", lang)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BottomNavButton({ icon, label, active, badge, loading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl transition-all active:scale-95 disabled:opacity-60"
    >
      <div className="relative flex items-center justify-center">
        <span className={active ? 'text-[var(--theme-primary)]' : 'text-[#8A8F98]'}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : icon}
        </span>
        {badge != null && (
          <span
            className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-black flex items-center justify-center"
            style={{ background: 'linear-gradient(180deg, #7B61FF 0%, #5B3DF5 100%)' }}
          >
            {badge}
          </span>
        )}
      </div>
      <span className={`text-[10px] font-bold ${active ? 'text-[var(--theme-primary)]' : 'text-[#8A8F98]'}`}>{label}</span>
    </button>
  );
}
