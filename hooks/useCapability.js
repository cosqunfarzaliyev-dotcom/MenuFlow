"use client";

// Thin React binding over lib/services/capabilityService.js — same shape as
// hooks/useEntitlement.js (that module's own comment explains why the plain
// resolver functions stay the primary API and these hooks are just a
// convenience). Subscribes to `profile?.role` specifically, not the whole
// `profile` object, so a component gating on a capability doesn't re-render
// every time an unrelated profile field changes.

import { useAppStore } from '@/lib/store';
import { getCapabilities, hasCapability } from '@/lib/services/capabilityService';

/** Boolean for a single capability, e.g. useCapability(CAPABILITIES.ORDERS_MANAGE). */
export function useCapability(capabilityKey) {
  const role = useAppStore((state) => state.profile?.role);
  return hasCapability(role, capabilityKey);
}

/** All capabilities at once — for a tab body gating several actions. */
export function useCapabilities() {
  const role = useAppStore((state) => state.profile?.role);
  return getCapabilities(role);
}
