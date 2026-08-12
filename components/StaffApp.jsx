"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore, ORDER_STATUS } from '@/lib/store';
import { supabase, supabaseReady } from '@/lib/supabase';
import { subscribeOrders, subscribeAlerts } from '@/lib/services/realtime';
import { isAccessBlocked, accessBlockReason } from '@/lib/services/billingService';
import { CheckCircle2, Clock, Bell, UserSquare2, UtensilsCrossed, Check, QrCode, Lock, Shield } from 'lucide-react';
import { OrderCard } from '@/components/staff/OrderCard';
import RealtimeStatusBadge from '@/components/RealtimeStatusBadge';
import { LoadingState, ErrorState, EmptyState, PageSkeleton, Tabs, TabsTrigger, LanguageSwitcher, Card, CardHeader, CardBody, Badge, Button, PageHeader, Alert } from '@/components/ui';
import { buttonVariants } from '@/components/ui/variants';
import { cn } from '@/lib/utils';
import { CAPABILITIES } from '@/lib/services/capabilityService';
import { useCapability } from '@/hooks/useCapability';
import { useStaffTranslation } from '@/lib/i18n/dictionaries/staff';
import { useLocaleSync } from '@/hooks/useLocaleSync';

export function StaffApp() {
  const {
    orders,
    updateOrderStatus,
    alerts,
    resolveAlert,
    tables,
    loadOrders,
    loadAlerts,
    loadTables,
    settings: rawSettings,
    restaurant,
    profile,
    loadProfile,
    isAdminAuthenticated,
    setIsAdminAuthenticated,
  } = useAppStore();
  const settings = restaurant ? { restaurantName: restaurant.name } : (rawSettings || { restaurantName: 'MenuFlow' });
  const { t } = useStaffTranslation();
  useLocaleSync(profile?.locale);
  // Formal capability layer (Master Plan Phase 6) — both roles that reach
  // /staff (`staff`, `restaurant_admin`) have orders.manage today (see
  // capabilityService.js), so this doesn't hide anything currently; it
  // exists so a future view-only staff tier is a role-matrix edit, not a
  // StaffApp rewrite.
  const canManageOrders = useCapability(CAPABILITIES.ORDERS_MANAGE);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'alerts'
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [isMounted, setIsMounted] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const router = useRouter();

  const notificationTimeoutRef = useRef(null);

  useEffect(() => { setIsMounted(true); }, []);

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

  const handleLogout = async () => {
    if (supabaseReady) await supabase.auth.signOut();
    setIsAdminAuthenticated(false);
    router.replace('/login');
  };

  const getTableName = useCallback((id) => {
    const table = tables.find(tb => tb.id === id);
    return table ? table.name : t('tableFallbackName')(id);
  }, [tables, t]);

  const playChimeSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.7);
    } catch (e) {
      console.log("Audio play error:", e);
    }
  }, []);

  const triggerNotification = useCallback((msg) => {
    setNotification(msg);
    playChimeSound();
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null);
    }, 5000);
  }, [playChimeSound]);

  const isAuthorizedStaff = Boolean(profile && ['staff', 'restaurant_admin'].includes(profile.role));

  useEffect(() => {
    if (!isAdminAuthenticated || !isAuthorizedStaff) return undefined;
    const setupRealtime = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        await Promise.all([loadOrders(), loadAlerts(), loadTables()]);
      } catch (err) {
        console.error('StaffApp load error', err);
        setLoadError(err?.message || String(err));
      }

      try {
        const restaurantId = profile?.restaurant_id || restaurant?.id || null;

        const orderSub = await subscribeOrders(({ event, table, record }) => {
          // Refresh orders from Supabase; realtime ensures low-latency updates
          loadOrders();
          if (event === 'INSERT') triggerNotification(t('newOrderChime'));
        }, { restaurantId });

        const alertSub = await subscribeAlerts(({ event, table, record }) => {
          loadAlerts();
          // A repeat/edited call re-uses the same row (see upsert_alert),
          // so this fires as an UPDATE, not just an INSERT — re-chime for
          // those too. But skip the chime when the update is staff marking
          // an alert resolved (status -> 'resolved'), which is our own
          // action, not a new customer call.
          if (record?.status && record.status !== 'active') return;
          const alertType = record?.type || record?.alert_type;
          if (alertType === 'bill') {
            triggerNotification(t('billRequestedChime'));
          } else {
            triggerNotification(t('waiterCalledChime'));
          }
        }, { restaurantId });

        setLoading(false);

        return () => {
          if (orderSub && typeof orderSub.unsubscribe === 'function') orderSub.unsubscribe();
          if (alertSub && typeof alertSub.unsubscribe === 'function') alertSub.unsubscribe();
        };
      } catch (err) {
        console.error('Realtime subscribe error:', err);
        setLoading(false);
      }
    };

    let cleanup = null;
    setupRealtime().then((unsubscribe) => {
      cleanup = unsubscribe;
    }).catch((error) => {
      console.error('Realtime setup error:', error);
    });

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [loadOrders, loadAlerts, loadTables, triggerNotification, isAdminAuthenticated, isAuthorizedStaff, t]);


  const pendingOrders = orders.filter(o => o.status === ORDER_STATUS.PENDING);
  const preparingOrders = orders.filter(o => [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING].includes(o.status));
  const finishedOrders = orders.filter(o => [ORDER_STATUS.READY, ORDER_STATUS.SERVED].includes(o.status));

  const activeAlerts = alerts.filter(a => a.status === 'active');

  const handleStatusChange = (id) => {
    const order = orders.find((currentOrder) => currentOrder.id === id);
    const nextStatus = {
      [ORDER_STATUS.PENDING]: ORDER_STATUS.ACCEPTED,
      [ORDER_STATUS.ACCEPTED]: ORDER_STATUS.PREPARING,
      [ORDER_STATUS.PREPARING]: ORDER_STATUS.READY,
      [ORDER_STATUS.READY]: ORDER_STATUS.SERVED,
      [ORDER_STATUS.SERVED]: ORDER_STATUS.CANCELLED,
    }[order?.status];

    if (nextStatus) updateOrderStatus(id, nextStatus);
  };

  if (!isMounted || authChecking) return <PageSkeleton />;

  if (!isAdminAuthenticated) {
    // middleware.js already redirects unauthenticated requests to /staff
    // over to /login before this component mounts; this is a fallback.
    return <RoleRedirectStaff message={t('sessionExpiredRedirect')} href="/login?next=/staff" />;
  }

  if (profile && profile.role === 'super_admin') {
    router.replace('/superadmin');
    return <PageSkeleton />;
  }

  if (profile && !isAuthorizedStaff) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        {/* Card replaces the raw bg-slate-950/60 border-slate-800 box —
            className overrides keep the exact same translucent background
            and rounded-3xl corners Card's own flat variant doesn't default to. */}
        <Card context="dark" variant="flat" className="max-w-sm text-center bg-slate-950/60 p-8 rounded-3xl">
          <Lock className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{t('noAccessTitle')}</h2>
          <p className="text-slate-400 text-sm mb-6">
            {profile.role === 'unassigned'
              ? t('noAccessUnassigned')
              : t('noAccessNotStaff')}
          </p>
          <Button variant="secondary" size="block" onClick={handleLogout}>{t('logoutButton')}</Button>
        </Card>
      </div>
    );
  }

  if (restaurant && isAccessBlocked(restaurant)) {
    const reason = accessBlockReason(restaurant);
    const messages = {
      deactivated: t('lockedDeactivated'),
      trial_expired: t('lockedTrialExpired')(restaurant.name),
      past_due: t('lockedPastDue')(restaurant.name),
      canceled: t('lockedCanceled')(restaurant.name),
    };
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        {/* Card replaces the raw bg-slate-950/60 border-slate-800 box — same
            treatment as the no-access screen above. */}
        <Card context="dark" variant="flat" className="max-w-sm text-center bg-slate-950/60 p-8 rounded-3xl">
          <Lock className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{t('panelLockedTitle')}</h2>
          <p className="text-slate-400 text-sm mb-6">{messages[reason] || messages.canceled}</p>
          <Button variant="secondary" size="block" onClick={handleLogout}>{t('logoutButton')}</Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <LoadingState title={t('panelLoadingTitle')} subtitle={t('panelLoadingSubtitle')} />;
  }

  if (loadError) {
    return <ErrorState title={t('loadErrorTitle')} description={loadError} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 sm:p-8 font-sans">
      
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-6 right-6 z-[100] bg-rose-600 text-white px-6 py-4 rounded-2xl font-bold shadow-[0_10px_40px_rgba(225,29,72,0.4)] flex items-center gap-4 animate-bounce">
          <Bell className="w-6 h-6 animate-pulse" />
          <span className="text-lg tracking-wide">{notification}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header — Card (replaces the old bg-slate-900/50 + border-slate-800
            literal) wrapping PageHeader (title/description/actions), same
            primitives AdminApp already migrated onto. Kept boxed (unlike
            AdminApp's own unboxed PageHeaders) since StaffApp has no sidebar
            chrome and this panel is the page's only "app bar" — preserving
            that visual role, not just its literal classes. */}
        <Card context="dark" variant="flat" className="bg-slate-900/50 p-6">
          <PageHeader
            context="dark"
            title={
              <span className="flex items-center gap-3">
                <UserSquare2 className="w-8 h-8 text-blue-500" />
                {t('panelTitle')}
              </span>
            }
            description={t('panelSubtitle')(settings.restaurantName || "MenuFlow")}
            actions={
              <>
                <LanguageSwitcher context="dark" profile={profile} />
                {/* / is now the public marketing homepage, not the customer
                    menu (see app/page.jsx) — link to this restaurant's own
                    real menu when the slug is known, falling back to the
                    marketing home rather than a dead link while it's still
                    loading. Styled via buttonVariants (same pattern as
                    MarketingHeader's nav links) since a Link can't render the
                    Button primitive itself. */}
                <Link
                  href={restaurant?.slug ? `/menu/${restaurant.slug}` : '/'}
                  className={cn(buttonVariants({ context: 'dark', variant: 'subtle', size: 'sm' }), 'gap-2')}
                >
                  <QrCode className="w-4 h-4" />
                  <span>{t('customerMenuLink')}</span>
                </Link>

                <Button variant="secondary" size="sm" onClick={handleLogout}>
                  {t('logoutShort')}
                </Button>

                <Tabs>
                  <TabsTrigger active={activeTab === 'orders'} onClick={() => setActiveTab('orders')}>
                    {t('ordersTab')(pendingOrders.length)}
                  </TabsTrigger>
                  <TabsTrigger active={activeTab === 'alerts'} accent="warning" onClick={() => setActiveTab('alerts')}>
                    {t('alertsTab')}
                    {activeAlerts.length > 0 && (
                      <Badge tone="warning" className="bg-white text-amber-600 w-5 h-5 px-0 py-0 justify-center text-[10px] font-black">
                        {activeAlerts.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </Tabs>
                <div className="ml-3 hidden md:flex items-center">
                  <RealtimeStatusBadge />
                </div>
              </>
            }
          />
        </Card>

        {/* Content */}
        {/* Orders Tab — PageHeader added above the 3-column grid, same shape
            as the Alerts tab's own PageHeader. The 3 columns stay plain
            divs (NOT wrapped in Card) — each already renders OrderCard,
            which is itself a Card, so boxing the column too would double-box
            every order tile. Only Pending's EmptyState branch was
            restructured (col-span-full hack → the same length ? content :
            EmptyState shape Alerts uses); Preparing/Completed intentionally
            still render nothing when empty — pre-existing behavior, unchanged. */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <PageHeader context="dark" title={t('ordersTab')(pendingOrders.length)} description={t('ordersSubtitle')} />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* Pending */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    {t('pendingTitle')(pendingOrders.length)}
                  </h3>
                </div>
                {pendingOrders.length > 0 ? (
                  <div className="space-y-4">
                    {pendingOrders.map(order => (
                      <OrderCard key={order.id} order={order} tableName={getTableName(order.table)} onStatusChange={handleStatusChange} nextStatus={ORDER_STATUS.ACCEPTED} nextLabel={t('acceptButton')} nextColor="bg-blue-600 hover:bg-blue-500" readOnly={!canManageOrders} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Clock className="w-8 h-8 text-amber-400" />}
                    title={t('noNewOrdersTitle')}
                    description={t('noNewOrdersDescription')}
                  />
                )}
              </div>

              {/* Preparing */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <UtensilsCrossed className="w-5 h-5 text-blue-400" />
                    {t('preparingTitle')(preparingOrders.length)}
                  </h3>
                </div>
                <div className="space-y-4">
                  {preparingOrders.map(order => (
                    <OrderCard key={order.id} order={order} tableName={getTableName(order.table)} onStatusChange={handleStatusChange} nextStatus={ORDER_STATUS.READY} nextLabel={t('readyButton')} nextColor="bg-emerald-600 hover:bg-emerald-500" readOnly={!canManageOrders} />
                  ))}
                </div>
              </div>

              {/* Completed */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    {t('finishedTitle')(finishedOrders.length)}
                  </h3>
                </div>
                <div className="space-y-4">
                  {finishedOrders.slice(0, 10).map(order => (
                    <OrderCard key={order.id} order={order} tableName={getTableName(order.table)} onStatusChange={handleStatusChange} isCompleted={order.status === ORDER_STATUS.SERVED} nextLabel={t('servedButton')} nextColor="bg-emerald-600 hover:bg-emerald-500" readOnly={!canManageOrders} />
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Alerts Tab — PageHeader + conditional grid/EmptyState, same
            branching shape AdminApp's Orders tab already uses (list.length
            ? <grid/table> : <EmptyState/>), replacing the old col-span-full
            wrapper hack that rendered EmptyState *inside* the grid. */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <PageHeader context="dark" title={t('alertsTab')} description={t('alertsSubtitle')} />

            {activeAlerts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeAlerts.map(alert => {
                  const isBill = alert.type === 'bill';
                  const isCash = alert.paymentMethod === 'cash';
                  const isCard = alert.paymentMethod === 'card';
                  const paymentLabel = alert.paymentMethodLabel || (isCash ? t('cashLabel') : isCard ? t('posLabel') : t('cardLabel'));

                  return (
                    <Card key={alert.id} context="dark" variant="flat" className="border-2 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                      <CardHeader className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500 shrink-0">
                          <Bell className="w-6 h-6 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-lg text-white flex items-center gap-2">
                            {getTableName(alert.table)}
                            {alert.callCount > 1 && (
                              <Badge tone="warning" className="bg-amber-500 text-white px-1.5 py-0.5 text-[10px] font-black" title={t('calledTimesTitle')(alert.callCount)}>
                                ×{alert.callCount}
                              </Badge>
                            )}
                          </h4>
                          <p className="text-amber-400 text-sm font-semibold">{alert.type === 'waiter' ? t('waiterCallType') : t('billRequestType')}</p>
                        </div>
                      </CardHeader>
                      <CardBody>
                        {isBill && (
                          <Alert tone={isCash ? 'success' : 'info'} className="mb-4 flex-col items-start gap-2">
                            <span className="block text-[10px] font-bold uppercase tracking-wide opacity-70">{t('paymentTypeLabel')}</span>
                            <Badge tone={isCash ? 'success' : 'info'} className="px-3 py-2 text-sm gap-2 font-semibold">
                              <span>{isCash ? '💵' : '💳'}</span>
                              <span>{paymentLabel}</span>
                            </Badge>
                          </Alert>
                        )}

                        <div className="text-xs text-slate-400 mb-4">
                          {alert.callCount > 1 ? t('lastCallPrefix') : t('timePrefix')}{new Date(alert.time).toLocaleTimeString()}
                        </div>
                        {/* Alert resolution is order-adjacent table service, so it
                            rides orders.manage too — see capabilityService.js. */}
                        {canManageOrders && (
                          <Button onClick={() => resolveAlert(alert.id)} size="block" className="bg-amber-600 hover:bg-amber-500">
                            <Check className="w-4 h-4" />
                            {t('resolvedButton')}
                          </Button>
                        )}
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Bell className="w-8 h-8 text-emerald-400" />}
                title={t('noPendingAlertsTitle')}
                description={t('noPendingAlertsDescription')}
              />
            )}
          </div>
        )}

        <div className="flex items-center justify-center pt-4 pb-2">
          <Image src="/brand/menuflow-logo-dark-bg-h48.png" alt="MenuFlow" width={90} height={14} className="h-3.5 w-auto object-contain opacity-70" unoptimized />
        </div>

      </div>
    </div>
  );
}

function RoleRedirectStaff({ message, href }) {
  const { t } = useStaffTranslation();
  const router = useRouter();
  useEffect(() => {
    const timer = setTimeout(() => router.replace(href), 400);
    return () => clearTimeout(timer);
  }, [router, href]);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="max-w-sm text-center">
        <p className="text-slate-400 text-sm mb-4">{message}</p>
        {/* Raw `text-blue-400 ... underline` link → buttonVariants (ghost),
            same cn()+buttonVariants pattern already used for the header's
            customer-menu Link — no Button primitive here since a <Link>
            can't render it directly. href/navigation/translation unchanged. */}
        <Link href={href} className={cn(buttonVariants({ context: 'dark', variant: 'ghost' }))}>
          {t('manualRedirectLink')}
        </Link>
      </div>
    </div>
  );
}
