// ---------------------------------------------------------------------------
// Capability resolver — the single source of truth for "can THIS ROLE
// perform THIS ACTION?" Master Plan Phase 6 ("Roles & permissions") has
// tracked this as a real gap: today's authorization is role-level only
// (middleware.js sends a role to its one panel, RLS enforces row access) —
// there is no formal, named permission matrix a component can check before
// rendering a create/edit/delete control. This module is that matrix,
// modeled on lib/services/entitlementService.js's resolver shape (registry +
// role defaults + a resolve function + a fail-closed unknown-key rule), but
// on a different axis:
//   - entitlementService.js resolves "does THIS RESTAURANT'S PLAN (with a
//     per-restaurant override) allow feature X?" — tenant-scoped, plan-based.
//   - capabilityService.js resolves "can THIS ROLE perform action X at all?"
//     — role-scoped, static. There is no per-restaurant override here on
//     purpose: the requested capability set (products/orders/payments/
//     banners/analytics/users/restaurant settings) is about job function
//     (what a `staff` account is trusted to touch vs. a `restaurant_admin`
//     account), not about what a restaurant paid for.
//
// SCOPE / SECURITY: exactly like the entitlement resolver, every capability
// here is a UI-layer check — it decides what renders, not what the database
// accepts. It is NOT a new authorization boundary. The real boundary is
// still RLS + the SECURITY DEFINER RPCs (see CLAUDE.md "Security invariants
// — do not weaken these"): a `staff` account still holds the same anon/
// authenticated Postgres role today regardless of what this resolver says,
// so hiding a button here stops a legitimate user from a wrong click, not a
// motivated one from calling Supabase directly. If a capability ever needs
// real enforcement, that's a new RLS policy / RPC check, same rule the
// entitlement resolver's `enforcement` field already documents — this module
// doesn't attempt that split because nothing requested here has real
// enforcement yet either.
// ---------------------------------------------------------------------------

// Canonical capability keys, dot-namespaced exactly as requested (matches
// the existing `action_type`-style naming already used elsewhere in this
// codebase, e.g. banners.action_type). Import these instead of typing raw
// strings so a typo is a build-visible `undefined`, not a silently-false
// permission.
export const CAPABILITIES = {
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_EDIT: 'products.edit',
  PRODUCTS_DELETE: 'products.delete',

  ORDERS_VIEW: 'orders.view',
  ORDERS_MANAGE: 'orders.manage',

  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_MANAGE: 'payments.manage',

  BANNERS_VIEW: 'banners.view',
  BANNERS_CREATE: 'banners.create',
  BANNERS_EDIT: 'banners.edit',
  BANNERS_DELETE: 'banners.delete',

  ANALYTICS_VIEW: 'analytics.view',

  USERS_MANAGE: 'users.manage',

  RESTAURANT_SETTINGS: 'restaurant.settings',
};

export const CAPABILITY_KEYS = Object.values(CAPABILITIES);

// `categories` (products.category_id's own management, i.e. the "Kateqoriya"
// tab in AdminApp) deliberately has no capability of its own — the requested
// list has no `categories.*` entry, and categories are a sub-resource of
// products in this schema (category_id FK, no independent access pattern
// anywhere in the codebase), so category CRUD is gated under `products.*`
// at call sites instead of inventing an unrequested key.

// Per-role capability grants. `restaurant_admin` and `staff` are listed
// explicitly (fail-closed: a capability absent from a role's object resolves
// false, not true) — reflecting what each role can *actually already do* in
// the shipped UI today, not a new restriction:
//   - `staff` only ever reaches /staff (middleware.js), which has exactly two
//     surfaces: order-status transitions and alert resolution — both
//     order-adjacent table-service actions, so both fold into
//     `orders.manage`. `payments.view` is granted because StaffApp already
//     *displays* which payment method a bill-alert requested (read-only) —
//     see the `paymentLabel` rendering in StaffApp.jsx. Everything else
//     (products, banners, analytics, users, restaurant settings) has no
//     staff-facing UI anywhere today, so it stays false.
//   - `restaurant_admin` reaches /admin, which has UI for every one of these
//     domains except real user management — `users.manage` is false here on
//     purpose: per CLAUDE.md's locked D1 decision, account assignment is
//     super-admin-only (`assignUserToRestaurant`/`removeUserFromRestaurant`
//     are only called from `components/superadmin/RestaurantsTab.jsx`);
//     AdminApp's own "İstifadəçilər" tab is a documented placeholder with no
//     real action to gate. If D1 is ever revisited, this is the one line
//     that changes.
const ROLE_CAPABILITIES = {
  restaurant_admin: {
    [CAPABILITIES.PRODUCTS_VIEW]: true,
    [CAPABILITIES.PRODUCTS_CREATE]: true,
    [CAPABILITIES.PRODUCTS_EDIT]: true,
    [CAPABILITIES.PRODUCTS_DELETE]: true,
    [CAPABILITIES.ORDERS_VIEW]: true,
    [CAPABILITIES.ORDERS_MANAGE]: true,
    [CAPABILITIES.PAYMENTS_VIEW]: true,
    [CAPABILITIES.PAYMENTS_MANAGE]: true,
    [CAPABILITIES.BANNERS_VIEW]: true,
    [CAPABILITIES.BANNERS_CREATE]: true,
    [CAPABILITIES.BANNERS_EDIT]: true,
    [CAPABILITIES.BANNERS_DELETE]: true,
    [CAPABILITIES.ANALYTICS_VIEW]: true,
    [CAPABILITIES.USERS_MANAGE]: false,
    [CAPABILITIES.RESTAURANT_SETTINGS]: true,
  },
  staff: {
    [CAPABILITIES.PRODUCTS_VIEW]: false,
    [CAPABILITIES.PRODUCTS_CREATE]: false,
    [CAPABILITIES.PRODUCTS_EDIT]: false,
    [CAPABILITIES.PRODUCTS_DELETE]: false,
    [CAPABILITIES.ORDERS_VIEW]: true,
    [CAPABILITIES.ORDERS_MANAGE]: true,
    [CAPABILITIES.PAYMENTS_VIEW]: true,
    [CAPABILITIES.PAYMENTS_MANAGE]: false,
    [CAPABILITIES.BANNERS_VIEW]: false,
    [CAPABILITIES.BANNERS_CREATE]: false,
    [CAPABILITIES.BANNERS_EDIT]: false,
    [CAPABILITIES.BANNERS_DELETE]: false,
    [CAPABILITIES.ANALYTICS_VIEW]: false,
    [CAPABILITIES.USERS_MANAGE]: false,
    [CAPABILITIES.RESTAURANT_SETTINGS]: false,
  },
};

// `super_admin` is the platform owner — generated as a wildcard (every
// registered key, true) instead of a hand-maintained object like the two
// above. Two reasons: (1) super_admin's own panel already spans restaurant
// creation, plan/feature-flag control, and the platform user directory —
// conceptually broader than any single one of these seven domains, so
// granting all of them is the accurate description, not a shortcut; (2) a
// future capability added to the registry above and forgotten in the
// restaurant_admin/staff objects fails closed (false) for those roles, which
// is correct, but should never accidentally lock the platform owner out —
// generating this one from CAPABILITY_KEYS guarantees it can't drift behind
// the registry the way a hand-copied literal could.
const SUPER_ADMIN_CAPABILITIES = Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, true]));

const ROLE_CAPABILITY_MATRIX = {
  super_admin: SUPER_ADMIN_CAPABILITIES,
  ...ROLE_CAPABILITIES,
};

/**
 * Resolve one capability for one role.
 *
 * Fails closed twice over: an unregistered capability key returns false
 * (typo-safe), and a role with no entry in the matrix — `unassigned`, null,
 * undefined, or anything unrecognized — returns false rather than throwing,
 * so a still-loading `profile` (role undefined for a beat after login) never
 * flashes a control it's about to hide.
 */
export const hasCapability = (role, capabilityKey) => {
  if (!CAPABILITY_KEYS.includes(capabilityKey)) return false;
  const grants = ROLE_CAPABILITY_MATRIX[role];
  if (!grants) return false;
  return grants[capabilityKey] === true;
};

/**
 * Every capability resolved at once: { 'products.view': bool, ... }. Use
 * when a component needs several checks at once (a tab body deciding what
 * to render), so the role lookup happens once instead of once per key.
 */
export const getCapabilities = (role) =>
  CAPABILITY_KEYS.reduce((acc, key) => {
    acc[key] = hasCapability(role, key);
    return acc;
  }, {});
