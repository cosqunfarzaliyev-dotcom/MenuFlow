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
import { LoadingState, ErrorState, EmptyState, PageSkeleton, Tabs, TabsTrigger, LanguageToggle, Card, CardHeader, CardBody, Tag, Button, PageHeader, Banner } from '@/components/kit';
import { buttonVariants } from '@/components/kit/variants';
import { cn } from '@/lib/utils';
import { CAPABILITIES } from '@/lib/services/capabilityService';
import { useCapability } from '@/hooks/useCapability';
import { useStaffTranslation } from '@/lib/i18n/dictionaries/staff';
import { useCommonTranslation } from '@/lib/i18n/dictionaries/common';
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
  const { t: tc } = useCommonTranslation();
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

  if (!isMounted || authChecking) return <PageSkeleton className="kit-dark" />;

  if (!isAdminAuthenticated) {
    // middleware.js already redirects unauthenticated requests to /staff
    // over to /login before this component mounts; this is a fallback.
    return <RoleRedirectStaff message={t('sessionExpiredRedirect')} href="/login?next=/staff" />;
  }

  if (profile && profile.role === 'super_admin') {
    router.replace('/superadmin');
    return <PageSkeleton className="kit-dark" />;
  }

  if (profile && !isAuthorizedStaff) {
    return (
      <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center p-4">
        <Card variant="plain" className="max-w-sm text-center p-8">
          <Lock className="w-9 h-9 text-[var(--k-warning)] mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[var(--k-text)] mb-2">{t('noAccessTitle')}</h2>
          <p className="text-[var(--k-text-3)] text-sm mb-6">
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
      <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center p-4">
        <Card variant="plain" className="max-w-sm text-center p-8">
          <Lock className="w-9 h-9 text-[var(--k-warning)] mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[var(--k-text)] mb-2">{t('panelLockedTitle')}</h2>
          <p className="text-[var(--k-text-3)] text-sm mb-6">{messages[reason] || messages.canceled}</p>
          <Button variant="secondary" size="block" onClick={handleLogout}>{t('logoutButton')}</Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="kit-dark min-h-screen bg-[var(--k-bg)]">
        <LoadingState title={t('panelLoadingTitle')} description={t('panelLoadingSubtitle')} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="kit-dark min-h-screen bg-[var(--k-bg)]">
        <ErrorState title={t('loadErrorTitle')} description={loadError} actionLabel={tc('tryAgain')} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="kit-dark min-h-screen bg-[var(--k-bg)] text-[var(--k-text)] p-4 sm:p-8 font-sans">

      {/* Notification Toast — same triggerNotification()/timeout/chime logic
          as before, restyled onto kit tokens (solid --k-danger, no bounce/
          heavy shadow — the shared k-anim-in entrance instead). */}
      {notification && (
        <div className="k-anim-in fixed top-6 right-6 z-[100] bg-[var(--k-danger)] text-white px-5 py-3.5 rounded-[var(--k-r)] border border-[var(--k-danger)] font-medium flex items-center gap-3 shadow-lg">
          <Bell className="w-5 h-5 animate-pulse shrink-0" />
          <span className="text-sm tracking-wide">{notification}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header — Card wrapping PageHeader (title/description/actions).
            Kept boxed (unlike AdminApp's own unboxed PageHeaders) since
            StaffApp has no sidebar chrome and this panel is the page's only
            "app bar" — preserving that visual role, not just its literal
            classes. */}
        <Card variant="plain" className="p-6">
          <PageHeader
            title={
              <span className="flex items-center gap-3">
                <UserSquare2 className="w-7 h-7 text-[var(--k-accent)]" />
                {t('panelTitle')}
              </span>
            }
            description={t('panelSubtitle')(settings.restaurantName || "MenuFlow")}
            actions={
              <>
                <LanguageToggle profile={profile} />
                {/* / is now the public marketing homepage, not the customer
                    menu (see app/page.jsx) — link to this restaurant's own
                    real menu when the slug is known, falling back to the
                    marketing home rather than a dead link while it's still
                    loading. Styled via buttonVariants since a Link can't
                    render the Button primitive itself. */}
                <Link
                  href={restaurant?.slug ? `/menu/${restaurant.slug}` : '/'}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
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
                  <TabsTrigger active={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')}>
                    {t('alertsTab')}
                    {activeAlerts.length > 0 && (
                      <Tag tone="warning" size="sm" className="px-1.5 justify-center min-w-[18px]">
                        {activeAlerts.length}
                      </Tag>
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
            <PageHeader title={t('ordersTab')(pendingOrders.length)} description={t('ordersSubtitle')} />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* Pending */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-[var(--k-text)] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--k-warning)]" />
                    {t('pendingTitle')(pendingOrders.length)}
                  </h3>
                </div>
                {pendingOrders.length > 0 ? (
                  <div className="space-y-4">
                    {pendingOrders.map(order => (
                      <OrderCard key={order.id} order={order} tableName={getTableName(order.table)} onStatusChange={handleStatusChange} nextStatus={ORDER_STATUS.ACCEPTED} nextLabel={t('acceptButton')} readOnly={!canManageOrders} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Clock className="w-5 h-5" />}
                    title={t('noNewOrdersTitle')}
                    description={t('noNewOrdersDescription')}
                  />
                )}
              </div>

              {/* Preparing */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-[var(--k-text)] flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-[var(--k-accent)]" />
                    {t('preparingTitle')(preparingOrders.length)}
                  </h3>
                </div>
                <div className="space-y-4">
                  {preparingOrders.map(order => (
                    <OrderCard key={order.id} order={order} tableName={getTableName(order.table)} onStatusChange={handleStatusChange} nextStatus={ORDER_STATUS.READY} nextLabel={t('readyButton')} readOnly={!canManageOrders} />
                  ))}
                </div>
              </div>

              {/* Completed */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-[var(--k-text)] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[var(--k-success)]" />
                    {t('finishedTitle')(finishedOrders.length)}
                  </h3>
                </div>
                <div className="space-y-4">
                  {finishedOrders.slice(0, 10).map(order => (
                    <OrderCard key={order.id} order={order} tableName={getTableName(order.table)} onStatusChange={handleStatusChange} isCompleted={order.status === ORDER_STATUS.SERVED} nextLabel={t('servedButton')} readOnly={!canManageOrders} />
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
            <PageHeader title={t('alertsTab')} description={t('alertsSubtitle')} />

            {activeAlerts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeAlerts.map(alert => {
                  const isBill = alert.type === 'bill';
                  const isCash = alert.paymentMethod === 'cash';
                  const isCard = alert.paymentMethod === 'card';
                  const paymentLabel = alert.paymentMethodLabel || (isCash ? t('cashLabel') : isCard ? t('posLabel') : t('cardLabel'));

                  return (
                    <Card key={alert.id} variant="raised" className="border-[color:var(--k-warning)]/30">
                      <CardHeader className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-[var(--k-warning-soft)] rounded-full flex items-center justify-center text-[var(--k-warning)] shrink-0">
                          <Bell className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-[var(--k-text)] flex items-center gap-2">
                            {getTableName(alert.table)}
                            {alert.callCount > 1 && (
                              <Tag tone="warning" size="sm" title={t('calledTimesTitle')(alert.callCount)}>
                                ×{alert.callCount}
                              </Tag>
                            )}
                          </h4>
                          <p className="text-[var(--k-warning)] text-xs font-medium">{alert.type === 'waiter' ? t('waiterCallType') : t('billRequestType')}</p>
                        </div>
                      </CardHeader>
                      <CardBody>
                        {isBill && (
                          <Banner tone={isCash ? 'success' : 'info'} className="mb-4 flex-col items-start gap-2">
                            <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-70">{t('paymentTypeLabel')}</span>
                            <Tag tone={isCash ? 'success' : 'info'} size="md" className="px-2.5 py-1 h-auto">
                              <span>{isCash ? '💵' : '💳'}</span>
                              <span>{paymentLabel}</span>
                            </Tag>
                          </Banner>
                        )}

                        <div className="text-xs text-[var(--k-text-3)] mb-4">
                          {alert.callCount > 1 ? t('lastCallPrefix') : t('timePrefix')}{new Date(alert.time).toLocaleTimeString()}
                        </div>
                        {/* Alert resolution is order-adjacent table service, so it
                            rides orders.manage too — see capabilityService.js. */}
                        {canManageOrders && (
                          <Button variant="primary" onClick={() => resolveAlert(alert.id)} size="block" icon={<Check className="w-4 h-4" />}>
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
                icon={<Bell className="w-5 h-5" />}
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
    <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center p-4">
      <div className="max-w-sm text-center">
        <p className="text-[var(--k-text-3)] text-sm mb-4">{message}</p>
        {/* Raw `text-blue-400 ... underline` link → buttonVariants (ghost),
            same cn()+buttonVariants pattern already used for the header's
            customer-menu Link — no Button primitive here since a <Link>
            can't render it directly. href/navigation/translation unchanged. */}
        <Link href={href} className={cn(buttonVariants({ variant: 'ghost' }))}>
          {t('manualRedirectLink')}
        </Link>
      </div>
    </div>
  );
}
