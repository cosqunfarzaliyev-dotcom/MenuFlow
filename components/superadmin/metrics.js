// planCatalog.js, not constants.js: this module must stay loadable under plain
// Node so scripts/verify-superadmin-metrics.mjs can import the real thing
// instead of a copy (constants.js pulls in lucide-react and an `@/` alias).
import { PLAN_ORDER, PLAN_FALLBACK_PRICES } from './planCatalog.js';

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
//
// `plans` is the live `plans` table (SuperAdminApp's fetchAllPlans() state).
// Revenue MUST be priced from it, not from the hardcoded catalog: PlansTab
// writes price_monthly straight to that table and /pricing renders it, so a
// super_admin who edits a plan's price would otherwise see MRR/ARR keep
// reporting the hardcoded literal. (That drift was real — the DB's `basic`
// sat at 39 ₼ while the catalog still said 29.) PLAN_FALLBACK_PRICES covers a
// legacy plan key with no row in `plans` any more, and offline/no-Supabase
// mode where `plans` comes back empty.
//
// `subscriptions` is restaurant_subscriptions (planService.fetchAllSubscriptions()).
// It is needed for ONE field — billing_interval — and nothing else can supply
// it: restaurants.subscription_status never tracked monthly-vs-yearly. Without
// it, a restaurant paying 790 ₼/year gets reported as 79 × 12 = 948 ₼/year.
// The plan itself still comes from restaurants.plan (the 0021 sync trigger
// keeps restaurant_subscriptions.plan_id mirrored from it), so this argument
// can never change which plan bucket a restaurant lands in — only how its
// price is annualized.
export function computeMetrics(restaurants, users, plans = [], subscriptions = []) {
  const total = restaurants.length;
  const active = restaurants.filter((r) => r.subscription_status === 'active').length;
  const trialing = restaurants.filter((r) => r.subscription_status === 'trialing').length;
  const cancelled = restaurants.filter((r) => r.subscription_status === 'canceled' || r.subscription_status === 'cancelled').length;
  const pastDue = restaurants.filter((r) => r.subscription_status === 'past_due').length;

  const dbPrice = {};
  const dbYearly = {};
  // Display name straight from the plans table, so a plan a super_admin created
  // (a key PLAN_META has never heard of) shows its own name instead of falling
  // back to planMeta()'s "Basic" default.
  const planNames = {};
  for (const p of plans || []) {
    if (!p?.key) continue;
    dbPrice[p.key] = Number(p.price_monthly) || 0;
    dbYearly[p.key] = Number(p.price_yearly) || 0;
    if (p.name) planNames[p.key] = p.name;
  }
  const priceOf = (key) => (key in dbPrice ? dbPrice[key] : (PLAN_FALLBACK_PRICES[key] ?? 0));
  // The yearly list price is its own number, NOT monthly × 12 — a yearly plan
  // is normally discounted (pro: 790, not 948). Falls back to monthly × 12 only
  // when the plan has no yearly price at all (a legacy key with no `plans` row,
  // or price_yearly left at 0).
  const yearlyPriceOf = (key) => (dbYearly[key] > 0 ? dbYearly[key] : priceOf(key) * 12);
  const isKnownPlan = (key) => Boolean(key) && (key in dbPrice || key in PLAN_FALLBACK_PRICES);

  const intervalOf = {};
  for (const s of subscriptions || []) {
    if (s?.restaurant_id) intervalOf[s.restaurant_id] = s.billing_interval;
  }

  const planCounts = {};
  const planRevenue = {};
  const planPrices = {};
  // Seed with the sellable plans first so they always render (even at zero),
  // then with every plan the live table knows about.
  for (const key of [...PLAN_ORDER, ...Object.keys(dbPrice)]) {
    planCounts[key] = planCounts[key] || 0;
    planRevenue[key] = planRevenue[key] || 0;
    planPrices[key] = priceOf(key);
  }

  let mrr = 0;
  let arr = 0;
  let payingCount = 0;
  let yearlyCount = 0;
  for (const r of restaurants) {
    // A legacy key ('free'/'trial'/'enterprise') keeps its own bucket instead
    // of being folded into 'free' — folding an enterprise row into 'free' both
    // zeroed its revenue and hid it from the Subscriptions tab while it kept
    // inflating the share-% denominator.
    const plan = isKnownPlan(r.plan) ? r.plan : 'free';
    const price = priceOf(plan);
    planCounts[plan] = (planCounts[plan] || 0) + 1;
    planPrices[plan] = price;
    if (planRevenue[plan] === undefined) planRevenue[plan] = 0;
    // Only paying (active) subscriptions count toward recurring revenue —
    // a restaurant sitting on a paid plan while trialing/past_due/cancelled
    // isn't actually billing yet.
    if (r.subscription_status === 'active') {
      // Standard SaaS normalization: each subscriber contributes its real
      // annual contract value to ARR, and one twelfth of it to MRR. A yearly
      // subscriber on `pro` therefore adds 790 (not 79 × 12 = 948) to ARR and
      // 65.83 to MRR — so the two figures shown side by side stay consistent
      // (up to the qəpik rounding below; 790/12 does not terminate).
      const isYearly = intervalOf[r.id] === 'yearly';
      const annual = isYearly ? yearlyPriceOf(plan) : price * 12;
      const monthly = annual / 12;
      mrr += monthly;
      arr += annual;
      planRevenue[plan] += monthly;
      if (annual > 0) payingCount += 1;
      if (isYearly) yearlyCount += 1;
    }
  }
  // Float noise: 790/12 is not exact in binary. Round the aggregates once,
  // here, rather than letting 65.83333333333333 reach a tooltip.
  const round2 = (v) => Math.round(v * 100) / 100;
  mrr = round2(mrr);
  arr = round2(arr);
  for (const key of Object.keys(planRevenue)) planRevenue[key] = round2(planRevenue[key]);

  // Render order for the Subscriptions tab: the sellable plans, then any other
  // plan key that actually has restaurants on it.
  const planKeys = [
    ...PLAN_ORDER,
    ...Object.keys(planCounts).filter((k) => !PLAN_ORDER.includes(k) && planCounts[k] > 0),
  ];

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

  // Last 6 months of signups, for the growth chart's x-axis. The bucket is
  // returned as a Date (monthStart), not a pre-formatted az-AZ string — the
  // chart formats it in the viewer's own language.
  const monthlySignups = Array.from({ length: 6 }).map((_, i) => {
    const offset = -(5 - i);
    const start = startOfMonth(offset);
    const end = startOfMonth(offset + 1);
    const count = restaurants.filter((r) => r.created_at && new Date(r.created_at) >= start && new Date(r.created_at) < end).length;
    return { monthStart: start.toISOString(), count };
  });

  return {
    total, active, trialing, cancelled, pastDue,
    mrr, arr, growthRate, churnRate, activeUsers, payingCount, yearlyCount,
    planCounts, planRevenue, planPrices, planNames, planKeys, monthlySignups,
  };
}
