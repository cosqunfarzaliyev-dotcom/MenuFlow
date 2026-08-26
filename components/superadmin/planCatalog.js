// The plan catalog's *data* — deliberately dependency-free (no lucide icons, no
// entitlementService, no alias imports) so metrics.js and scripts/verify-
// superadmin-metrics.mjs can both load it under plain Node.
//
// constants.js builds PLAN_META (labels, colors, icons) on top of this and
// re-exports PLAN_ORDER, so every existing
// `from '@/components/superadmin/constants'` import keeps working unchanged.

// Selectable plans shown in create/edit dropdowns and the Subscriptions tab.
// 'free'/'trial'/'enterprise' are legacy: still priced below so an old row
// resolves, never offered as a choice.
export const PLAN_ORDER = ['basic', 'pro'];

// FALLBACK prices only — used for a legacy key with no row in the `plans` table
// and in offline/no-Supabase mode. The live price the panel reports revenue
// from is plans.price_monthly (see metrics.js). These two had already drifted
// once (basic was 29 here while the DB said 39), silently under-reporting
// MRR/ARR by 10 ₼ per basic restaurant; keep them in step, but nothing
// user-visible depends on that any more.
export const PLAN_FALLBACK_PRICES = {
  free: 0,
  trial: 0,
  basic: 39,
  pro: 79,
  enterprise: 199,
};
