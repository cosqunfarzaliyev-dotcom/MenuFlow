"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore, ORDER_STATUS } from '@/lib/store';
import { supabase, supabaseReady } from '@/lib/supabase';
import { subscribeOrders, subscribeAlerts } from '@/lib/services/realtime';
import { isAccessBlocked, accessBlockReason } from '@/lib/services/billingService';
import { CheckCircle2, Clock, Bell, BellRing, BellOff, UserSquare2, UtensilsCrossed, Check, Lock, Shield } from 'lucide-react';
import { OrderCard } from '@/components/staff/OrderCard';
import RealtimeStatusBadge from '@/components/RealtimeStatusBadge';
import { LoadingState, ErrorState, EmptyState, PageSkeleton, Tabs, TabsTrigger, LanguageToggle, Card, CardHeader, CardBody, Tag, Button, PageHeader, Banner, ConfirmDialog, useConfirmDialog } from '@/components/kit';
import { buttonVariants } from '@/components/kit/variants';
import { cn } from '@/lib/utils';
import { CAPABILITIES } from '@/lib/services/capabilityService';
import { useCapability } from '@/hooks/useCapability';
import { FEATURES } from '@/lib/services/entitlementService';
import { getServiceRules } from '@/lib/services/serviceModelService';
import { useFeature } from '@/hooks/useEntitlement';
import { useStaffTranslation } from '@/lib/i18n/dictionaries/staff';
import { useCommonTranslation } from '@/lib/i18n/dictionaries/common';
import { useLocaleSync } from '@/hooks/useLocaleSync';
import { isPushSupported, getPushPermission, isSubscribedOnThisDevice, subscribeToPush, unsubscribeFromPush } from '@/lib/services/pushService';

export function StaffApp() {
  const {
    orders,
    updateOrderStatus,
    settleTablePayment,
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
  const { t, language } = useStaffTranslation();
  const { t: tc } = useCommonTranslation();
  useLocaleSync(profile?.locale);
  // Formal capability layer (Master Plan Phase 6) — both roles that reach
  // /staff (`staff`, `restaurant_admin`) have orders.manage today (see
  // capabilityService.js), so this doesn't hide anything currently; it
  // exists so a future view-only staff tier is a role-matrix edit, not a
  // StaffApp rewrite.
  const canManageOrders = useCapability(CAPABILITIES.ORDERS_MANAGE);
  // 0045 — in a self-service venue nobody serves anything: the customer takes
  // the order off the counter. Only the wording changes here; the order flow
  // (pending -> accepted -> preparing -> ready -> served) and the Alerts tab
  // stay exactly as they are, because payment confirmation still runs through
  // the same 'bill' alert CartDrawer raises at checkout.
  const { selfPickup } = getServiceRules(restaurant);
  const pushNotificationsEnabled = useFeature(FEATURES.PUSH_NOTIFICATIONS);
  // Order cancellation — see OrderCard.jsx's `onCancel` prop. Confirmed
  // before it fires (irreversible, and the customer-facing menu shows the
  // order as cancelled immediately), same useConfirmDialog pattern
  // AdminApp/DesignTab already use for delete flows.
  const confirmDialog = useConfirmDialog();
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

  // `fallbackNumber` is the human-readable table_number (order.table/
  // alert.table) — used only if the table can't be found by id (e.g. a
  // deleted table with orphaned orders), so that rare case still shows
  // "Masa 5" instead of a raw UUID.
  const getTableName = useCallback((id, fallbackNumber) => {
    const table = tables.find(tb => tb.id === id);
    return table ? table.name : t('tableFallbackName')(fallbackNumber ?? id);
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
  // `language` (a stable primitive from useLanguageStore), NOT `t` — `t` is
  // a brand-new function reference on every single render
  // (createTranslationHook, lib/i18n/index.js: `const t = (key) => ...`,
  // never memoized). With `t` in this array, the first setLoading(false)
  // above caused a re-render, which produced a new `t`, which re-ran this
  // whole effect — re-fetching orders/alerts/tables and re-subscribing to
  // realtime — forever. That's what an endless loading screen that never
  // actually shows the panel looks like. `language` still gives the
  // intended behavior (re-subscribe so the realtime chime text picks up a
  // language change) without recreating itself on every unrelated render.
  }, [loadOrders, loadAlerts, loadTables, triggerNotification, isAdminAuthenticated, isAuthorizedStaff, language]);


  const pendingOrders = orders.filter(o => o.status === ORDER_STATUS.PENDING);
  const preparingOrders = orders.filter(o => [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING].includes(o.status));
  // A SERVED order drops off this column once its bill is actually paid —
  // staff has nothing left to do with it, keeping it around just pads the
  // list. While unpaid, though, it stays exactly as before: it's still the
  // reminder that this table's payment hasn't been settled yet. READY orders
  // always stay regardless of payment (food not yet handed over is never
  // "done"), so only SERVED is gated on paymentStatus.
  const finishedOrders = orders.filter(o =>
    [ORDER_STATUS.READY, ORDER_STATUS.SERVED].includes(o.status) &&
    !(o.status === ORDER_STATUS.SERVED && o.paymentStatus === 'paid')
  );

  const activeAlerts = alerts.filter(a => a.status === 'active');

  const handleStatusChange = (id) => {
    const order = orders.find((currentOrder) => currentOrder.id === id);
    // Forward-only progression. Cancellation is a distinct, explicit action
    // (handleCancelOrder below) — it used to live as a [SERVED]: CANCELLED
    // entry at the end of this map, but that transition was unreachable
    // (OrderCard hides the "next stage" button once isCompleted is true,
    // which is exactly when status === SERVED) and confusing dead code to
    // anyone reading it as "how do I cancel an order?".
    const nextStatus = {
      [ORDER_STATUS.PENDING]: ORDER_STATUS.ACCEPTED,
      [ORDER_STATUS.ACCEPTED]: ORDER_STATUS.PREPARING,
      [ORDER_STATUS.PREPARING]: ORDER_STATUS.READY,
      [ORDER_STATUS.READY]: ORDER_STATUS.SERVED,
    }[order?.status];

    if (nextStatus) updateOrderStatus(id, nextStatus);
  };

  // Previously there was no UI path anywhere (Staff or Admin) to ever set an
  // order to `cancelled` — the status existed in the enum/labels/filters but
  // was fully dead. Offered only while an order hasn't reached READY yet
  // (see the two OrderCard columns below); once food is ready/served,
  // cancelling from here no longer reflects reality in the kitchen.
  const handleCancelOrder = (id) => {
    confirmDialog.confirm({
      title: t('cancelOrderConfirmTitle'),
      message: t('cancelOrderConfirmMessage'),
      onConfirm: () => updateOrderStatus(id, ORDER_STATUS.CANCELLED),
    });
  };

  // 0025_order_payment_status.sql. A table's unpaid balance — used both to
  // show staff what they're about to confirm and as the amount named in the
  // confirm dialog below. `orders` here is the staff-wide fetchOrders() list
  // (unlike CustomerApp's table-scoped one), so it's filtered by tableId.
  const currencySymbol = restaurant?.currency_symbol || '₼';
  const getTableUnpaidTotal = (tableId) =>
    orders
      .filter((o) => o.tableId === tableId && o.paymentStatus === 'unpaid' && o.status !== ORDER_STATUS.CANCELLED)
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  // Settles the WHOLE table's unpaid balance in one call (settle_table_payment
  // RPC — see the migration), not just this one alert. The alert's own
  // recorded payment_method is what staff already saw the customer request
  // (cash/card icon in the card below); confirming here means "I actually
  // received this amount", so it also resolves the bill alert server-side in
  // the same transaction — no separate resolveAlert() call needed for bill
  // alerts (unlike waiter alerts, which still use it below).
  const handleSettlePayment = (alert) => {
    const amount = getTableUnpaidTotal(alert.tableId);
    confirmDialog.confirm({
      title: t('settlePaymentConfirmTitle'),
      message: t('settlePaymentConfirmMessage')(amount.toFixed(2), currencySymbol),
      onConfirm: () =>
        settleTablePayment({
          tableId: alert.tableId,
          paymentMethod: alert.paymentMethod,
          paymentMethodLabel: alert.paymentMethodLabel,
          paid: true,
        }),
    });
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
                {t(selfPickup ? 'panelTitleSelfService' : 'panelTitle')}
              </span>
            }
            description={t('panelSubtitle')(settings.restaurantName || "MenuFlow")}
            actions={
              <>
                {pushNotificationsEnabled && <PushNotificationToggle profileId={profile?.id} />}
                <LanguageToggle profile={profile} />

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

            {/* Three columns, three grid tracks. This was `lg:grid-cols-5`
                with only three children, so every order column rendered at
                1/5 of the width with two empty tracks trailing it — the
                single biggest reason the cards read as cramped on the
                kitchen/pass screen they're meant to be read from across the
                room. */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* Pending */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base text-[var(--k-text)] flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[var(--k-warning)]" />
                    {t('pendingTitle')(pendingOrders.length)}
                  </h3>
                </div>
                {pendingOrders.length > 0 ? (
                  <div className="space-y-4">
                    {pendingOrders.map(order => (
                      <OrderCard key={order.id} order={order} tableName={getTableName(order.tableId, order.table)} onStatusChange={handleStatusChange} nextStatus={ORDER_STATUS.ACCEPTED} nextLabel={t('acceptButton')} readOnly={!canManageOrders} onCancel={canManageOrders ? handleCancelOrder : undefined} />
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
                  <h3 className="font-semibold text-base text-[var(--k-text)] flex items-center gap-2">
                    <UtensilsCrossed className="w-5 h-5 text-[var(--k-accent)]" />
                    {t('preparingTitle')(preparingOrders.length)}
                  </h3>
                </div>
                <div className="space-y-4">
                  {preparingOrders.map(order => {
                    // This column mixes ACCEPTED and PREPARING orders (see
                    // the filter above) but handleStatusChange only ever
                    // advances ONE step at a time — an ACCEPTED order still
                    // needs to become PREPARING first. A single hardcoded
                    // "Ready" label/nextStatus for the whole column used to
                    // mean clicking it on a freshly-accepted order silently
                    // moved it to PREPARING (still in this same column, same
                    // card, same label) with no visible change — looked like
                    // the button just didn't work. Computed per-order instead.
                    const isAccepted = order.status === ORDER_STATUS.ACCEPTED;
                    return (
                      <OrderCard
                        key={order.id}
                        order={order}
                        tableName={getTableName(order.tableId, order.table)}
                        onStatusChange={handleStatusChange}
                        nextStatus={isAccepted ? ORDER_STATUS.PREPARING : ORDER_STATUS.READY}
                        nextLabel={isAccepted ? t('startPreparingButton') : t('readyButton')}
                        readOnly={!canManageOrders}
                        onCancel={canManageOrders ? handleCancelOrder : undefined}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Completed */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base text-[var(--k-text)] flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[var(--k-success)]" />
                    {t(selfPickup ? 'finishedTitleSelfService' : 'finishedTitle')(finishedOrders.length)}
                  </h3>
                </div>
                <div className="space-y-4">
                  {finishedOrders.slice(0, 10).map(order => (
                    <OrderCard key={order.id} order={order} tableName={getTableName(order.tableId, order.table)} onStatusChange={handleStatusChange} isCompleted={order.status === ORDER_STATUS.SERVED} nextLabel={t(selfPickup ? 'handedOverButton' : 'servedButton')} readOnly={!canManageOrders} />
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
                            {getTableName(alert.tableId, alert.table)}
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
                            {/* paymentLabel already carries its own emoji prefix
                                (cashLabel/posLabel/cardLabel below, and every
                                caller of createAlert's paymentMethodLabel) — a
                                second hardcoded emoji here used to double it up
                                whenever paymentMethodLabel was present. */}
                            <Tag tone={isCash ? 'success' : 'info'} size="md" className="px-2.5 py-1 h-auto">
                              {paymentLabel}
                            </Tag>
                          </Banner>
                        )}

                        <div className="text-xs text-[var(--k-text-3)] mb-4">
                          {alert.callCount > 1 ? t('lastCallPrefix') : t('timePrefix')}{new Date(alert.time).toLocaleTimeString()}
                        </div>
                        {/* Alert resolution is order-adjacent table service, so it
                            rides orders.manage too — see capabilityService.js. */}
                        {canManageOrders && isBill && (
                          <>
                            <div className="mb-3 flex items-center justify-between text-sm">
                              <span className="text-[var(--k-text-3)]">{t('unpaidAmountLabel')}</span>
                              <span className="k-nums font-semibold text-[var(--k-text)]">
                                {getTableUnpaidTotal(alert.tableId).toFixed(2)} {currencySymbol}
                              </span>
                            </div>
                            {/* Settles the table's whole unpaid balance AND
                                resolves this alert server-side, in one RPC —
                                see handleSettlePayment. A separate
                                resolveAlert() call is only needed for waiter
                                alerts (below), not bill ones. */}
                            <Button variant="primary" onClick={() => handleSettlePayment(alert)} size="block" icon={<Check className="w-4 h-4" />}>
                              {t('confirmPaymentButton')}
                            </Button>
                          </>
                        )}
                        {canManageOrders && !isBill && (
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

      <ConfirmDialog {...confirmDialog.dialogProps} />
    </div>
  );
}

// "Bildirişləri aktivləşdir" — subscribes THIS device to Web Push
// (lib/services/pushService.js) so a new order/waiter-call/bill-request
// still surfaces (public/sw.js's `push` handler → an OS notification) when
// the /staff tab is backgrounded or closed, not just via the in-app
// Realtime toast + audio chime this panel already has. iOS Safari only
// supports Web Push from an installed (Add to Home Screen) PWA — the
// permission prompt still works either way, it just won't fire on iOS until
// installed; not worth a platform-detection branch for a graceful-degrade
// case the browser itself already handles (requestPermission()/subscribe()
// simply reject there).
function PushNotificationToggle({ profileId }) {
  const { t } = useStaffTranslation();
  // Lazy initializer, not a synchronous setState-in-effect: browser support
  // is a stable fact of the render environment, not something that changes
  // mid-session, so it only ever needs to be read once, at mount — no
  // separate "unsupported" branch inside the effect below is needed.
  const [supported] = useState(() => isPushSupported());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return undefined;
    let cancelled = false;
    isSubscribedOnThisDevice().then((result) => {
      if (!cancelled) setSubscribed(result);
    });
    return () => { cancelled = true; };
  }, [supported]);

  if (!supported) return null;

  const handleToggle = async () => {
    setBusy(true);
    if (subscribed) {
      const { error } = await unsubscribeFromPush();
      if (!error) setSubscribed(false);
    } else {
      const { error } = await subscribeToPush(profileId);
      if (!error) {
        setSubscribed(true);
      } else if (getPushPermission() === 'denied') {
        // A rejected browser permission prompt can't be re-triggered
        // programmatically — only the user's own browser settings can undo
        // it, so the button's title attribute below points them there
        // instead of retrying silently forever.
      } else {
        // Permission WAS granted but the actual subscribe() call still
        // failed — e.g. the browser's own push service (Google/Mozilla's
        // infrastructure) is unreachable (AbortError "push service not
        // available": no network path to it, a corporate/VPN block, or a
        // browser with it disabled). Previously this branch did nothing —
        // the button just stopped spinning with zero explanation, which is
        // indistinguishable from "the click didn't register." At least
        // surface that it failed; there's nothing this app can do about an
        // unreachable browser-level push service beyond that.
        alert(t('pushSubscribeFailedHint'));
      }
    }
    setBusy(false);
  };

  return (
    <Button
      variant={subscribed ? 'secondary' : 'outline'}
      size="sm"
      onClick={handleToggle}
      loading={busy}
      title={getPushPermission() === 'denied' ? t('pushPermissionDeniedHint') : undefined}
      icon={subscribed ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
    >
      {subscribed ? t('pushEnabledLabel') : t('pushEnableButton')}
    </Button>
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
