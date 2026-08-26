// ---------------------------------------------------------------------------
// Restaurant service model — HOW a venue operates, not what its plan grants.
//
// Three schemes, one per real-world operating pattern:
//   waiter_pay_later  Customer sits, eats, then asks for the bill. The classic
//                     dine-in flow, and what every restaurant did before 0045.
//   waiter_prepay     A waiter still serves, but the payment method is declared
//                     up front, at order time.
//   self_service      No waiter at all. The customer orders, declares payment,
//                     and collects the order themselves from the counter once
//                     the kitchen marks it ready.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT A FEATURE FLAG
// ---------------------------------------------------------------------------
// CLAUDE.md keeps two authorization axes deliberately separate, and this is a
// third thing that belongs to neither:
//   capabilityService  — role-scoped: "can a `staff` account do X at all?"
//   entitlementService — plan-scoped: "does this restaurant's PLAN include X?"
//   this module        — operating mode: "how does this venue actually run?"
//
// Registering it in entitlementService's FEATURE_REGISTRY would be actively
// wrong: app/[locale]/pricing/page.jsx renders every FEATURE_KEYS entry as a
// sellable plan feature on the PUBLIC pricing page (and verify-entitlements.mjs
// check 10 forces a label for each), so "self service" would be advertised as a
// Basic-vs-Pro perk. It is not something a plan grants — a fast-food counter
// and a fine-dining room can both be on Pro. Same reasoning 0044 recorded for
// the pay_later_enabled column this replaces.
//
// Kept dependency-free (no lucide, no `@/` alias imports) for the same reason
// components/superadmin/planCatalog.js is: scripts/verify-service-model.mjs
// imports the real module under plain Node rather than testing a copy.
// ---------------------------------------------------------------------------

export const SERVICE_MODELS = {
  WAITER_PAY_LATER: 'waiter_pay_later',
  WAITER_PREPAY: 'waiter_prepay',
  SELF_SERVICE: 'self_service',
};

// Render order for the SuperAdmin select. Must stay in step with the check
// constraint in 0045_restaurant_service_model.sql — verify-service-model.mjs
// asserts exactly that.
export const SERVICE_MODEL_ORDER = [
  SERVICE_MODELS.WAITER_PAY_LATER,
  SERVICE_MODELS.WAITER_PREPAY,
  SERVICE_MODELS.SELF_SERVICE,
];

// Matches the column default in 0045. Anything unrecognised resolves to this,
// which is what keeps offline mode (supabaseReady === false, `restaurant` is
// null and the data/menu.json seed has no such field) behaving exactly as it
// did before this module existed.
export const DEFAULT_SERVICE_MODEL = SERVICE_MODELS.WAITER_PAY_LATER;

// The single source of truth for every behavioural question the three surfaces
// ask. Adding a fourth model means adding one row here — not hunting for
// `service_model === '...'` comparisons scattered across the components.
//
//   payLaterAllowed     Is "Sonra ödəyəcəyəm" offered in the cart?
//   waiterCallEnabled   Is the "Garson" button shown in the customer menu?
//   billRequestEnabled  Is the "Hesab" (ask for the bill afterwards) flow shown?
//   selfPickup          Does the customer collect the order themselves? Drives
//                       pickup-flavoured copy on both the customer menu and the
//                       staff panel.
const RULES = {
  [SERVICE_MODELS.WAITER_PAY_LATER]: {
    payLaterAllowed: true,
    waiterCallEnabled: true,
    billRequestEnabled: true,
    selfPickup: false,
  },
  [SERVICE_MODELS.WAITER_PREPAY]: {
    payLaterAllowed: false,
    waiterCallEnabled: true,
    billRequestEnabled: true,
    selfPickup: false,
  },
  [SERVICE_MODELS.SELF_SERVICE]: {
    payLaterAllowed: false,
    waiterCallEnabled: false,
    billRequestEnabled: false,
    selfPickup: true,
  },
};

// Normalises whatever the row holds (or doesn't) to a known model.
export const getServiceModel = (restaurant) => {
  const raw = restaurant?.service_model;
  return raw && RULES[raw] ? raw : DEFAULT_SERVICE_MODEL;
};

// A fresh object per call — callers must never mutate the shared RULES entry.
export const getServiceRules = (restaurant) => ({ ...RULES[getServiceModel(restaurant)] });
