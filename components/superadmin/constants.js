// Shared metadata + formatters for the Super Admin panel.
// Keeping labels/colors here means every tab (Dashboard, Restaurants,
// Subscriptions, Analytics, Users) renders plans/statuses identically.

import { Sparkles, Rocket, Crown } from 'lucide-react';
import { FEATURE_KEYS, FEATURE_REGISTRY, getEntitlements } from '@/lib/services/entitlementService';
import { PLAN_ORDER, PLAN_FALLBACK_PRICES } from './planCatalog';

// Only Basic/Pro are offered going forward. 'free'/'trial'/'enterprise' stay
// mapped here (not in PLAN_ORDER) purely so any legacy row still renders a
// sensible label instead of falling back silently — the create/edit UI never
// offers them as a choice.
//
// `price` is the fallback price from planCatalog.js — see that file for why it
// is only a fallback and never the number the panel reports revenue from.
export const PLAN_META = {
  free: { label: 'Free (legacy)', price: PLAN_FALLBACK_PRICES.free, color: '#94a3b8', icon: Sparkles },
  trial: { label: 'Free (legacy)', price: PLAN_FALLBACK_PRICES.trial, color: '#94a3b8', icon: Sparkles },
  basic: { label: 'Basic', price: PLAN_FALLBACK_PRICES.basic, color: '#38bdf8', icon: Rocket },
  pro: { label: 'Pro', price: PLAN_FALLBACK_PRICES.pro, color: '#a78bfa', icon: Crown },
  enterprise: { label: 'Enterprise (legacy)', price: PLAN_FALLBACK_PRICES.enterprise, color: '#fbbf24', icon: Crown },
};

// Re-exported so existing `from '@/components/superadmin/constants'` imports
// (RestaurantsTab, metrics) keep working — the value itself lives in
// planCatalog.js.
export { PLAN_ORDER };

// `t` is optional (the superadmin translation dictionary's `t`, see
// lib/i18n/dictionaries/superadmin.js) — omitted, this keeps returning the
// original AZ `label` literal above unchanged, so any call site not yet
// swept to pass `t` keeps working exactly as before.
const PLAN_LABEL_KEYS = { free: 'planFree', trial: 'planFree', basic: 'planBasic', pro: 'planPro', enterprise: 'planEnterprise' };
export const planMeta = (plan, t) => {
  const meta = PLAN_META[plan] || PLAN_META.basic;
  if (!t) return meta;
  const key = PLAN_LABEL_KEYS[plan] || PLAN_LABEL_KEYS.basic;
  return { ...meta, label: t(key) };
};

// Feature flags each plan grants by default when a restaurant's plan changes.
// SuperAdmin can still override any individual restaurant's flags afterwards.
//
// The values now live in lib/services/entitlementService.js — the service
// layer owns them because superAdminService.js needs them too, and a service
// importing from a component directory was the wrong dependency direction.
// Re-exported here so existing `from '@/components/superadmin/constants'`
// imports keep working.
export { PLAN_DEFAULT_FLAGS } from '@/lib/services/entitlementService';

// bg/text/border are Tailwind arbitrary-value classes reading --k-* tokens
// (not raw amber-500/emerald-500/... literals) so every status pill matches
// the Quiet Premium kit's soft-tone Tag look exactly, including in dark/light
// parity — see the "neutral Tag + className override" pattern each call site
// (DashboardTab/RestaurantsTab/UsersTab/PlansTab) uses this for.
export const SUBSCRIPTION_STATUS_META = {
  trialing: { label: 'Trial', color: '#FBBF24', bg: 'bg-[var(--k-warning-soft)]', text: 'text-[var(--k-warning)]', border: 'border-[color:var(--k-warning)]/25' },
  active: { label: 'Aktiv', color: '#34D399', bg: 'bg-[var(--k-success-soft)]', text: 'text-[var(--k-success)]', border: 'border-[color:var(--k-success)]/25' },
  past_due: { label: 'Ödəniş gecikib', color: '#F97316', bg: 'bg-[var(--k-accent-soft)]', text: 'text-[var(--k-accent)]', border: 'border-[color:var(--k-accent)]/25' },
  canceled: { label: 'Ləğv olunub', color: '#F87171', bg: 'bg-[var(--k-danger-soft)]', text: 'text-[var(--k-danger)]', border: 'border-[color:var(--k-danger)]/25' },
  cancelled: { label: 'Ləğv olunub', color: '#F87171', bg: 'bg-[var(--k-danger-soft)]', text: 'text-[var(--k-danger)]', border: 'border-[color:var(--k-danger)]/25' },
  // 'expired' only ever appears via restaurant_subscriptions (either the
  // literal stored value or planService.getEffectiveSubscriptionStatus()'s
  // dynamic detection) — restaurants.subscription_status's check constraint
  // never included it, so this key is unreachable from that column's values.
  expired: { label: 'Müddəti bitib', color: '#A1A1A6', bg: 'bg-[var(--k-surface-3)]', text: 'text-[var(--k-text-3)]', border: 'border-[var(--k-border-2)]' },
};

const STATUS_LABEL_KEYS = {
  trialing: 'statusTrialing', active: 'statusActive', past_due: 'statusPastDue',
  canceled: 'statusCanceled', cancelled: 'statusCanceled', expired: 'statusExpired',
};
export const subscriptionMeta = (status, t) => {
  const meta = SUBSCRIPTION_STATUS_META[status] || SUBSCRIPTION_STATUS_META.trialing;
  if (!t) return meta;
  const key = STATUS_LABEL_KEYS[status] || STATUS_LABEL_KEYS.trialing;
  return { ...meta, label: t(key) };
};

// Labels for the per-restaurant feature toggles, derived from the central
// registry so a new feature shows up in the SuperAdmin panel automatically
// instead of needing to be listed in two places.
export const FEATURE_FLAG_META = Object.fromEntries(
  FEATURE_KEYS.map((key) => [
    key,
    { label: FEATURE_REGISTRY[key].label, description: FEATURE_REGISTRY[key].description },
  ])
);

// Effective (resolved) flags for a restaurant. This used to merge raw jsonb
// over an all-true default, which disagreed with the plan defaults; it now
// delegates to the resolver so the SuperAdmin toggles show the same state the
// customer/admin surfaces actually act on.
export const featureFlags = (restaurant) => getEntitlements(restaurant);

export const ROLE_LABELS = {
  super_admin: 'Owner',
  restaurant_admin: 'Admin',
  staff: 'Staff',
};

const ROLE_LABEL_KEYS = { super_admin: 'roleOwner', restaurant_admin: 'roleAdmin', staff: 'roleStaff' };
export const roleLabel = (role, t) => (t ? t(ROLE_LABEL_KEYS[role] || role) : (ROLE_LABELS[role] || role));

const LOCALE_TAGS = { az: 'az-AZ', en: 'en-US', ru: 'ru-RU' };

export const formatMoney = (value, symbol = '₼', localeTag = 'az-AZ') => {
  const n = Number(value) || 0;
  return `${n.toLocaleString(localeTag, { maximumFractionDigits: 0 })} ${symbol}`;
};

export const formatDate = (value, localeTag = 'az-AZ') => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(localeTag, { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatRelativeTime = (value, t, localeTag = 'az-AZ') => {
  const never = t ? t('neverLabel') : 'Heç vaxt';
  if (!value) return never;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return never;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t ? t('justNowLabel') : 'İndicə';
  if (mins < 60) return t ? t('minutesAgo')(mins) : `${mins} dəq əvvəl`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t ? t('hoursAgo')(hours) : `${hours} saat əvvəl`;
  const days = Math.floor(hours / 24);
  if (days < 30) return t ? t('daysAgo')(days) : `${days} gün əvvəl`;
  return formatDate(value, localeTag);
};

export { LOCALE_TAGS };

export const daysUntil = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
};
