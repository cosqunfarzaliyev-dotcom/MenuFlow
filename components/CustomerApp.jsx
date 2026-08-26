"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ORDER_STATUS, useAppStore } from "@/lib/store";
import {
  subscribeOrders, subscribeProducts, subscribeBanners, subscribeDiscounts,
} from '@/lib/services/realtime';
import { ProductCard } from "@/components/ProductCard";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { CartDrawer } from "@/components/CartDrawer";
import { BannerCarousel } from "@/components/BannerCarousel";
import { Bell, ShoppingCart, UtensilsCrossed, CheckCircle2, Clock, Home, CreditCard, Loader2, ArrowUpRight, XCircle, Search, X, Leaf } from "lucide-react";
import { getLocalizedText, getLocalizedCategoryName, getLocalizedProduct } from "@/lib/translations";
import { applyDiscounts } from "@/lib/services/promotionsService";
import { requestWalletPayment } from "@/lib/services/paymentService";
import { FEATURES, hasFeature } from "@/lib/services/entitlementService";
import {
  Sheet, Button, Tag, Pill, Input, LanguageToggle,
  EmptyState, LoadingState, ErrorState,
} from "@/components/kit";
import { useLanguage } from "@/hooks/useLanguage";
import { cn, isVideoUrl, pickReadableForeground } from "@/lib/utils";

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
    loadTableOrders,
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
        // 0035_restaurant_logo_display_mode.sql — 'name' | 'logo', lets the
        // restaurant admin choose full-logo vs. text-name for this header.
        logoDisplayMode: restaurant.logo_display_mode || 'name',
        currencySymbol: restaurant.currency_symbol || '₼',
        tableCount: restaurant.table_count || 50,
        tagline: restaurant.tagline || '',
      }
    : rawSettings || {
        restaurantName: 'MenuFlow',
        restaurantLogo: '',
        logoDisplayMode: 'name',
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
  const [searchQuery, setSearchQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);

  const [tableId, setTableId] = useState(() => params?.table || searchParams?.get('table') || "1");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Cart persistence: keyed by restaurant + table so a page refresh (or an
  // accidental tab close/reopen in the same session) doesn't wipe an
  // in-progress order — sessionStorage rather than localStorage on purpose,
  // so a cart from a previous, unrelated visit never silently resurfaces.
  // Null until the restaurant slug resolves, so nothing is read/written
  // against a table id that hasn't been confirmed yet.
  const cartStorageKey = restaurant?.slug && tableId ? `mf-cart:${restaurant.slug}:${tableId}` : null;
  const cartRestoredKeyRef = useRef(null);

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
        //
        // Orders are deliberately NOT loaded here — loadOrders() (staff-only)
        // would silently return [] for this anon session (orders RLS has no
        // anon SELECT policy at all). They're loaded once `resolvedTable` is
        // known, below, via the QR-token-gated loadTableOrders().
        await Promise.all([
          loadMenuData(), loadAlerts(), loadTables(), loadBanners(), loadDiscounts(), loadPlans(),
        ]);
      } catch (err) {
        console.error('CustomerApp load error', err);
        setLoadError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    loadAppData();
  }, [params, searchParams, loadMenuData, loadAlerts, loadTables, loadRestaurantBySlug, loadBanners, loadDiscounts, loadPlans]);

  const resolvedTable = tables.find(
    (t) => t.table_number?.toString() === tableId?.toString() || t.id === tableId,
  );

  // Initial orders load for this table — waits for `tables` to resolve the
  // route's table number/id into a real DB table UUID (loadTableOrders
  // needs that, not the route param). Re-runs if the resolved table changes
  // (e.g. `tables` refetches after being empty).
  useEffect(() => {
    if (!resolvedTable?.id || !restaurant?.id) return;
    loadTableOrders(resolvedTable.id);
  }, [resolvedTable?.id, restaurant?.id, loadTableOrders]);

  useEffect(() => {
    let sub;
    if (!tableId) return undefined;

    const startSub = async () => {
      try {
        // Kept even though it's currently a no-op for this anon customer
        // session: `orders` RLS has no anon SELECT policy (see store.js's
        // loadOrders comment — every policy is `{authenticated} using
        // (is_staff_of(...))`), and Realtime's postgres_changes filter runs
        // the same RLS check per subscriber, so this channel never actually
        // delivers an event here. Left in place as a free win the moment it
        // *does* pass (e.g. a future signed-in customer session) — the
        // polling effect right below is what actually keeps this table's
        // order statuses live today, through the same QR-token-verified
        // get_table_orders() RPC the initial load already uses.
        sub = await subscribeOrders(({ record }) => {
          const recTableId = record?.table_id?.toString();
          const myTableId = resolvedTable?.id?.toString();
          if (recTableId && myTableId && recTableId === myTableId) {
            loadTableOrders(myTableId);
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
  }, [tableId, resolvedTable?.id, loadTableOrders, restaurant?.id]);

  // Polling fallback for the gap above: staff changing an order's status
  // (accept/prepare/ready/served, or cancel) never reaches this anon
  // session over Realtime, so without this the customer's own order-status
  // view would only ever update on a manual page reload. Deliberately a
  // plain get_table_orders() re-fetch on an interval rather than an RLS
  // policy change — the QR-token-gated RPC is the one sanctioned read path
  // for a customer's orders (see CLAUDE.md's QR-token invariant), so this
  // keeps that boundary intact instead of opening anon SELECT on `orders`.
  // Paused while the tab is hidden (visibilitychange) so a customer who
  // background-tabs the menu isn't quietly polling every 10s forever.
  useEffect(() => {
    if (!resolvedTable?.id) return undefined;

    let iv = null;
    const tick = () => loadTableOrders(resolvedTable.id);
    const start = () => { if (!iv) iv = setInterval(tick, 10000); };
    const stop = () => { if (iv) { clearInterval(iv); iv = null; } };

    if (document.visibilityState === 'visible') start();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { tick(); start(); }
      else stop();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [resolvedTable?.id, loadTableOrders]);

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

  // Promotions are owned by the admin panel but displayed to anonymous menu
  // visitors. Realtime events update an already-open QR menu immediately;
  // the visible-tab polling fallback keeps the same UI current if a project's
  // Realtime publication has not yet been configured. Discounts are included
  // because their changes affect the product prices rendered below.
  useEffect(() => {
    let subscriptions = [];
    let disposed = false;
    let pollInterval = null;

    const refreshPromotions = () => {
      Promise.all([loadBanners(), loadDiscounts()]).catch((err) => {
        console.warn('Failed to refresh promotions:', err);
      });
    };

    const startPolling = () => {
      if (!pollInterval) pollInterval = setInterval(refreshPromotions, 12000);
    };

    const stopPolling = () => {
      if (!pollInterval) return;
      clearInterval(pollInterval);
      pollInterval = null;
    };

    const start = async () => {
      if (!restaurant?.id) return;
      const options = { restaurantId: restaurant.id };
      try {
        const created = await Promise.all([
          subscribeBanners(() => loadBanners(), options),
          subscribeDiscounts(() => loadDiscounts(), options),
        ]);
        if (disposed) {
          created.forEach((sub) => sub?.unsubscribe?.());
        } else {
          subscriptions = created;
        }
      } catch (err) {
        console.warn('Failed to subscribe to promotion realtime updates:', err);
      }
    };

    start();
    if (document.visibilityState === 'visible') startPolling();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshPromotions();
        startPolling();
      } else {
        stopPolling();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      subscriptions.forEach((sub) => sub?.unsubscribe?.());
    };
  }, [restaurant?.id, loadBanners, loadDiscounts]);

  // Restore a persisted cart once we know which restaurant+table it belongs
  // to (guards against restoring the wrong table's cart, and against
  // restoring before the key is even known). Runs at most once per key.
  useEffect(() => {
    if (!cartStorageKey || cartRestoredKeyRef.current === cartStorageKey) return;
    cartRestoredKeyRef.current = cartStorageKey;
    try {
      const raw = window.sessionStorage.getItem(cartStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setCartItems(parsed);
        }
      }
    } catch {
      // Corrupt/unavailable storage — cart just starts empty, same as today.
    }
  }, [cartStorageKey]);

  // Persist on every cart change. sessionStorage (not localStorage) so a
  // cart from a previous, unrelated visit to this table never resurfaces —
  // it only survives a reload/accidental tab close within the same
  // browser session.
  useEffect(() => {
    if (!cartStorageKey) return;
    try {
      if (cartItems.length > 0) {
        window.sessionStorage.setItem(cartStorageKey, JSON.stringify(cartItems));
      } else {
        window.sessionStorage.removeItem(cartStorageKey);
      }
    } catch {
      // Storage full/unavailable (e.g. private browsing) — cart still works
      // in-memory for the rest of this visit, it just won't survive a reload.
    }
  }, [cartStorageKey, cartItems]);

  const currentTable = resolvedTable || { id: tableId, name: `Masa ${tableId}` };

  // `orders` is already scoped to this table by get_table_orders() (server
  // side, via the QR token) — no client-side table match needed here
  // anymore. "Sifarişlərim" stays visible for anything not finished AND
  // paid: still-in-progress orders (unchanged) plus served-but-unpaid ones,
  // which used to vanish from the customer's screen the instant the kitchen
  // marked them served, even though nothing had been paid yet.
  const activeOrders = orders.filter(
    (o) => o.status !== ORDER_STATUS.CANCELLED && !(o.status === ORDER_STATUS.SERVED && o.paymentStatus === 'paid'),
  );

  // Drives the "Hesab" modal: only orders still owed, regardless of kitchen
  // status — a served order that hasn't been paid is exactly the "bitirdi,
  // indi ödəyir" case this feature exists for.
  //
  // `!o.paymentMethod` is what makes "Hesab" go quiet once the customer has
  // already chosen how they're paying in the cart. That choice IS this
  // modal's whole job (it does nothing but record a method and alert staff),
  // so leaving the balance here afterwards asked the same question twice and
  // let one order raise two bill alerts. An order sent with "Sonra
  // ödəyəcəyəm" carries no payment_method (see CartDrawer.handleSendOrder),
  // so it still shows up here and "Hesab" keeps working exactly as before.
  //
  // Customer-side visibility ONLY — payment_status stays 'unpaid' in the DB
  // until staff actually settle the table, so StaffApp's per-table balance
  // (which filters on paymentStatus, not paymentMethod), the admin
  // "Ödənilməyib" KPI and the Z/X report all still show the money as owed.
  // Nothing here marks anything paid.
  const unpaidOrders = orders.filter(
    (o) => o.status !== ORDER_STATUS.CANCELLED && o.paymentStatus === 'unpaid' && !o.paymentMethod,
  );
  const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

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

  // Kept in sync with the latest `activeOrders` on every render so the
  // 30s-later timeout below (whose closure is otherwise fixed at mount,
  // deps []) can check the CURRENT order state at fire time, not whatever
  // it was when the tab was hidden.
  const hasActiveOrderRef = useRef(false);
  useEffect(() => {
    hasActiveOrderRef.current = activeOrders.length > 0;
  }, [activeOrders]);

  // Auto-clear on a backgrounded/closed tab. sessionStorage alone doesn't
  // solve "the menu shouldn't stay open forever" on mobile — a locked
  // screen or a backgrounded browser tab routinely stays alive for hours,
  // so without this the cart (and whatever modal/search state was on
  // screen) just sits there indefinitely. Page Visibility is the only
  // signal available (there's no reliable "tab actually closed" event);
  // `hidden` also fires on a quick app-switch or screen lock, which is why
  // this is a debounced timeout rather than an instant clear — cancelled on
  // `visible` so a brief glance away never wipes an in-progress order. A
  // customer with an active order (placed, awaiting kitchen/payment) is
  // never cleared this way, however long the tab stays hidden — they still
  // need this screen to see their order/pay the bill when they come back.
  //
  // The `setTimeout` below only fires while this page's JS is still
  // running — which an actually-*closed* tab, or a backgrounded one the OS
  // kills for memory (routine on mobile, often well under 30s), never is.
  // That silently defeated the whole feature: sessionStorage still holds
  // the old cart (it's only cleared as a side effect of setCartItems([])
  // running, via the persist effect below), so reopening the menu just
  // restored it — indistinguishable from the clear never having happened.
  // `hiddenAtKey` fixes that with a synchronous sessionStorage write (not a
  // pending timer) the instant the tab goes hidden, checked against wall
  // time the next moment JS *is* running again — on remount (a real close
  // + reopen) or on the `visible` transition — so elapsed time is measured
  // correctly even when nothing was alive to count it in the background.
  const BACKGROUND_CLEAR_DELAY_MS = 30000;
  const backgroundClearTimeoutRef = useRef(null);
  const hiddenAtKey = cartStorageKey ? `mf-hidden-at:${cartStorageKey}` : null;

  useEffect(() => {
    if (!hiddenAtKey) return undefined;

    const clearBackgroundedState = () => {
      if (hasActiveOrderRef.current) return;
      setCartItems([]);
      setIsCartOpen(false);
      setSelectedProduct(null);
      setIsBillModalOpen(false);
      setSelectedCategory("all");
      setSearchQuery("");
      setVegOnly(false);
    };

    // A stamp left over from a previous life of this tab (real close +
    // reopen, or a hard reload) — resolve it against wall-clock time as
    // soon as this effect can actually run, instead of trusting a timer
    // that never got the chance to.
    const staleHiddenAt = Number(window.sessionStorage.getItem(hiddenAtKey));
    window.sessionStorage.removeItem(hiddenAtKey);
    if (staleHiddenAt && Date.now() - staleHiddenAt >= BACKGROUND_CLEAR_DELAY_MS) {
      clearBackgroundedState();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        window.sessionStorage.setItem(hiddenAtKey, String(Date.now()));
        backgroundClearTimeoutRef.current = setTimeout(clearBackgroundedState, BACKGROUND_CLEAR_DELAY_MS);
        return;
      }

      if (backgroundClearTimeoutRef.current) {
        clearTimeout(backgroundClearTimeoutRef.current);
        backgroundClearTimeoutRef.current = null;
      }
      const hiddenAt = Number(window.sessionStorage.getItem(hiddenAtKey));
      window.sessionStorage.removeItem(hiddenAtKey);
      if (hiddenAt && Date.now() - hiddenAt >= BACKGROUND_CLEAR_DELAY_MS) {
        clearBackgroundedState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (backgroundClearTimeoutRef.current) {
        clearTimeout(backgroundClearTimeoutRef.current);
      }
    };
  }, [hiddenAtKey]);

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
    const { token, error } = await requestWalletPayment({ method: methodKey, amount: unpaidTotal || 0 });
    setWalletPaying(null);
    if (token) {
      await handleRequestBill(methodKey);
    } else if (error) {
      alert(error.message || 'Ödəniş ləğv edildi.');
    }
  };

  // Banner sistemi — yalnız aktiv bannerlər, BannerCarousel-ə keçirilməzdən
  // əvvəl bir dəfə hesablanır (əvvəllər bu filter render zamanı İKİ dəfə,
  // eyni nəticə üçün ayrı-ayrı çağırılırdı).
  const activeBanners = useMemo(() => banners.filter((b) => b.is_active), [banners]);

  // Endirimlər: aktiv endirimləri məhsul qiymətlərinə avtomatik tətbiq edir
  // (bütün menyuya və ya seçilmiş məhsula tətbiq oluna bilər).
  const pricedProducts = useMemo(() => {
    return PRODUCTS.map((product) => {
      const { price, discount } = applyDiscounts(product, discounts);
      if (!discount) return product;
      return { ...product, price, originalPrice: product.price, activeDiscount: discount };
    });
  }, [PRODUCTS, discounts]);

  // Axtarış + VEG süzgəci + kateqoriya eyni anda tətbiq olunur (reference
  // dizaynda hər üçü bir sırada birgə işləyir). Axtarış hazırkı dildə
  // göstərilən ad/təsvirə görə uyğunlaşır — getLocalizedProduct-un mövcud
  // DB tərcüməsi → köhnə demo map → AZ mənbə zənciri (lib/translations.js)
  // ilə eynidir, ona görə axtarış nəticələri ekranda görünənlə üst-üstə düşür.

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    let list = selectedCategory === "all"
      ? pricedProducts
      : pricedProducts.filter(p => p.category === selectedCategory);

    if (vegOnly) {
      list = list.filter(p => p.isVegetarian);
    }

    if (normalizedQuery) {
      list = list.filter(p => {
        const localized = getLocalizedProduct(p, lang);
        return (
          localized.name?.toLowerCase().includes(normalizedQuery) ||
          localized.description?.toLowerCase().includes(normalizedQuery)
        );
      });
    }

    return list;
  }, [selectedCategory, pricedProducts, vegOnly, normalizedQuery, lang]);

  const isFiltering = Boolean(normalizedQuery) || vegOnly;

  const cartTotalQty = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  // Order status -> kit Tag tone + icon. Same five states, same labels; the
  // hand-mixed hex pairs are gone in favour of the token tones.
  const statusMap = {
    [ORDER_STATUS.PENDING]: { label: getLocalizedText("statusPending", lang), icon: <Clock className="w-3.5 h-3.5" />, tone: 'warning' },
    [ORDER_STATUS.ACCEPTED]: { label: getLocalizedText("statusPreparing", lang), icon: <Clock className="w-3.5 h-3.5" />, tone: 'accent' },
    [ORDER_STATUS.PREPARING]: { label: getLocalizedText("statusPreparing", lang), icon: <UtensilsCrossed className="w-3.5 h-3.5" />, tone: 'accent' },
    [ORDER_STATUS.READY]: { label: getLocalizedText("statusCompleted", lang), icon: <CheckCircle2 className="w-3.5 h-3.5" />, tone: 'success' },
    [ORDER_STATUS.SERVED]: { label: getLocalizedText("statusCompleted", lang), icon: <CheckCircle2 className="w-3.5 h-3.5" />, tone: 'success' },
    [ORDER_STATUS.CANCELLED]: { label: getLocalizedText("statusCancelled", lang), icon: <XCircle className="w-3.5 h-3.5" />, tone: 'danger' },
  };

  // The restaurant's own palette, handed to .kit-light as CSS custom
  // properties (components/kit/tokens.css derives every other token from
  // these four via color-mix). Four inline variables instead of a stylesheet
  // per tenant: the values are row data that changes at runtime, and CSS
  // custom properties inherit down the whole subtree, including the cart and
  // product Sheets, which render in place (theme={null}) precisely so they
  // stay inside this element and keep inheriting them.
  //
  // NOTE: theme_secondary_color is the MENU TEXT colour as of migration 0043.
  // It previously fed a --theme-secondary variable that nothing in the repo
  // ever read, so the admin panel's "second colour" picker was inert; the
  // migration repurposed the column rather than adding a fifth one.
  const themeStyle = useMemo(() => {
    const accent = restaurant?.theme_primary_color || '#6C4CFF';
    return {
      '--theme-primary': accent,
      '--theme-text': restaurant?.theme_secondary_color || '#14151A',
      '--theme-bg': restaurant?.theme_background_color || '#FAFAF9',
      '--theme-surface': restaurant?.theme_surface_color || '#FFFFFF',
      // Button LABEL colour. Computed, never stored: it is fully determined
      // by the accent, so persisting it would just create a second source of
      // truth that can drift out of sync with the button colour it describes.
      '--theme-accent-fg': pickReadableForeground(accent),
    };
  }, [
    restaurant?.theme_primary_color,
    restaurant?.theme_secondary_color,
    restaurant?.theme_background_color,
    restaurant?.theme_surface_color,
  ]);

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
          {/* Admin-chosen via logoDisplayMode (0035_restaurant_logo_
              display_mode.sql, SettingsTab's "Tam logo göstər" switch):
              'logo' shows the full, uncropped logo at its own aspect ratio
              (never force-cropped into the old 32×32 object-cover square).
              A wide wordmark logo sitting on the SAME row as "Masa N" left
              the table indicator squeezed against LanguageToggle on the
              right with nowhere left to truncate to on a narrow phone —
              effectively invisible. Stacked vertically instead in this
              mode: logo on top, table indicator directly under it, so it
              always has the full header width to itself regardless of how
              wide the logo is. Name+avatar mode (unchanged) keeps the
              original side-by-side layout — that pairing was never the
              problem, only the logo case was. */}
          {settings.restaurantLogo && settings.logoDisplayMode === 'logo' ? (
            <div className="flex min-w-0 flex-col gap-0.5">
              <Image
                src={settings.restaurantLogo}
                alt={settings.restaurantName}
                className="h-10 w-auto max-w-[190px] shrink-0 object-contain"
                width={190}
                height={40}
                unoptimized
              />
              <p className="truncate text-[11px] leading-tight text-[var(--k-text-3)]">
                {getLocalizedText("activeTable", lang)} · {currentTable.name}
              </p>
            </div>
          ) : (
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
          )}

          <LanguageToggle />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 pt-6 sm:px-6">

        {/* Active Orders — moved to the very top of the menu (was the last
            section, after the whole product grid, so checking order status
            meant scrolling past everything). Only rendered when there's
            something to show — an empty-state placeholder here, before the
            customer has browsed anything, would just be clutter at the most
            prominent spot on the page, so the EmptyState/"Aktiv sifariş
            yoxdur" branch is gone entirely along with it. */}
        {activeOrders.length > 0 && (
          <section>
            <h2 className="mb-3.5 text-[15px] font-semibold text-[var(--k-text)]">
              {getLocalizedText("activeOrders", lang)}
            </h2>
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
                    <div className="flex shrink-0 items-center gap-1.5 self-start sm:self-center">
                      <Tag tone={status?.tone || 'neutral'} className="h-8 px-3">
                        {status?.icon}
                        {status?.label}
                      </Tag>
                      {/* Orthogonal to the status tag above — an order can be
                          "Tamamlandı" (served) and still unpaid, which is
                          exactly the "yeməyini bitirib sonra ödəyir"
                          scenario this whole feature exists for. */}
                      <Tag tone={order.paymentStatus === 'paid' ? 'success' : 'warning'} className="h-8 px-3">
                        {order.paymentStatus === 'paid' ? getLocalizedText('paidStatus', lang) : getLocalizedText('unpaidStatus', lang)}
                      </Tag>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Axtarış + VEG süzgəci. Kateqoriya sırasından ayrıca, birgə bir sırada:
            axtarış həmişəki kimi geniş kapsul, VEG düyməsi onun yanında sabit
            enli — hər ikisi eyni "kapsul" forma dilini paylaşır ki, aşağıdakı
            kateqoriya kaşeləri və şəkil üstü reytinq nişanı ilə vizual olaraq
            bir ailədən görünsün. */}
        <section className="flex items-center gap-2.5">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--k-text-3)]" aria-hidden="true" />
            <Input
              type="search"
              inputMode="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={getLocalizedText("searchPlaceholder", lang)}
              aria-label={getLocalizedText("searchPlaceholder", lang)}
              className="!rounded-full pl-10 pr-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label={getLocalizedText("clearSearchLabel", lang)}
                className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[var(--k-text-3)] hover:bg-[var(--k-surface-2)] hover:text-[var(--k-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setVegOnly(v => !v)}
            aria-pressed={vegOnly}
            title={getLocalizedText("vegOnlyLabel", lang)}
            className={cn(
              'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors duration-[var(--k-dur)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)]',
              vegOnly
                ? 'border-[var(--k-success)] bg-[var(--k-success)] text-white'
                : 'border-[var(--k-border)] bg-[var(--k-surface)] text-[var(--k-success)] hover:border-[var(--k-success)]',
            )}
          >
            <Leaf className="h-[18px] w-[18px]" aria-hidden="true" />
            <span className="sr-only">{getLocalizedText("vegOnlyLabel", lang)}</span>
          </button>
        </section>

        {/* Banners (Banner sistemi) — SuperAdmin restoranın banner funksiyasını söndürsə heç göstərilmir, plan-dan asılı olmayaraq (bax: lib/services/entitlementService.js) */}
        {hasFeature(restaurant, FEATURES.BANNERS) && activeBanners.length > 0 && (
          <BannerCarousel
            prevLabel={getLocalizedText("bannerPrevLabel", lang)}
            nextLabel={getLocalizedText("bannerNextLabel", lang)}
            goToLabel={(n, total) => getLocalizedText("bannerGoToLabel", lang)(n, total)}
            slides={activeBanners.map((banner) => {
              // A banner is now either a static image OR a short looping
              // video (Dizayn -> Banner sistemi) — isVideoUrl reads the
              // uploaded file's own extension back off the URL, see its
              // comment in lib/utils.js for why no separate DB column is
              // needed. Muted/loop/playsInline: this is ambient background
              // motion the customer never taps play on, same treatment
              // browsers require for autoplay to even be allowed.
              const content = isVideoUrl(banner.image_url) ? (
                <video
                  src={banner.image_url}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
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

              const node = (
                <div className="relative h-full w-full overflow-hidden">
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
                    // Extra bottom padding whenever more than one banner is
                    // active — BannerCarousel overlays its dot indicators
                    // along the same bottom edge, and without the extra
                    // room the subtitle text sat directly behind them.
                    <div className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 ${activeBanners.length > 1 ? 'pb-6' : ''}`}>
                      {banner.title && <p className="text-[13px] font-semibold leading-tight text-white">{banner.title}</p>}
                      {banner.subtitle && <p className="mt-0.5 text-[11px] leading-tight text-white/75">{banner.subtitle}</p>}
                    </div>
                  )}
                </div>
              );

              return { key: banner.id, node };
            })}
          />
        )}

        {/* Categories. Icon-tile row instead of a text-pill row: the category
            set is the customer's real primary navigation through the menu
            (not decoration), so it earns the heavier, more tappable tile
            treatment — each tile carries the admin's own emoji icon
            (categories.icon) on a tint of the restaurant's own accent colour,
            so this stays self-branded per tenant with zero new tokens. */}

        <section id="menu-categories" className="scroll-mt-20">
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar sm:-mx-6 sm:px-6">
            <CategoryTile
              active={selectedCategory === "all"}
              onClick={() => setSelectedCategory("all")}
              icon={<UtensilsCrossed className="h-5 w-5" aria-hidden="true" />}
              label={getLocalizedText("allMenu", lang)}
            />
            {CATEGORIES.map(cat => (
              <CategoryTile
                key={cat.id}
                active={selectedCategory === cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                icon={<span aria-hidden="true" className="text-xl leading-none">{cat.icon}</span>}
                label={getLocalizedCategoryName(cat, lang)}
              />
            ))}
          </div>
        </section>

        {/* Products */}
        <section>
          {/* Section heading. Names what the grid below is currently showing —
              the selected category, or the whole menu — so the icon row above
              and the grid read as one navigation unit rather than two
              unrelated blocks. Hidden while filtering, where the grid is a
              result set rather than a browsable section. */}
          {filteredProducts.length > 0 && !isFiltering && (
            <h2 className="mb-3.5 text-[19px] font-bold tracking-[-0.01em] text-[var(--k-text)]">
              {selectedCategory === 'all'
                ? getLocalizedText('allMenu', lang)
                : getLocalizedCategoryName(
                    CATEGORIES.find(c => c.id === selectedCategory) || {},
                    lang,
                  )}
            </h2>
          )}
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpenDetail={setSelectedProduct}
                  onAddToCart={handleAddToCart}
                  lang={lang}
                />
              ))}
            </div>
          ) : isFiltering ? (
            <EmptyState
              icon={<Search className="w-5 h-5" />}
              title={getLocalizedText("noSearchResultsTitle", lang)}
              description={getLocalizedText("noSearchResultsDescription", lang)}
              action={
                <Button
                  variant="secondary"
                  onClick={() => { setSearchQuery(''); setVegOnly(false); }}
                >
                  {getLocalizedText("clearSearchLabel", lang)}
                </Button>
              }
            />
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

      </main>

      {/* Footer */}
      {/* .customer-footer pins this region to a fixed cream ground and
          re-declares the --k-* tokens its subtree reads, so the restaurant's
          chosen background/text colours stop at its edge — see the block in
          app/globals.css for why the MenuFlow mark requires that. */}
      <footer className="customer-footer mt-10 border-t border-[var(--k-border)] px-4 py-6 text-center">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--k-text-3)]">
            {/* Deliberately NOT the restaurant's own logo. A restaurant's
                uploaded logo brands the customer menu HEADER only; this
                footer is the MenuFlow product credit line and stays the
                same on every tenant's menu, so a restaurant swapping its
                logo can never repaint it. */}
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
          <BottomNavButton
            icon={<Home className="h-[21px] w-[21px]" strokeWidth={2.2} />}
            label={getLocalizedText("navMenu", lang)}
            active
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          />
          <BottomNavButton
            icon={<ShoppingCart className="h-[21px] w-[21px]" strokeWidth={2.2} />}
            label={getLocalizedText("navCart", lang)}
            badge={cartTotalQty > 0 ? cartTotalQty : null}
            onClick={() => setIsCartOpen(true)}
          />
          <BottomNavButton
            icon={<Bell className="h-[21px] w-[21px]" strokeWidth={2.2} />}
            label={waiterCooldownLeft > 0 ? `${waiterCooldownLeft}s` : getLocalizedText("navWaiter", lang)}
            loading={waiterCalling}
            disabled={waiterCooldownLeft > 0}
            onClick={handleCallWaiter}
          />
          <BottomNavButton
            icon={<CreditCard className="h-[21px] w-[21px]" strokeWidth={2.2} />}
            label={getLocalizedText("navBill", lang)}
            onClick={() => setIsBillModalOpen(true)}
          />
        </div>
      </nav>

      {/* Product Detail Modal */}
      <ProductDetailModal
        key={selectedProduct?.id || 'product-modal'}
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCartWithOptions={handleAddToCart}
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
        /* top/right/left/bottom-24 (not inset-0) keeps the fixed bottom nav
           visible above the scrim — see CartDrawer.jsx's Sheet for the full
           rationale (same 6rem the page's own pb-24 reserves for that nav). */
        scrimClassName="top-0 right-0 left-0 bottom-24 sm:items-center sm:justify-center sm:p-4"
      >
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
          <h2 className="text-[15px] font-semibold text-[var(--k-text)]">
            {getLocalizedText("paymentType", lang)}
          </h2>

          {unpaidOrders.length > 0 ? (
            <>
              {/* Previously this amount only ever fed silently into the
                  wallet sheet — the customer had no way to see what they
                  actually owed before tapping a payment method. */}
              <p className="mt-1.5 k-nums text-2xl font-semibold text-[var(--k-accent)]">
                {unpaidTotal.toFixed(2)} {settings.currencySymbol}
              </p>
              <p className="mt-1 text-[13px] text-[var(--k-text-3)]">
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
                  place instead of sending a second, confusing notification.
                  The final method actually charged is still whatever staff
                  confirms in settle_table_payment — this only records
                  intent. */}

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
            </>
          ) : (
            // Nothing owed — either no orders yet or staff already settled
            // the table. Showing payment buttons here would let a customer
            // "pay" a zero balance, which just confuses staff with a bill
            // alert for nothing.
            <p className="mt-3 text-[13px] text-[var(--k-text-3)]">
              {getLocalizedText("nothingToPay", lang)}
            </p>
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

// Kateqoriya kaşesi: ikon üstdə, etiket altda, dar sütun. Aktiv olmayanda
// --k-accent-soft üzərində --k-accent tonunda ikon (restoranın öz brend
// rəngi), aktiv olanda tam dolu --k-accent — Pill komponenti ilə eyni
// active/passive məntiqi, sadəcə kvadrat kaşe formasında.
function CategoryTile({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="group flex w-[68px] shrink-0 flex-col items-center gap-1.5 focus-visible:outline-none"
    >
      <span
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-[var(--k-r-lg)] border transition-colors duration-[var(--k-dur)]',
          'group-focus-visible:ring-2 group-focus-visible:ring-[var(--k-focus)]',
          active
            ? 'border-[var(--k-accent)] bg-[var(--k-accent)] text-[var(--k-accent-fg)]'
            : 'border-transparent bg-[var(--k-accent-soft)] text-[var(--k-accent)]',
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          'line-clamp-2 w-full text-center text-[11px] leading-tight',
          active ? 'font-semibold text-[var(--k-text)]' : 'font-medium text-[var(--k-text-3)]',
        )}
      >
        {label}
      </span>
    </button>
  );
}

// Alt naviqasiya düyməsi. Aktiv vəziyyət ikonun arxasındakı accent-tonlu
// kapsulla verilir — CategoryTile və Fərdiləşdirmə çipləri ilə eyni "seçilmiş =
// accent-soft fon + accent ikon" dili, ona görə bütün panel bir sistem kimi
// oxunur. Yalnız rəng dəyişikliyi ilə kifayətlənmirik: kiçik 10px etiketdə
// tək başına rəng fərqi kontrast baxımından zəif siqnaldır.
function BottomNavButton({ icon, label, active, badge, loading, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex flex-col items-center justify-center gap-1 py-2 transition-colors duration-[var(--k-dur)]',
        'disabled:opacity-45 focus-visible:outline-none',
        active ? 'text-[var(--k-accent)]' : 'text-[var(--k-text-3)]',
      )}
    >
      <span
        className={cn(
          'relative flex h-9 w-[52px] items-center justify-center rounded-full transition-colors duration-[var(--k-dur)]',
          'group-focus-visible:ring-2 group-focus-visible:ring-[var(--k-focus)]',
          active
            ? 'bg-[var(--k-accent-soft)]'
            : 'bg-transparent group-hover:bg-[var(--k-surface-2)]',
        )}
      >
        {loading ? <Loader2 className="h-[21px] w-[21px] animate-spin" /> : icon}
        {badge != null && (
          <span className="k-nums absolute right-1 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--k-accent)] px-1 text-[9px] font-semibold text-[var(--k-accent-fg)] ring-2 ring-[var(--k-surface)]">
            {badge}
          </span>
        )}
      </span>
      <span className={cn('text-[10px] leading-none', active ? 'font-semibold' : 'font-medium')}>
        {label}
      </span>
    </button>
  );
}
