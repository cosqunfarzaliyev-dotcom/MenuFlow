// Shared metadata + formatters for the Super Admin panel.
// Keeping labels/colors here means every tab (Dashboard, Restaurants,
// Subscriptions, Analytics, Users) renders plans/statuses identically.

import { Sparkles, Rocket, Crown, Building2 } from 'lucide-react';

export const PLAN_META = {
  free: { label: 'Free', price: 0, color: '#94a3b8', icon: Sparkles },
  trial: { label: 'Free', price: 0, color: '#94a3b8', icon: Sparkles },
  basic: { label: 'Basic', price: 29, color: '#38bdf8', icon: Rocket },
  pro: { label: 'Pro', price: 79, color: '#a78bfa', icon: Crown },
  enterprise: { label: 'Enterprise', price: 199, color: '#fbbf24', icon: Building2 },
};

export const PLAN_ORDER = ['free', 'basic', 'pro', 'enterprise'];

export const planMeta = (plan) => PLAN_META[plan] || PLAN_META.free;

export const SUBSCRIPTION_STATUS_META = {
  trialing: { label: 'Trial', color: '#fbbf24', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  active: { label: 'Aktiv', color: '#34d399', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  past_due: { label: 'Ödəniş gecikib', color: '#fb923c', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  canceled: { label: 'Ləğv olunub', color: '#f87171', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
  cancelled: { label: 'Ləğv olunub', color: '#f87171', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
};

export const subscriptionMeta = (status) => SUBSCRIPTION_STATUS_META[status] || SUBSCRIPTION_STATUS_META.trialing;

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
