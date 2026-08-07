// Shared metadata + formatters for the Super Admin panel.
// Keeping labels/colors here means every tab (Dashboard, Restaurants,
// Subscriptions, Analytics, Users) renders plans/statuses identically.

import { Sparkles, Rocket, Crown } from 'lucide-react';

// Only Basic/Pro are offered going forward. 'free'/'trial'/'enterprise' stay
// mapped here (not in PLAN_ORDER) purely so any legacy row still renders a
// sensible label instead of falling back silently — the create/edit UI never
// offers them as a choice.
export const PLAN_META = {
  free: { label: 'Free (legacy)', price: 0, color: '#94a3b8', icon: Sparkles },
  trial: { label: 'Free (legacy)', price: 0, color: '#94a3b8', icon: Sparkles },
  basic: { label: 'Basic', price: 29, color: '#38bdf8', icon: Rocket },
  pro: { label: 'Pro', price: 79, color: '#a78bfa', icon: Crown },
  enterprise: { label: 'Enterprise (legacy)', price: 199, color: '#fbbf24', icon: Crown },
};

// Selectable plans shown in create/edit dropdowns and the Subscriptions tab.
export const PLAN_ORDER = ['basic', 'pro'];

export const planMeta = (plan) => PLAN_META[plan] || PLAN_META.basic;

// Feature flags each plan grants by default when a restaurant's plan changes.
// SuperAdmin can still override any individual restaurant's flags afterwards.
export const PLAN_DEFAULT_FLAGS = {
  basic: { apple_pay: false, google_pay: false, banners: false },
  pro: { apple_pay: true, google_pay: true, banners: true },
};

export const SUBSCRIPTION_STATUS_META = {
  trialing: { label: 'Trial', color: '#fbbf24', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  active: { label: 'Aktiv', color: '#34d399', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  past_due: { label: 'Ödəniş gecikib', color: '#fb923c', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  canceled: { label: 'Ləğv olunub', color: '#f87171', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
  cancelled: { label: 'Ləğv olunub', color: '#f87171', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
};

export const subscriptionMeta = (status) => SUBSCRIPTION_STATUS_META[status] || SUBSCRIPTION_STATUS_META.trialing;

export const DEFAULT_FEATURE_FLAGS = { apple_pay: true, google_pay: true, banners: true };

export const FEATURE_FLAG_META = {
  apple_pay: { label: 'Apple Pay', description: 'Müştəri panelində Apple Pay seçimi' },
  google_pay: { label: 'Google Pay', description: 'Müştəri panelində Google Pay seçimi' },
  banners: { label: 'Banner reklamları', description: 'Müştəri menyusunda banner bölməsi' },
};

export const featureFlags = (restaurant) => ({ ...DEFAULT_FEATURE_FLAGS, ...(restaurant?.feature_flags || {}) });

export const ROLE_LABELS = {
  super_admin: 'Owner',
  restaurant_admin: 'Admin',
  staff: 'Staff',
};

export const formatMoney = (value, symbol = '₼') => {
  const n = Number(value) || 0;
  return `${n.toLocaleString('az-AZ', { maximumFractionDigits: 0 })} ${symbol}`;
};

export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('az-AZ', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatRelativeTime = (value) => {
  if (!value) return 'Heç vaxt';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Heç vaxt';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'İndicə';
  if (mins < 60) return `${mins} dəq əvvəl`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat əvvəl`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} gün əvvəl`;
  return formatDate(value);
};

export const daysUntil = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
};
