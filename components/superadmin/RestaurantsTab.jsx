"use client";

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Building2, Search, Users, Trash2, Edit2, ExternalLink, Copy,
  X,
} from 'lucide-react';
import {
  createRestaurant, updateRestaurant, deleteRestaurant,
  markRestaurantActive, markRestaurantPastDue, cancelRestaurantSubscription,
  extendRestaurantTrial, setRestaurantActiveState, setRestaurantFeatureFlag, setRestaurantPlan,
  fetchProfilesForRestaurant, assignUserToRestaurant, removeUserFromRestaurant,
} from '@/lib/services/superAdminService';
import {
  fetchRestaurantSubscription, getEffectiveSubscriptionStatus, setSubscriptionBillingInterval,
  setSubscriptionAutoRenew, markSubscriptionExpired, touchSubscriptionCancelledAt, renewSubscription,
} from '@/lib/services/planService';
import { TRIAL_LENGTH_DAYS } from '@/lib/services/billingService';
import { PLAN_ORDER, planMeta, subscriptionMeta, formatDate, daysUntil, FEATURE_FLAG_META, featureFlags, LOCALE_TAGS } from './constants';
import { useToast } from './Toast';
import {
  ConfirmDialog, useConfirmDialog, Field, Input, Select, Tag, Button, EmptyState, Switch,
  Table, TableHead, TableHeaderCell, TableBody, TableCell,
} from '@/components/kit';
import { CAPABILITIES } from '@/lib/services/capabilityService';
import { useCapability } from '@/hooks/useCapability';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';

// Overrides FEATURE_FLAG_META's AZ-only label/description for display here
// (and in PlansTab.jsx) without touching lib/services/entitlementService.js
// — that registry is shared cross-surface infra (see its own header
// comment), so translating its display text is scoped to the two SuperAdmin
// consumers that render it, not the registry itself.
const FEATURE_LABEL_KEYS = {
  apple_pay: ['featureAppleyPayLabel', 'featureApplePayDescription'],
  google_pay: ['featureGooglePayLabel', 'featureGooglePayDescription'],
  banners: ['featureBannersLabel', 'featureBannersDescription'],
};
const translatedFeatureMeta = (key, meta, t) => {
  const [labelKey, descKey] = FEATURE_LABEL_KEYS[key] || [];
  if (!labelKey) return meta;
  return { label: t(labelKey), description: t(descKey) };
};

export function RestaurantsTab({ restaurants, stats, origin, refresh, openRestaurantId, onConsumeOpenId }) {
  const { t, language } = useSuperAdminTranslation();
  const localeTag = LOCALE_TAGS[language] || 'az-AZ';
  const notify = useToast();
  const confirmDialog = useConfirmDialog();
  const [query, setQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [adminsModalRestaurant, setAdminsModalRestaurant] = useState(null);

  React.useEffect(() => {
    if (!openRestaurantId) return;
    const r = restaurants.find((x) => x.id === openRestaurantId);
    if (r) setEditingRestaurant(r);
    onConsumeOpenId?.();
  }, [openRestaurantId, restaurants, onConsumeOpenId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter((r) =>
      r.name?.toLowerCase().includes(q) ||
      r.slug?.toLowerCase().includes(q) ||
      r.owner_email?.toLowerCase().includes(q)
    );
  }, [restaurants, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--k-text-3)] absolute left-3.5 top-1/2 -translate-y-1/2 z-10" />
          <Field>
            {(id, a11y) => (
              <Input
                id={id}
                {...a11y}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchRestaurantsPlaceholder')}
                className="pl-10"
              />
            )}
          </Field>
        </div>
        <Button variant="primary" onClick={() => setIsCreateOpen(true)} className="shrink-0" icon={<Plus className="w-4 h-4" />}>
          {t('newRestaurantButton')}
        </Button>
      </div>

      {/* EmptyState renders as its own top-level replacement (not nested
          inside a card). The table branch keeps a plain kit surface. */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-5 h-5" />}
          title={query ? t('noResultsFound') : t('noRestaurantsYet')}
          description=""
        />
      ) : (
        <div className="rounded-[var(--k-r-lg)] border border-[var(--k-border)] bg-[var(--k-surface)] overflow-hidden">
          <Table>
            <TableHead>
              {[t('colAvatar'), t('colName'), t('colOwner'), t('colPackage'), t('colStatus'), t('colEndDate'), t('colOrderCount'), ''].map((h, i) => (
                <TableHeaderCell key={i}>{h}</TableHeaderCell>
              ))}
            </TableHead>
            <TableBody>
              {filtered.map((r, idx) => {
                const rowStats = stats[r.id] || { orderCount: 0, revenue: 0 };
                const plan = planMeta(r.plan, t);
                const status = subscriptionMeta(r.subscription_status, t);
                const trialDays = r.subscription_status === 'trialing' ? daysUntil(r.trial_ends_at) : null;
                const menuUrl = origin ? `${origin}/menu/${r.slug}` : '';
                return (
                  // motion.tr (not TableRow) — preserves the stagger-in
                  // animation, using the exact same visual classes TableRow
                  // itself applies.
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.025, 0.25) }}
                    className="border-t border-[var(--k-border)] hover:bg-[var(--k-surface-2)] transition-colors"
                  >
                    <TableCell>
                      <div className="w-9 h-9 rounded-[var(--k-r)] bg-[var(--k-surface-3)] flex items-center justify-center overflow-hidden">
                        {r.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.logo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-4 h-4 text-[var(--k-text-3)]" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-[var(--k-text)] font-medium whitespace-nowrap">{r.name}</p>
                      <p className="text-[13px] text-[var(--k-text-3)]">/{r.slug}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.owner_email || '—'}</TableCell>
                    <TableCell>
                      <span className="font-medium whitespace-nowrap" style={{ color: plan.color }}>{plan.label}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {/* tone is the closest semantic match; the className
                            override reproduces subscriptionMeta()'s exact
                            per-status colors (e.g. past_due's orange, which
                            has no dedicated Tag tone) so the color meaning
                            is unchanged. */}
                        <Tag tone="neutral" className={`whitespace-nowrap border ${status.bg} ${status.text} ${status.border}`}>
                          {status.label}
                        </Tag>
                        {r.is_active === false && (
                          <Tag tone="neutral" className="whitespace-nowrap">
                            {t('inactiveLabel')}
                          </Tag>
                        )}
                      </div>
                      <p className="text-[13px] text-[var(--k-text-3)] mt-1">{t('editFromHere')}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.subscription_status === 'trialing' && trialDays !== null
                        ? t('daysLeftSuffix')(trialDays > 0 ? trialDays : 0)
                        : formatDate(r.trial_ends_at, localeTag)}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{rowStats.orderCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        {menuUrl && (
                          <>
                            <a href={menuUrl} target="_blank" rel="noreferrer" title={t('viewMenuTitle')}
                              className="p-2 rounded-[var(--k-r-sm)] hover:bg-[var(--k-surface-2)] text-[var(--k-text-3)] hover:text-[var(--k-text)]">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => { navigator.clipboard.writeText(menuUrl); notify(t('linkCopiedToast')); }}
                              title={t('copyLinkTitle')}
                              className="p-2 rounded-[var(--k-r-sm)] hover:bg-[var(--k-surface-2)] text-[var(--k-text-3)] hover:text-[var(--k-text)]"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setAdminsModalRestaurant(r)}
                          title={t('adminsTitle')}
                          className="p-2 rounded-[var(--k-r-sm)] hover:bg-[var(--k-surface-2)] text-[var(--k-text-3)] hover:text-[var(--k-text)]"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingRestaurant(r)}
                          title={t('editTitle')}
                          className="p-2 rounded-[var(--k-r-sm)] hover:bg-[var(--k-surface-2)] text-[var(--k-text-3)] hover:text-[var(--k-text)]"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => confirmDialog.confirm({
                            title: t('deleteRestaurantConfirmTitle'),
                            message: t('deleteRestaurantConfirmMessage')(r.name),
                            onConfirm: async () => {
                              const { error } = await deleteRestaurant(r.id);
                              if (error) { notify(t('deleteFailedToast')(error.message), 'error'); return; }
                              notify(t('restaurantDeletedToast'));
                              refresh();
                            },
                          })}
                          title={t('deleteTitle')}
                          className="p-2 rounded-[var(--k-r-sm)] hover:bg-[var(--k-danger-soft)] text-[var(--k-text-3)] hover:text-[var(--k-danger)]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AnimatePresence>
        {isCreateOpen && (
          <RestaurantModal
            title={t('newRestaurantModalTitle')}
            onClose={() => setIsCreateOpen(false)}
            onSave={async (form) => {
              const { error } = await createRestaurant(form);
              if (error) { notify(t('createFailedToast')(error.message), 'error'); return; }
              setIsCreateOpen(false);
              notify(t('restaurantCreatedToast'));
              refresh();
            }}
          />
        )}
        {editingRestaurant && (
          <RestaurantModal
            title={t('editRestaurantModalTitle')}
            initial={editingRestaurant}
            isEdit
            onClose={() => setEditingRestaurant(null)}
            onRefresh={refresh}
            onSave={async (form) => {
              const planChanged = form.plan !== editingRestaurant.plan;
              const { error } = planChanged
                ? await setRestaurantPlan(editingRestaurant.id, form.plan)
                : { error: null };
              const { error: err2 } = await updateRestaurant({
                id: editingRestaurant.id, name: form.name, tagline: form.tagline, currencySymbol: form.currencySymbol,
              });
              if (error || err2) {
                notify(t('saveFailedToast')((error || err2).message), 'error');
                return;
              }
              setEditingRestaurant(null);
              notify(t('restaurantUpdatedToast'));
              refresh();
            }}
          />
        )}
        {adminsModalRestaurant && (
          <AdminsModal restaurant={adminsModalRestaurant} onClose={() => setAdminsModalRestaurant(null)} onChange={refresh} />
        )}
      </AnimatePresence>
      <ConfirmDialog {...confirmDialog.dialogProps} />
    </div>
  );
}

// Values tightened slightly (scale 0.96 not 0.94, 180ms not 200ms) to match
// the rest of the Quiet Premium kit's faster, smaller-amplitude motion — same
// change applied to PlansTab.jsx's local copy of this shape.
const modalMotion = {
  overlay: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  panel: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
    transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
  },
};

function RestaurantModal({ title, initial, isEdit, onClose, onSave, onRefresh }) {
  const { t } = useSuperAdminTranslation();
  const [form, setForm] = useState({
    name: initial?.name || '',
    slug: initial?.slug || '',
    tagline: initial?.tagline || '',
    currencySymbol: initial?.currency_symbol || '₼',
    tableCount: initial?.table_count || 20,
    plan: initial?.plan && PLAN_ORDER.includes(initial.plan) ? initial.plan : 'basic',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || (!isEdit && !form.slug.trim())) return;
    setSaving(true);
    await onSave({
      ...form,
      slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      tableCount: parseInt(form.tableCount, 10) || 20,
    });
    setSaving(false);
  };

  return (
    <motion.div {...modalMotion.overlay} className="kit-dark fixed inset-0 bg-[var(--k-scrim)] backdrop-blur-[2px] flex items-center justify-center p-4 z-50">
      <motion.form {...modalMotion.panel} onSubmit={handleSubmit} className="w-full max-w-md bg-[var(--k-surface)] border border-[var(--k-border)] rounded-[var(--k-r-lg)] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-[var(--k-text)]">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-[var(--k-surface-2)] rounded-[var(--k-r-sm)]"><X className="w-4 h-4 text-[var(--k-text-3)]" /></button>
        </div>

        <Field label={t('restaurantNameFieldLabel')}>
          {(id, a11y) => (
            <Input id={id} {...a11y} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          )}
        </Field>

        <Field label={t('slugFieldLabel')} hint={isEdit ? t('slugImmutableHint') : undefined}>
          {(id, a11y) => (
            <Input id={id} {...a11y} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} disabled={isEdit} required />
          )}
        </Field>

        <Field label={t('taglineFieldLabel')}>
          {(id, a11y) => (
            <Input id={id} {...a11y} value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('currencySymbolFieldLabel')}>
            {(id, a11y) => (
              <Input id={id} {...a11y} value={form.currencySymbol} onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })} />
            )}
          </Field>
          {!isEdit ? (
            <Field label={t('tableCountFieldLabel')}>
              {(id, a11y) => (
                <Input id={id} {...a11y} type="number" min="1" max="200" value={form.tableCount} onChange={(e) => setForm({ ...form, tableCount: e.target.value })} />
              )}
            </Field>
          ) : (
            <Field label={t('packageFieldLabel')}>
              {(id, a11y) => (
                <Select id={id} {...a11y} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                  {PLAN_ORDER.map((p) => <option key={p} value={p}>{planMeta(p, t).label}</option>)}
                </Select>
              )}
            </Field>
          )}
        </div>
        {isEdit && <p className="text-[10px] text-[var(--k-text-3)] -mt-2">{t('planChangeResetHint')}</p>}

        <Button type="submit" variant="primary" loading={saving} size="block">
          {t('saveButton')}
        </Button>

        {isEdit && initial && <RestaurantControlsPanel restaurant={initial} onRefresh={onRefresh} />}
        {isEdit && initial && <RestaurantSubscriptionPanel restaurant={initial} onRefresh={onRefresh} />}
      </motion.form>
    </motion.div>
  );
}

// Instant-apply switches for a restaurant's access/billing/feature state.
// Each switch calls its service function immediately (not tied to the
// surrounding form's "Yadda saxla" button) and shows a real success/error
// toast — the earlier version of this panel always said "uğurlu" even when
// the underlying update failed, which is why the Aktiv/Deaktiv control used
// to look broken.
function RestaurantControlsPanel({ restaurant, onRefresh }) {
  const { t } = useSuperAdminTranslation();
  const notify = useToast();
  const [local, setLocal] = useState(restaurant);
  const [pendingKey, setPendingKey] = useState(null);

  React.useEffect(() => { setLocal(restaurant); }, [restaurant]);

  const run = async (key, action, optimisticPatch) => {
    setPendingKey(key);
    setLocal((prev) => ({ ...prev, ...optimisticPatch }));
    const { error } = await action();
    setPendingKey(null);
    if (error) {
      setLocal(restaurant); // roll back the optimistic change
      notify(t('updateFailedToast')(error.message), 'error');
      return;
    }
    notify(t('updatedToast'));
    onRefresh?.();
  };

  const flags = featureFlags(local);

  return (
    <div className="border-t border-[var(--k-border)] pt-3 mt-1 space-y-0.5">
      <p className="text-[11px] font-semibold text-[var(--k-text-3)] uppercase tracking-wider mb-1">{t('controlsTitle')}</p>

      <Switch
        label={t('restaurantActiveLabel')}
        description={local.is_active === false ? t('restaurantActiveOffDescription') : t('restaurantActiveOnDescription')}
        checked={local.is_active !== false}
        disabled={pendingKey === 'is_active'}
        onChange={(val) => run('is_active', () => setRestaurantActiveState(local.id, val), { is_active: val })}
      />
      <Switch
        label={t('trialPeriodLabel')(TRIAL_LENGTH_DAYS)}
        description={local.subscription_status === 'trialing' ? t('daysLeftSuffix')(daysUntil(local.trial_ends_at) ?? 0) : t('notInTrialDescription')}
        checked={local.subscription_status === 'trialing'}
        disabled={pendingKey === 'trialing'}
        onChange={(val) => {
          if (val) {
            const trial_ends_at = new Date(Date.now() + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000).toISOString();
            run('trialing', () => extendRestaurantTrial(local.id, TRIAL_LENGTH_DAYS), { subscription_status: 'trialing', trial_ends_at });
          } else {
            run('trialing', () => cancelRestaurantSubscription(local.id), { subscription_status: 'canceled' });
          }
        }}
      />
      <Switch
        label={t('subscriptionActiveLabel')}
        description={local.subscription_status === 'active' ? t('subscriptionActiveOnDescription') : t('subscriptionActiveOffDescription')}
        checked={local.subscription_status === 'active'}
        disabled={pendingKey === 'active'}
        onChange={(val) => run('active', () => (val ? markRestaurantActive(local.id) : cancelRestaurantSubscription(local.id)), { subscription_status: val ? 'active' : 'canceled' })}
      />
      <Switch
        label={t('pastDueLabel')}
        description={t('pastDueDescription')}
        checked={local.subscription_status === 'past_due'}
        disabled={pendingKey === 'past_due'}
        onChange={(val) => run('past_due', () => (val ? markRestaurantPastDue(local.id) : cancelRestaurantSubscription(local.id)), { subscription_status: val ? 'past_due' : 'canceled' })}
      />

      <div className="h-px bg-[var(--k-border)] my-2" />
      <p className="text-[11px] font-semibold text-[var(--k-text-3)] uppercase tracking-wider mb-1">{t('featuresTitle')}</p>
      {Object.entries(FEATURE_FLAG_META).map(([key, meta]) => {
        const translated = translatedFeatureMeta(key, meta, t);
        return (
          <Switch
            key={key}
            label={translated.label}
            description={translated.description}
            checked={Boolean(flags[key])}
            disabled={pendingKey === key}
            onChange={(val) => run(key, () => setRestaurantFeatureFlag(local, key, val), { feature_flags: { ...flags, [key]: val } })}
          />
        );
      })}
    </div>
  );
}

// Restaurant Subscription (public.restaurant_subscriptions) — the normalized
// view, separate from RestaurantControlsPanel above (which stays exactly as
// it was, still driving is_active/trialing/active/past_due off the
// `restaurants` columns). This panel reads and edits the NEW table directly:
// billing_interval/auto_renew have no restaurants-column equivalent at all,
// and "mark as expired"/"mark as renewed" are explicit super_admin actions a
// status Switch can't express. See lib/services/planService.js's header
// comment for exactly which fields this writes directly vs. routes through
// the old restaurants-column + sync-trigger path.
function RestaurantSubscriptionPanel({ restaurant, onRefresh }) {
  const { t, language } = useSuperAdminTranslation();
  const localeTag = LOCALE_TAGS[language] || 'az-AZ';
  const notify = useToast();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState(null);

  // Async loader defined and invoked entirely inside the effect (not a
  // useCallback referenced from the dependency array) — matches
  // CustomerApp.jsx's loadAppData pattern, which is the one data-loading
  // shape in this codebase that doesn't trip react-hooks/set-state-in-effect
  // (the useCallback-then-call-in-effect shape a few lines up in this same
  // file, e.g. AdminsModal's `refresh`, does trip it — that's an accepted
  // pre-existing baseline violation there, not a pattern to add a new
  // instance of here).
  React.useEffect(() => {
    const loadSubscription = async () => {
      setLoading(true);
      const sub = await fetchRestaurantSubscription(restaurant.id);
      setSubscription(sub);
      setLoading(false);
    };
    loadSubscription();
  }, [restaurant.id]);

  const run = async (key, action) => {
    setPendingKey(key);
    const { error } = await action();
    setPendingKey(null);
    if (error) {
      notify(t('updateFailedToast')(error.message), 'error');
      return;
    }
    notify(t('updatedToast'));
    const sub = await fetchRestaurantSubscription(restaurant.id);
    setSubscription(sub);
    onRefresh?.();
  };

  if (loading) {
    return (
      <div className="border-t border-[var(--k-border)] pt-3 mt-1">
        <p className="text-[11px] font-semibold text-[var(--k-text-3)] uppercase tracking-wider mb-2">{t('subscriptionDetailsTitle')}</p>
        <p className="text-[13px] text-[var(--k-text-3)] py-2">{t('loadingText')}</p>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="border-t border-[var(--k-border)] pt-3 mt-1">
        <p className="text-[11px] font-semibold text-[var(--k-text-3)] uppercase tracking-wider mb-2">{t('subscriptionDetailsTitle')}</p>
        <p className="text-[13px] text-[var(--k-text-3)] py-2">{t('subscriptionNotFound')}</p>
      </div>
    );
  }

  const effectiveStatus = getEffectiveSubscriptionStatus(subscription);
  const effectiveMeta = subscriptionMeta(effectiveStatus, t);

  return (
    <div className="border-t border-[var(--k-border)] pt-3 mt-1 space-y-3">
      <p className="text-[11px] font-semibold text-[var(--k-text-3)] uppercase tracking-wider mb-1">{t('subscriptionDetailsTitle')}</p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div><span className="text-[var(--k-text-3)]">{t('planLabel')}</span><span className="text-[var(--k-text)] font-medium">{subscription.plan?.name || '—'}</span></div>
        <div>
          <span className="text-[var(--k-text-3)]">{t('statusLabelColon')}</span>
          <Tag tone="neutral" className={`${effectiveMeta.bg} ${effectiveMeta.text}`}>{effectiveMeta.label}</Tag>
        </div>
        <div><span className="text-[var(--k-text-3)]">{t('startDateLabel')}</span><span className="text-[var(--k-text)]">{formatDate(subscription.start_date, localeTag)}</span></div>
        <div><span className="text-[var(--k-text-3)]">{t('endDateLabel')}</span><span className="text-[var(--k-text)]">{formatDate(subscription.end_date, localeTag)}</span></div>
        <div><span className="text-[var(--k-text-3)]">{t('trialEndsLabel')}</span><span className="text-[var(--k-text)]">{formatDate(subscription.trial_ends_at, localeTag)}</span></div>
        <div><span className="text-[var(--k-text-3)]">{t('lastRenewedLabel')}</span><span className="text-[var(--k-text)]">{formatDate(subscription.renewed_at, localeTag)}</span></div>
        {subscription.cancelled_at && (
          <div className="col-span-2"><span className="text-[var(--k-text-3)]">{t('cancelledDateLabel')}</span><span className="text-[var(--k-text)]">{formatDate(subscription.cancelled_at, localeTag)}</span></div>
        )}
      </div>

      <Field label={t('billingIntervalLabel')}>
        {(id, a11y) => (
          <Select
            id={id} {...a11y}
            value={subscription.billing_interval}
            disabled={pendingKey === 'billing_interval'}
            onChange={(e) => run('billing_interval', () => setSubscriptionBillingInterval(restaurant.id, e.target.value))}
          >
            <option value="monthly">{t('monthlyOption')}</option>
            <option value="yearly">{t('yearlyOption')}</option>
          </Select>
        )}
      </Field>

      <Switch
        label={t('autoRenewLabel')}
        description={subscription.auto_renew ? t('autoRenewOnDescription') : t('autoRenewOffDescription')}
        checked={subscription.auto_renew}
        disabled={pendingKey === 'auto_renew'}
        onChange={(val) => run('auto_renew', () => setSubscriptionAutoRenew(restaurant.id, val))}
      />

      <div className="flex flex-wrap gap-2 pt-1">
        {effectiveStatus !== 'expired' && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pendingKey === 'expired'}
            onClick={() => run('expired', () => markSubscriptionExpired(restaurant.id))}
            className="hover:bg-[var(--k-danger-soft)] hover:text-[var(--k-danger)]"
          >
            {t('markExpiredButton')}
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pendingKey === 'renew'}
          onClick={() => run('renew', () => renewSubscription(restaurant.id))}
          className="hover:bg-[var(--k-success-soft)] hover:text-[var(--k-success)]"
        >
          {t('markRenewedButton')}
        </Button>
        {(subscription.status === 'cancelled' || subscription.status === 'canceled') && !subscription.cancelled_at && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pendingKey === 'cancelled_at'}
            onClick={() => run('cancelled_at', () => touchSubscriptionCancelledAt(restaurant.id))}
          >
            {t('markCancelledDateButton')}
          </Button>
        )}
      </div>
    </div>
  );
}

function AdminsModal({ restaurant, onClose, onChange }) {
  const { t } = useSuperAdminTranslation();
  const notify = useToast();
  const confirmDialog = useConfirmDialog();
  // Formal capability layer (Master Plan Phase 6) — this modal only ever
  // renders inside SuperAdminApp (super_admin-only route), so this is always
  // true today; it's the one place users.manage's real implementation
  // (assignUserToRestaurant/removeUserFromRestaurant) actually lives, per
  // the D1-locked account model — see capabilityService.js.
  const canManageUsers = useCapability(CAPABILITIES.USERS_MANAGE);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('restaurant_admin');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const data = await fetchProfilesForRestaurant(restaurant.id);
    setProfiles(data);
    setLoading(false);
  }, [restaurant.id]);

  React.useEffect(() => { refresh(); }, [refresh]);

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setSubmitting(true);
    setError('');
    const { error: err } = await assignUserToRestaurant({ email: newEmail.trim(), restaurantId: restaurant.id, role: newRole });
    setSubmitting(false);
    if (err) {
      setError(err.message || t('genericError'));
      return;
    }
    setNewEmail('');
    notify(t('userAssignedToast'));
    refresh();
    onChange?.();
  };

  return (
    <motion.div {...modalMotion.overlay} className="kit-dark fixed inset-0 bg-[var(--k-scrim)] backdrop-blur-[2px] flex items-center justify-center p-4 z-50">
      <motion.div {...modalMotion.panel} className="w-full max-w-lg bg-[var(--k-surface)] border border-[var(--k-border)] rounded-[var(--k-r-lg)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-[var(--k-text)]">{t('adminsModalTitle')(restaurant.name)}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--k-surface-2)] rounded-[var(--k-r-sm)]"><X className="w-4 h-4 text-[var(--k-text-3)]" /></button>
        </div>

        {canManageUsers && (
          <form onSubmit={handleAssign} className="flex flex-col sm:flex-row gap-2">
            {/* Neither control had a visible <label> before — Field is used
                unlabeled here (same treatment as the search input above)
                purely for the Input/Select primitive, not to invent new
                label text. */}
            <Field className="flex-1">
              {(id, a11y) => (
                <Input
                  id={id} {...a11y}
                  type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={t('userEmailPlaceholder')}
                />
              )}
            </Field>
            <Field>
              {(id, a11y) => (
                // w-auto overrides Select's own w-full — the original raw
                // <select> had no w-full and stayed content-width; keeping
                // that same compact sizing here.
                <Select id={id} {...a11y} value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-auto">
                  <option value="restaurant_admin">{t('roleFilterAdmin')}</option>
                  <option value="staff">{t('staffRoleOption')}</option>
                </Select>
              )}
            </Field>
            <Button type="submit" variant="primary" disabled={submitting} className="whitespace-nowrap">
              {submitting ? t('assigningButton') : t('assignButton')}
            </Button>
          </form>
        )}
        {error && <p className="text-[var(--k-danger)] text-xs font-medium">{error}</p>}
        <p className="text-[10px] text-[var(--k-text-3)]">
          {t('assignHelperText')}
        </p>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {loading ? (
            <p className="text-[var(--k-text-3)] text-sm text-center py-4">{t('loadingText')}</p>
          ) : profiles.length === 0 ? (
            <p className="text-[var(--k-text-3)] text-sm text-center py-4">{t('noAdminsAssignedYet')}</p>
          ) : (
            profiles.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-[var(--k-surface-2)] border border-[var(--k-border)] rounded-[var(--k-r)] px-4 py-2.5">
                <div>
                  <p className="text-[var(--k-text)] text-sm font-medium">{p.email}</p>
                  <p className="text-[var(--k-text-3)] text-[10px] font-medium uppercase">{p.role === 'restaurant_admin' ? t('roleFilterAdmin') : t('staffRoleShort')}</p>
                </div>
                {canManageUsers && (
                  <button
                    onClick={() => confirmDialog.confirm({
                      title: t('deleteUserConfirmTitle'),
                      message: t('deleteUserConfirmMessage')(p.email),
                      onConfirm: async () => {
                        await removeUserFromRestaurant(p.id);
                        notify(t('userRemovedToast'));
                        refresh();
                        onChange?.();
                      },
                    })}
                    className="p-2 rounded-[var(--k-r-sm)] hover:bg-[var(--k-danger-soft)] text-[var(--k-text-3)] hover:text-[var(--k-danger)]"
                    title={t('deleteTitle')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </motion.div>
      <ConfirmDialog {...confirmDialog.dialogProps} />
    </motion.div>
  );
}

export default RestaurantsTab;
