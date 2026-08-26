/**
 * Verifies lib/services/serviceModelService.js — the rule table three separate
 * surfaces (customer menu, staff panel, SuperAdmin form) read to decide how a
 * restaurant behaves.
 *
 * Why this is worth a script: the rules are pure data with no types behind
 * them, and getting one cell wrong is silent and surface-specific. Flipping
 * `waiterCallEnabled` for `waiter_prepay`, say, would remove the "Garson"
 * button from every prepay restaurant and nothing would fail — a waiter-service
 * venue would just quietly lose its call button.
 *
 * Imports the real module (not a copy), same reasoning as
 * verify-entitlements.mjs and verify-superadmin-metrics.mjs. Node reparses the
 * plain .js file as ESM with a harmless one-time stderr warning.
 *
 * Run: node scripts/verify-service-model.mjs
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SERVICE_MODELS,
  SERVICE_MODEL_ORDER,
  DEFAULT_SERVICE_MODEL,
  getServiceModel,
  getServiceRules,
} from '../lib/services/serviceModelService.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
let n = 0;

const check = (label, actual, expected) => {
  n += 1;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures += 1;
    console.error(`FAIL ${n}. ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`);
  }
};

const rulesOf = (service_model) => getServiceRules({ service_model });

// --- 1. The rule table, spelled out independently of the module -------------
// Deliberately re-stated here rather than imported: a test that reads the same
// object it is checking proves nothing.
{
  check('waiter_pay_later: the classic dine-in flow, everything on', rulesOf(SERVICE_MODELS.WAITER_PAY_LATER), {
    payLaterAllowed: true, waiterCallEnabled: true, billRequestEnabled: true, selfPickup: false,
  });
  check('waiter_prepay: waiter stays, pay-later goes', rulesOf(SERVICE_MODELS.WAITER_PREPAY), {
    payLaterAllowed: false, waiterCallEnabled: true, billRequestEnabled: true, selfPickup: false,
  });
  check('self_service: no waiter, no bill request, customer collects', rulesOf(SERVICE_MODELS.SELF_SERVICE), {
    payLaterAllowed: false, waiterCallEnabled: false, billRequestEnabled: false, selfPickup: true,
  });
}

// --- 2. Only self-service is self-pickup ------------------------------------
{
  check('exactly one model is self-pickup',
    SERVICE_MODEL_ORDER.filter((m) => rulesOf(m).selfPickup), [SERVICE_MODELS.SELF_SERVICE]);
  check('pay-later is offered by exactly one model',
    SERVICE_MODEL_ORDER.filter((m) => rulesOf(m).payLaterAllowed), [SERVICE_MODELS.WAITER_PAY_LATER]);
  check('a venue with no waiter never offers the bill-request flow',
    SERVICE_MODEL_ORDER.every((m) => rulesOf(m).waiterCallEnabled || !rulesOf(m).billRequestEnabled), true);
}

// --- 3. Unknown / missing values fall back, never throw ----------------------
// This is what keeps offline mode (supabaseReady === false, `restaurant` null,
// the data/menu.json seed has no such field) behaving as it did pre-0045.
{
  const fallback = rulesOf(DEFAULT_SERVICE_MODEL);
  check('null restaurant resolves to the default rules', getServiceRules(null), fallback);
  check('undefined restaurant resolves to the default rules', getServiceRules(undefined), fallback);
  check('restaurant with no service_model resolves to the default rules', getServiceRules({}), fallback);
  check('an unrecognised value resolves to the default rules', rulesOf('not_a_model'), fallback);
  check('getServiceModel normalises an unknown value', getServiceModel({ service_model: 'nope' }), DEFAULT_SERVICE_MODEL);
  check('getServiceModel passes a known value through', getServiceModel({ service_model: SERVICE_MODELS.SELF_SERVICE }), SERVICE_MODELS.SELF_SERVICE);
  check('the default is the pre-0045 behaviour (waiter + pay later)', DEFAULT_SERVICE_MODEL, SERVICE_MODELS.WAITER_PAY_LATER);
}

// --- 4. Callers cannot corrupt the shared table ------------------------------
{
  const a = rulesOf(SERVICE_MODELS.SELF_SERVICE);
  a.selfPickup = false;
  check('getServiceRules returns a fresh object per call', rulesOf(SERVICE_MODELS.SELF_SERVICE).selfPickup, true);
}

// --- 5. The module and the migration agree ----------------------------------
// The check constraint is the database's own opinion of what is valid. If these
// drift, SuperAdmin renders an option every save rejects — or worse, a value
// lands in the DB that getServiceRules() silently treats as the default.
{
  const migration = readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '0045_restaurant_service_model.sql'), 'utf8',
  );

  const constraintValues = (migration.match(/check \(service_model in \(([^)]*)\)\)/)?.[1] ?? '')
    .split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  check('SERVICE_MODEL_ORDER matches the check constraint exactly',
    [...SERVICE_MODEL_ORDER].sort(), [...constraintValues].sort());
  check('SERVICE_MODEL_ORDER has no duplicates',
    SERVICE_MODEL_ORDER.length, new Set(SERVICE_MODEL_ORDER).size);
  check('every SERVICE_MODELS value is in SERVICE_MODEL_ORDER',
    Object.values(SERVICE_MODELS).every((m) => SERVICE_MODEL_ORDER.includes(m)), true);

  const columnDefault = migration.match(/service_model text not null default '([a-z_]+)'/)?.[1];
  check('DEFAULT_SERVICE_MODEL matches the column default', DEFAULT_SERVICE_MODEL, columnDefault);

  check('the migration exposes service_model through get_public_restaurant',
    /returns table \([\s\S]*?service_model text[\s\S]*?\)/.test(migration), true);
  check('the migration drops the pay_later_enabled column it replaces',
    /drop column if exists pay_later_enabled/.test(migration), true);
  check('the migration guards service_model in protect_restaurant_privileged_fields',
    /new\.service_model := old\.service_model;/.test(migration), true);
}

// --- 6. Nothing still reads the replaced column ------------------------------
{
  const files = [
    ['components', 'CartDrawer.jsx'],
    ['components', 'CustomerApp.jsx'],
    ['components', 'superadmin', 'RestaurantsTab.jsx'],
    ['lib', 'services', 'superAdminService.js'],
  ];
  // Comments are stripped first: a historical note explaining what 0045
  // replaced is worth keeping, and failing on it would just push people to
  // delete the explanation. Only live code counts — reading a column the
  // migration dropped means PostgREST returns undefined and the gate silently
  // resolves the wrong way.
  const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  const stale = files.filter(
    (parts) => stripComments(readFileSync(path.join(ROOT, ...parts), 'utf8')).includes('pay_later_enabled'),
  ).map((parts) => parts.join('/'));
  check('no app file still reads pay_later_enabled (0045 dropped the column)', stale, []);
}

if (failures > 0) {
  console.error(`\n${failures} of ${n} checks failed.`);
  process.exit(1);
}
console.log(`PASS: service model rules resolve correctly for all ${n} checks`);
