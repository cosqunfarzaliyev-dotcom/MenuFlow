"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ORDER_STATUS, useAppStore } from '@/lib/store';
import { supabase, supabaseReady } from '@/lib/supabase';
import { subscribeProducts, subscribeCategories, subscribeTables, subscribeOrders } from '@/lib/services/realtime';
import {
  Settings, Plus, Edit2, Trash2, Shield, QrCode, Lock, BarChart3, Users, Download, Printer,
  TrendingUp, Clock, Activity, CheckCircle2, LayoutDashboard, Table2, ListOrdered, FileBarChart2,
  Search, Bell, ChevronRight, UserCircle2, Package, DollarSign, Megaphone, Palette, ClipboardList,
} from 'lucide-react';
import RealtimeStatusBadge from '@/components/RealtimeStatusBadge';
import { LoadingState, ErrorState, EmptyState, PageSkeleton } from '@/components/ui';
import { QRCodeSVG } from 'qrcode.react';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { SettingsTab } from '@/components/SettingsTab';
import { PromotionsTab } from '@/components/PromotionsTab';
import { DesignTab } from '@/components/DesignTab';
import { AuditLogTab } from '@/components/AuditLogTab';
import { getTrialDaysLeft, isAccessBlocked } from '@/lib/services/billingService';

// Admin access is gated behind Supabase Auth (email/password) rather than a
// client-side password, since any NEXT_PUBLIC_* value is bundled into the
// browser JS and visible to anyone via devtools. Create the admin user in
// your Supabase project's Authentication tab.
export function AdminApp() {
  const { 
    products, categories, createProduct, updateProduct, deleteProduct, createCategory, updateCategory, deleteCategory, 
    tables, loadTables, loadMenuData, loadOrders, loadAlerts, updateTableName, isAdminAuthenticated, setIsAdminAuthenticated, orders,
    settings: rawSettings, updateSettings, profile, loadProfile, restaurant,
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
  
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingTableId, setEditingTableId] = useState(null);
  const [editingTableName, setEditingTableName] = useState('');
  const [origin, setOrigin] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', icon: '' });

  const handleOpenCategoryModal = (category = null) => {
    if (category) {
      setEditingCategoryId(category.id);
      setCategoryForm({ name: category.name, icon: category.icon });
    } else {
      setEditingCategoryId(null);
      setCategoryForm({ name: '', icon: '' });
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim() || !categoryForm.icon.trim()) return;

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
      setConfirmState({
        isOpen: true,
        title: 'Diqqət',
        message: 'Bu kateqoriyada məhsullar var. Əvvəlcə məhsulları silin və ya başqa kateqoriyaya keçirin.',
        onConfirm: null,
        isAlert: true
      });
      return;
    }
    setConfirmState({
      isOpen: true,
      title: 'Kateqoriyanı Sil',
      message: 'Bu kateqoriyanı silmək istədiyinizə əminsiniz?',
      onConfirm: () => {
        deleteCategory(id);
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      },
      isAlert: false
    });
  };

  // Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', category: '', price: '', description: '', image: '', isPopular: false, isChefChoice: false, isSpicy: false, isVegetarian: false, options: [] });

  // Confirmation Modal State
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    isAlert: false
  });

  const handleOpenProductModal = (product = null) => {
    if (product) {
      setEditingProductId(product.id);
      setProductForm({ 
        name: product.name, 
        category: product.category, 
        price: product.price, 
        description: product.description, 
        image: product.image || '',
        isPopular: !!product.isPopular,
        isChefChoice: !!product.isChefChoice,
        isSpicy: !!product.isSpicy,
        isVegetarian: !!product.isVegetarian,
        options: Array.isArray(product.options) ? product.options : []
      });
    } else {
      setEditingProductId(null);
      setProductForm({ name: '', category: categories[0]?.id || '', price: '', description: '', image: '', isPopular: false, isChefChoice: false, isSpicy: false, isVegetarian: false, options: [] });
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
      await createProduct({ currency: "₼", ...productForm, price: parsedPrice });
    }
    setIsProductModalOpen(false);
  };

  const handleDeleteProduct = (id) => {
    setConfirmState({
      isOpen: true,
      title: 'Məhsulu Sil',
      message: 'Bu məhsulu silmək istədiyinizə əminsiniz?',
      onConfirm: () => {
        deleteProduct(id);
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      },
      isAlert: false
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
        await Promise.all([loadMenuData(), loadTables(), loadOrders(), loadAlerts()]);
      } catch (err) {
        console.error('Admin data load error:', err);
        setLoadError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loadMenuData, loadTables, loadOrders, loadAlerts, isAdminAuthenticated, restaurantResolved, profile]);

  useEffect(() => {
    let prodSub, catSub, tableSub, orderSub;
    const start = async () => {
      try {
        prodSub = await subscribeProducts(() => {
          loadMenuData();
        });

        catSub = await subscribeCategories(() => {
          loadMenuData();
        });

        tableSub = await subscribeTables(() => {
          loadTables();
        });

        orderSub = await subscribeOrders(({ event }) => {
          loadOrders();
        });
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
    };
  }, [loadMenuData, loadTables, loadOrders]);

  if (!isMounted) return null;

  if (authChecking) {
    return <PageSkeleton />;
  }

  // Role-based routing: this screen is only for restaurant_admin. Other
  // roles get sent to (or told about) where they actually belong.
  if (isAdminAuthenticated && profile) {
    if (profile.role === 'super_admin') {
      return (
        <RoleRedirect
          message="Bu hesab super admin hesabıdır — restoran admin panelinə deyil, platforma panelinə yönləndirilir."
          href="/superadmin"
        />
      );
    }
    if (profile.role === 'staff') {
      return (
        <RoleRedirect
          message="Bu hesab işçi (staff) hesabıdır — sifariş idarəetmə panelinə yönləndirilir."
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
    return <PageSkeleton />;
  }

  if (isAdminAuthenticated && loadError) {
    return <ErrorState title="Yükləmə xətası" description={loadError} onRetry={() => window.location.reload()} />;
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
    return <RoleRedirect message="Sessiya bitib — giriş səhifəsinə yönləndirilir." href="/login?next=/admin" />;
  }

  if (restaurant && isAccessBlocked(restaurant)) {
    return <SubscriptionLockedScreen restaurant={restaurant} onLogout={handleLogout} />;
  }

  const trialDaysLeft = restaurant ? getTrialDaysLeft(restaurant) : null;
  const showTrialBanner = restaurant?.subscription_status === 'trialing' && trialDaysLeft !== null && trialDaysLeft <= 5 && trialDaysLeft >= 0;

  const NAV_ITEMS = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
    { key: 'products', label: 'Menyu', icon: <UtensilsCrossed /> },
    { key: 'categories', label: 'Kateqoriya', icon: <Grid /> },
    { key: 'tables', label: 'Masalar', icon: <Table2 /> },
    { key: 'qrcodes', label: 'QR', icon: <QrCode /> },
    { key: 'orders', label: 'Sifarişlər', icon: <ListOrdered /> },
    { key: 'reports', label: 'Hesabat', icon: <FileBarChart2 /> },
    { key: 'promotions', label: 'Kampaniyalar', icon: <Megaphone /> },
    { key: 'design', label: 'Dizayn', icon: <Palette /> },
    { key: 'audit', label: 'Audit Log', icon: <ClipboardList /> },
    { key: 'users', label: 'İstifadəçilər', icon: <Users /> },
    { key: 'settings', label: 'Parametrlər', icon: <Settings /> },
  ];

  const PAGE_TITLES = {
    dashboard: 'Dashboard',
    products: 'Menyu İdarəetməsi',
    categories: 'Kateqoriya İdarəetməsi',
    tables: 'Masalar',
    qrcodes: 'QR Kod Generatoru',
    orders: 'Sifarişlər',
    reports: 'Hesabat',
    promotions: 'Kampaniyalar və Endirimlər',
    design: 'Dizayn (Theme Builder)',
    audit: 'Audit Log',
    users: 'İstifadəçilər',
    settings: 'Restoran Tənzimləmələri (Branding)',
  };

  return (
    <div className="min-h-screen bg-[#f3f4f8] text-slate-900 font-sans flex">

      {/* Sidebar */}
      <div className="hidden md:flex md:w-[280px] shrink-0 bg-white border-r border-slate-200 flex-col h-screen sticky top-0">
        <div className="flex items-center gap-3 px-6 h-20 border-b border-slate-100">
          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm shadow-blue-600/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-900 leading-tight">{settings.restaurantName || "MenuFlow"}</h2>
            <span className="text-[11px] text-slate-400 font-semibold">Admin Paneli</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {NAV_ITEMS.map(item => (
            <SidebarBtn
              key={item.key}
              icon={item.icon}
              label={item.label}
              active={activeTab === item.key}
              onClick={() => setActiveTab(item.key)}
            />
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 space-y-2">
          <Link href="/" className="w-full flex items-center justify-center gap-2 py-2.5 text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 rounded-xl font-bold transition-all text-xs">
            <QrCode className="w-4 h-4" />
            <span>Müştəri Menyusuna Keç</span>
          </Link>
          <button onClick={handleLogout} className="w-full py-2.5 text-slate-500 hover:text-white bg-slate-100 hover:bg-slate-800 rounded-xl font-bold transition-colors text-xs">
            Çıxış et
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Topbar */}
        <div className="h-20 shrink-0 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-10">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 min-w-0">
            <span className="truncate">Admin</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="text-slate-900 truncate">{PAGE_TITLES[activeTab]}</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            <div className="hidden lg:flex items-center gap-2 bg-slate-100 rounded-xl px-3.5 py-2.5 w-64">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Axtar..."
                className="bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400 w-full"
              />
            </div>
            <button className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500">
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-rose-500 border border-white" />
            </button>
            <div className="flex items-center gap-2.5 pl-3 sm:border-l border-slate-200">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                {(settings.restaurantName || 'M').charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-sm font-bold text-slate-900">{settings.restaurantName || 'MenuFlow'}</p>
                <p className="text-[11px] text-slate-400 font-semibold">Admin</p>
              </div>
            </div>
          </div>
        </div>

        {showTrialBanner && (
          <div className="mx-4 sm:mx-8 mt-4 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3">
            <p className="text-amber-700 text-sm font-bold">
              {trialDaysLeft === 0 ? 'Pulsuz sınaq bu gün bitir.' : `Pulsuz sınaq ${trialDaysLeft} gün sonra bitir.`}
            </p>
            <a href="https://wa.me/994000000000" target="_blank" rel="noreferrer" className="whitespace-nowrap text-xs font-bold bg-amber-500 hover:bg-amber-400 text-white px-4 py-1.5 rounded-lg transition-colors">
              Abunəliyə keç
            </a>
          </div>
        )}

        {(activeTab === 'products' || activeTab === 'categories') && (
          <div className="px-4 sm:px-8 pt-6 flex items-center justify-end gap-3">
            <button
              onClick={() => activeTab === 'categories' ? handleOpenCategoryModal() : handleOpenProductModal()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              {activeTab === 'products' ? 'Yeni Məhsul' : 'Yeni Kateqoriya'}
            </button>
            <RealtimeStatusBadge />
          </div>
        )}

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
          {activeTab === 'orders' && (
            <OrdersManagement orders={orders} tables={tables} currencySymbol={settings.currencySymbol} />
          )}

          {/* Hesabat */}
          {activeTab === 'reports' && (
            <AnalyticsDashboard orders={orders} tables={tables} />
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

          {/* İstifadəçilər */}
          {activeTab === 'users' && (
            <UsersPlaceholder profile={profile} restaurant={restaurant} settings={settings} />
          )}

          {['settings', 'products', 'categories', 'qrcodes'].includes(activeTab) && (
          <div className="bg-[#0b0f1a] border border-slate-800 rounded-[22px] p-6 shadow-sm text-white">
            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <SettingsTab settings={settings} updateSettings={updateSettings} />
            )}

            {/* Products CRUD Demo */}
            {activeTab === 'products' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {products.length > 0 ? products.map(product => (
                  <div key={product.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-800 shrink-0">
                      <Image
                        src={product.image?.trim() || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        width={160}
                        height={160}
                        unoptimized
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-bold text-sm truncate">{product.name}</h4>
                      <p className="text-blue-400 font-bold text-sm">{product.price} {settings.currencySymbol || '₼'}</p>
                      <div className="flex gap-2 mt-1">
                        {product.isPopular && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">Populyar</span>}
                        {product.isChefChoice && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold">Şefin Seçimi</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => handleOpenProductModal(product)}
                        className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )) : (
                  <EmptyState
                    title="Məhsul tapılmadı"
                    description="Hal-hazırda heç bir məhsul mövcud deyil. Yeni məhsul əlavə etmək üçün yuxarıdakı düymədən istifadə edin."
                  />
                )}
              </div>
            )}

            {/* Categories Demo */}
            {activeTab === 'categories' && (
              <div className="space-y-3">
                {categories.length > 0 ? categories.map(category => (
                  <div key={category.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
                    <div className="flex items-center gap-4">
                      <span className="text-3xl bg-slate-800 p-3 rounded-xl">{category.icon}</span>
                      <span className="text-white font-bold text-lg">{category.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleOpenCategoryModal(category)}
                        className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCategory(category.id)}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )) : null}
              </div>
            )}

            {/* QR Codes Demo */}
            {activeTab === 'qrcodes' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between print:hidden">
                  <p className="text-slate-400 text-sm">Masalar üçün QR kodları buradan redaktə edib, çap edə bilərsiniz.</p>
                  <button 
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Hamısını PDF Kimi Çap Et
                  </button>
                </div>
                
                <style dangerouslySetInnerHTML={{__html: `
                  @media print {
                    body * { visibility: hidden; }
                    #print-qr-area, #print-qr-area * { visibility: visible; }
                    #print-qr-area { position: absolute; left: 0; top: 0; width: 100%; display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
                    .print\\:hidden { display: none !important; }
                  }
                `}} />

                <div className="min-h-[360px]">
                  {tables.length > 0 ? (
                    <div id="print-qr-area" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {tables.map(table => {
                        const tableUrl = `${origin}/menu/${encodeURIComponent(restaurant?.slug || 'default')}/${encodeURIComponent(table.table_number || table.id)}`;
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
                                  >Yadda saxla</button>
                                  <button 
                                    onClick={() => setEditingTableId(null)}
                                    className="flex-1 bg-slate-300 text-slate-700 text-xs font-bold py-1.5 rounded-lg"
                                  >Ləğv et</button>
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
                                    title="Adı Dəyiş"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleDownloadQR(table)}
                                    className="p-2 bg-slate-100 text-slate-600 hover:text-emerald-600 rounded-lg transition-colors"
                                    title="PNG Yüklə"
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
                  ) : (
                    <EmptyState
                      icon={<QrCode className="w-8 h-8 text-blue-400" />}
                      title="QR kod tapılmadı"
                      description="Masa qeydləri tapılmadı. Masalar yaratdıqdan sonra QR kodlar burada görünəcək."
                    />
                  )}
                </div>
              </div>
            )}
          </div>
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
      />

      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
        productForm={productForm}
        setProductForm={setProductForm}
        isEditing={!!editingProductId}
        categories={categories}
      />

      <ConfirmModal 
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        isAlert={confirmState.isAlert}
      />
    </div>
  );
}

// Variantlar (məs. Ölçü: Kiçik/Orta/Böyük) və Əlavələr (məs. Göbələk, Pendir,
// Zeytun) qrupları. Hər seçimin əlavə qiyməti var — səbətdə/checkout-da
// qiymət avtomatik hesablanır (bax: ProductDetailModal.jsx).
function ProductOptionsEditor({ options, onChange }) {
  const addGroup = () => onChange([...options, { title: '', choices: [{ name: '', extraPrice: 0 }] }]);
  const removeGroup = (gi) => onChange(options.filter((_, i) => i !== gi));
  const updateGroupTitle = (gi, title) => onChange(options.map((g, i) => (i === gi ? { ...g, title } : g)));
  const addChoice = (gi) => onChange(options.map((g, i) => (i === gi ? { ...g, choices: [...g.choices, { name: '', extraPrice: 0 }] } : g)));
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
    <div className="border-t border-slate-800 pt-4">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-bold text-slate-400">Variantlar / Əlavələr (Ölçü, Toppinqlər...)</label>
        <button type="button" onClick={addGroup} className="text-xs font-bold text-blue-400 hover:text-blue-300">+ Qrup əlavə et</button>
      </div>
      {options.length === 0 && (
        <p className="text-xs text-slate-500 mb-2">Məs: &quot;Ölçü&quot; qrupu → Kiçik / Orta / Böyük. Hər seçimin əlavə qiyməti checkout-da avtomatik cəmlənir.</p>
      )}
      <div className="space-y-3">
        {options.map((group, gi) => (
          <div key={gi} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={group.title}
                onChange={(e) => updateGroupTitle(gi, e.target.value)}
                placeholder="Qrup adı (məs: Ölçü, Əlavələr)"
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <button type="button" onClick={() => removeGroup(gi)} className="text-rose-400 hover:text-rose-300 p-1"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1.5">
              {group.choices.map((choice, ci) => (
                <div key={ci} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={choice.name}
                    onChange={(e) => updateChoice(gi, ci, 'name', e.target.value)}
                    placeholder="Seçim (məs: Böyük, Göbələk)"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={choice.extraPrice}
                    onChange={(e) => updateChoice(gi, ci, 'extraPrice', e.target.value)}
                    placeholder="+₼"
                    className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                  <button type="button" onClick={() => removeChoice(gi, ci)} className="text-slate-500 hover:text-rose-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button type="button" onClick={() => addChoice(gi)} className="text-xs font-bold text-slate-400 hover:text-white">+ Seçim əlavə et</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductModal({ isOpen, onClose, onSave, productForm, setProductForm, isEditing, categories }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto no-scrollbar">
        <h2 className="text-2xl font-serif-title font-bold text-white mb-6">
          {isEditing ? 'Məhsulu Redaktə Et' : 'Yeni Məhsul'}
        </h2>
        
        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">Məhsul Adı</label>
            <input 
              type="text" 
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              placeholder="Məsələn: Pepperoni Pizza"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-1">Kateqoriya</label>
              <select 
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                required
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-1">Qiymət (₼)</label>
              <input 
                type="number" 
                step="0.01"
                value={productForm.price}
                onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                placeholder="Məsələn: 12.50"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">Şəkil URL (İstəyə bağlı)</label>
            <input 
              type="text" 
              value={productForm.image}
              onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
              placeholder="https://... şəkil linki"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">Təsvir</label>
            <textarea 
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              placeholder="Məhsul haqqında məlumat..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>
          
          {/* Variantlar (Ölçü, Əlavələr və s.) — qiymət avtomatik hesablanır */}
          <ProductOptionsEditor
            options={productForm.options || []}
            onChange={(options) => setProductForm({ ...productForm, options })}
          />

          {/* Tags / Badges */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={productForm.isPopular || false} 
                onChange={(e) => setProductForm({ ...productForm, isPopular: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-950 accent-amber-500"
              />
              <span className="text-sm font-bold text-slate-300">⭐ Populyar</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={productForm.isChefChoice || false} 
                onChange={(e) => setProductForm({ ...productForm, isChefChoice: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-950 accent-blue-500"
              />
              <span className="text-sm font-bold text-slate-300">👨‍🍳 Şefin Seçimi</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={productForm.isSpicy || false} 
                onChange={(e) => setProductForm({ ...productForm, isSpicy: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500 focus:ring-offset-slate-950 accent-rose-500"
              />
              <span className="text-sm font-bold text-slate-300">🌶️ Acılı</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={productForm.isVegetarian || false} 
                onChange={(e) => setProductForm({ ...productForm, isVegetarian: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-950 accent-emerald-500"
              />
              <span className="text-sm font-bold text-slate-300">🥗 Veqetarian</span>
            </label>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
            >
              Ləğv et
            </button>
            <button 
              type="submit" 
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors"
            >
              Yadda saxla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryModal({ isOpen, onClose, onSave, categoryForm, setCategoryForm, isEditing }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-xl">
        <h2 className="text-2xl font-serif-title font-bold text-white mb-6">
          {isEditing ? 'Kateqoriyanı Redaktə Et' : 'Yeni Kateqoriya'}
        </h2>
        
        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">Kateqoriya Adı</label>
            <input 
              type="text" 
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              placeholder="Məsələn: İsti İçkilər"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">İkon (Emoji)</label>
            <input 
              type="text" 
              value={categoryForm.icon}
              onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
              placeholder="Məsələn: ☕"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>
          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
            >
              Ləğv et
            </button>
            <button 
              type="submit" 
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors"
            >
              Yadda saxla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, isAlert }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-xl text-center">
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-slate-400 mb-6 text-sm">{message}</p>
        
        <div className="flex gap-3">
          {!isAlert && (
            <button 
              onClick={onCancel}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
            >
              Ləğv et
            </button>
          )}
          <button 
            onClick={isAlert ? onCancel : onConfirm}
            className={`flex-1 py-3 text-white rounded-xl font-bold transition-colors ${
              isAlert ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {isAlert ? 'Tamam' : 'Bəli, Sil'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SidebarBtn({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
        active ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      <span className={active ? 'text-white' : 'text-slate-400'}>{React.cloneElement(icon, { className: 'w-[18px] h-[18px]' })}</span>
      {label}
    </button>
  );
}

function StatCard({ label, value, change }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-end justify-between">
        <h4 className="text-2xl font-bold text-white">{value}</h4>
        <span className="text-emerald-400 text-xs font-bold">{change}</span>
      </div>
    </div>
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
        const t = tables.find(tb => tb.id === id);
        return { name: t ? t.name : `Masa ${id}`, value: rev };
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
      const daysOfWeek = ['Bazar', 'B.E', 'Ç.A', 'Ç', 'C.A', 'C', 'Ş'];
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
  }, [orders, tables, timeFilter]);

  const recentOrders = useMemo(() => {
    return [...orders].reverse().slice(0, 5).map(o => {
      const table = tables.find(t => t.id === o.table);
      return { ...o, tableName: table ? table.name : `Masa ${o.table}` };
    });
  }, [orders, tables]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 p-1 bg-slate-900/50 border border-slate-800 rounded-xl w-fit">
        <button 
          onClick={() => setTimeFilter('day')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeFilter === 'day' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Bugün
        </button>
        <button 
          onClick={() => setTimeFilter('week')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeFilter === 'week' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Bu Həftə
        </button>
        <button 
          onClick={() => setTimeFilter('month')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeFilter === 'month' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Bu Ay
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={timeFilter === 'day' ? "Günlük Gəlir" : timeFilter === 'week' ? "Həftəlik Gəlir" : "Aylıq Gəlir"} value={`${stats.revenue.toFixed(2)} ₼`} icon={<TrendingUp className="text-emerald-400" />} />
        <StatCard label={timeFilter === 'day' ? "Bugünkü Sifariş" : timeFilter === 'week' ? "Həftəlik Sifariş" : "Aylıq Sifariş"} value={stats.count} icon={<Activity className="text-blue-400" />} />
        <StatCard label="Orta Hesab (AOV)" value={`${stats.aov.toFixed(2)} ₼`} icon={<BarChart3 className="text-purple-400" />} />
        <StatCard label="Aktiv Masalar" value={stats.activeTables} icon={<Users className="text-amber-400" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
          <h4 className="text-white font-bold mb-6 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-400"/> {timeFilter === 'day' ? 'Saatlıq' : timeFilter === 'week' ? 'Həftəlik' : 'Aylıq'} Sifariş Dinamikası</h4>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₼${val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f8fafc' }}
                  itemStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                />
                <Bar dataKey="sales" name="Satış (₼)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
          <h4 className="text-white font-bold mb-6 flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-amber-400"/> Gəlir Paylanması (Masalar)</h4>
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
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">Məlumat yoxdur</div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {stats.topTables.map((t, i) => (
              <div key={i} className="flex justify-between items-center text-xs font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-slate-300">{t.name}</span>
                </div>
                <span className="text-white">{t.value.toFixed(2)} ₼</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
          <h4 className="text-white font-bold mb-6 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-400"/> Ən Çox Satılanlar (Top 5)</h4>
          <div className="space-y-4">
            {stats.topDishes.length > 0 ? stats.topDishes.map((dish, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-200">{i + 1}. {dish.name}</span>
                  <span className="text-emerald-400">{dish.count} ədəd</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div 
                    className="bg-emerald-500 h-2 rounded-full" 
                    style={{ width: `${Math.max(5, (dish.count / (stats.totalItemsSold || 1)) * 100)}%` }} 
                  />
                </div>
              </div>
            )) : (
              <EmptyState
                icon={<TrendingUp className="w-8 h-8 text-emerald-400" />}
                title="Satış hələ yoxdur"
                description="Uğurlu sifarişlər hələ olmadığı üçün ən çox satılan məhsullar görünmür."
              />
            )}
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 flex flex-col">
          <h4 className="text-white font-bold mb-6 flex items-center gap-2"><Clock className="w-5 h-5 text-purple-400"/> Son Sifarişlər (Live Feed)</h4>
          <div className="space-y-3 flex-1 overflow-y-auto pr-2 no-scrollbar">
            {recentOrders.length > 0 ? recentOrders.map(order => (
              <div key={order.id} className="bg-slate-950/50 border border-slate-800/80 p-3 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold text-sm">{order.tableName}</span>
                    <span className="text-slate-500 text-[10px]">{new Date(order.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <span className="text-slate-400 text-xs font-semibold">{order.items.length} məhsul</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-blue-400 font-bold text-sm">{order.total ? order.total.toFixed(2) : "0.00"} ₼</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    order.status === ORDER_STATUS.SERVED || order.status === ORDER_STATUS.READY ? 'bg-emerald-500/20 text-emerald-400' :
                    order.status === ORDER_STATUS.PREPARING || order.status === ORDER_STATUS.ACCEPTED ? 'bg-blue-500/20 text-blue-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    {order.status === ORDER_STATUS.SERVED ? 'Xidmət edildi' :
                      order.status === ORDER_STATUS.READY ? 'Hazırdır' :
                      order.status === ORDER_STATUS.PREPARING ? 'Hazırlanır' :
                      order.status === ORDER_STATUS.ACCEPTED ? 'Qəbul edildi' :
                      order.status === ORDER_STATUS.CANCELLED ? 'Ləğv edildi' : 'Gözləyir'}
                  </span>
                </div>
              </div>
            )) : (
              <EmptyState
                icon={<Clock className="w-8 h-8 text-purple-400" />}
                title="Son sifariş yoxdur"
                description="Heç bir son sifariş tapılmadı. Sifarişlər qəbul edildikcə burada canlı feed görünəcək."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Status label / color helpers shared by the new light-themed views
const ORDER_STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: 'Gözləyir',
  [ORDER_STATUS.ACCEPTED]: 'Qəbul edildi',
  [ORDER_STATUS.PREPARING]: 'Hazırlanır',
  [ORDER_STATUS.READY]: 'Hazırdır',
  [ORDER_STATUS.SERVED]: 'Xidmət edildi',
  [ORDER_STATUS.CANCELLED]: 'Ləğv edildi',
};

function statusBadgeClasses(status) {
  if (status === ORDER_STATUS.SERVED || status === ORDER_STATUS.READY) return 'bg-emerald-50 text-emerald-600';
  if (status === ORDER_STATUS.PREPARING || status === ORDER_STATUS.ACCEPTED) return 'bg-blue-50 text-blue-600';
  if (status === ORDER_STATUS.CANCELLED) return 'bg-rose-50 text-rose-600';
  return 'bg-amber-50 text-amber-600';
}

// Light "soft" KPI card used across the new Dashboard — 22px radius, soft shadow.
function KpiCard({ label, value, icon, tint }) {
  return (
    <div className="bg-white rounded-[22px] p-5 shadow-[0_2px_16px_rgba(15,23,42,0.06)] border border-slate-100 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${tint}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-1 truncate">{label}</p>
        <h4 className="text-xl font-bold text-slate-900 truncate">{value}</h4>
      </div>
    </div>
  );
}

// Dashboard — the new "analytics hub" home page.
function DashboardHome({ orders, tables, products, categories, currencySymbol }) {
  const symbol = currencySymbol || '₼';

  const stats = useMemo(() => {
    const now = new Date();
    const today = orders.filter(o => new Date(o.time).toDateString() === now.toDateString());
    const todayRevenue = today.reduce((sum, o) => sum + (o.total || 0), 0);
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
      const dayOrders = orders.filter(o => new Date(o.time).toDateString() === d.toDateString());
      return {
        label: d.toLocaleDateString('az-AZ', { weekday: 'short' }),
        revenue: dayOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      };
    });

    // Category split (by items sold) for the donut chart
    const categoryCounts = {};
    orders.forEach(o => {
      o.items.forEach(item => {
        const catId = item.product.category;
        const cat = categories.find(c => c.id === catId);
        const name = cat ? cat.name : 'Digər';
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
  }, [orders, categories]);

  const recentOrders = useMemo(() => {
    return [...orders].reverse().slice(0, 8).map(o => {
      const table = tables.find(t => t.id === o.table);
      return { ...o, tableName: table ? table.name : `Masa ${o.table}` };
    });
  }, [orders, tables]);

  const DONUT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Ümumi Sifariş" value={orders.length} icon={<ListOrdered className="w-5 h-5 text-blue-600" />} tint="bg-blue-50" />
        <KpiCard label="Bugünkü Gəlir" value={`${stats.todayRevenue.toFixed(2)} ${symbol}`} icon={<DollarSign className="w-5 h-5 text-emerald-600" />} tint="bg-emerald-50" />
        <KpiCard label="Aktiv Masa" value={stats.activeTables} icon={<Table2 className="w-5 h-5 text-amber-600" />} tint="bg-amber-50" />
        <KpiCard label="Məhsul Sayı" value={products.length} icon={<Package className="w-5 h-5 text-purple-600" />} tint="bg-purple-50" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[22px] p-6 shadow-[0_2px_16px_rgba(15,23,42,0.06)] border border-slate-100">
          <h4 className="text-slate-900 font-bold mb-6 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-600" /> Gəlir (son 7 gün)</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.revenueByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f6" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${symbol}${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 4px 20px rgba(15,23,42,0.08)' }}
                  formatter={(value) => [`${Number(value).toFixed(2)} ${symbol}`, 'Gəlir']}
                />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-[22px] p-6 shadow-[0_2px_16px_rgba(15,23,42,0.06)] border border-slate-100">
          <h4 className="text-slate-900 font-bold mb-4 flex items-center gap-2"><PieChartIcon className="w-4 h-4 text-amber-600" /> Kateqoriyalar</h4>
          <div className="h-48">
            {stats.categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={78} paddingAngle={4} dataKey="value" stroke="none">
                    {stats.categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">Məlumat yoxdur</div>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            {stats.categoryData.map((c, i) => (
              <div key={i} className="flex justify-between items-center text-xs font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <span className="text-slate-600">{c.name}</span>
                </div>
                <span className="text-slate-900">{c.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[22px] p-6 shadow-[0_2px_16px_rgba(15,23,42,0.06)] border border-slate-100">
        <h4 className="text-slate-900 font-bold mb-6 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-600" /> Ən Çox Satılan</h4>
        <div className="h-64">
          {stats.bestSellers.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.bestSellers} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f6" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} interval={0} tick={{ width: 100 }} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }} formatter={(v) => [`${v} ədəd`, 'Satış']} />
                <Bar dataKey="count" name="Satış" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">Hələ satış yoxdur</div>
          )}
        </div>
      </div>

      {/* Premium Table — Son Sifarişlər */}
      <div className="bg-white rounded-[22px] shadow-[0_2px_16px_rgba(15,23,42,0.06)] border border-slate-100 overflow-hidden">
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <h4 className="text-slate-900 font-bold flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /> Son Sifarişlər</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 text-xs font-bold uppercase tracking-wide">
                <th className="px-6 py-3 font-bold">Masa</th>
                <th className="px-6 py-3 font-bold">Vaxt</th>
                <th className="px-6 py-3 font-bold">Məhsul</th>
                <th className="px-6 py-3 font-bold">Məbləğ</th>
                <th className="px-6 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length > 0 ? recentOrders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3.5"><span className="rounded-xl bg-slate-50 px-3 py-1.5 font-bold text-slate-800 inline-block">{order.tableName}</span></td>
                  <td className="px-6 py-3.5 text-slate-500">{new Date(order.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-6 py-3.5 text-slate-600">{order.items.length} məhsul</td>
                  <td className="px-6 py-3.5 font-bold text-slate-900">{order.total ? order.total.toFixed(2) : '0.00'} {symbol}</td>
                  <td className="px-6 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${statusBadgeClasses(order.status)}`}>
                      {ORDER_STATUS_LABELS[order.status] || 'Gözləyir'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm">Hələ sifariş yoxdur</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Masalar — table management: rename tables, see live status.
function TablesManagement({ tables, orders, editingTableId, editingTableName, setEditingTableId, setEditingTableName, updateTableName }) {
  const tableStatus = (tableId) => {
    const active = orders.find(o => o.table === tableId && o.status !== ORDER_STATUS.SERVED && o.status !== ORDER_STATUS.CANCELLED);
    return active ? active.status : null;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tables.length > 0 ? tables.map(table => {
        const status = tableStatus(table.id);
        return (
          <div key={table.id} className="bg-white rounded-[22px] p-5 shadow-[0_2px_16px_rgba(15,23,42,0.06)] border border-slate-100">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Table2 className="w-5 h-5" />
              </div>
              <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${status ? statusBadgeClasses(status) : 'bg-slate-50 text-slate-400'}`}>
                {status ? ORDER_STATUS_LABELS[status] : 'Boş'}
              </span>
            </div>
            {editingTableId === table.id ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={editingTableName}
                  onChange={(e) => setEditingTableName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-bold text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { updateTableName(table.id, editingTableName); setEditingTableId(null); }}
                    className="flex-1 bg-blue-600 text-white text-xs font-bold py-1.5 rounded-lg"
                  >Yadda saxla</button>
                  <button onClick={() => setEditingTableId(null)} className="flex-1 bg-slate-100 text-slate-600 text-xs font-bold py-1.5 rounded-lg">Ləğv et</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{table.name}</span>
                <button
                  onClick={() => { setEditingTableId(table.id); setEditingTableName(table.name); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Adı Dəyiş"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      }) : (
        <EmptyState icon={<Table2 className="w-8 h-8 text-blue-400" />} title="Masa tapılmadı" description="Hələ heç bir masa qeydə alınmayıb." />
      )}
    </div>
  );
}

// Sifarişlər — full order list.
function OrdersManagement({ orders, tables, currencySymbol }) {
  const symbol = currencySymbol || '₼';
  const sorted = useMemo(() => {
    return [...orders].reverse().map(o => {
      const table = tables.find(t => t.id === o.table);
      return { ...o, tableName: table ? table.name : `Masa ${o.table}` };
    });
  }, [orders, tables]);

  return (
    <div className="bg-white rounded-[22px] shadow-[0_2px_16px_rgba(15,23,42,0.06)] border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 text-xs font-bold uppercase tracking-wide">
              <th className="px-6 py-3.5 font-bold">Masa</th>
              <th className="px-6 py-3.5 font-bold">Tarix</th>
              <th className="px-6 py-3.5 font-bold">Məhsul</th>
              <th className="px-6 py-3.5 font-bold">Məbləğ</th>
              <th className="px-6 py-3.5 font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length > 0 ? sorted.map(order => (
              <tr key={order.id} className="hover:bg-slate-50 transition-colors border-t border-slate-50">
                <td className="px-6 py-3.5"><span className="rounded-xl bg-slate-50 px-3 py-1.5 font-bold text-slate-800 inline-block">{order.tableName}</span></td>
                <td className="px-6 py-3.5 text-slate-500">{new Date(order.time).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-6 py-3.5 text-slate-600">{order.items.length} məhsul</td>
                <td className="px-6 py-3.5 font-bold text-slate-900">{order.total ? order.total.toFixed(2) : '0.00'} {symbol}</td>
                <td className="px-6 py-3.5">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${statusBadgeClasses(order.status)}`}>
                    {ORDER_STATUS_LABELS[order.status] || 'Gözləyir'}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm">Hələ sifariş yoxdur</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// İstifadəçilər — placeholder until multi-user/staff-role management ships.
function UsersPlaceholder({ profile, restaurant, settings }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-[22px] p-5 shadow-[0_2px_16px_rgba(15,23,42,0.06)] border border-slate-100 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold">
          {(settings.restaurantName || 'M').charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-slate-900">{profile?.email || settings.restaurantName}</p>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Restoran Admini</p>
        </div>
      </div>
      <EmptyState
        icon={<UserCircle2 className="w-8 h-8 text-blue-400" />}
        title="İstifadəçi idarəetməsi tezliklə"
        description="Hazırda panelə tək bir admin hesabı ilə giriş mümkündür. Komanda üzvləri və rollar üçün istifadəçi idarəetməsi yaxın zamanda əlavə olunacaq."
      />
    </div>
  );
}

function SubscriptionLockedScreen({ restaurant, onLogout }) {
  const expired = restaurant?.subscription_status === 'trialing';
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="max-w-sm text-center bg-slate-950/60 p-8 rounded-3xl border border-slate-800">
        <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/30 mx-auto mb-4">
          <Lock className="w-7 h-7 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {expired ? 'Pulsuz sınaq bitib' : 'Abunəlik dayandırılıb'}
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          {expired
            ? `"${restaurant.name}" üçün 14 günlük pulsuz sınaq müddəti bitib. Davam etmək üçün abunəliyə keçin.`
            : `"${restaurant.name}" üçün abunəlik ödənişi gecikib. Panelə yenidən giriş üçün ödənişi tamamlayın.`}
        </p>
        <div className="flex flex-col gap-2">
          <a href="https://wa.me/994000000000" target="_blank" rel="noreferrer" className="py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-bold text-sm">
            Abunəliyə keç
          </a>
          <button onClick={onLogout} className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm">
            Çıxış et
          </button>
        </div>
      </div>
    </div>
  );
}

function PieChartIcon({ className }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
}

function RoleRedirect({ message, href }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace(href), 600);
    return () => clearTimeout(t);
  }, [router, href]);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="max-w-sm text-center">
        <p className="text-slate-400 text-sm mb-4">{message}</p>
        <Link href={href} className="text-blue-400 hover:text-blue-300 text-sm font-bold underline">
          Avtomatik yönləndirilmirsə buraya klikləyin
        </Link>
      </div>
    </div>
  );
}

function UnassignedScreen({ onLogout }) {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="max-w-sm text-center bg-slate-950/60 p-8 rounded-3xl border border-slate-800">
        <Lock className="w-10 h-10 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Hesab hələ təyin edilməyib</h2>
        <p className="text-slate-400 text-sm mb-6">
          Hesabınız yaradılıb, lakin hələ heç bir restorana admin kimi təyin edilməyib.
          Platforma administratorundan bu hesabı bir restorana təyin etməsini xahiş edin.
        </p>
        <button onClick={onLogout} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm">
          Çıxış et
        </button>
      </div>
    </div>
  );
}
