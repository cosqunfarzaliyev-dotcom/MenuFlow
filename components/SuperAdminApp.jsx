"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { Menu, AlertTriangle } from 'lucide-react';
import { supabase, supabaseReady } from '@/lib/supabase';
import { useAppStore, ROLES } from '@/lib/store';
import { fetchRestaurants, fetchRestaurantStats, fetchPlatformUsers } from '@/lib/services/superAdminService';
import { fetchAllPlans, fetchPlanFeatures } from '@/lib/services/planService';
import { fetchSiteContent, fetchFaqItems } from '@/lib/services/siteContentService';
import { PageSkeleton, LanguageToggle, Card, Button } from '@/components/kit';
import { buttonVariants } from '@/components/kit/variants';
import { cn } from '@/lib/utils';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';
import { useLocaleSync } from '@/hooks/useLocaleSync';

import { ToastProvider } from '@/components/superadmin/Toast';
import { Sidebar, getTabs, MODES, DEFAULT_MODE } from '@/components/superadmin/Sidebar';
import { DashboardTab } from '@/components/superadmin/DashboardTab';
import { RestaurantsTab } from '@/components/superadmin/RestaurantsTab';
import { PlansTab } from '@/components/superadmin/PlansTab';
import { SubscriptionsTab } from '@/components/superadmin/SubscriptionsTab';
import { AnalyticsTab } from '@/components/superadmin/AnalyticsTab';
import { UsersTab } from '@/components/superadmin/UsersTab';
import { SitePagesTab } from '@/components/superadmin/SitePagesTab';
import { SiteContactTab } from '@/components/superadmin/SiteContactTab';
import { SiteFaqTab } from '@/components/superadmin/SiteFaqTab';
import { computeMetrics } from '@/components/superadmin/metrics';

export function SuperAdminApp() {
  const { profile, loadProfile, isAdminAuthenticated, setIsAdminAuthenticated, loadPlans } = useAppStore();
  const { t } = useSuperAdminTranslation();
  useLocaleSync(profile?.locale);
  const router = useRouter();
  const searchParams = useSearchParams();

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

  // Website mode (Phase 4) — supabase/migrations/0032_site_content_cms.sql.
  // Own loading flags, deliberately NOT folded into `loading` above: the
  // top-level skeleton gate only checks `loading` (restaurants) — see the
  // render below — so a slow restaurants fetch must never blank the CMS
  // tabs, and vice versa.
  const [siteContent, setSiteContent] = useState([]);
  const [siteContentLoading, setSiteContentLoading] = useState(true);
  const [faqItems, setFaqItems] = useState([]);
  const [faqLoading, setFaqLoading] = useState(true);

  // Mode + tab are derived from the URL DURING RENDER, not synced via a
  // useState+useEffect pair — that would be a 20th react-hooks/
  // set-state-in-effect violation (CLAUDE.md's lint baseline is pinned at
  // exactly 19) and would also mean the very first render briefly shows the
  // wrong tab before the effect catches up. `router.replace(...,
  // {scroll:false})` below is the only way this ever changes.
  const modeParam = searchParams.get('mode');
  const mode = modeParam === MODES.WEBSITE ? MODES.WEBSITE : DEFAULT_MODE;
  const tabsForMode = getTabs(t, mode);
  const tabParam = searchParams.get('tab');
  const activeTab = tabsForMode.some((tab) => tab.id === tabParam) ? tabParam : tabsForMode[0].id;

  const navigate = useCallback((nextMode, nextTab) => {
    const params = new URLSearchParams();
    if (nextMode !== DEFAULT_MODE) params.set('mode', nextMode);
    const defaultTab = getTabs(t, nextMode)[0].id;
    if (nextTab && nextTab !== defaultTab) params.set('tab', nextTab);
    const qs = params.toString();
    router.replace(qs ? `/superadmin?${qs}` : '/superadmin', { scroll: false });
  }, [router, t]);

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

  // Website mode fetchers — browser `supabase` client (the default both
  // functions fall back to), same as every other SuperAdmin fetch above.
  // fetchFaqItems({publishedOnly:false}) intentionally includes drafts:
  // SiteFaqTab manages every row, not just what's currently live on /faq.
  const refreshSiteContent = useCallback(async () => {
    setSiteContentLoading(true);
    const rows = await fetchSiteContent();
    setSiteContent(rows);
    setSiteContentLoading(false);
  }, []);

  const refreshFaq = useCallback(async () => {
    setFaqLoading(true);
    const rows = await fetchFaqItems(undefined, { publishedOnly: false });
    setFaqItems(rows);
    setFaqLoading(false);
  }, []);

  useEffect(() => {
    if (isAdminAuthenticated && profile?.role === ROLES.SUPER_ADMIN) {
      refresh();
      refreshUsers();
      refreshPlans();
      refreshSiteContent();
      refreshFaq();
      // Hydrates entitlementService's PLAN_FEATURE_DEFAULTS from the live
      // plans/plan_features tables — RestaurantsTab.jsx's per-restaurant
      // feature toggles (featureFlags() -> getEntitlements()) read the same
      // resolver, so this keeps that display in sync with the same source
      // /pricing and the customer/admin surfaces use.
      loadPlans();
    }
  }, [isAdminAuthenticated, profile, refresh, refreshUsers, refreshPlans, refreshSiteContent, refreshFaq, loadPlans]);

  const handleLogout = async () => {
    if (supabaseReady) await supabase.auth.signOut();
    setIsAdminAuthenticated(false);
    // SuperAdmin's own dedicated entry point (app/superadmin-login), not the
    // shared /login — see that page's header comment.
    router.replace('/superadmin-login');
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
    navigate(MODES.RESTAURANTS, 'restaurants');
  };

  if (!isMounted || authChecking) return <PageSkeleton className="kit-dark" />;

  if (!isAdminAuthenticated) {
    // middleware.js already redirects unauthenticated requests to /superadmin
    // over to /superadmin-login before this component mounts; this is a
    // fallback (e.g. a client-side nav that never round-tripped middleware).
    router.replace('/superadmin-login');
    return <PageSkeleton className="kit-dark" />;
  }

  if (!profile || profile.role !== ROLES.SUPER_ADMIN) {
    return (
      <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center p-4">
        <Card variant="plain" className="max-w-sm text-center p-8">
          <AlertTriangle className="w-9 h-9 text-[var(--k-warning)] mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[var(--k-text)] mb-2">{t('noAccessTitle')}</h2>
          <p className="text-[var(--k-text-3)] text-sm mb-6">
            {t('noSuperAdminAccess')(profile?.role)}
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/admin" className={cn(buttonVariants({ variant: 'primary', size: 'block' }))}>{t('goToAdminPanel')}</Link>
            <Button variant="secondary" size="block" onClick={handleLogout}>{t('logoutButton')}</Button>
          </div>
        </Card>
      </div>
    );
  }

  const activeMeta = tabsForMode.find((tab) => tab.id === activeTab) || tabsForMode[0];

  return (
    <ToastProvider>
      <div className="kit-dark min-h-screen bg-[var(--k-bg)] text-[var(--k-text)] font-sans lg:flex">
        <Sidebar
          activeTab={activeTab}
          onTabChange={(nextTab) => navigate(mode, nextTab)}
          mode={mode}
          onModeChange={(nextMode) => navigate(nextMode, getTabs(t, nextMode)[0].id)}
          restaurantCount={restaurants.length}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onLogout={handleLogout}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-8 py-4 bg-[var(--k-bg)]/90 backdrop-blur-xl border-b border-[var(--k-border)]">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-[var(--k-r)] hover:bg-[var(--k-surface-2)] text-[var(--k-text-2)]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="h-8 px-2 bg-[var(--k-warning-soft)] rounded-[var(--k-r)] flex items-center justify-center border border-[color:var(--k-warning)]/25 lg:hidden">
                <Image src="/brand/menuflow-logo-dark-bg-h48.png" alt="MenuFlow" width={72} height={11} className="h-3 w-auto object-contain" unoptimized />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[var(--k-text)] leading-tight">{activeMeta.label}</h1>
                {mode === MODES.RESTAURANTS && (
                  <p className="text-[13px] text-[var(--k-text-3)] hidden sm:block">{restaurants.length} {t('restaurantsRegisteredSuffix')}</p>
                )}
              </div>
            </div>
            <div className="ml-auto">
              <LanguageToggle profile={profile} />
            </div>
          </header>

          <main className="px-4 sm:px-8 py-6 max-w-[1400px]">
            {/* Only the RESTAURANTS-mode tabs depend on `loading` (the
                restaurants fetch) — website-mode tabs have their own
                siteContentLoading/faqLoading flags (passed as props below,
                same pattern PlansTab.jsx already uses for plansLoading) so a
                slow restaurants fetch can never blank the CMS tabs. */}
            {mode === MODES.RESTAURANTS && loading ? (
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
                  {mode === MODES.RESTAURANTS && (
                    <>
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
                    </>
                  )}
                  {mode === MODES.WEBSITE && (
                    <>
                      {activeTab === 'site-pages' && (
                        <SitePagesTab content={siteContent} loading={siteContentLoading} refresh={refreshSiteContent} />
                      )}
                      {activeTab === 'site-contact' && (
                        <SiteContactTab content={siteContent} loading={siteContentLoading} refresh={refreshSiteContent} />
                      )}
                      {activeTab === 'site-faq' && (
                        <SiteFaqTab items={faqItems} loading={faqLoading} refresh={refreshFaq} />
                      )}
                    </>
                  )}
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
