/**
 * Verifies components/superadmin/metrics.js — the single function every number
 * in the Super Admin panel's Dashboard / Subscriptions / Analytics tabs is
 * derived from.
 *
 * Two invariants matter most, both of which were broken in production:
 *
 *   1. Revenue is priced from the LIVE `plans` table (plans.price_monthly), not
 *      from a hardcoded catalog. Those two had silently drifted (the catalog
 *      said basic = 29 while the DB said 39), so MRR/ARR/per-plan revenue
 *      under-reported by 10 ₼ per basic restaurant and no edit in PlansTab
 *      could ever move them.
 *
 *   2. A yearly subscriber is annualized at the plan's discounted price_yearly,
 *      not price_monthly × 12. The live `pro` plan costs 790 ₼/year, but ARR
 *      reported 79 × 12 = 948 ₼ because billing_interval was never read.
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

// MRR is rounded to the qəpik for display, and 790/12 does not terminate, so
// ARR and MRR x 12 agree to within a rounding error rather than exactly. A
// tolerance well under 1 ₼ is the honest assertion here.
const checkClose = (label, actual, expected, tolerance = 0.5) => {
  n += 1;
  if (!(Math.abs(actual - expected) <= tolerance)) {
    failures += 1;
    console.error(`FAIL ${n}. ${label}\n     expected: ${expected} (+/- ${tolerance})\n     actual:   ${actual}`);
  }
};

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

// --- 8. Yearly billing is annualized at price_yearly, not price_monthly x 12 --
{
  const restaurants = [{ id: 'a', plan: 'pro', subscription_status: 'active', created_at: iso(monthsAgo(0)) }];
  const yearly = [{ restaurant_id: 'a', billing_interval: 'yearly', status: 'active' }];
  const monthly = [{ restaurant_id: 'a', billing_interval: 'monthly', status: 'active' }];

  const y = computeMetrics(restaurants, [], PLANS, yearly);
  check('a yearly pro subscriber contributes price_yearly to ARR (790, not 948)', y.arr, 790);
  check('...and one twelfth of it to MRR', y.mrr, 65.83);
  check('...and that same twelfth to the plan card revenue', y.planRevenue.pro, 65.83);

  const m = computeMetrics(restaurants, [], PLANS, monthly);
  check('a monthly pro subscriber is still 79 / 948', [m.mrr, m.arr], [79, 948]);

  check('no subscription row at all defaults to monthly', computeMetrics(restaurants, [], PLANS, []).arr, 948);
  check('subscriptions omitted entirely defaults to monthly', computeMetrics(restaurants, [], PLANS).arr, 948);
  check('yearlyCount tracks how many active subscribers bill annually', [y.yearlyCount, m.yearlyCount], [1, 0]);
  check('a yearly subscriber still counts once as paying', y.payingCount, 1);
}

// --- 9. ARR and MRR can never contradict each other ---------------------------
{
  const restaurants = [
    { id: 'a', plan: 'pro', subscription_status: 'active', created_at: iso(monthsAgo(0)) },
    { id: 'b', plan: 'basic', subscription_status: 'active', created_at: iso(monthsAgo(0)) },
    { id: 'c', plan: 'basic', subscription_status: 'active', created_at: iso(monthsAgo(0)) },
  ];
  const subs = [
    { restaurant_id: 'a', billing_interval: 'yearly', status: 'active' },
    { restaurant_id: 'b', billing_interval: 'yearly', status: 'active' },
    { restaurant_id: 'c', billing_interval: 'monthly', status: 'active' },
  ];
  const m = computeMetrics(restaurants, [], PLANS, subs);
  check('mixed billing: ARR is 790 + 390 + (39 x 12)', m.arr, 1648);
  checkClose('mixed billing: ARR and MRR x 12 never contradict each other', m.mrr * 12, m.arr);
}

// --- 10. Yearly price falls back to monthly x 12 when there is none ----------
{
  const restaurants = [{ id: 'a', plan: 'basic', subscription_status: 'active', created_at: iso(monthsAgo(0)) }];
  const subs = [{ restaurant_id: 'a', billing_interval: 'yearly', status: 'active' }];
  const noYearly = [{ ...PLANS[0], price_yearly: '0' }, PLANS[1]];
  check('a plan with no yearly price falls back to monthly x 12', computeMetrics(restaurants, [], noYearly, subs).arr, 468);

  const legacy = [{ id: 'a', plan: 'enterprise', subscription_status: 'active', created_at: iso(monthsAgo(0)) }];
  check('a legacy plan billed yearly falls back to its fallback price x 12',
    computeMetrics(legacy, [], PLANS, subs).arr, 199 * 12);
}

// --- 11. Users ----------------------------------------------------------------
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
