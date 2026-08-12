/**
 * Verifies the role → capability matrix in lib/services/capabilityService.js
 * resolves correctly for every case that matters in production: the three
 * real roles, fail-closed unknown keys, fail-closed unknown/missing roles,
 * and the specific "staff can manage orders but nothing else" / "restaurant
 * admin can't manage users" boundaries the matrix exists to encode.
 *
 * Imports the real module directly (not a copy), same pattern as
 * scripts/verify-entitlements.mjs (see that file's own header comment for
 * why the one-time Node ESM-reparse stderr warning is harmless).
 *
 * Run: node scripts/verify-capabilities.mjs
 */
import {
  CAPABILITIES,
  CAPABILITY_KEYS,
  hasCapability,
  getCapabilities,
} from '../lib/services/capabilityService.js';

let failed = false;
const fail = (msg) => {
  console.error('FAIL:', msg);
  failed = true;
};

// 1. super_admin is a true wildcard — every registered key resolves true,
//    including one added to the registry without a matching literal (the
//    whole point of generating it from CAPABILITY_KEYS instead of hand-
//    copying). Simulates that by checking every current key plus asserting
//    getCapabilities() returns no `false` at all for this role.
{
  for (const key of CAPABILITY_KEYS) {
    if (hasCapability('super_admin', key) !== true) {
      fail(`super_admin must resolve ${key} to true, got ${hasCapability('super_admin', key)}`);
    }
  }
  const entitlements = getCapabilities('super_admin');
  if (Object.values(entitlements).some((v) => v !== true)) {
    fail('getCapabilities(super_admin) must be all-true');
  }
}

// 2. restaurant_admin has every domain except users.manage — the D1-locked
//    boundary (account assignment is super-admin-only) this module exists to
//    encode. If this flips to true without a deliberate D1 change, it's a
//    real regression, not a matrix tweak.
{
  if (hasCapability('restaurant_admin', CAPABILITIES.USERS_MANAGE) !== false) {
    fail('restaurant_admin must NOT have users.manage (D1: account assignment is super-admin-only)');
  }
  const otherKeys = CAPABILITY_KEYS.filter((k) => k !== CAPABILITIES.USERS_MANAGE);
  for (const key of otherKeys) {
    if (hasCapability('restaurant_admin', key) !== true) {
      fail(`restaurant_admin must have ${key}, got ${hasCapability('restaurant_admin', key)}`);
    }
  }
}

// 3. staff is scoped to exactly orders.view/manage + payments.view — the
//    real StaffApp surface (order status transitions, alert resolution, and
//    the read-only payment-method label on bill alerts). Everything else
//    must be false; staff has no UI for any of it today.
{
  const staffGranted = [CAPABILITIES.ORDERS_VIEW, CAPABILITIES.ORDERS_MANAGE, CAPABILITIES.PAYMENTS_VIEW];
  for (const key of staffGranted) {
    if (hasCapability('staff', key) !== true) {
      fail(`staff must have ${key}, got ${hasCapability('staff', key)}`);
    }
  }
  const staffDenied = CAPABILITY_KEYS.filter((k) => !staffGranted.includes(k));
  for (const key of staffDenied) {
    if (hasCapability('staff', key) !== false) {
      fail(`staff must NOT have ${key}, got ${hasCapability('staff', key)}`);
    }
  }
}

// 4. Fail closed on an unknown capability key, for every role including
//    super_admin's wildcard (a typo must never resolve true just because the
//    asking role is the platform owner).
{
  for (const role of ['super_admin', 'restaurant_admin', 'staff']) {
    if (hasCapability(role, 'not_a_real_capability') !== false) {
      fail(`hasCapability(${role}, 'not_a_real_capability') must be false, not throw or default true`);
    }
  }
}

// 5. Fail closed on an unknown/missing role — 'unassigned', null, undefined,
//    and a garbage string must all resolve false for every capability and
//    must never throw (a still-loading profile has role undefined for a
//    beat after login).
{
  for (const role of ['unassigned', null, undefined, 'not_a_real_role']) {
    for (const key of CAPABILITY_KEYS) {
      let result;
      try {
        result = hasCapability(role, key);
      } catch (err) {
        fail(`hasCapability(${role}, ${key}) threw: ${err.message}`);
        continue;
      }
      if (result !== false) {
        fail(`hasCapability(${JSON.stringify(role)}, ${key}) should be false, got ${result}`);
      }
    }
  }
}

// 6. getCapabilities() returns exactly the registry's keys, no more, no less,
//    for every role (including an unknown one, which should still return the
//    full key set with every value false rather than an empty object).
{
  for (const role of ['super_admin', 'restaurant_admin', 'staff', 'unassigned']) {
    const gotKeys = Object.keys(getCapabilities(role)).sort();
    const wantKeys = [...CAPABILITY_KEYS].sort();
    if (JSON.stringify(gotKeys) !== JSON.stringify(wantKeys)) {
      fail(`getCapabilities(${role}) keys ${JSON.stringify(gotKeys)} must exactly equal CAPABILITY_KEYS ${JSON.stringify(wantKeys)}`);
    }
  }
}

// 7. Registry completeness — every CAPABILITIES value is dot-namespaced
//    (matches the requested `domain.action` naming) and every key appears
//    exactly once in CAPABILITY_KEYS (catches a copy-paste duplicate).
{
  for (const key of CAPABILITY_KEYS) {
    if (!/^[a-z]+\.[a-z]+$/.test(key)) {
      fail(`capability key '${key}' must match the 'domain.action' naming convention`);
    }
  }
  const unique = new Set(CAPABILITY_KEYS);
  if (unique.size !== CAPABILITY_KEYS.length) {
    fail('CAPABILITY_KEYS must not contain duplicates');
  }
}

if (failed) {
  process.exit(1);
}

console.log('PASS: role capability matrix resolves correctly for all 7 checks');
