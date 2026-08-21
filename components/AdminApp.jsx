"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ORDER_STATUS, useAppStore } from '@/lib/store';
import { supabase, supabaseReady } from '@/lib/supabase';
import { subscribeProducts, subscribeCategories, subscribeTables, subscribeOrders, subscribeAlerts } from '@/lib/services/realtime';
import {
  Settings, Plus, Edit2, Trash2, QrCode, Lock, BarChart3, Users, Download, Printer,
  TrendingUp, Clock, Activity, CheckCircle2, LayoutDashboard, Table2, ListOrdered, FileBarChart2,
  Search, Bell, ChevronRight, UserCircle2, Package, DollarSign, Megaphone, Palette, ClipboardList,
  Wallet, CreditCard, Smartphone, Plug,
} from 'lucide-react';
import RealtimeStatusBadge from '@/components/RealtimeStatusBadge';
import {
  LoadingState, ErrorState, EmptyState, PageSkeleton, Sheet, SheetHeader, SheetFooter, Banner, Tabs, TabsTrigger,
  Sidebar, SidebarMenuButton, ConfirmDialog, useConfirmDialog, Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell, TableEmptyRow,
  Card, CardHeader, CardBody, PageHeader, Button, Input, Select, Textarea, Checkbox, Field, Tag, LanguageToggle, Divider,
  ImageUploadField,
} from '@/components/kit';
import { buttonVariants } from '@/components/kit/variants';
import { QRCodeSVG } from 'qrcode.react';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { SettingsTab } from '@/components/SettingsTab';
import { SalesReportView } from '@/components/admin/SalesReportView';
import { IntegrationsTab } from '@/components/IntegrationsTab';
import { PromotionsTab } from '@/components/PromotionsTab';
import { DesignTab } from '@/components/DesignTab';
import { AuditLogTab } from '@/components/AuditLogTab';
import { getTrialDaysLeft, isAccessBlocked, accessBlockReason } from '@/lib/services/billingService';
import { getEntitlements } from '@/lib/services/entitlementService';
import { CAPABILITIES } from '@/lib/services/capabilityService';
import { useCapabilities } from '@/hooks/useCapability';
import { useAdminTranslation, LOCALE_TAGS } from '@/lib/i18n/dictionaries/admin';
import { useCommonTranslation } from '@/lib/i18n/dictionaries/common';
import { useLocaleSync } from '@/hooks/useLocaleSync';

// Admin access is gated behind Supabase Auth (email/password) rather than a
// client-side password, since any NEXT_PUBLIC_* value is bundled into the
// browser JS and visible to anyone via devtools. Create the admin user in
// your Supabase project's Authentication tab.
export function AdminApp() {
  const { 
    products, categories, createProduct, updateProduct, deleteProduct, createCategory, updateCategory, deleteCategory, 
    tables, loadTables, loadMenuData, loadOrders, loadAlerts, updateTableName, isAdminAuthenticated, setIsAdminAuthenticated, orders,
    qrTokensByTableId, loadQrTokens,
    settings: rawSettings, updateRestaurantProfile, profile, loadProfile, restaurant,
    loadPlans,
  } = useAppStore();

  const settings = restaurant
    ? {
        restaurantName: restaurant.name,
        restaurantLogo: restaurant.logo || '',
        // 0035_restaurant_logo_display_mode.sql — read here so SettingsTab
        // can prefill its "Tam logo göstər" switch with the saved mode.
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
  
  const router = useRouter();
  // Full-app localization pass — see lib/i18n/dictionaries/admin.js. `t`
  // covers this file's own strings; `tc` is the cross-panel `common`
  // dictionary (buttons like save/cancel reused verbatim across surfaces).
  // useLocaleSync hydrates the shared language store from this admin's
  // saved profiles.locale (migration 0023) the first time this browser has
  // no explicit local choice — see hooks/useLocaleSync.js.
  const { t } = useAdminTranslation();
  const { t: tc } = useCommonTranslation();
  useLocaleSync(profile?.locale);
  // Formal capability layer (Master Plan Phase 6) — role → capability matrix,
  // resolved once here and read by key at each gated control below. Today
  // only `restaurant_admin` ever reaches this component (middleware.js
  // restricts /admin to that one role), and restaurant_admin has every
  // capability below except users.manage (see capabilityService.js's D1
  // note), so none of these gates change what currently renders — they
  // formalize the check for whichever role reaches this component next.
  const can = useCapabilities();
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  // Which sub-view the "Hesabat" tab shows — the existing AnalyticsDashboard
  // (unchanged) or the new Z/X sales report (components/admin/
  // SalesReportView.jsx). Kept as a second sub-view of the existing nav
  // item rather than a new sidebar entry, since "Hesabat" is already the
  // right semantic home for both.
  const [reportsSubTab, setReportsSubTab] = useState('analytics');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [editingTableId, setEditingTableId] = useState(null);
  const [editingTableName, setEditingTableName] = useState('');
  const [origin, setOrigin] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', icon: '', image: '', translations: {} });

  const handleOpenCategoryModal = (category = null) => {
    if (category) {
      setEditingCategoryId(category.id);
      setCategoryForm({ name: category.name, icon: category.icon, image: category.image || '', translations: category.translations || {} });
    } else {
      setEditingCategoryId(null);
      setCategoryForm({ name: '', icon: '', image: '', translations: {} });
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    // Icon (emoji) is decorative only — istəyə bağlı, ad kimi məcburi deyil.
    // Boş buraxılsa customer menyusunda sadəcə ikonsuz çip göstərilir
    // (bax CustomerApp.jsx-in kateqoriya çipi, ProductOptionsEditor-un
    // seçim ikonu ilə eyni "boş = neytral" davranışı).
    if (!categoryForm.name.trim()) return;

    if (editingCategoryId) {
      await updateCategory({ id: editingCategoryId, ...categoryForm });
    } else {
      await createCategory({ ...categoryForm });
    }
    setIsCategoryModalOpen(false);
  };

  const handleDeleteCategory = (id) => {
    const hasProducts = products.some(p => p.category === id);
    if (hasProducts) {
      confirmDialog.confirm({
        title: t('deleteCategoryWarningTitle'),
        message: t('deleteCategoryWarningMessage'),
        isAlert: true,
      });
      return;
    }
    confirmDialog.confirm({
      title: t('deleteCategoryConfirmTitle'),
      message: t('deleteCategoryConfirmMessage'),
      onConfirm: () => deleteCategory(id),
    });
  };

  // Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', category: '', price: '', description: '', image: '', prepTimeMinutes: '', caloriesValue: '', proteinValue: '', carbsValue: '', fatValue: '', isPopular: false, isChefChoice: false, isSpicy: false, isVegetarian: false, options: [], translations: {} });

  // Confirmation dialog — shared kit ConfirmDialog (Phase B),
  // promoted from what used to be a local ConfirmModal + confirmState pair
  // in this file.
  const confirmDialog = useConfirmDialog();

  const handleOpenProductModal = (product = null) => {
    if (product) {
      setEditingProductId(product.id);
      setProductForm({ 
        name: product.name, 
        category: product.category, 
        price: product.price, 
        description: product.description, 
        image: product.image || '',
        // prepTimeMinutes is the raw integer; product.prepTime is the
        // formatted display string and must never be fed back into the form.
        prepTimeMinutes: product.prepTimeMinutes ?? '',
        // Same rule for nutrition: the *Value fields are the raw numbers,
        // product.calories/protein/... are formatted display strings.
        caloriesValue: product.caloriesValue ?? '',
        proteinValue: product.proteinValue ?? '',
        carbsValue: product.carbsValue ?? '',
        fatValue: product.fatValue ?? '',
        isPopular: !!product.isPopular,
        isChefChoice: !!product.isChefChoice,
        isSpicy: !!product.isSpicy,
        isVegetarian: !!product.isVegetarian,
        options: Array.isArray(product.options) ? product.options : [],
        translations: product.translations || {},
      });
    } else {
      setEditingProductId(null);
      setProductForm({ name: '', category: categories[0]?.id || '', price: '', description: '', image: '', prepTimeMinutes: '', caloriesValue: '', proteinValue: '', carbsValue: '', fatValue: '', isPopular: false, isChefChoice: false, isSpicy: false, isVegetarian: false, options: [], translations: {} });
    }
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productForm.name.trim() || !productForm.price) return;
    
    const parsedPrice = parseFloat(productForm.price);

    if (editingProductId) {
      await updateProduct({ id: editingProductId, ...productForm, price: parsedPrice });
    } else {
      // No `currency` here: products.currency does not exist and must not —
      // the symbol comes from restaurants.currency_symbol via the store.
      await createProduct({ ...productForm, price: parsedPrice });
    }
    setIsProductModalOpen(false);
  };

  const handleDeleteProduct = (id) => {
    confirmDialog.confirm({
      title: t('deleteProductConfirmTitle'),
      message: t('deleteProductConfirmMessage'),
      onConfirm: () => deleteProduct(id),
    });
  };

  const handleDownloadQR = async (table) => {
    const container = document.querySelector(`#qr-${table.id}`);
    if (!container) return;

    // Prefer an existing canvas if present
    const existingCanvas = container.querySelector('canvas');
    const fileName = `table-${table.id}.png`;

    if (existingCanvas) {
      try {
        const dataUrl = existingCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      } catch (e) {
        console.error('Canvas export error:', e);
        return;
      }
    }

    const qrSvg = container.querySelector('svg');
    if (!qrSvg) {
      console.error('No SVG or canvas found for QR export');
      return;
    }

    try {
      // Serialize SVG
      let svgMarkup = new XMLSerializer().serializeToString(qrSvg);
      if (!/xmlns/.test(svgMarkup)) {
        svgMarkup = svgMarkup.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      const svgData = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgMarkup;

      // Render SVG into an Image, then paint into a 1024x1024 canvas with white background and 30px quiet zone
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvasSize = 1024; // minimum size
          const margin = 30; // quiet zone in pixels
          const drawSize = canvasSize - margin * 2;

          const canvas = document.createElement('canvas');
          canvas.width = canvasSize;
          canvas.height = canvasSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas not available');

          // White background (no transparency)
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw the SVG image centered within the quiet zone
          ctx.drawImage(img, margin, margin, drawSize, drawSize);

          // Use toDataURL as requested and trigger download
          const dataUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch (err) {
          console.error('Canvas export error:', err);
        }
      };

      img.onerror = (e) => {
        console.error('SVG to Image load error', e);
      };

      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
    } catch (err) {
      console.error('QR export error:', err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!supabaseReady) {
      setAuthChecking(false);
      return undefined;
    }

    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const authed = Boolean(data?.session);
      setIsAdminAuthenticated(authed);
      if (authed) await loadProfile();
      setAuthChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setIsAdminAuthenticated(Boolean(session));
      if (session) await loadProfile();
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, [setIsAdminAuthenticated, loadProfile]);

  // Once we know which restaurant this admin belongs to, load that
  // restaurant's data (skip while we're still resolving the profile).
  const restaurantResolved = !isAdminAuthenticated || Boolean(profile);
  useEffect(() => {
    if (!isAdminAuthenticated || !restaurantResolved) return;
    if (!profile || profile.role !== 'restaurant_admin') return;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        // loadPlans() hydrates entitlementService's PLAN_FEATURE_DEFAULTS
        // from the live plans/plan_features tables (0021_plan_subscription_
        // system.sql) — read by getEntitlements(restaurant) below (wallet
        // notice) and DesignTab's banner gate, same resolver either way.
        await Promise.all([loadMenuData(), loadTables(), loadOrders(), loadAlerts(), loadPlans()]);
      } catch (err) {
        console.error('Admin data load error:', err);
        setLoadError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loadMenuData, loadTables, loadOrders, loadAlerts, loadPlans, isAdminAuthenticated, restaurantResolved, profile]);

  // QR token-ləri yalnız "QR Kodlar" tabı açılanda yüklə (sütun səviyyəli
  // qorunmadadır, adi loadTables() ilə gəlmir — bax: 0008_qr_token_verification.sql)
  useEffect(() => {
    if (activeTab === 'qrcodes' && isAdminAuthenticated && restaurantResolved) {
      loadQrTokens();
    }
  }, [activeTab, isAdminAuthenticated, restaurantResolved, loadQrTokens]);

  useEffect(() => {
    let prodSub, catSub, tableSub, orderSub, alertSub;
    const restaurantId = profile?.restaurant_id || restaurant?.id || null;

    const start = async () => {
      try {
        prodSub = await subscribeProducts(() => {
          loadMenuData();
        }, { restaurantId });

        catSub = await subscribeCategories(() => {
          loadMenuData();
        }, { restaurantId });

        tableSub = await subscribeTables(() => {
          loadTables();
        }, { restaurantId });

        orderSub = await subscribeOrders(({ event }) => {
          loadOrders();
        }, { restaurantId });

        // Ofisiant/hesab çağırışları — StaffApp bunu artıq dinləyir, admin
        // paneli isə heç vaxt abunə olmurdu, ona görə "Sifarişlər" tabındakı
        // zəng bildirişləri yalnız əl ilə yeniləməklə görünürdü.
        alertSub = await subscribeAlerts(() => {
          loadAlerts();
        }, { restaurantId });
      } catch (err) {
        console.warn('Admin realtime subscribe error', err);
      }
    };

    start();

    return () => {
      if (prodSub && typeof prodSub.unsubscribe === 'function') prodSub.unsubscribe();
      if (catSub && typeof catSub.unsubscribe === 'function') catSub.unsubscribe();
      if (tableSub && typeof tableSub.unsubscribe === 'function') tableSub.unsubscribe();
      if (orderSub && typeof orderSub.unsubscribe === 'function') orderSub.unsubscribe();
      if (alertSub && typeof alertSub.unsubscribe === 'function') alertSub.unsubscribe();
    };
  }, [loadMenuData, loadTables, loadOrders, loadAlerts, profile?.restaurant_id, restaurant?.id]);

  if (!isMounted) return null;

  if (authChecking) {
    return <PageSkeleton className="kit-dark" />;
  }

  // Role-based routing: this screen is only for restaurant_admin. Other
  // roles get sent to (or told about) where they actually belong.
  if (isAdminAuthenticated && profile) {
    if (profile.role === 'super_admin') {
      return (
        <RoleRedirect
          message={t('redirectSuperAdmin')}
          href="/superadmin"
        />
      );
    }
    if (profile.role === 'staff') {
      return (
        <RoleRedirect
          message={t('redirectStaff')}
          href="/staff"
        />
      );
    }
    if (profile.role === 'unassigned') {
      return (
        <UnassignedScreen
          onLogout={async () => {
            if (supabaseReady) await supabase.auth.signOut();
            setIsAdminAuthenticated(false);
          }}
        />
      );
    }
  }

  if (isAdminAuthenticated && loading) {
    return <PageSkeleton className="kit-dark" />;
  }

  if (isAdminAuthenticated && loadError) {
    return (
      <div className="kit-dark min-h-screen bg-[var(--k-bg)]">
        <ErrorState title={t('loadErrorTitle')} description={loadError} actionLabel={tc('tryAgain')} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const handleLogout = async () => {
    if (supabaseReady) {
      await supabase.auth.signOut();
    }
    setIsAdminAuthenticated(false);
    router.replace('/login');
  };

  if (!isAdminAuthenticated) {
    // Server-side middleware (middleware.js) already redirects unauthenticated
    // requests to /admin over to /login before this component ever mounts.
    // This is just a safety net (e.g. session expired mid-session).
    return <RoleRedirect message={t('redirectSessionExpired')} href="/login?next=/admin" />;
  }

  if (restaurant && isAccessBlocked(restaurant)) {
    return <SubscriptionLockedScreen restaurant={restaurant} onLogout={handleLogout} />;
  }

  const trialDaysLeft = restaurant ? getTrialDaysLeft(restaurant) : null;
  const showTrialBanner = restaurant?.subscription_status === 'trialing' && trialDaysLeft !== null && trialDaysLeft <= 5 && trialDaysLeft >= 0;

  const NAV_ITEMS = [
    { key: 'dashboard', label: t('navDashboard'), icon: <LayoutDashboard /> },
    { key: 'products', label: t('navProducts'), icon: <UtensilsCrossed /> },
    { key: 'categories', label: t('navCategories'), icon: <Grid /> },
    { key: 'tables', label: t('navTables'), icon: <Table2 /> },
    { key: 'qrcodes', label: t('navQrCodes'), icon: <QrCode /> },
    { key: 'orders', label: t('navOrders'), icon: <ListOrdered /> },
    { key: 'payments', label: t('navPayments'), icon: <Wallet /> },
    { key: 'reports', label: t('navReports'), icon: <FileBarChart2 /> },
    { key: 'promotions', label: t('navPromotions'), icon: <Megaphone /> },
    { key: 'design', label: t('navDesign'), icon: <Palette /> },
    { key: 'audit', label: t('navAudit'), icon: <ClipboardList /> },
    { key: 'users', label: t('navUsers'), icon: <Users /> },
    { key: 'settings', label: t('navSettings'), icon: <Settings /> },
    { key: 'integrations', label: t('navIntegrations'), icon: <Plug /> },
  ];

  const PAGE_TITLES = {
    dashboard: t('titleDashboard'),
    products: t('titleProducts'),
    categories: t('titleCategories'),
    tables: t('titleTables'),
    qrcodes: t('titleQrCodes'),
    orders: t('titleOrders'),
    payments: t('titlePayments'),
    reports: t('titleReports'),
    promotions: t('titlePromotions'),
    design: t('titleDesign'),
    audit: t('titleAudit'),
    users: t('titleUsers'),
    settings: t('titleSettings'),
    integrations: t('titleIntegrations'),
  };

  return (
    <div className="kit-dark min-h-screen bg-[var(--k-bg)] text-[var(--k-text)] font-sans flex">

      {/* Sidebar — kit's Sidebar (ported from the old primitive kit for
          this panel, see components/kit/Sidebar.jsx) keeps the same mobile
          scrim + off-canvas drawer behavior; only the tokens changed. */}
      <Sidebar
        items={NAV_ITEMS}
        activeKey={activeTab}
        onSelect={setActiveTab}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        breakpoint="md"
        header={
          settings.restaurantLogo ? (
            <div className="flex items-center gap-3 min-w-0">
              <Image src={settings.restaurantLogo} alt="Logo" width={36} height={36} className="w-9 h-9 rounded-[var(--k-r)] object-cover shrink-0" unoptimized />
              <div className="min-w-0">
                <h2 className="font-semibold text-[15px] text-[var(--k-text)] leading-tight truncate">{settings.restaurantName}</h2>
                <span className="text-[11px] text-[var(--k-text-3)] font-medium">{t('adminPanelLabel')}</span>
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <Image src="/brand/menuflow-logo-dark-bg-h48.png" alt="MenuFlow" width={110} height={17} className="h-4 w-auto object-contain mb-1" unoptimized />
              <span className="text-[11px] text-[var(--k-text-3)] font-medium truncate block">{settings.restaurantName ? `${settings.restaurantName} — ` : ''}{t('adminPanelLabel')}</span>
            </div>
          )
        }
        footer={
          <>
            <LanguageToggle profile={profile} className="w-full justify-center" />
            <Link href="/staff" className="w-full flex items-center justify-center gap-2 h-9 text-[var(--k-success)] hover:text-[var(--k-text)] bg-[var(--k-success-soft)] hover:bg-[var(--k-success)] rounded-[var(--k-r)] font-medium transition-colors text-xs">
              <UtensilsCrossed className="w-4 h-4" />
              <span>{t('staffPanelLink')}</span>
            </Link>
            <button onClick={handleLogout} className="w-full h-9 text-[var(--k-text-2)] hover:text-[var(--k-text)] bg-[var(--k-surface-2)] border border-[var(--k-border)] hover:bg-[var(--k-surface-3)] rounded-[var(--k-r)] font-medium transition-colors text-xs">
              {t('logoutButton')}
            </button>
            <div className="flex items-center justify-center pt-2">
              <Image src="/brand/menuflow-logo-dark-bg-h48.png" alt="MenuFlow" width={90} height={14} className="h-3.5 w-auto object-contain opacity-70" unoptimized />
            </div>
          </>
        }
      />

      {/* Main Area */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Topbar */}
        <div className="h-16 shrink-0 bg-[var(--k-surface)]/90 backdrop-blur-xl border-b border-[var(--k-border)] px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-10">
          <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--k-text-3)] min-w-0">
            <SidebarMenuButton breakpoint="md" onClick={() => setMobileNavOpen(true)} className="mr-1" />
            <span className="truncate">{t('adminBreadcrumb')}</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[var(--k-text)] truncate">{PAGE_TITLES[activeTab]}</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            {/* Persistent Sidebar (md:flex, see Sidebar.jsx) already carries its
                own LanguageToggle in the footer at md+ — showing this one too
                left two live az/en/ru switchers on screen at once on desktop.
                This one now only bridges the sm..md gap, where the sidebar is
                still off-canvas and reaching the drawer just to change
                language would be an extra step. */}
            <LanguageToggle profile={profile} className="hidden sm:inline-flex md:hidden" />
            <Link
              href="/staff"
              className="hidden sm:flex items-center gap-2 px-3.5 h-9 bg-[var(--k-success-soft)] hover:bg-[var(--k-success)]/25 text-[var(--k-success)] border border-[color:var(--k-success)]/30 rounded-[var(--k-r)] text-xs font-medium transition-colors"
              title={t('staffPanelLinkTitle')}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>{t('staffPanelShort')}</span>
            </Link>
            <div className="hidden lg:flex items-center gap-2 bg-[var(--k-surface-2)] border border-[var(--k-border)] rounded-[var(--k-r)] px-3.5 h-10 w-64">
              <Search className="w-4 h-4 text-[var(--k-text-3)]" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                className="bg-transparent outline-none text-sm text-[var(--k-text)] placeholder:text-[var(--k-text-3)] w-full"
              />
            </div>
            <button className="relative w-9 h-9 flex items-center justify-center rounded-[var(--k-r)] bg-[var(--k-surface-2)] border border-[var(--k-border)] hover:bg-[var(--k-surface-3)] transition-colors text-[var(--k-text-2)]">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full bg-[var(--k-danger)]" />
            </button>
            <div className="flex items-center gap-2.5 pl-3 sm:border-l border-[var(--k-border)]">
              <div className="w-8 h-8 rounded-full bg-[var(--k-accent)] text-[var(--k-accent-fg)] flex items-center justify-center font-semibold text-sm">
                {(settings.restaurantName || 'M').charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-sm font-semibold text-[var(--k-text)]">{settings.restaurantName || 'MenuFlow'}</p>
                <p className="text-[11px] text-[var(--k-text-3)] font-medium">{t('adminBadge')}</p>
              </div>
            </div>
          </div>
        </div>

        {showTrialBanner && (
          <Banner
            tone="warning"
            className="mx-4 sm:mx-8 mt-4 justify-between items-center"
            action={
              <a href="https://wa.me/994000000000" target="_blank" rel="noreferrer" className="whitespace-nowrap text-xs font-semibold bg-[var(--k-warning)] hover:opacity-90 text-[var(--k-bg)] px-3.5 py-1.5 rounded-[var(--k-r-sm)] transition-opacity">
                {t('upgradeToSubscription')}
              </a>
            }
          >
            <p className="text-sm font-medium">
              {trialDaysLeft === 0 ? t('trialEndsToday') : t('trialEndsInDays')(trialDaysLeft)}
            </p>
          </Banner>
        )}

        {/* Products' and Categories' own action rows both moved into their
            own PageHeaders below (see the Məhsullar/Kateqoriyalar blocks
            inside the scrollable content area) — this strip they used to
            share is retired now that neither tab needs it. */}

        <div className="flex-1 overflow-y-auto p-4 sm:p-8">

          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <DashboardHome orders={orders} tables={tables} products={products} categories={categories} currencySymbol={settings.currencySymbol} />
          )}

          {/* Masalar */}
          {activeTab === 'tables' && (
            <TablesManagement
              tables={tables}
              orders={orders}
              editingTableId={editingTableId}
              editingTableName={editingTableName}
              setEditingTableId={setEditingTableId}
              setEditingTableName={setEditingTableName}
              updateTableName={updateTableName}
            />
          )}

          {/* Sifarişlər */}
          {activeTab === 'orders' && can[CAPABILITIES.ORDERS_VIEW] && (
            <OrdersManagement orders={orders} tables={tables} currencySymbol={settings.currencySymbol} />
          )}

          {/* Ödənişlər — nəğd / post-terminal / Google-Apple Pay ayrı sxemalarla */}
          {activeTab === 'payments' && can[CAPABILITIES.PAYMENTS_VIEW] && (
            <PaymentsManagement orders={orders} tables={tables} currencySymbol={settings.currencySymbol} restaurant={restaurant} />
          )}

          {/* Hesabat — Analitika (mövcud) + yeni Z/X Hesabatları alt-görünüşü,
              eyni nav bölməsi altında (ikisi də "hesabat"dır, ayrıca sidebar
              girişi əlavə etməyə ehtiyac yoxdur). */}
          {activeTab === 'reports' && can[CAPABILITIES.ANALYTICS_VIEW] && (
            <div className="space-y-6">
              <Tabs>
                <TabsTrigger active={reportsSubTab === 'analytics'} onClick={() => setReportsSubTab('analytics')}>{t('reportsSubTabAnalytics')}</TabsTrigger>
                <TabsTrigger active={reportsSubTab === 'zx'} onClick={() => setReportsSubTab('zx')}>{t('reportsSubTabZX')}</TabsTrigger>
              </Tabs>
              {reportsSubTab === 'analytics' ? (
                <AnalyticsDashboard orders={orders} tables={tables} />
              ) : (
                <SalesReportView orders={orders} tables={tables} restaurantName={restaurant?.name} currencySymbol={settings.currencySymbol} />
              )}
            </div>
          )}

          {activeTab === 'promotions' && (
            <PromotionsTab />
          )}

          {activeTab === 'design' && (
            <DesignTab />
          )}

          {activeTab === 'audit' && (
            <AuditLogTab />
          )}

          {/* İstifadəçilər — oxu-only heyət siyahısı (0028). */}
          {activeTab === 'users' && can[CAPABILITIES.USERS_VIEW] && (
            <UsersTab profile={profile} restaurant={restaurant} settings={settings} />
          )}

          {/* Məhsullar — migrated to Card/PageHeader/Table/Button (kit).
              Pulled out of the shared settings/categories/qrcodes wrapper below
              (which stays exactly as it was) since Products now owns its own
              PageHeader + Card, not the plain bg-slate-900/60 box. */}
          {activeTab === 'products' && can[CAPABILITIES.PRODUCTS_VIEW] && (
            <div className="space-y-6">
              <PageHeader
                title={t('titleProducts')}
                description={t('productsSubtitle')}
                actions={
                  <>
                    {can[CAPABILITIES.PRODUCTS_CREATE] && (
                      <Button variant="primary" onClick={() => handleOpenProductModal()} icon={<Plus className="w-4 h-4" />}>
                        {t('newProduct')}
                      </Button>
                    )}
                    <RealtimeStatusBadge />
                  </>
                }
              />

              {products.length > 0 ? (
                <Card variant="plain" className="overflow-hidden">
                  <Table>
                    <TableHead>
                      <TableHeaderCell>{t('colProduct')}</TableHeaderCell>
                      <TableHeaderCell>{t('colPrice')}</TableHeaderCell>
                      <TableHeaderCell>{t('colTags')}</TableHeaderCell>
                      <TableHeaderCell className="text-right">{t('colActions')}</TableHeaderCell>
                    </TableHead>
                    <TableBody>
                      {products.map(product => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-[var(--k-r)] overflow-hidden bg-[var(--k-surface-3)] shrink-0">
                                <Image
                                  src={product.image?.trim() || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  width={88}
                                  height={88}
                                  unoptimized
                                />
                              </div>
                              <span className="font-medium text-[var(--k-text)] truncate">{product.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-[var(--k-text)] whitespace-nowrap">{product.price} {settings.currencySymbol || '₼'}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {product.isPopular && <Tag tone="warning">{t('popularBadge')}</Tag>}
                              {product.isChefChoice && <Tag tone="info">{t('chefChoiceBadge')}</Tag>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              {can[CAPABILITIES.PRODUCTS_EDIT] && (
                                <button
                                  onClick={() => handleOpenProductModal(product)}
                                  className="p-2 rounded-[var(--k-r-sm)] bg-[var(--k-surface-2)] text-[var(--k-text-2)] hover:text-[var(--k-text)] transition-colors"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                              {can[CAPABILITIES.PRODUCTS_DELETE] && (
                                <button
                                  onClick={() => handleDeleteProduct(product.id)}
                                  className="p-2 rounded-[var(--k-r-sm)] bg-[var(--k-danger-soft)] text-[var(--k-danger)] hover:opacity-80 transition-opacity"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              ) : (
                <EmptyState
                  title={t('productNotFoundTitle')}
                  description={t('productNotFoundDescription')}
                />
              )}
            </div>
          )}

          {/* Kateqoriyalar — migrated to Card/PageHeader/Button/Badge/EmptyState
              (kit), same pattern as the Məhsullar block above.
              Pulled out of the shared settings/qrcodes wrapper below, which
              stays exactly as it was for those two tabs. The per-category
              product-count Badge is a pure display addition (products are
              already loaded in this scope, same `.category === id` match
              handleDeleteCategory already uses) — no new state, no new
              capability gate, no CRUD behavior change. */}
          {activeTab === 'categories' && can[CAPABILITIES.PRODUCTS_VIEW] && (
            <div className="space-y-6">
              <PageHeader
                title={t('titleCategories')}
                description={t('categoriesSubtitle')}
                actions={
                  <>
                    {/* categories.create has no capability of its own — see
                        capabilityService.js's note, category CRUD rides
                        products.* */}
                    {can[CAPABILITIES.PRODUCTS_CREATE] && (
                      <Button variant="primary" onClick={() => handleOpenCategoryModal()} icon={<Plus className="w-4 h-4" />}>
                        {t('newCategory')}
                      </Button>
                    )}
                    <RealtimeStatusBadge />
                  </>
                }
              />

              {categories.length > 0 ? (
                <Card variant="plain">
                  <CardBody className="space-y-3">
                    {categories.map(category => {
                      const productCount = products.filter(p => p.category === category.id).length;
                      return (
                        <div key={category.id} className="flex items-center justify-between p-4 rounded-[var(--k-r-lg)] bg-[var(--k-surface-2)] border border-[var(--k-border)]">
                          <div className="flex items-center gap-4 min-w-0">
                            <span className="text-3xl bg-[var(--k-surface-3)] p-3 rounded-[var(--k-r)] shrink-0">{category.icon}</span>
                            <div className="min-w-0">
                              <span className="text-[var(--k-text)] font-semibold text-base truncate block">{category.name}</span>
                              <Tag tone="neutral" className="mt-1">{productCount} {t('itemsSuffix')}</Tag>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            {can[CAPABILITIES.PRODUCTS_EDIT] && (
                              <button
                                onClick={() => handleOpenCategoryModal(category)}
                                className="p-2 rounded-[var(--k-r-sm)] bg-[var(--k-surface-3)] text-[var(--k-text-2)] hover:text-[var(--k-text)] transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {can[CAPABILITIES.PRODUCTS_DELETE] && (
                              <button
                                onClick={() => handleDeleteCategory(category.id)}
                                className="p-2 rounded-[var(--k-r-sm)] bg-[var(--k-danger-soft)] text-[var(--k-danger)] hover:opacity-80 transition-opacity"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardBody>
                </Card>
              ) : (
                <EmptyState
                  title={t('categoryNotFoundTitle')}
                  description={t('categoryNotFoundDescription')}
                />
              )}
            </div>
          )}

          {/* QR Kodları — migrated to Card/PageHeader/Button/Badge/EmptyState
              (kit). Pulled out of the shared settings wrapper below
              (now Settings-only, unchanged). Every id handleDownloadQR and the
              @media print rule depend on (#print-qr-area, #qr-card-<id>,
              #qr-<id>) and every print:hidden class stays exactly where it
              was — only the surrounding chrome changed. Each QR tile keeps
              its deliberately white/light styling untouched: it's a
              printable/scannable artifact, not part of the dark admin shell,
              so it isn't wrapped in a dark Card and its inline rename/
              download buttons stay plain <button> (Button's dark-context
              variants would look wrong floating on a white card). The
              "missing token" Badge is a pure display addition — surfaces an
              already-computed value (qrTokensByTableId?.[table.id]) that
              silently produced a token-less, unverifiable QR link before;
              doesn't change what tableUrl resolves to. No local loading/
              error state added, same as every other migrated tab — the
              app-level PageSkeleton/ErrorState gate above already covers
              this page before it ever renders. */}
          {activeTab === 'qrcodes' && (
            <div className="space-y-6">
              <PageHeader
                title={t('titleQrCodes')}
                description={t('qrHelperText')}
                actions={
                  <Button variant="primary" onClick={() => window.print()} className="print:hidden" icon={<Printer className="w-4 h-4" />}>
                    {t('qrPrintAllPdf')}
                  </Button>
                }
              />

              <style dangerouslySetInnerHTML={{__html: `
                @media print {
                  body * { visibility: hidden; }
                  #print-qr-area, #print-qr-area * { visibility: visible; }
                  #print-qr-area { position: absolute; left: 0; top: 0; width: 100%; display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
                  .print\\:hidden { display: none !important; }
                }
              `}} />

              <div className="text-xs text-[var(--k-text-3)] bg-[var(--k-surface-2)] border border-[var(--k-border)] rounded-[var(--k-r)] px-4 py-2.5">
                {t('qrTokenNotice')}
              </div>

              <div className="min-h-[360px]">
                {tables.length > 0 ? (
                  <Card variant="plain" className="p-4 sm:p-6">
                    <div id="print-qr-area" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {tables.map(table => {
                        const tableToken = qrTokensByTableId?.[table.id];
                        const tableUrl = `${origin}/menu/${encodeURIComponent(restaurant?.slug || 'default')}/${encodeURIComponent(table.table_number || table.id)}${tableToken ? `?t=${encodeURIComponent(tableToken)}` : ''}`;
                        return (
                          <div key={table.id} id={`qr-card-${table.id}`} className="qr-code-card bg-white flex flex-col items-center justify-center gap-3 relative group p-4 border border-slate-200 rounded-2xl">
                            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs uppercase tracking-wider">
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
                                <QrCode className="w-4 h-4 text-blue-600" />
                              )}
                              <span>{settings.restaurantName || "MenuFlow"}</span>
                            </div>

                            <div id={`qr-${table.id}`} className="bg-white p-2 border-2 border-slate-100 rounded-xl">
                              <QRCodeSVG
                                value={tableUrl}
                                size={120}
                                bgColor={"#ffffff"}
                                fgColor={"#0f172a"}
                                level={"Q"}
                              />
                            </div>

                            {!tableToken && (
                              <Tag tone="warning" className="print:hidden">{t('qrTokenMissingBadge')}</Tag>
                            )}

                            {editingTableId === table.id ? (
                              <div className="flex flex-col gap-2 w-full print:hidden">
                                <input
                                  type="text"
                                  value={editingTableName}
                                  onChange={(e) => setEditingTableName(e.target.value)}
                                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-slate-900 text-center font-bold text-sm"
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      updateTableName(table.id, editingTableName);
                                      setEditingTableId(null);
                                    }}
                                    className="flex-1 bg-blue-600 text-white text-xs font-bold py-1.5 rounded-lg"
                                  >{tc('save')}</button>
                                  <button
                                    onClick={() => setEditingTableId(null)}
                                    className="flex-1 bg-slate-300 text-slate-700 text-xs font-bold py-1.5 rounded-lg"
                                  >{tc('cancel')}</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1 w-full">
                                <span className="font-bold text-slate-900 font-serif-title text-lg text-center break-words w-full">{table.name}</span>
                                <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                                  <button
                                    onClick={() => {
                                      setEditingTableId(table.id);
                                      setEditingTableName(table.name);
                                    }}
                                    className="p-2 bg-slate-100 text-slate-600 hover:text-blue-600 rounded-lg transition-colors"
                                    title={t('renameTableTitle')}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDownloadQR(table)}
                                    className="p-2 bg-slate-100 text-slate-600 hover:text-emerald-600 rounded-lg transition-colors"
                                    title={t('downloadPngTitle')}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ) : (
                  <EmptyState
                    icon={<QrCode className="w-5 h-5" />}
                    title={t('qrNotFoundTitle')}
                    description={t('qrNotFoundDescription')}
                  />
                )}
              </div>
            </div>
          )}

          {/* Ayarlar — SettingsTab.jsx now owns its own PageHeader/Card
              (migrated to kit), so this no longer needs its own
              wrapper div. Removing it also fixes a pre-existing double-card
              nesting bug: this div and SettingsTab's own root box were both
              `bg-slate-900/60 border-slate-800 rounded-3xl`, so Settings was
              rendering one bordered box inside an identical outer one. */}
          {activeTab === 'settings' && can[CAPABILITIES.RESTAURANT_SETTINGS] && (
            <SettingsTab settings={settings} updateRestaurantProfile={updateRestaurantProfile} restaurantId={restaurant?.id} />
          )}

          {/* İnteqrasiyalar — IntegrationsTab.jsx öz PageHeader/Card-larını
              daşıyır (SettingsTab-ın yuxarıdakı naxışı), üstəgəl öz daxilində
              FEATURES.POS_INTEGRATION (Pro plan) qapısını özü idarə edir. */}
          {activeTab === 'integrations' && can[CAPABILITIES.INTEGRATIONS] && (
            <IntegrationsTab />
          )}

          </div>
        </div>

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSave={handleSaveCategory}
        categoryForm={categoryForm}
        setCategoryForm={setCategoryForm}
        isEditing={!!editingCategoryId}
        restaurantId={restaurant?.id}
      />

      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
        productForm={productForm}
        setProductForm={setProductForm}
        isEditing={!!editingProductId}
        categories={categories}
        restaurantId={restaurant?.id}
      />

      <ConfirmDialog {...confirmDialog.dialogProps} />
    </div>
  );
}

// Variantlar (məs. Ölçü: Kiçik/Orta/Böyük) və Əlavələr (məs. Göbələk, Pendir,
// Zeytun) qrupları. Hər seçimin əlavə qiyməti var — səbətdə/checkout-da
// qiymət avtomatik hesablanır (bax: ProductDetailModal.jsx).
function ProductOptionsEditor({ options, onChange }) {
  const { t } = useAdminTranslation();
  const addGroup = () => onChange([...options, { title: '', choices: [{ name: '', extraPrice: 0, icon: '' }] }]);
  const removeGroup = (gi) => onChange(options.filter((_, i) => i !== gi));
  const updateGroupTitle = (gi, title) => onChange(options.map((g, i) => (i === gi ? { ...g, title } : g)));
  const addChoice = (gi) => onChange(options.map((g, i) => (i === gi ? { ...g, choices: [...g.choices, { name: '', extraPrice: 0, icon: '' }] } : g)));
  const removeChoice = (gi, ci) => onChange(options.map((g, i) => (i === gi ? { ...g, choices: g.choices.filter((_, j) => j !== ci) } : g)));
  const updateChoice = (gi, ci, field, value) =>
    onChange(
      options.map((g, i) =>
        i === gi
          ? { ...g, choices: g.choices.map((c, j) => (j === ci ? { ...c, [field]: field === 'extraPrice' ? Number(value) || 0 : value } : c)) }
          : g
      )
    );

  return (
    <div className="border-t border-[var(--k-border)] pt-4">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-[13px] font-medium text-[var(--k-text-2)]">{t('optionsEditorLabel')}</label>
        <button type="button" onClick={addGroup} className="text-xs font-medium text-[var(--k-accent)] hover:opacity-80">{t('optionsAddGroup')}</button>
      </div>
      {options.length === 0 && (
        <p className="text-xs text-[var(--k-text-3)] mb-2">{t('optionsEmptyHint')}</p>
      )}
      <div className="space-y-3">
        {options.map((group, gi) => (
          <div key={gi} className="bg-[var(--k-surface-2)] border border-[var(--k-border)] rounded-[var(--k-r)] p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="text"
                size="sm"
                value={group.title}
                onChange={(e) => updateGroupTitle(gi, e.target.value)}
                placeholder={t('optionsGroupNamePlaceholder')}
                className="flex-1"
              />
              <button type="button" onClick={() => removeGroup(gi)} className="text-[var(--k-danger)] hover:opacity-80 p-1"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1.5">
              {group.choices.map((choice, ci) => (
                <div key={ci} className="flex items-center gap-2">
                  {/* Emoji — müştəri menyusunda bu seçimin dairəvi çipində
                      görünür. Kateqoriya ikonları ilə eyni yanaşma: şəkil
                      yükləmədən rəngarəng nəticə. Boş buraxılsa çipdə neytral
                      ehtiyat ikon göstərilir. maxLength=2 çünki bəzi emoji
                      cütlüklərdən (ZWJ) ibarətdir. */}
                  <Input
                    type="text"
                    size="sm"
                    maxLength={2}
                    value={choice.icon || ''}
                    onChange={(e) => updateChoice(gi, ci, 'icon', e.target.value)}
                    placeholder={t('optionsChoiceIconPlaceholder')}
                    aria-label={t('optionsChoiceIconLabel')}
                    className="w-12 shrink-0 text-center text-base"
                  />
                  <Input
                    type="text"
                    size="sm"
                    value={choice.name}
                    onChange={(e) => updateChoice(gi, ci, 'name', e.target.value)}
                    placeholder={t('optionsChoicePlaceholder')}
                    className="flex-1 text-xs"
                  />
                  <Input
                    type="number"
                    size="sm"
                    step="0.01"
                    value={choice.extraPrice}
                    onChange={(e) => updateChoice(gi, ci, 'extraPrice', e.target.value)}
                    placeholder="+₼"
                    className="w-20 text-xs"
                  />
                  <button type="button" onClick={() => removeChoice(gi, ci)} className="text-[var(--k-text-3)] hover:text-[var(--k-danger)] p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button type="button" onClick={() => addChoice(gi)} className="text-xs font-medium text-[var(--k-text-2)] hover:text-[var(--k-text)]">{t('optionsAddChoice')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductModal({ isOpen, onClose, onSave, productForm, setProductForm, isEditing, categories, restaurantId }) {
  const { t } = useAdminTranslation();
  const { t: tc } = useCommonTranslation();
  if (!isOpen) return null;

  // Small helper so the 4 EN/RU fields below don't each hand-roll the
  // {...translations, [lang]: {...translations[lang], [field]: value}}
  // spread. Written once here (product-scoped) rather than lib/translations.js
  // since it's UI-form shape, not a resolver concern.
  const setTranslationField = (lang, field, value) => {
    setProductForm({
      ...productForm,
      translations: {
        ...productForm.translations,
        [lang]: { ...productForm.translations?.[lang], [field]: value },
      },
    });
  };
  return (
    <Sheet isOpen={isOpen} onClose={onClose} side="right" size="lg" ariaLabel={isEditing ? t('editProductTitle') : t('newProductTitle')}>
      <SheetHeader title={isEditing ? t('editProductTitle') : t('newProductTitle')} onClose={onClose} />

      <form onSubmit={onSave} className="flex flex-col min-h-0 flex-1">
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          <Field label={t('productNameLabel')} required>
            {(id, a11y) => (
              <Input
                id={id} type="text" value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder={t('productNamePlaceholder')} {...a11y}
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('categoryLabel')} required>
              {(id, a11y) => (
                <Select
                  id={id} value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} {...a11y}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('priceLabelAzn')} required>
              {(id, a11y) => (
                <Input
                  id={id} type="number" step="0.01" value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  placeholder={t('pricePlaceholder')} {...a11y}
                />
              )}
            </Field>
          </div>
          <Field label={t('prepTimeLabel')} hint={t('prepTimeHint')}>
            {(id, a11y) => (
              <Input
                id={id} type="number" min="0" step="1" value={productForm.prepTimeMinutes}
                onChange={(e) => setProductForm({ ...productForm, prepTimeMinutes: e.target.value })}
                placeholder={t('prepTimePlaceholder')} {...a11y}
              />
            )}
          </Field>
          {/* Qidalanma dəyəri — müştəri menyusunun məhsul detalındakı
              "Qidalanma dəyəri" panelini doldurur (0031_product_nutrition.sql).
              Dördü də istəyə bağlıdır: boş buraxılan sahə NULL yazılır və
              paneldə heç görünmür, ona görə "ölçülməyib" ilə "sıfırdır"
              qarışmır. */}
          <div className="rounded-[var(--k-r)] border border-[var(--k-border)] p-3.5">
            <p className="text-[13px] font-semibold text-[var(--k-text)]">{t('nutritionSectionTitle')}</p>
            <p className="mt-0.5 text-[11px] text-[var(--k-text-3)]">{t('nutritionSectionHint')}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label={t('caloriesLabel')}>
                {(id, a11y) => (
                  <Input
                    id={id} type="number" min="0" step="1" value={productForm.caloriesValue}
                    onChange={(e) => setProductForm({ ...productForm, caloriesValue: e.target.value })}
                    {...a11y}
                  />
                )}
              </Field>
              <Field label={t('proteinLabel')}>
                {(id, a11y) => (
                  <Input
                    id={id} type="number" min="0" step="0.1" value={productForm.proteinValue}
                    onChange={(e) => setProductForm({ ...productForm, proteinValue: e.target.value })}
                    {...a11y}
                  />
                )}
              </Field>
              <Field label={t('carbsLabel')}>
                {(id, a11y) => (
                  <Input
                    id={id} type="number" min="0" step="0.1" value={productForm.carbsValue}
                    onChange={(e) => setProductForm({ ...productForm, carbsValue: e.target.value })}
                    {...a11y}
                  />
                )}
              </Field>
              <Field label={t('fatLabel')}>
                {(id, a11y) => (
                  <Input
                    id={id} type="number" min="0" step="0.1" value={productForm.fatValue}
                    onChange={(e) => setProductForm({ ...productForm, fatValue: e.target.value })}
                    {...a11y}
                  />
                )}
              </Field>
            </div>
          </div>
          <Field label={t('imageUrlLabel')}>
            {(id, a11y) => (
              <ImageUploadField
                id={id} value={productForm.image}
                onChange={(url) => setProductForm({ ...productForm, image: url })}
                restaurantId={restaurantId} folder="products"
                urlPlaceholder={t('imageUrlPlaceholder')}
                uploadLabel={t('imageUploadButton')}
                previewAlt={t('imagePreviewAlt')}
                invalidLabel={t('logoInvalidBadge')}
                {...a11y}
              />
            )}
          </Field>
          <Field label={t('descriptionLabel')}>
            {(id, a11y) => (
              <Textarea
                id={id}
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                placeholder={t('descriptionPlaceholder')}
                rows={3}
                {...a11y}
              />
            )}
          </Field>

          <Divider />

          {/* EN/RU tərcümələri (0029_product_category_translations.sql) —
              istəyə bağlı override, boş buraxılsa müştəri menyusunda yuxarıdakı
              AZ dəyəri göstərilir (bax lib/translations.js-in resolver şərhi). */}
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-[var(--k-text)]">{t('translationsSectionTitle')}</h4>
              <p className="text-xs text-[var(--k-text-3)] mt-0.5">{t('translationsHint')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('productNameEnLabel')}>
                {(id, a11y) => (
                  <Input
                    id={id} type="text" value={productForm.translations?.en?.name || ''}
                    onChange={(e) => setTranslationField('en', 'name', e.target.value)} {...a11y}
                  />
                )}
              </Field>
              <Field label={t('productNameRuLabel')}>
                {(id, a11y) => (
                  <Input
                    id={id} type="text" value={productForm.translations?.ru?.name || ''}
                    onChange={(e) => setTranslationField('ru', 'name', e.target.value)} {...a11y}
                  />
                )}
              </Field>
            </div>
            <Field label={t('productDescriptionEnLabel')}>
              {(id, a11y) => (
                <Textarea
                  id={id} rows={2} value={productForm.translations?.en?.description || ''}
                  onChange={(e) => setTranslationField('en', 'description', e.target.value)} {...a11y}
                />
              )}
            </Field>
            <Field label={t('productDescriptionRuLabel')}>
              {(id, a11y) => (
                <Textarea
                  id={id} rows={2} value={productForm.translations?.ru?.description || ''}
                  onChange={(e) => setTranslationField('ru', 'description', e.target.value)} {...a11y}
                />
              )}
            </Field>
          </div>

          <Divider />

          {/* Variantlar (Ölçü, Əlavələr və s.) — qiymət avtomatik hesablanır */}
          <ProductOptionsEditor
            options={productForm.options || []}
            onChange={(options) => setProductForm({ ...productForm, options })}
          />

          {/* Tags / Badges */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Checkbox
              checked={productForm.isPopular || false}
              onChange={(e) => setProductForm({ ...productForm, isPopular: e.target.checked })}
              label={t('tagPopular')}
            />
            <Checkbox
              checked={productForm.isChefChoice || false}
              onChange={(e) => setProductForm({ ...productForm, isChefChoice: e.target.checked })}
              label={t('tagChefChoice')}
            />
            <Checkbox
              checked={productForm.isSpicy || false}
              onChange={(e) => setProductForm({ ...productForm, isSpicy: e.target.checked })}
              label={t('tagSpicy')}
            />
            <Checkbox
              checked={productForm.isVegetarian || false}
              onChange={(e) => setProductForm({ ...productForm, isVegetarian: e.target.checked })}
              label={t('tagVegetarian')}
            />
          </div>
        </div>

        <SheetFooter className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            {tc('cancel')}
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            {tc('save')}
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  );
}

function CategoryModal({ isOpen, onClose, onSave, categoryForm, setCategoryForm, isEditing, restaurantId }) {
  const { t } = useAdminTranslation();
  const { t: tc } = useCommonTranslation();
  if (!isOpen) return null;
  return (
    <Sheet isOpen={isOpen} onClose={onClose} side="center" size="md" ariaLabel={isEditing ? t('editCategoryTitle') : t('newCategoryTitle')}>
      <SheetHeader title={isEditing ? t('editCategoryTitle') : t('newCategoryTitle')} onClose={onClose} />

      <form onSubmit={onSave}>
        <div className="p-4 sm:p-5 space-y-4">
          <Field label={t('categoryNameLabel')} required>
            {(id, a11y) => (
              <Input
                id={id} type="text" value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder={t('categoryNamePlaceholder')} {...a11y}
              />
            )}
          </Field>
          <Field label={t('categoryIconLabel')}>
            {(id, a11y) => (
              <Input
                id={id} type="text" value={categoryForm.icon}
                onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                placeholder={t('categoryIconPlaceholder')} {...a11y}
              />
            )}
          </Field>
          {/* Separate from the emoji `icon` above — a real photo for the
              category card/header, not the dot-leader list's own glyph.
              0033_media_uploads.sql. */}
          <Field label={t('categoryImageLabel')}>
            {(id, a11y) => (
              <ImageUploadField
                id={id} value={categoryForm.image}
                onChange={(url) => setCategoryForm({ ...categoryForm, image: url })}
                restaurantId={restaurantId} folder="categories"
                urlPlaceholder={t('imageUrlPlaceholder')}
                uploadLabel={t('imageUploadButton')}
                previewAlt={t('imagePreviewAlt')}
                invalidLabel={t('logoInvalidBadge')}
                {...a11y}
              />
            )}
          </Field>

          <Divider />

          {/* EN/RU — yalnız ad, categories cədvəlində description sütunu
              yoxdur (bax 0029-un öz şərhi). */}
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-[var(--k-text)]">{t('translationsSectionTitle')}</h4>
              <p className="text-xs text-[var(--k-text-3)] mt-0.5">{t('translationsHint')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('categoryNameEnLabel')}>
                {(id, a11y) => (
                  <Input
                    id={id} type="text" value={categoryForm.translations?.en?.name || ''}
                    onChange={(e) => setCategoryForm({
                      ...categoryForm,
                      translations: { ...categoryForm.translations, en: { ...categoryForm.translations?.en, name: e.target.value } },
                    })} {...a11y}
                  />
                )}
              </Field>
              <Field label={t('categoryNameRuLabel')}>
                {(id, a11y) => (
                  <Input
                    id={id} type="text" value={categoryForm.translations?.ru?.name || ''}
                    onChange={(e) => setCategoryForm({
                      ...categoryForm,
                      translations: { ...categoryForm.translations, ru: { ...categoryForm.translations?.ru, name: e.target.value } },
                    })} {...a11y}
                  />
                )}
              </Field>
            </div>
          </div>
        </div>
        <SheetFooter className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            {tc('cancel')}
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            {tc('save')}
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  );
}

function Grid({ className }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
}
function UtensilsCrossed({ className }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"></path><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"></path><path d="m2.1 21.8 6.4-6.3"></path><path d="m19 5-7 7"></path></svg>
}

// Analytics Dashboard Component
function AnalyticsDashboard({ orders, tables }) {
  const { t } = useAdminTranslation();
  const [timeFilter, setTimeFilter] = useState('day'); // 'day', 'week', 'month'

  const stats = useMemo(() => {
    const now = new Date();
    
    let filteredOrders = [];
    if (timeFilter === 'day') {
      filteredOrders = orders.filter(o => new Date(o.time).toDateString() === now.toDateString());
    } else if (timeFilter === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredOrders = orders.filter(o => new Date(o.time) >= oneWeekAgo);
    } else if (timeFilter === 'month') {
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredOrders = orders.filter(o => new Date(o.time) >= oneMonthAgo);
    }
    
    const revenue = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const count = filteredOrders.length;
    const aov = count > 0 ? (revenue / count) : 0;
    
    const activeTables = new Set(
      orders.filter(o => o.status !== ORDER_STATUS.SERVED && o.status !== ORDER_STATUS.CANCELLED).map(o => o.table)
    ).size;

    // Top dishes
    const dishCounts = {};
    filteredOrders.forEach(o => {
      o.items.forEach(item => {
        const id = item.product.id;
        if (!dishCounts[id]) {
          dishCounts[id] = { name: item.product.name, count: 0, revenue: 0 };
        }
        dishCounts[id].count += item.quantity;
        dishCounts[id].revenue += (item.quantity * item.product.price);
      });
    });
    
    const topDishes = Object.values(dishCounts).sort((a, b) => b.count - a.count).slice(0, 5);
    const totalItemsSold = Object.values(dishCounts).reduce((sum, d) => sum + d.count, 0);

    // Table revenue
    const tableRevenue = {};
    filteredOrders.forEach(o => {
      const tId = o.table;
      if (!tableRevenue[tId]) {
        tableRevenue[tId] = 0;
      }
      tableRevenue[tId] += (o.total || 0);
    });

    const topTables = Object.entries(tableRevenue)
      .map(([id, rev]) => {
        const table = tables.find(tb => tb.id === id);
        return { name: table ? table.name : t('tableFallbackName')(id), value: rev };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Chart Data
    let chartData = [];
    if (timeFilter === 'day') {
      const hourlyData = {};
      for (let i = 8; i <= 23; i++) {
        hourlyData[i] = { label: `${i}:00`, sales: 0, orders: 0 };
      }
      filteredOrders.forEach(o => {
        const hour = new Date(o.time).getHours();
        if (hourlyData[hour]) {
          hourlyData[hour].sales += (o.total || 0);
          hourlyData[hour].orders += 1;
        }
      });
      chartData = Object.values(hourlyData);
    } else if (timeFilter === 'week') {
      const daysOfWeek = t('weekdayAbbreviations');
      const weekData = {};
      for(let i = 0; i < 7; i++) {
        weekData[i] = { label: daysOfWeek[i], sales: 0, orders: 0 };
      }
      filteredOrders.forEach(o => {
        const day = new Date(o.time).getDay();
        weekData[day].sales += (o.total || 0);
        weekData[day].orders += 1;
      });
      chartData = [1,2,3,4,5,6,0].map(d => weekData[d]);
    } else if (timeFilter === 'month') {
      const monthData = {};
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      for(let i = 1; i <= daysInMonth; i++) {
        monthData[i] = { label: `${i}`, sales: 0, orders: 0 };
      }
      filteredOrders.forEach(o => {
        const day = new Date(o.time).getDate();
        if(monthData[day]) {
          monthData[day].sales += (o.total || 0);
          monthData[day].orders += 1;
        }
      });
      chartData = Object.values(monthData);
    }

    return { revenue, count, aov, activeTables, topDishes, totalItemsSold, topTables, chartData };
  }, [orders, tables, timeFilter, t]);

  const recentOrders = useMemo(() => {
    return [...orders].reverse().slice(0, 5).map(o => {
      const table = tables.find(t => t.id === o.table);
      return { ...o, tableName: table ? table.name : `Masa ${o.table}` };
    });
  }, [orders, tables]);

  // Categorical palette drawn entirely from --k-* tokens (accent + the 4
  // semantic tones + muted text) rather than hardcoded hex — recharts takes
  // these as plain SVG attribute strings, and CSS custom properties resolve
  // fine there as long as the chart is a descendant of .kit-dark (it is).
  const COLORS = ['var(--k-accent)', 'var(--k-success)', 'var(--k-info)', 'var(--k-warning)', 'var(--k-danger)'];
  const tooltipStyle = { backgroundColor: 'var(--k-surface-2)', border: '1px solid var(--k-border)', borderRadius: '10px', color: 'var(--k-text)' };

  return (
    <div className="space-y-6">
      <PageHeader title={t('titleReports')} description={t('reportsSubtitle')} />

      <Tabs className="w-fit">
        <TabsTrigger active={timeFilter === 'day'} onClick={() => setTimeFilter('day')}>
          {t('filterToday')}
        </TabsTrigger>
        <TabsTrigger active={timeFilter === 'week'} onClick={() => setTimeFilter('week')}>
          {t('filterThisWeek')}
        </TabsTrigger>
        <TabsTrigger active={timeFilter === 'month'} onClick={() => setTimeFilter('month')}>
          {t('filterThisMonth')}
        </TabsTrigger>
      </Tabs>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={timeFilter === 'day' ? t('kpiDailyRevenue') : timeFilter === 'week' ? t('kpiWeeklyRevenue') : t('kpiMonthlyRevenue')} value={`${stats.revenue.toFixed(2)} ₼`} icon={<TrendingUp className="w-5 h-5 text-[var(--k-success)]" />} tint="bg-[var(--k-success-soft)]" />
        <KpiCard label={timeFilter === 'day' ? t('kpiTodayOrders') : timeFilter === 'week' ? t('kpiWeeklyOrders') : t('kpiMonthlyOrders')} value={stats.count} icon={<Activity className="w-5 h-5 text-[var(--k-accent)]" />} tint="bg-[var(--k-accent-soft)]" />
        <KpiCard label={t('kpiAvgCheck')} value={`${stats.aov.toFixed(2)} ₼`} icon={<BarChart3 className="w-5 h-5 text-[var(--k-info)]" />} tint="bg-[var(--k-info-soft)]" />
        <KpiCard label={t('kpiActiveTables')} value={stats.activeTables} icon={<Users className="w-5 h-5 text-[var(--k-warning)]" />} tint="bg-[var(--k-warning-soft)]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card variant="plain" className="lg:col-span-2">
          <CardHeader>
            <h4 className="text-[var(--k-text)] font-semibold flex items-center gap-2 text-sm"><BarChart3 className="w-4 h-4 text-[var(--k-accent)]"/> {timeFilter === 'day' ? t('chartHourly') : timeFilter === 'week' ? t('chartWeekly') : t('chartMonthly')} {t('chartOrderDynamics')}</h4>
          </CardHeader>
          <CardBody>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" stroke="var(--k-text-3)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--k-text-3)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₼${val}`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: 'var(--k-text)', fontWeight: 600 }}
                  />
                  <Bar dataKey="sales" name={t('salesSeriesLabel')} fill="var(--k-accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card variant="plain">
          <CardHeader>
            <h4 className="text-[var(--k-text)] font-semibold flex items-center gap-2 text-sm"><PieChartIcon className="w-4 h-4 text-[var(--k-warning)]"/> {t('chartRevenueDistributionByTable')}</h4>
          </CardHeader>
          <CardBody>
            <div className="h-56">
              {stats.topTables.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.topTables}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {stats.topTables.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `${value.toFixed(2)} ₼`}
                      contentStyle={tooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[var(--k-text-3)] text-sm">{t('noData')}</div>
              )}
            </div>
            <div className="mt-4 space-y-2">
              {stats.topTables.map((tableStat, i) => (
                <div key={i} className="flex justify-between items-center text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[var(--k-text-2)]">{tableStat.name}</span>
                  </div>
                  <span className="text-[var(--k-text)]">{tableStat.value.toFixed(2)} ₼</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card variant="plain">
          <CardHeader>
            <h4 className="text-[var(--k-text)] font-semibold flex items-center gap-2 text-sm"><TrendingUp className="w-4 h-4 text-[var(--k-success)]"/> {t('topSellersTitle')}</h4>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              {stats.topDishes.length > 0 ? stats.topDishes.map((dish, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-[var(--k-text-2)]">{i + 1}. {dish.name}</span>
                    <span className="text-[var(--k-success)]">{dish.count} {t('unitsSold')}</span>
                  </div>
                  <div className="w-full bg-[var(--k-surface-3)] rounded-full h-1.5">
                    <div
                      className="bg-[var(--k-success)] h-1.5 rounded-full"
                      style={{ width: `${Math.max(5, (dish.count / (stats.totalItemsSold || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              )) : (
                <EmptyState
                  icon={<TrendingUp className="w-5 h-5" />}
                  title={t('noSalesYetTitle')}
                  description={t('noSalesYetDescription')}
                />
              )}
            </div>
          </CardBody>
        </Card>

        <Card variant="plain" className="flex flex-col">
          <CardHeader>
            <h4 className="text-[var(--k-text)] font-semibold flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-[var(--k-info)]"/> {t('recentOrdersLiveFeedTitle')}</h4>
          </CardHeader>
          <CardBody className="flex-1 flex flex-col min-h-0">
            <div className="space-y-3 flex-1 overflow-y-auto pr-2 no-scrollbar">
              {recentOrders.length > 0 ? recentOrders.map(order => (
                <div key={order.id} className="bg-[var(--k-surface-2)] border border-[var(--k-border)] p-3 rounded-[var(--k-r-lg)] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[var(--k-text)] font-semibold text-sm">{order.tableName}</span>
                      <span className="text-[var(--k-text-3)] text-[10px]">{new Date(order.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <span className="text-[var(--k-text-3)] text-xs font-medium">{order.items.length} {t('itemsSuffix')}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[var(--k-text)] font-semibold text-sm">{order.total ? order.total.toFixed(2) : "0.00"} ₼</span>
                    <Tag tone={statusBadgeTone(order.status)}>
                      {orderStatusLabels(t)[order.status] || t('statusPending')}
                    </Tag>
                  </div>
                </div>
              )) : (
                <EmptyState
                  icon={<Clock className="w-5 h-5" />}
                  title={t('noRecentOrdersTitle')}
                  description={t('noRecentOrdersDescription')}
                />
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// Status label / color helpers shared by the new light-themed views. Kept
// as a function (not a static object) now that labels are translated —
// called with the active admin dictionary's `t` from each render site.
const orderStatusLabels = (t) => ({
  [ORDER_STATUS.PENDING]: t('statusPending'),
  [ORDER_STATUS.ACCEPTED]: t('statusAccepted'),
  [ORDER_STATUS.PREPARING]: t('statusPreparing'),
  [ORDER_STATUS.READY]: t('statusReady'),
  [ORDER_STATUS.SERVED]: t('statusServed'),
  [ORDER_STATUS.CANCELLED]: t('statusCancelled'),
});

// Kept as a literal Tailwind color-pair string, now built directly from
// --k-* tokens instead of the old kit's BADGE_TONE_CLASSES map — its one
// remaining call site (DashboardHome's recent-orders table, see the "Known
// mismatches" note in CLAUDE.md) renders a hand-styled <span>, not a <Tag>,
// so it can't just take a `tone` prop.
function statusBadgeClasses(status) {
  if (status === ORDER_STATUS.SERVED || status === ORDER_STATUS.READY) return 'bg-[var(--k-success-soft)] text-[var(--k-success)]';
  if (status === ORDER_STATUS.PREPARING || status === ORDER_STATUS.ACCEPTED) return 'bg-[var(--k-info-soft)] text-[var(--k-info)]';
  if (status === ORDER_STATUS.CANCELLED) return 'bg-[var(--k-danger-soft)] text-[var(--k-danger)]';
  return 'bg-[var(--k-warning-soft)] text-[var(--k-warning)]';
}

// Same precedence as statusBadgeClasses above, but returns the Tag
// primitive's `tone` name instead of a literal class string — for call
// sites (TablesManagement, OrdersManagement, PaymentSchemaTable,
// AnalyticsDashboard) that render an actual <Tag> rather than a hand-styled
// <span>. Kept as a separate function rather than deriving one from the
// other so neither has to know the other's return shape.
function statusBadgeTone(status) {
  if (status === ORDER_STATUS.SERVED || status === ORDER_STATUS.READY) return 'success';
  if (status === ORDER_STATUS.PREPARING || status === ORDER_STATUS.ACCEPTED) return 'info';
  if (status === ORDER_STATUS.CANCELLED) return 'danger';
  return 'warning';
}

// KPI card — used for every metric strip in the admin panel (Dashboard,
// Hesabat/Analytics, Ödənişlər) so every tab shares the same tinted-icon-well
// treatment instead of each rolling its own variant. Props/behavior
// unchanged, every call site keeps working as-is — only the underlying
// Card/token layer changed.
function KpiCard({ label, value, icon, tint }) {
  return (
    <Card variant="plain">
      <CardBody className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-[var(--k-r)] flex items-center justify-center shrink-0 ${tint}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[var(--k-text-3)] text-[11px] font-medium uppercase tracking-wide mb-1 truncate">{label}</p>
          <h4 className="text-lg font-semibold text-[var(--k-text)] truncate">{value}</h4>
        </div>
      </CardBody>
    </Card>
  );
}

// Dashboard — the new "analytics hub" home page.
function DashboardHome({ orders, tables, products, categories, currencySymbol }) {
  const { t, language } = useAdminTranslation();
  const symbol = currencySymbol || '₼';

  const stats = useMemo(() => {
    const now = new Date();
    const today = orders.filter(o => new Date(o.time).toDateString() === now.toDateString());
    // Cancelled orders were counted into revenue here even though
    // superAdminService.fetchRestaurantStats() already excludes them from
    // its own revenue sum — this made "today's revenue" inconsistent with
    // the platform-level number for the exact same data.
    const todayRevenue = today
      .filter(o => o.status !== ORDER_STATUS.CANCELLED)
      .reduce((sum, o) => sum + (o.total || 0), 0);
    const activeTables = new Set(
      orders.filter(o => o.status !== ORDER_STATUS.SERVED && o.status !== ORDER_STATUS.CANCELLED).map(o => o.table)
    ).size;

    // Revenue over the last 7 days for the line chart
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push(d);
    }
    const revenueByDay = days.map(d => {
      const dayOrders = orders.filter(o => new Date(o.time).toDateString() === d.toDateString() && o.status !== ORDER_STATUS.CANCELLED);
      return {
        label: d.toLocaleDateString(LOCALE_TAGS[language] || 'az-AZ', { weekday: 'short' }),
        revenue: dayOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      };
    });

    // Category split (by items sold) for the donut chart
    const categoryCounts = {};
    orders.forEach(o => {
      o.items.forEach(item => {
        const catId = item.product.category;
        const cat = categories.find(c => c.id === catId);
        const name = cat ? cat.name : t('otherCategory');
        categoryCounts[name] = (categoryCounts[name] || 0) + item.quantity;
      });
    });
    const categoryData = Object.entries(categoryCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Best sellers for the bar chart
    const dishCounts = {};
    orders.forEach(o => {
      o.items.forEach(item => {
        const id = item.product.id;
        if (!dishCounts[id]) dishCounts[id] = { name: item.product.name, count: 0 };
        dishCounts[id].count += item.quantity;
      });
    });
    const bestSellers = Object.values(dishCounts).sort((a, b) => b.count - a.count).slice(0, 5);

    return { todayRevenue, activeTables, revenueByDay, categoryData, bestSellers };
  }, [orders, categories, language, t]);

  const recentOrders = useMemo(() => {
    return [...orders].reverse().slice(0, 8).map(o => {
      const table = tables.find(tb => tb.id === o.table);
      return { ...o, tableName: table ? table.name : t('tableFallbackName')(o.table) };
    });
  }, [orders, tables, t]);

  const DONUT_COLORS = ['var(--k-accent)', 'var(--k-success)', 'var(--k-info)', 'var(--k-warning)', 'var(--k-danger)', 'var(--k-text-3)'];
  const tooltipStyle = { backgroundColor: 'var(--k-surface-2)', border: '1px solid var(--k-border)', borderRadius: '10px' };

  return (
    <div className="space-y-6">
      {/* PageHeader — Dashboard had no in-content heading at all before this;
          the topbar's breadcrumb (AdminApp's own PAGE_TITLES strip, shared by
          every tab) already names the page, so this adds what that strip
          can't: a subtitle and an actions slot (the realtime badge). */}
      <PageHeader
        title={t('titleDashboard')}
        description={t('dashboardSubtitle')}
        actions={<RealtimeStatusBadge />}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t('kpiTotalOrders')} value={orders.length} icon={<ListOrdered className="w-5 h-5 text-[var(--k-accent)]" />} tint="bg-[var(--k-accent-soft)]" />
        <KpiCard label={t('kpiTodayRevenue')} value={`${stats.todayRevenue.toFixed(2)} ${symbol}`} icon={<DollarSign className="w-5 h-5 text-[var(--k-success)]" />} tint="bg-[var(--k-success-soft)]" />
        <KpiCard label={t('kpiActiveTable')} value={stats.activeTables} icon={<Table2 className="w-5 h-5 text-[var(--k-warning)]" />} tint="bg-[var(--k-warning-soft)]" />
        <KpiCard label={t('kpiProductCount')} value={products.length} icon={<Package className="w-5 h-5 text-[var(--k-info)]" />} tint="bg-[var(--k-info-soft)]" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card variant="plain" className="lg:col-span-2">
          <CardHeader>
            <h4 className="text-[var(--k-text)] font-semibold flex items-center gap-2 text-sm"><TrendingUp className="w-4 h-4 text-[var(--k-accent)]" /> {t('revenueLast7Days')}</h4>
          </CardHeader>
          <CardBody>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.revenueByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--k-border)" />
                  <XAxis dataKey="label" stroke="var(--k-text-3)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--k-text-3)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${symbol}${v}`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: 'var(--k-text)' }}
                    itemStyle={{ color: 'var(--k-accent)' }}
                    formatter={(value) => [`${Number(value).toFixed(2)} ${symbol}`, t('revenueLabel')]}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="var(--k-accent)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--k-accent)' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card variant="plain">
          <CardHeader>
            <h4 className="text-[var(--k-text)] font-semibold flex items-center gap-2 text-sm"><PieChartIcon className="w-4 h-4 text-[var(--k-warning)]" /> {t('categoriesChartTitle')}</h4>
          </CardHeader>
          <CardBody>
            <div className="h-48">
              {stats.categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={78} paddingAngle={4} dataKey="value" stroke="none">
                      {stats.categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--k-text)' }} itemStyle={{ color: 'var(--k-text)' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[var(--k-text-3)] text-sm">{t('noData')}</div>
              )}
            </div>
            <div className="mt-3 space-y-1.5">
              {stats.categoryData.map((c, i) => (
                <div key={i} className="flex justify-between items-center text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span className="text-[var(--k-text-2)]">{c.name}</span>
                  </div>
                  <span className="text-[var(--k-text)]">{c.value}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card variant="plain">
        <CardHeader>
          <h4 className="text-[var(--k-text)] font-semibold flex items-center gap-2 text-sm"><BarChart3 className="w-4 h-4 text-[var(--k-success)]" /> {t('topSellingTitle')}</h4>
        </CardHeader>
        <CardBody>
          <div className="h-64">
            {stats.bestSellers.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.bestSellers} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--k-border)" />
                  <XAxis dataKey="name" stroke="var(--k-text-3)" fontSize={12} tickLine={false} axisLine={false} interval={0} tick={{ width: 100 }} />
                  <YAxis stroke="var(--k-text-3)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--k-text)' }} itemStyle={{ color: 'var(--k-success)' }} formatter={(v) => [`${v} ${t('unitsSold')}`, t('salesLabel')]} />
                  <Bar dataKey="count" name={t('salesLabel')} fill="var(--k-success)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[var(--k-text-3)] text-sm">{t('noSalesYet')}</div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Premium Table — Son Sifarişlər */}
      <Card variant="plain" className="overflow-hidden">
        <CardHeader>
          <h4 className="text-[var(--k-text)] font-semibold flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-[var(--k-accent)]" /> {t('recentOrdersTitle')}</h4>
        </CardHeader>
        <Table>
          <TableHead>
            <TableHeaderCell>{t('colTable')}</TableHeaderCell>
            <TableHeaderCell>{t('colTime')}</TableHeaderCell>
            <TableHeaderCell>{t('colProduct')}</TableHeaderCell>
            <TableHeaderCell>{t('colAmount')}</TableHeaderCell>
            <TableHeaderCell>{t('colStatus')}</TableHeaderCell>
          </TableHead>
          <TableBody>
            {recentOrders.length > 0 ? recentOrders.map(order => (
              <TableRow key={order.id}>
                <TableCell><span className="rounded-[var(--k-r)] bg-[var(--k-surface-3)] px-3 py-1.5 font-medium text-[var(--k-text-2)] inline-block">{order.tableName}</span></TableCell>
                <TableCell className="text-[var(--k-text-3)]">{new Date(order.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                <TableCell className="text-[var(--k-text-2)]">{order.items.length} {t('itemsSuffix')}</TableCell>
                <TableCell className="font-semibold text-[var(--k-text)]">{order.total ? order.total.toFixed(2) : '0.00'} {symbol}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadgeClasses(order.status)}`}>
                    {orderStatusLabels(t)[order.status] || t('statusPending')}
                  </span>
                </TableCell>
              </TableRow>
            )) : (
              <TableEmptyRow colSpan={5}>{t('noOrdersYet')}</TableEmptyRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// Masalar — table management: rename tables, see live status.
function TablesManagement({ tables, orders, editingTableId, editingTableName, setEditingTableId, setEditingTableName, updateTableName }) {
  const { t } = useAdminTranslation();
  const { t: tc } = useCommonTranslation();
  const tableStatus = (tableId) => {
    const active = orders.find(o => o.table === tableId && o.status !== ORDER_STATUS.SERVED && o.status !== ORDER_STATUS.CANCELLED);
    return active ? active.status : null;
  };
  // A served-but-unpaid table used to read as "Boş" here — tableStatus()
  // above only tracks kitchen-pipeline status, so once the last order hit
  // SERVED, the table looked completely free even with an open balance. This
  // is a separate signal (payment_status, orthogonal to order status — see
  // 0025_order_payment_status.sql) rendered as its own column below rather
  // than folded into tableStatus(), so "what's cooking" and "who still owes
  // money" stay independently readable instead of one silently masking the
  // other.
  const tablePaymentStatus = (tableId) => {
    const relevant = orders.filter(o => o.table === tableId && o.status !== ORDER_STATUS.CANCELLED);
    if (relevant.length === 0) return null;
    return relevant.some(o => o.paymentStatus === 'unpaid') ? 'unpaid' : 'paid';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('titleTables')}
        description={t('tablesSubtitle')}
      />

      {tables.length > 0 ? (
        <Card variant="plain" className="overflow-hidden">
          <Table>
            <TableHead>
              <TableHeaderCell>{t('colTable')}</TableHeaderCell>
              <TableHeaderCell>{t('colStatus')}</TableHeaderCell>
              <TableHeaderCell>{t('colPayment')}</TableHeaderCell>
              <TableHeaderCell className="text-right">{t('colActions')}</TableHeaderCell>
            </TableHead>
            <TableBody>
              {tables.map(table => {
                const status = tableStatus(table.id);
                const paymentStatus = tablePaymentStatus(table.id);
                const isEditing = editingTableId === table.id;
                return (
                  <TableRow key={table.id}>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            size="sm"
                            value={editingTableName}
                            onChange={(e) => setEditingTableName(e.target.value)}
                            className="w-full max-w-[200px]"
                            autoFocus
                          />
                          <Button size="sm" variant="primary" onClick={() => { updateTableName(table.id, editingTableName); setEditingTableId(null); }}>
                            {tc('save')}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setEditingTableId(null)}>
                            {tc('cancel')}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-[var(--k-r)] bg-[var(--k-accent-soft)] text-[var(--k-accent)] flex items-center justify-center shrink-0">
                            <Table2 className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-[var(--k-text)]">{table.name}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tag tone={status ? statusBadgeTone(status) : 'neutral'}>
                        {status ? orderStatusLabels(t)[status] : t('statusEmpty')}
                      </Tag>
                    </TableCell>
                    <TableCell>
                      {paymentStatus ? (
                        <Tag tone={paymentStatus === 'paid' ? 'success' : 'warning'}>
                          {paymentStatus === 'paid' ? t('paidStatus') : t('unpaidStatus')}
                        </Tag>
                      ) : (
                        <span className="text-[var(--k-text-3)]">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {!isEditing && (
                        <div className="flex justify-end">
                          <button
                            onClick={() => { setEditingTableId(table.id); setEditingTableName(table.name); }}
                            className="p-2 rounded-[var(--k-r-sm)] bg-[var(--k-surface-2)] text-[var(--k-text-2)] hover:text-[var(--k-text)] transition-colors"
                            title={t('renameTableTitle')}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <EmptyState icon={<Table2 className="w-5 h-5" />} title={t('tableNotFoundTitle')} description={t('tableNotFoundDescription')} />
      )}
    </div>
  );
}

// Sifarişlər — full order list.
function OrdersManagement({ orders, tables, currencySymbol }) {
  const { t, language } = useAdminTranslation();
  const symbol = currencySymbol || '₼';
  const sorted = useMemo(() => {
    return [...orders].reverse().map(o => {
      const table = tables.find(tb => tb.id === o.table);
      return { ...o, tableName: table ? table.name : t('tableFallbackName')(o.table) };
    });
  }, [orders, tables, t]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('titleOrders')}
        description={t('ordersSubtitle')}
      />

      {sorted.length > 0 ? (
        <Card variant="plain" className="overflow-hidden">
          <Table>
            <TableHead>
              <TableHeaderCell>{t('colTable')}</TableHeaderCell>
              <TableHeaderCell>{t('colDate')}</TableHeaderCell>
              <TableHeaderCell>{t('colProduct')}</TableHeaderCell>
              <TableHeaderCell>{t('colNote')}</TableHeaderCell>
              <TableHeaderCell>{t('colAmount')}</TableHeaderCell>
              <TableHeaderCell>{t('colStatus')}</TableHeaderCell>
              <TableHeaderCell>{t('colPayment')}</TableHeaderCell>
            </TableHead>
            <TableBody>
              {sorted.map(order => (
                <TableRow key={order.id}>
                  <TableCell><span className="rounded-[var(--k-r)] bg-[var(--k-surface-3)] px-3 py-1.5 font-medium text-[var(--k-text-2)] inline-block">{order.tableName}</span></TableCell>
                  <TableCell className="text-[var(--k-text-3)]">{new Date(order.time).toLocaleString(LOCALE_TAGS[language] || 'az-AZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</TableCell>
                  <TableCell className="text-[var(--k-text-2)]">{order.items.length} {t('itemsSuffix')}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-[var(--k-warning)]" title={order.note || ''}>
                    {order.note || '—'}
                  </TableCell>
                  <TableCell className="font-semibold text-[var(--k-text)]">{order.total ? order.total.toFixed(2) : '0.00'} {symbol}</TableCell>
                  <TableCell>
                    <Tag tone={statusBadgeTone(order.status)}>
                      {orderStatusLabels(t)[order.status] || t('statusPending')}
                    </Tag>
                  </TableCell>
                  {/* Orthogonal to the status column above — this is
                      payment_status (0025_order_payment_status.sql), not
                      order.status. A cancelled order never carries a
                      meaningful payment state, so it's shown as a dash
                      rather than "Ödənilməyib". */}
                  <TableCell>
                    {order.status === ORDER_STATUS.CANCELLED ? (
                      <span className="text-[var(--k-text-3)]">—</span>
                    ) : (
                      <Tag tone={order.paymentStatus === 'paid' ? 'success' : 'warning'}>
                        {order.paymentStatus === 'paid' ? t('paidStatus') : t('unpaidStatus')}
                      </Tag>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <EmptyState
          icon={<ListOrdered className="w-5 h-5" />}
          title={t('noOrdersYet')}
          description={t('ordersNotFoundDescription')}
        />
      )}
    </div>
  );
}

// Ödənişlər — orders split into three separate payment-method "schemas"
// (cash / POS terminal / Google & Apple Pay), each with its own summary
// and its own table, instead of one mixed order list.
function PaymentSchemaTable({ title, icon, tint, rows, currencySymbol, emptyLabel }) {
  const { t, language } = useAdminTranslation();
  const symbol = currencySymbol || '₼';
  const total = rows.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  return (
    <Card variant="plain" className="overflow-hidden">
      <CardHeader className="flex items-center justify-between flex-wrap gap-3">
        <h4 className="text-[var(--k-text)] font-semibold flex items-center gap-2 text-sm">
          <span className={`w-9 h-9 rounded-[var(--k-r)] flex items-center justify-center ${tint}`}>{icon}</span>
          {title}
        </h4>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-[var(--k-text-3)]">{t('countLabel')} <span className="text-[var(--k-text)] font-semibold">{rows.length}</span></span>
          <span className="text-[var(--k-text-3)]">{t('totalLabel')} <span className="text-[var(--k-text)] font-semibold">{total.toFixed(2)} {symbol}</span></span>
        </div>
      </CardHeader>
      <Table>
        <TableHead>
          <TableHeaderCell>{t('colTable')}</TableHeaderCell>
          <TableHeaderCell>{t('colDate')}</TableHeaderCell>
          <TableHeaderCell>{t('colProduct')}</TableHeaderCell>
          <TableHeaderCell>{t('colAmount')}</TableHeaderCell>
          <TableHeaderCell>{t('colStatus')}</TableHeaderCell>
          {/* This column is what "Status" above is NOT — order.status is
              kitchen progress (pending/preparing/served/…), payment_status
              is whether this specific payment method actually collected the
              money. The two were easy to conflate before there was a second
              column to tell them apart. */}
          <TableHeaderCell>{t('colPayment')}</TableHeaderCell>
        </TableHead>
        <TableBody>
          {rows.length > 0 ? rows.map(order => (
            <TableRow key={order.id}>
              <TableCell><span className="rounded-[var(--k-r)] bg-[var(--k-surface-3)] px-3 py-1.5 font-medium text-[var(--k-text-2)] inline-block">{order.tableName}</span></TableCell>
              <TableCell className="text-[var(--k-text-3)]">{new Date(order.time).toLocaleString(LOCALE_TAGS[language] || 'az-AZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</TableCell>
              <TableCell className="text-[var(--k-text-2)]">{order.items.length} {t('itemsSuffix')}</TableCell>
              <TableCell className="font-semibold text-[var(--k-text)]">{order.total ? order.total.toFixed(2) : '0.00'} {symbol}</TableCell>
              <TableCell>
                <Tag tone={statusBadgeTone(order.status)}>
                  {orderStatusLabels(t)[order.status] || t('statusPending')}
                </Tag>
              </TableCell>
              <TableCell>
                <Tag tone={order.paymentStatus === 'paid' ? 'success' : 'warning'}>
                  {order.paymentStatus === 'paid' ? t('paidStatus') : t('unpaidStatus')}
                </Tag>
              </TableCell>
            </TableRow>
          )) : (
            <TableEmptyRow colSpan={6}>{emptyLabel}</TableEmptyRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function PaymentsManagement({ orders, tables, currencySymbol, restaurant }) {
  const { t } = useAdminTranslation();
  const symbol = currencySymbol || '₼';
  const walletEnabled = getEntitlements(restaurant);

  const withTableName = useMemo(() => {
    return [...orders].reverse().map(o => {
      const table = tables.find(tb => tb.id === o.table);
      return { ...o, tableName: table ? table.name : t('tableFallbackName')(o.table) };
    });
  }, [orders, tables, t]);

  // Cancelled orders used to stay in these buckets (and in grandTotal below)
  // just because they happened to carry a payment_method — a cancelled
  // order was never actually paid and should never count as revenue, same
  // rule superAdminService.fetchRestaurantStats() already applies at the
  // platform level.
  const payable = useMemo(() => withTableName.filter(o => o.status !== ORDER_STATUS.CANCELLED), [withTableName]);
  const cashOrders = useMemo(() => payable.filter(o => o.paymentMethod === 'cash'), [payable]);
  const cardOrders = useMemo(() => payable.filter(o => o.paymentMethod === 'card'), [payable]);
  const walletOrders = useMemo(() => payable.filter(o => ['google_pay', 'apple_pay'].includes(o.paymentMethod)), [payable]);
  const unspecifiedCount = payable.length - cashOrders.length - cardOrders.length - walletOrders.length;
  // "Sonra ödəyəcəyəm" orders (payment_method null) plus any settled order
  // whose method still didn't stick land here too — genuinely unpaid,
  // regardless of which method bucket (if any) it's in above.
  const unpaidOrders = useMemo(() => payable.filter(o => o.paymentStatus === 'unpaid'), [payable]);

  // "Ümumi Ödəniş" (total payments) means money actually collected — before
  // payment_status existed, this summed every non-cancelled order's total
  // regardless of whether it was ever paid, which is exactly what a "Sonra
  // ödəyəcəyəm" order would have overstated as already-received revenue.
  const grandTotal = payable
    .filter(o => o.paymentStatus === 'paid')
    .reduce((s, o) => s + (Number(o.total) || 0), 0);
  const unpaidTotal = unpaidOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t('titlePayments')} description={t('paymentsSubtitle')} />

      {(!walletEnabled.google_pay || !walletEnabled.apple_pay) && (
        <Banner tone="warning" icon={<span className="w-2 h-2 rounded-full bg-[var(--k-warning)] shrink-0 mt-1.5" />}>
          <p className="text-xs font-medium">
            {!walletEnabled.google_pay && !walletEnabled.apple_pay
              ? t('walletBothDisabled')
              : !walletEnabled.google_pay
                ? t('walletGoogleDisabled')
                : t('walletAppleDisabled')}
          </p>
        </Banner>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label={t('kpiCash')} value={`${cashOrders.length}`} icon={<Wallet className="w-5 h-5 text-[var(--k-success)]" />} tint="bg-[var(--k-success-soft)]" />
        <KpiCard label={t('kpiPosTerminal')} value={`${cardOrders.length}`} icon={<CreditCard className="w-5 h-5 text-[var(--k-accent)]" />} tint="bg-[var(--k-accent-soft)]" />
        <KpiCard label={t('kpiWallet')} value={`${walletOrders.length}`} icon={<Smartphone className="w-5 h-5 text-[var(--k-info)]" />} tint="bg-[var(--k-info-soft)]" />
        <KpiCard label={t('kpiTotalPayments')} value={`${grandTotal.toFixed(2)} ${symbol}`} icon={<DollarSign className="w-5 h-5 text-[var(--k-warning)]" />} tint="bg-[var(--k-warning-soft)]" />
        {/* New: what's still owed, across every payment method — the number
            that didn't exist anywhere in this panel before 0025. */}
        <KpiCard label={t('kpiUnpaid')} value={`${unpaidOrders.length} · ${unpaidTotal.toFixed(2)} ${symbol}`} icon={<Clock className="w-5 h-5 text-[var(--k-danger)]" />} tint="bg-[var(--k-danger-soft)]" />
      </div>

      <PaymentSchemaTable
        title={t('cashPaymentsTitle')}
        icon={<Wallet className="w-4 h-4 text-[var(--k-success)]" />}
        tint="bg-[var(--k-success-soft)]"
        rows={cashOrders}
        currencySymbol={symbol}
        emptyLabel={t('noCashPayments')}
      />

      <PaymentSchemaTable
        title={t('posPaymentsTitle')}
        icon={<CreditCard className="w-4 h-4 text-[var(--k-accent)]" />}
        tint="bg-[var(--k-accent-soft)]"
        rows={cardOrders}
        currencySymbol={symbol}
        emptyLabel={t('noPosPayments')}
      />

      <PaymentSchemaTable
        title={t('walletPaymentsTitle')}
        icon={<Smartphone className="w-4 h-4 text-[var(--k-info)]" />}
        tint="bg-[var(--k-info-soft)]"
        rows={walletOrders}
        currencySymbol={symbol}
        emptyLabel={t('noWalletPayments')}
      />

      {unspecifiedCount > 0 && (
        <p className="text-xs text-[var(--k-text-3)] font-medium px-1">
          {t('unspecifiedPaymentsNote')(unspecifiedCount)}
        </p>
      )}
    </div>
  );
}

// İstifadəçilər — oxu-only heyət siyahısı (0028_restaurant_staff_directory.sql
// / get_restaurant_staff() RPC). Hesab yaratma/silmə/rol dəyişmə BURADAN
// keçmir və heç vaxt keçməyəcək — CLAUDE.md-nin D1 qərarına görə hesab
// yaratma uçdan-uca super-admin-only-dur (bax capabilityService.js-in
// CAPABILITIES.USERS_MANAGE şərhi). Əvvəlki versiya ("UsersPlaceholder")
// yalnız giriş etmiş adminin öz kartını göstərib "ayrıca heyət qeydiyyatı
// lazım deyil" yazırdı — bu, yanıldıcı idi: staff rollu hesablar real
// mövcuddur, sadəcə bu tabdan görünmürdü.
function UsersTab({ profile, restaurant, settings }) {
  const { t } = useAdminTranslation();
  const { restaurantStaff, loadRestaurantStaff } = useAppStore();
  const [loading, setLoading] = useState(true);

  // No setLoading(true) here: `loading` already starts true (useState(true)
  // above) and UsersTab fully unmounts when the admin switches tabs (it's
  // gated behind `activeTab === 'users'` in the parent), so a fresh mount
  // always starts from a clean loading state without needing to set it
  // synchronously inside the effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    loadRestaurantStaff().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadRestaurantStaff]);

  const roleLabel = (role) => (role === 'restaurant_admin' ? t('roleLabelRestaurantAdmin') : t('roleLabelStaff'));

  return (
    <div className="space-y-6">
      <PageHeader title={t('titleUsers')} description={t('usersSubtitle')} />

      <Card variant="plain">
        <CardBody className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-[var(--k-r)] bg-[var(--k-accent)] text-[var(--k-accent-fg)] flex items-center justify-center font-semibold">
              {(settings.restaurantName || 'M').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-[var(--k-text)]">{profile?.email || settings.restaurantName}</p>
              <p className="text-xs text-[var(--k-success)] font-medium uppercase tracking-wide">{t('restaurantAdminAndStaffRole')}</p>
            </div>
          </div>
          {/* Styled to match the other /staff links in this shell (sidebar
              footer, topbar) — deliberately not the Button primitive, same
              as those, so all "go to staff panel" links in the admin shell
              stay visually consistent with each other. */}
          <Link
            href="/staff"
            className="px-4 h-10 bg-[var(--k-success)] hover:opacity-90 text-[var(--k-bg)] rounded-[var(--k-r)] font-medium text-xs flex items-center gap-2 transition-opacity"
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>{t('goToStaffPanel')}</span>
          </Link>
        </CardBody>
      </Card>

      <Card variant="plain">
        <CardHeader title={t('usersRosterSectionTitle')} />
        <CardBody>
          {loading ? (
            <LoadingState full={false} />
          ) : (
            <Table>
              <TableHead>
                <TableHeaderCell>{t('colEmail')}</TableHeaderCell>
                <TableHeaderCell>{t('colRole')}</TableHeaderCell>
              </TableHead>
              <TableBody>
                {restaurantStaff.length === 0 ? (
                  <TableEmptyRow colSpan={2}>{t('noStaffYet')}</TableEmptyRow>
                ) : (
                  restaurantStaff.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        {u.email}
                        {u.id === profile?.id && <span className="text-[var(--k-text-3)]"> ({t('youLabel')})</span>}
                      </TableCell>
                      <TableCell>
                        <Tag tone={u.role === 'restaurant_admin' ? 'accent' : 'neutral'}>{roleLabel(u.role)}</Tag>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Hesab yaratma özü hələ də super-admin-only-dur (D1) — bu, honest
          bir "bizimlə əlaqə saxla" yönləndirməsidir, "lazım deyil" yalanı
          deyil. SubscriptionLockedScreen-in eyni dəstək linkini işlədir. */}
      <EmptyState
        icon={<UserCircle2 className="w-5 h-5" />}
        title={t('contactSupportToAddStaffTitle')}
        description={t('contactSupportToAddStaffDescription')}
        action={
          <a
            href="https://wa.me/994000000000"
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'secondary' })}
          >
            {t('contactSupportButton')}
          </a>
        }
      />
    </div>
  );
}

function SubscriptionLockedScreen({ restaurant, onLogout }) {
  const { t } = useAdminTranslation();
  const reason = accessBlockReason(restaurant);
  const copy = {
    deactivated: {
      title: t('deactivatedTitle'),
      body: t('deactivatedBody')(restaurant.name),
    },
    trial_expired: {
      title: t('trialExpiredTitle'),
      body: t('trialExpiredBody')(restaurant.name),
    },
    past_due: {
      title: t('pastDueTitle'),
      body: t('pastDueBody')(restaurant.name),
    },
    canceled: {
      title: t('canceledTitle'),
      body: t('canceledBody')(restaurant.name),
    },
  };
  const { title, body } = copy[reason] || copy.canceled;
  return (
    <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center p-4">
      <Card variant="plain" className="max-w-sm text-center p-8">
        <div className="w-12 h-12 bg-[var(--k-warning-soft)] rounded-[var(--k-r)] flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-[var(--k-warning)]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--k-text)] mb-2">{title}</h2>
        <p className="text-[var(--k-text-3)] text-sm mb-6">{body}</p>
        <div className="flex flex-col gap-2">
          {reason !== 'deactivated' && (
            <a href="https://wa.me/994000000000" target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'primary', size: 'block' })}>
              {t('upgradeToSubscription')}
            </a>
          )}
          <Button variant="secondary" onClick={onLogout} size="block">
            {t('logoutButton')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function PieChartIcon({ className }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
}

function RoleRedirect({ message, href }) {
  const { t } = useAdminTranslation();
  const router = useRouter();
  useEffect(() => {
    const timer = setTimeout(() => router.replace(href), 600);
    return () => clearTimeout(timer);
  }, [router, href]);

  return (
    <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center p-4">
      <div className="max-w-sm text-center">
        <p className="text-[var(--k-text-3)] text-sm mb-4">{message}</p>
        <Link href={href} className="text-[var(--k-accent)] hover:opacity-80 text-sm font-medium underline">
          {t('redirectManualLink')}
        </Link>
      </div>
    </div>
  );
}

function UnassignedScreen({ onLogout }) {
  const { t } = useAdminTranslation();
  return (
    <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center p-4">
      <Card variant="plain" className="max-w-sm text-center p-8">
        <Lock className="w-9 h-9 text-[var(--k-warning)] mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-[var(--k-text)] mb-2">{t('unassignedTitle')}</h2>
        <p className="text-[var(--k-text-3)] text-sm mb-6">
          {t('unassignedBody')}
        </p>
        <Button variant="secondary" onClick={onLogout} size="block">
          {t('logoutButton')}
        </Button>
      </Card>
    </div>
  );
}
