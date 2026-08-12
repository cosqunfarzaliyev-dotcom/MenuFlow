"use client";

// Thin React binding over lib/services/entitlementService.js.
//
// The plain hasFeature()/getEntitlements() functions stay the primary API —
// they work inside services and event handlers where hooks can't go. These
// hooks exist only so a component doesn't have to pull `restaurant` out of the
// store by hand every time it wants to gate one element.
//
// Both subscribe to the `restaurant` slice specifically, so a component that
// only cares about entitlements doesn't re-render on unrelated store writes
// (orders/alerts churn constantly via realtime).

import { useAppStore } from '@/lib/store';
import { getEntitlements, hasFeature } from '@/lib/services/entitlementService';

/** Boolean for a single feature, e.g. useFeature(FEATURES.BANNERS). */
export function useFeature(featureKey) {
  const restaurant = useAppStore((state) => state.restaurant);
  return hasFeature(restaurant, featureKey);
}

/** All features at once — for components gating several things. */
export function useEntitlements() {
  const restaurant = useAppStore((state) => state.restaurant);
  return getEntitlements(restaurant);
}
