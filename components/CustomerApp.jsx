"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ORDER_STATUS, useAppStore } from "@/lib/store";
import { subscribeOrders, subscribeProducts } from '@/lib/services/realtime';
import { ProductCard } from "@/components/ProductCard";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { CartDrawer } from "@/components/CartDrawer";
import { Bell, ShoppingCart, UtensilsCrossed, CheckCircle2, Clock, Home, CreditCard, Loader2, ArrowUpRight } from "lucide-react";
import { getLocalizedText, getLocalizedCategoryName, getLocalizedProduct } from "@/lib/translations";
import { applyDiscounts } from "@/lib/services/promotionsService";
import { requestWalletPayment } from "@/lib/services/paymentService";
import { FEATURES, hasFeature } from "@/lib/services/entitlementService";
import {
  Sheet, Button, Tag, Pill, LanguageToggle,
  EmptyState, LoadingState, ErrorState,
} from "@/components/kit";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

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
    loadPlans,
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

  // Language now lives in a shared, persisted store (lib/i18n/languageStore.js)
  // instead of component-local state, so the choice survives reloads and is
  // shared with every other surface — but getLocalizedText/getLocalizedProduct/
  // getLocalizedCategoryName below keep their exact original call signature,
  // so this surface's translated output is unchanged (see PROJECT_CONTEXT.md).
  const { language: lang } = useLanguage();
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

        // loadPlans() is independent of the restaurant slug (plans are
        // platform-wide, not tenant-scoped) — hydrates entitlementService's
        // PLAN_FEATURE_DEFAULTS from the DB so hasFeature()/getEntitlements()
        // below reflect the live plans/plan_features tables. Safe to run in
        // parallel with the tenant-scoped loads.
        await Promise.all([loadMenuData(), loadOrders(), loadAlerts(), loadTables(), loadBanners(), loadDiscounts(), loadPlans()]);
      } catch (err) {
        console.error('CustomerApp load error', err);
        setLoadError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    loadAppData();
  }, [params, searchParams, loadMenuData, loadOrders, loadAlerts, loadTables, loadRestaurantBySlug, loadBanners, loadDiscounts, loadPlans]);

  const resolvedTable = tables.find(
    (t) => t.table_number?.toString() === tableId?.toString() || t.id === tableId,
  );

  useEffect(() => {
    let sub;
    if (!tableId) return undefined;

    const startSub = async () => {
      try {
        sub = await subscribeOrders(({ record }) => {
          const recTableId = record?.table_id?.toString();
          const myTableId = resolvedTable?.id?.toString();
          if (recTableId && myTableId && recTableId === myTableId) {
            loadOrders();
          }
        }, { restaurantId: restaurant?.id || null });
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
  }, [tableId, resolvedTable?.id, loadOrders, restaurant?.id]);

  useEffect(() => {
    let prodSub;
    const start = async () => {
      try {
        prodSub = await subscribeProducts(() => {
          loadMenuData();
        }, { restaurantId: restaurant?.id || null });
      } catch (err) {
        console.warn('Failed to subscribe to products realtime:', err);
      }
    };
    start();
    return () => {
      if (prodSub && typeof prodSub.unsubscribe === 'function') prodSub.unsubscribe();
    };
  }, [loadMenuData, restaurant?.id]);

  const currentTable = resolvedTable || { id: tableId, name: `Masa ${tableId}` };

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

  // Spam guard for the "Garson" button: once a call goes through, the
  // button stays disabled (with a live countdown) for a short cooldown
  // instead of letting a nervous customer fire off a dozen taps. Repeat
  // taps after the cooldown still just bump the same staff-side
  // notification (see upsert_alert), they don't pile up as new ones.
  const WAITER_COOLDOWN_SECONDS = 30;
  const [waiterCalling, setWaiterCalling] = useState(false);
  const [waiterCooldownLeft, setWaiterCooldownLeft] = useState(0);

  useEffect(() => {
    if (waiterCooldownLeft <= 0) return undefined;
    const iv = setInterval(() => {
      setWaiterCooldownLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, [waiterCooldownLeft > 0]);

  const handleCallWaiter = async () => {
    if (waiterCalling || waiterCooldownLeft > 0) return;
    setWaiterCalling(true);
    const { error } = await createAlert({
      tableId: currentTable.id,
      type: 'waiter',
      note: getLocalizedText('waiterRequestNote', lang),
    });
    setWaiterCalling(false);
    if (!error) setWaiterCooldownLeft(WAITER_COOLDOWN_SECONDS);
    alert(error ? (error.message || getLocalizedText('genericError', lang) || 'Xəta baş verdi.') : getLocalizedText("waiterCalled", lang));
  };

  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [walletPaying, setWalletPaying] = useState(null); // 'google_pay' | 'apple_pay' | null
  const [billRequesting, setBillRequesting] = useState(false);
  const billTotal = activeOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const handleRequestBill = async (methodKey) => {
    if (billRequesting) return;
    setBillRequesting(true);
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
    setBillRequesting(false);

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

  // Order status -> kit Tag tone + icon. Same five states, same labels; the
  // hand-mixed hex pairs are gone in favour of the token tones.
  const statusMap = {
    [ORDER_STATUS.PENDING]: { label: getLocalizedText("statusPending", lang), icon: <Clock className="w-3.5 h-3.5" />, tone: 'warning' },
    [ORDER_STATUS.ACCEPTED]: { label: getLocalizedText("statusPreparing", lang), icon: <Clock className="w-3.5 h-3.5" />, tone: 'accent' },
    [ORDER_STATUS.PREPARING]: { label: getLocalizedText("statusPreparing", lang), icon: <UtensilsCrossed className="w-3.5 h-3.5" />, tone: 'accent' },
    [ORDER_STATUS.READY]: { label: getLocalizedText("statusCompleted", lang), icon: <CheckCircle2 className="w-3.5 h-3.5" />, tone: 'success' },
    [ORDER_STATUS.SERVED]: { label: getLocalizedText("statusCompleted", lang), icon: <CheckCircle2 className="w-3.5 h-3.5" />, tone: 'success' },
    [ORDER_STATUS.CANCELLED]: { label: getLocalizedText("statusCompleted", lang), icon: <CheckCircle2 className="w-3.5 h-3.5" />, tone: 'danger' },
  };

  const themeStyle = {
    '--theme-primary': restaurant?.theme_primary_color || '#6C4CFF',
    '--theme-secondary': restaurant?.theme_secondary_color || '#14151A',
  };

  if (loading) {
    return (
      <div className="kit-light min-h-screen bg-[var(--k-bg)]" style={themeStyle}>
        <LoadingState title="Menyu yüklənir…" description="Menyu və masa məlumatları hazırlanır" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="kit-light min-h-screen bg-[var(--k-bg)]" style={themeStyle}>
        <ErrorState
          title="Yükləmə xətası"
          description={loadError}
          actionLabel="Təkrar cəhd et"
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="kit-light min-h-screen bg-[var(--k-bg)] pb-24" style={themeStyle}>

      {/* Header. Reduced to what a seated customer actually needs: who you're
          ordering from, which table you're at, and the language. The old
          gradient logo chip and the pulsing green "live" dot are gone —
          neither told the customer anything actionable. */}
      <header className="sticky top-0 z-40 border-b border-[var(--k-border)] bg-[var(--k-surface)]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            {settings.restaurantLogo ? (
              <Image
                src={settings.restaurantLogo}
                alt=""
                className="h-8 w-8 shrink-0 rounded-[var(--k-r-sm)] border border-[var(--k-border)] object-cover"
                width={32}
                height={32}
                unoptimized
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--k-r-sm)] bg-[var(--k-accent)] text-[13px] font-semibold text-[var(--k-accent-fg)]">
                {(settings.restaurantName || 'M').charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-[var(--k-text)]">
                {settings.restaurantName}
              </p>
              <p className="truncate text-[11px] leading-tight text-[var(--k-text-3)]">
                {getLocalizedText("activeTable", lang)} · {currentTable.name}
              </p>
            </div>
          </div>

          <LanguageToggle />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 pt-6 sm:px-6">

        {/* Banners (Banner sistemi) — SuperAdmin restoranın banner funksiyasını söndürsə heç göstərilmir, plan-dan asılı olmayaraq (bax: lib/services/entitlementService.js) */}
        {hasFeature(restaurant, FEATURES.BANNERS) && banners.filter((b) => b.is_active).length > 0 && (
          <section className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar sm:-mx-6 sm:px-6">
            {banners.filter((b) => b.is_active).map((banner) => {
              const content = (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={banner.image_url}
                  alt={banner.title || 'banner'}
                  className="h-full w-full object-cover"
                />
              );

              // Resolve the action against THIS restaurant's own
              // already-loaded products/categories — a banner pointing at
              // another restaurant's id (or a since-deleted one) simply
              // won't be found here, which is exactly the graceful "target
              // unavailable -> render as non-interactive" fallback the
              // action system needs, with no extra tenant check required.
              let onClickAction = null;
              let hrefAction = null;
              if (banner.action_type === 'product') {
                const target = PRODUCTS.find((p) => p.id === banner.action_target_id);
                if (target) onClickAction = () => setSelectedProduct(target);
              } else if (banner.action_type === 'category') {
                const target = CATEGORIES.find((c) => c.id === banner.action_target_id);
                if (target) {
                  onClickAction = () => {
                    setSelectedCategory(target.id);
                    // The category bar + filtered grid sit below the banner
                    // strip — without this the click can read as dead
                    // (selection changed, but nothing visibly happened).
                    document.getElementById('menu-categories')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  };
                }
              } else if (banner.action_type === 'external' && isSafeUrl(banner.link_url)) {
                hrefAction = banner.link_url;
              } else if (banner.action_type === 'phone' && banner.link_url?.startsWith('tel:')) {
                hrefAction = banner.link_url;
              }
              const isClickable = Boolean(onClickAction || hrefAction);
              const interactiveClassName = "block h-full w-full text-left transition-transform duration-[var(--k-dur)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)] focus-visible:ring-inset";

              return (
                <div
                  key={banner.id}
                  className="relative h-32 w-[280px] shrink-0 overflow-hidden rounded-[var(--k-r-lg)] border border-[var(--k-border)] sm:h-40 sm:w-[360px]"
                >
                  {hrefAction ? (
                    <a
                      href={hrefAction}
                      target={banner.action_type === 'external' ? '_blank' : undefined}
                      rel={banner.action_type === 'external' ? 'noreferrer' : undefined}
                      className={interactiveClassName}
                    >
                      {content}
                    </a>
                  ) : onClickAction ? (
                    <button type="button" onClick={onClickAction} className={interactiveClassName}>
                      {content}
                    </button>
                  ) : (
                    content
                  )}
                  {/* Clickable affordance — an <a>/<button> shows a pointer
                      cursor on hover, but that's invisible on touch devices
                      (no hover state at all) and easy to miss even on
                      desktop against a busy promo image. This badge is the
                      only signal a customer gets that tapping does
                      something. */}
                  {isClickable && (
                    <span className="pointer-events-none absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-[var(--k-r-sm)] bg-[var(--k-text)]/70 text-[var(--k-surface)] backdrop-blur-sm">
                      <ArrowUpRight className="w-3 h-3" />
                    </span>
                  )}
                  {(banner.title || banner.subtitle) && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3">
                      {banner.title && <p className="text-[13px] font-semibold leading-tight text-white">{banner.title}</p>}
                      {banner.subtitle && <p className="mt-0.5 text-[11px] leading-tight text-white/75">{banner.subtitle}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* Categories */}
        <section id="menu-categories" className="scroll-mt-20">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar sm:-mx-6 sm:px-6">
            <Pill active={selectedCategory === "all"} onClick={() => setSelectedCategory("all")}>
              {getLocalizedText("allMenu", lang)}
            </Pill>
            {CATEGORIES.map(cat => (
              <Pill
                key={cat.id}
                active={selectedCategory === cat.id}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span aria-hidden="true">{cat.icon}</span>
                {getLocalizedCategoryName(cat, lang)}
              </Pill>
            ))}
          </div>
        </section>

        {/* Products */}
        <section>
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
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
            </div>
          ) : (
            <EmptyState
              icon={<ShoppingCart className="w-5 h-5" />}
              title="Məhsul tapılmadı"
              description="Seçilmiş kateqoriyaya uyğun məhsul yoxdur. Daha geniş kateqoriya üçün bütün məhsullara qayıdın."
              action={
                <Button variant="secondary" onClick={() => setSelectedCategory('all')}>
                  Hamısına qayıt
                </Button>
              }
            />
          )}
        </section>

        {/* Active Orders */}
        <section className="border-t border-[var(--k-border)] pt-6">
          <h2 className="mb-3.5 text-[15px] font-semibold text-[var(--k-text)]">
            {getLocalizedText("activeOrders", lang)}
          </h2>
          {activeOrders.length > 0 ? (
            <div className="space-y-2.5">
              {activeOrders.map(order => {
                const status = statusMap[order.status];
                return (
                  <div
                    key={order.id}
                    className="flex flex-col gap-3 rounded-[var(--k-r-lg)] border border-[var(--k-border)] bg-[var(--k-surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="mb-2 flex items-center gap-2 text-[11px] text-[var(--k-text-3)]">
                        <span className="k-nums">
                          {new Date(order.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="k-nums font-semibold text-[var(--k-accent)]">
                          {order.total} {settings.currencySymbol}
                        </span>
                      </div>
                      <ul className="space-y-0.5">
                        {order.items.map((item, idx) => {
                          const locItem = getLocalizedProduct(item.product, lang);
                          return (
                            <li key={idx} className="text-[13px] text-[var(--k-text-2)]">
                              <span className="k-nums mr-1.5 font-semibold text-[var(--k-text)]">{item.quantity}×</span>
                              {locItem.name}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <Tag tone={status?.tone || 'neutral'} className="h-8 self-start px-3 sm:self-center">
                      {status?.icon}
                      {status?.label}
                    </Tag>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<CheckCircle2 className="w-5 h-5" />}
              title="Aktiv sifariş yoxdur"
              description="Masanız üçün heç bir açıq sifariş yoxdur. Yeni sifariş verdikdə burada görünəcək."
            />
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-10 border-t border-[var(--k-border)] px-4 py-6 text-center">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--k-text-3)]">
            {settings.restaurantLogo ? (
              <>
                <Image
                  src={settings.restaurantLogo}
                  alt=""
                  className="h-3.5 w-3.5 rounded object-contain"
                  width={14}
                  height={14}
                  unoptimized
                />
                <span>
                  {getLocalizedText("poweredBy", lang)}{' '}
                  <strong className="font-semibold text-[var(--k-text-2)]">{settings.restaurantName}</strong>
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                {getLocalizedText("poweredBy", lang)}
                <Image
                  src="/brand/menuflow-logo-light-bg-h48.png"
                  alt="MenuFlow"
                  width={64}
                  height={11}
                  className="h-2.5 w-auto object-contain opacity-60"
                  unoptimized
                />
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--k-text-3)]">
            {settings.tagline || getLocalizedText("tagline", lang)}
          </p>
        </div>
      </footer>

      {/* Bottom Navigation. Solid surface + hairline top border instead of the
          frosted-glass bar; on a scrolling photo grid the blur was reading as
          smear rather than depth. */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--k-border)] bg-[var(--k-surface)] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-md grid-cols-4">
          <BottomNavButton icon={<Home className="w-[18px] h-[18px]" />} label="Menu" active onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
          <BottomNavButton icon={<ShoppingCart className="w-[18px] h-[18px]" />} label="Səbət" badge={cartTotalQty > 0 ? cartTotalQty : null} onClick={() => setIsCartOpen(true)} />
          <BottomNavButton
            icon={<Bell className="w-[18px] h-[18px]" />}
            label={waiterCooldownLeft > 0 ? `${waiterCooldownLeft}s` : 'Garson'}
            loading={waiterCalling}
            disabled={waiterCooldownLeft > 0}
            onClick={handleCallWaiter}
          />
          <BottomNavButton icon={<CreditCard className="w-[18px] h-[18px]" />} label="Hesab" onClick={() => setIsBillModalOpen(true)} />
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
      <Sheet
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        side="bottom"
        size="sm"
        stacked
        ariaLabel={getLocalizedText("paymentType", lang)}
        theme={null}
        panelClassName="kit-light sm:rounded-[var(--k-r-lg)] sm:border sm:max-w-sm sm:mx-auto sm:my-auto"
        scrimClassName="sm:items-center sm:justify-center sm:p-4"
      >
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
          <h2 className="text-[15px] font-semibold text-[var(--k-text)]">
            {getLocalizedText("paymentType", lang)}
          </h2>
          <p className="mt-1.5 text-[13px] text-[var(--k-text-3)]">
            {getLocalizedText("paymentPrompt", lang)}
          </p>

          <div className="mt-5 flex gap-2.5">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => handleRequestBill('cash')}
              disabled={billRequesting}
              className="flex-1"
            >
              {getLocalizedText("cash", lang)}
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={() => handleRequestBill('card')}
              disabled={billRequesting}
              className="flex-1"
            >
              {getLocalizedText("card", lang)}
            </Button>
          </div>
          {/* Changing your mind here (cash -> card etc.) after already
              requesting the bill updates the same staff-side alert in
              place instead of sending a second, confusing notification. */}

          {/* Always shown to customers — feature-detecting the wallet APIs
              up front hid these buttons on browsers/webviews that report
              PaymentRequest/ApplePaySession late or inconsistently.
              Tapping is itself the capability check: requestWalletPayment
              (lib/services/paymentService.js) returns a clear error if the
              wallet genuinely isn't available on this device. */}
          {(hasFeature(restaurant, FEATURES.GOOGLE_PAY) || hasFeature(restaurant, FEATURES.APPLE_PAY)) && (
            <div className="mt-2.5 flex gap-2.5">
              {hasFeature(restaurant, FEATURES.GOOGLE_PAY) && (
                <Button
                  size="lg"
                  disabled={walletPaying === 'google_pay'}
                  loading={walletPaying === 'google_pay'}
                  onClick={() => handleWalletPay('google_pay')}
                  className="flex-1 bg-[var(--k-text)] text-[var(--k-surface)] border-transparent hover:bg-[var(--k-text)]/90"
                >
                  G Pay
                </Button>
              )}
              {hasFeature(restaurant, FEATURES.APPLE_PAY) && (
                <Button
                  size="lg"
                  disabled={walletPaying === 'apple_pay'}
                  loading={walletPaying === 'apple_pay'}
                  onClick={() => handleWalletPay('apple_pay')}
                  className="flex-1 bg-[var(--k-text)] text-[var(--k-surface)] border-transparent hover:bg-[var(--k-text)]/90"
                >
                   Pay
                </Button>
              )}
            </div>
          )}

          <button
            onClick={() => setIsBillModalOpen(false)}
            className="mt-4 text-[13px] font-medium text-[var(--k-text-3)] transition-colors hover:text-[var(--k-text)] focus-visible:outline-none focus-visible:underline"
          >
            {getLocalizedText("cancel", lang)}
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function BottomNavButton({ icon, label, active, badge, loading, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={cn(
        'flex flex-col items-center justify-center gap-1 py-2.5 transition-colors duration-[var(--k-dur)]',
        'disabled:opacity-45 focus-visible:outline-none focus-visible:bg-[var(--k-surface-2)]',
        active ? 'text-[var(--k-accent)]' : 'text-[var(--k-text-3)]',
      )}
    >
      <span className="relative flex items-center justify-center">
        {loading ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : icon}
        {badge != null && (
          <span className="k-nums absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--k-accent)] px-1 text-[9px] font-semibold text-[var(--k-accent-fg)]">
            {badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
