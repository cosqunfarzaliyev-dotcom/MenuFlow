"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { Menu, AlertTriangle } from 'lucide-react';
import { supabase, supabaseReady } from '@/lib/supabase';
import { useAppStore, ROLES } from '@/lib/store';
import { fetchRestaurants, fetchRestaurantStats, fetchPlatformUsers } from '@/lib/services/superAdminService';
import { fetchAllPlans, fetchPlanFeatures } from '@/lib/services/planService';
import { PageSkeleton, LanguageSwitcher, Card, Button } from '@/components/ui';
import { buttonVariants } from '@/components/ui/variants';
import { cn } from '@/lib/utils';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';
import { useLocaleSync } from '@/hooks/useLocaleSync';

import { ToastProvider } from '@/components/superadmin/Toast';
import { Sidebar, getTabs } from '@/components/superadmin/Sidebar';
import { DashboardTab } from '@/components/superadmin/DashboardTab';
import { RestaurantsTab } from '@/components/superadmin/RestaurantsTab';
import { PlansTab } from '@/components/superadmin/PlansTab';
import { SubscriptionsTab } from '@/components/superadmin/SubscriptionsTab';
import { AnalyticsTab } from '@/components/superadmin/AnalyticsTab';
import { UsersTab } from '@/components/superadmin/UsersTab';
import { computeMetrics } from '@/components/superadmin/metrics';

export function SuperAdminApp() {
  const { profile, loadProfile, isAdminAuthenticated, setIsAdminAuthenticated, loadPlans } = useAppStore();
  const { t } = useSuperAdminTranslation();
  useLocaleSync(profile?.locale);
  const router = useRouter();

  const [authChecking, setAuthChecking] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [origin, setOrigin] = useState('');

  const [restaurants, setRestaurants] = useState([]);
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  // All plans (active + inactive/legacy) for PlansTab's catalog view — a
  // separate fetch/state from the store's loadPlans() above, which only
  // pulls active plans for entitlement hydration/customer-facing use. A
  // super_admin managing the catalog needs to see (and reactivate) a
  // deactivated plan too.
  const [plans, setPlans] = useState([]);
  const [planFeatures, setPlanFeatures] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openRestaurantId, setOpenRestaurantId] = useState(null);

  useEffect(() => { setIsMounted(true); setOrigin(window.location.origin); }, []);

  useEffect(() => {
    if (!supabaseReady) { setAuthChecking(false); return undefined; }
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
    return () => { active = false; listener?.subscription?.unsubscribe(); };
  }, [setIsAdminAuthenticated, loadProfile]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [list, statMap] = await Promise.all([fetchRestaurants(), fetchRestaurantStats()]);
    setRestaurants(list);
    setStats(statMap);
    setLoading(false);
  }, []);

  const refreshUsers = useCallback(async () => {
    setUsersLoading(true);
    const list = await fetchPlatformUsers();
    setUsers(list);
    setUsersLoading(false);
  }, []);

  const refreshPlans = useCallback(async () => {
    setPlansLoading(true);
    const [plansData, featuresData] = await Promise.all([fetchAllPlans(), fetchPlanFeatures()]);
    setPlans(plansData);
    setPlanFeatures(featuresData);
    setPlansLoading(false);
  }, []);

  useEffect(() => {
    if (isAdminAuthenticated && profile?.role === ROLES.SUPER_ADMIN) {
      refresh();
      refreshUsers();
      refreshPlans();
      // Hydrates entitlementService's PLAN_FEATURE_DEFAULTS from the live
      // plans/plan_features tables — RestaurantsTab.jsx's per-restaurant
      // feature toggles (featureFlags() -> getEntitlements()) read the same
      // resolver, so this keeps that display in sync with the same source
      // /pricing and the customer/admin surfaces use.
      loadPlans();
    }
  }, [isAdminAuthenticated, profile, refresh, refreshUsers, refreshPlans, loadPlans]);

  const handleLogout = async () => {
    if (supabaseReady) await supabase.auth.signOut();
    setIsAdminAuthenticated(false);
    router.replace('/login');
  };

  // A restaurant_admin row per restaurant_id, so the Restaurants table can
  // show an owner email without an extra N+1 query — we already load the
  // platform-wide user directory for the Users tab.
  const restaurantsWithOwner = useMemo(() => {
    const ownerByRestaurant = {};
    for (const u of users) {
      if (u.role === 'restaurant_admin' && u.restaurant_id && !ownerByRestaurant[u.restaurant_id]) {
        ownerByRestaurant[u.restaurant_id] = u.email;
      }
    }
    return restaurants.map((r) => ({ ...r, owner_email: ownerByRestaurant[r.id] || null }));
  }, [restaurants, users]);

  const metrics = useMemo(() => computeMetrics(restaurantsWithOwner, users), [restaurantsWithOwner, users]);

  const goToRestaurant = (r) => {
    setOpenRestaurantId(r.id);
    setActiveTab('restaurants');
  };

  if (!isMounted || authChecking) return <PageSkeleton />;

  if (!isAdminAuthenticated) {
    // middleware.js already redirects unauthenticated requests to /superadmin
    // over to /login before this component mounts; this is a fallback.
    router.replace('/login?next=/superadmin');
    return <PageSkeleton />;
  }

  if (!profile || profile.role !== ROLES.SUPER_ADMIN) {
    return (
      <div className="superadmin-theme min-h-screen bg-[#050505] flex items-center justify-center p-4">
        {/* Card replaces the raw sa-card box — matches the same auth-gate
            treatment already applied to Staff/Admin's no-access screens
            (plain flat surface, not the glass sa-card look, for consistency
            with those screens rather than the rest of SuperAdmin's dashboard
            chrome). sa-heading-4/sa-caption typography kept as-is — only the
            container/buttons were in scope for this pass. */}
        <Card context="dark" variant="flat" className="max-w-sm text-center p-8">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h2 className="sa-heading-4 text-white mb-2">{t('noAccessTitle')}</h2>
          <p className="sa-caption text-slate-400 mb-6">
            {t('noSuperAdminAccess')(profile?.role)}
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/admin" className={cn(buttonVariants({ context: 'dark', variant: 'primary', size: 'block' }))}>{t('goToAdminPanel')}</Link>
            <Button variant="secondary" size="block" onClick={handleLogout}>{t('logoutButton')}</Button>
          </div>
        </Card>
      </div>
    );
  }

  const tabs = getTabs(t);
  const activeMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  return (
    <ToastProvider>
      <div className="superadmin-theme min-h-screen bg-[#050505] text-white font-sans lg:flex">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          restaurantCount={restaurants.length}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onLogout={handleLogout}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-8 py-4 bg-[#050505]/85 backdrop-blur-xl border-b border-slate-800/80">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-slate-800/80 text-slate-300"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="h-8 px-2 bg-amber-500/15 rounded-xl flex items-center justify-center border border-amber-500/25 lg:hidden">
                <Image src="/brand/menuflow-logo-dark-bg-h48.png" alt="MenuFlow" width={72} height={11} className="h-3 w-auto object-contain" unoptimized />
              </div>
              <div>
                <h1 className="sa-heading-4 text-white leading-tight">{activeMeta.label}</h1>
                <p className="sa-caption text-slate-500 hidden sm:block">{restaurants.length} {t('restaurantsRegisteredSuffix')}</p>
              </div>
            </div>
            <div className="ml-auto">
              <LanguageSwitcher context="dark" profile={profile} />
            </div>
          </header>

          <main className="px-4 sm:px-8 py-6 max-w-[1400px]">
            {loading ? (
              <PageSkeleton />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  {activeTab === 'dashboard' && (
                    <DashboardTab restaurants={restaurantsWithOwner} metrics={metrics} onOpenRestaurant={goToRestaurant} />
                  )}
                  {activeTab === 'restaurants' && (
                    <RestaurantsTab
                      restaurants={restaurantsWithOwner}
                      stats={stats}
                      origin={origin}
                      refresh={refresh}
                      openRestaurantId={openRestaurantId}
                      onConsumeOpenId={() => setOpenRestaurantId(null)}
                    />
                  )}
                  {activeTab === 'plans' && (
                    <PlansTab plans={plans} planFeatures={planFeatures} loading={plansLoading} refresh={refreshPlans} />
                  )}
                  {activeTab === 'subscriptions' && <SubscriptionsTab metrics={metrics} />}
                  {activeTab === 'analytics' && <AnalyticsTab metrics={metrics} />}
                  {activeTab === 'users' && <UsersTab users={users} loading={usersLoading} />}
                </motion.div>
              </AnimatePresence>
            )}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

export default SuperAdminApp;
