import { PLAN_ORDER, planMeta } from './constants';

const startOfMonth = (offset = 0) => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() + offset);
  return d;
};

// Derives every number the Super Admin panel shows (Dashboard stat cards,
// Subscription plan cards, Analytics charts) from the restaurants + platform
// users already loaded — no extra queries needed.
export function computeMetrics(restaurants, users) {
  const total = restaurants.length;
  const active = restaurants.filter((r) => r.subscription_status === 'active').length;
  const trialing = restaurants.filter((r) => r.subscription_status === 'trialing').length;
  const cancelled = restaurants.filter((r) => r.subscription_status === 'canceled' || r.subscription_status === 'cancelled').length;
  const pastDue = restaurants.filter((r) => r.subscription_status === 'past_due').length;

  const planCounts = {};
  const planRevenue = {};
  for (const plan of PLAN_ORDER) { planCounts[plan] = 0; planRevenue[plan] = 0; }

  let mrr = 0;
  for (const r of restaurants) {
    const plan = PLAN_ORDER.includes(r.plan) ? r.plan : 'free';
    planCounts[plan] = (planCounts[plan] || 0) + 1;
    // Only paying (active) subscriptions count toward recurring revenue —
    // a restaurant sitting on a paid plan while trialing/past_due/cancelled
    // isn't actually billing yet.
    if (r.subscription_status === 'active') {
      const price = planMeta(plan).price;
      mrr += price;
      planRevenue[plan] = (planRevenue[plan] || 0) + price;
    }
  }
  const arr = mrr * 12;

  const thisMonthStart = startOfMonth(0);
  const lastMonthStart = startOfMonth(-1);
  const newThisMonth = restaurants.filter((r) => r.created_at && new Date(r.created_at) >= thisMonthStart).length;
  const newLastMonth = restaurants.filter((r) => {
    if (!r.created_at) return false;
    const d = new Date(r.created_at);
    return d >= lastMonthStart && d < thisMonthStart;
  }).length;
  const growthRate = newLastMonth === 0
    ? (newThisMonth > 0 ? 100 : 0)
    : Math.round(((newThisMonth - newLastMonth) / newLastMonth) * 1000) / 10;

  const churnRate = total === 0 ? 0 : Math.round((cancelled / total) * 1000) / 10;

  const activeUsers = users.filter((u) => u.role !== 'unassigned').length;

  // Last 6 months of signups, for the growth chart's x-axis.
  const monthlySignups = Array.from({ length: 6 }).map((_, i) => {
    const offset = -(5 - i);
    const start = startOfMonth(offset);
    const end = startOfMonth(offset + 1);
    const count = restaurants.filter((r) => r.created_at && new Date(r.created_at) >= start && new Date(r.created_at) < end).length;
    return { month: start.toLocaleDateString('az-AZ', { month: 'short' }), count };
  });

  return {
    total, active, trialing, cancelled, pastDue,
    mrr, arr, growthRate, churnRate, activeUsers,
    planCounts, planRevenue, monthlySignups,
  };
}
