/**
 * Verifies components/superadmin/metrics.js — the single function every number
 * in the Super Admin panel's Dashboard / Subscriptions / Analytics tabs is
 * derived from.
 *
 * The invariant that matters most: revenue is priced from the LIVE `plans`
 * table (plans.price_monthly), not from constants.js's hardcoded PLAN_META.
 * Those two had silently drifted in production (PLAN_META said basic = 29
 * while the DB said 39), so MRR/ARR/per-plan revenue under-reported by 10 ₼
 * per basic restaurant and no edit in PlansTab could ever move them.
 *
 * Imports the real module directly (not a copy), same reasoning as
 * verify-entitlements.mjs. Node reparses the plain `.js` files in the import
 * chain as ESM with a harmless one-time stderr warning.
 *
 * Run: node scripts/verify-superadmin-metrics.mjs
 */

import { computeMetrics } from '../components/superadmin/metrics.js';

let failures = 0;
let n = 0;

const check = (label, actual, expected) => {
  n += 1;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.error(`FAIL ${n}. ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`);
  }
};

// Live plans table shape, mirroring what fetchAllPlans() returns. Note basic is
// 39 here and 29 in no world — this is deliberately NOT PLAN_META's value.
const PLANS = [
  { key: 'basic', name: 'Basic', price_monthly: '39.00', price_yearly: '390.00', currency: 'AZN', is_active: true, sort_order: 1 },
  { key: 'pro', name: 'Pro', price_monthly: '79.00', price_yearly: '790.00', currency: 'AZN', is_active: true, sort_order: 2 },
];

const iso = (d) => d.toISOString();
const monthsAgo = (k) => { const d = new Date(); d.setDate(15); d.setHours(12, 0, 0, 0); d.setMonth(d.getMonth() - k); return d; };

// --- 1. Revenue is priced from the live plans table -------------------------
{
  const restaurants = [
    { id: 'a', plan: 'basic', subscription_status: 'active', created_at: iso(monthsAgo(0)) },
    { id: 'b', plan: 'pro', subscription_status: 'active', created_at: iso(monthsAgo(0)) },
  ];
  const m = computeMetrics(restaurants, [], PLANS);
  check('MRR uses plans.price_monthly (39 + 79), not PLAN_META', m.mrr, 118);
  check('ARR is 12x MRR', m.arr, 1416);
  check('per-plan revenue follows the live price', [m.planRevenue.basic, m.planRevenue.pro], [39, 79]);
  check('planPrices exposes the live price for the cards', [m.planPrices.basic, m.planPrices.pro], [39, 79]);
  check('planNames come from the plans table', [m.planNames.basic, m.planNames.pro], ['Basic', 'Pro']);
}

// --- 2. A price edit in PlansTab moves the numbers ---------------------------
{
  const restaurants = [{ id: 'a', plan: 'basic', subscription_status: 'active', created_at: iso(monthsAgo(0)) }];
  const edited = [{ ...PLANS[0], price_monthly: '49.00' }, PLANS[1]];
  check('editing a plan price re-prices MRR', computeMetrics(restaurants, [], edited).mrr, 49);
}

// --- 3. Only status='active' bills ------------------------------------------
{
  const restaurants = [
    { id: 'a', plan: 'pro', subscription_status: 'active', created_at: iso(monthsAgo(0)) },
    { id: 'b', plan: 'pro', subscription_status: 'trialing', created_at: iso(monthsAgo(0)) },
    { id: 'c', plan: 'pro', subscription_status: 'past_due', created_at: iso(monthsAgo(0)) },
    { id: 'd', plan: 'pro', subscription_status: 'canceled', created_at: iso(monthsAgo(0)) },
  ];
  const m = computeMetrics(restaurants, [], PLANS);
  check('MRR counts only active subscriptions', m.mrr, 79);
  check('payingCount agrees with MRR (was: every paid-plan row regardless of status)', m.payingCount, 1);
  check('status buckets', [m.total, m.active, m.trialing, m.pastDue, m.cancelled], [4, 1, 1, 1, 1]);
  check('churnRate is cancelled/total as a percentage', m.churnRate, 25);
}

// --- 4. Legacy plan keys keep their own bucket -------------------------------
{
  const restaurants = [
    { id: 'a', plan: 'enterprise', subscription_status: 'active', created_at: iso(monthsAgo(0)) },
    { id: 'b', plan: 'pro', subscription_status: 'active', created_at: iso(monthsAgo(0)) },
  ];
  const m = computeMetrics(restaurants, [], PLANS);
  check('a legacy plan is not folded into free (its revenue survives)', m.planCounts.enterprise, 1);
  check('legacy plan is priced from PLAN_META when plans has no row', m.mrr, 199 + 79);
  check('planKeys renders sellable plans first, then legacy keys in use', m.planKeys, ['basic', 'pro', 'enterprise']);
}

// --- 5. Unknown plan key falls back to free (never invents revenue) ----------
{
  const restaurants = [{ id: 'a', plan: 'not_a_plan', subscription_status: 'active', created_at: iso(monthsAgo(0)) }];
  const m = computeMetrics(restaurants, [], PLANS);
  check('an unrecognised plan key contributes zero revenue', m.mrr, 0);
  check('an unrecognised plan key lands in the free bucket', m.planCounts.free, 1);
}

// --- 6. Offline / plans not loaded yet ---------------------------------------
{
  const restaurants = [{ id: 'a', plan: 'pro', subscription_status: 'active', created_at: iso(monthsAgo(0)) }];
  check('falls back to PLAN_META when plans is empty', computeMetrics(restaurants, [], []).mrr, 79);
  check('falls back when plans is omitted entirely', computeMetrics(restaurants, []).mrr, 79);
  check('empty platform produces zeroes, not NaN', computeMetrics([], [], PLANS).mrr, 0);
  check('empty platform churn is 0, not NaN', computeMetrics([], [], PLANS).churnRate, 0);
}

// --- 7. Growth + signup chart ------------------------------------------------
{
  const restaurants = [
    { id: 'a', plan: 'pro', subscription_status: 'active', created_at: iso(monthsAgo(0)) },
    { id: 'b', plan: 'pro', subscription_status: 'active', created_at: iso(monthsAgo(0)) },
    { id: 'c', plan: 'pro', subscription_status: 'active', created_at: iso(monthsAgo(1)) },
  ];
  const m = computeMetrics(restaurants, [], PLANS);
  check('growthRate compares this month against last (2 vs 1 = +100%)', m.growthRate, 100);
  check('signup chart has 6 buckets', m.monthlySignups.length, 6);
  check('signup buckets carry an ISO month start, not a pre-formatted az-AZ label',
    m.monthlySignups.every((r) => typeof r.monthStart === 'string' && !Number.isNaN(Date.parse(r.monthStart))), true);
  check('this month + last month land in the right buckets',
    [m.monthlySignups[5].count, m.monthlySignups[4].count], [2, 1]);
  check('growthRate is 100 when last month was empty but this month is not',
    computeMetrics([{ id: 'a', plan: 'pro', subscription_status: 'active', created_at: iso(monthsAgo(0)) }], [], PLANS).growthRate, 100);
  check('growthRate is 0 when nothing happened either month',
    computeMetrics([{ id: 'a', plan: 'pro', subscription_status: 'active', created_at: iso(monthsAgo(4)) }], [], PLANS).growthRate, 0);
}

// --- 8. Users -----------------------------------------------------------------
{
  const users = [
    { id: '1', role: 'super_admin' },
    { id: '2', role: 'restaurant_admin' },
    { id: '3', role: 'staff' },
    { id: '4', role: 'unassigned' },
  ];
  check('activeUsers excludes unassigned accounts', computeMetrics([], users, PLANS).activeUsers, 3);
}

if (failures > 0) {
  console.error(`\n${failures} of ${n} checks failed.`);
  process.exit(1);
}
console.log(`PASS: SuperAdmin metrics resolve correctly for all ${n} checks`);
