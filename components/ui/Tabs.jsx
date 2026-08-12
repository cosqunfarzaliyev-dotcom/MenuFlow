"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { tabsListVariants, tabsTriggerVariants } from './variants';

// Deliberately not a state-owning compound component (no internal
// value/onChange context) — every current and near-term consumer already
// owns its `activeTab` state (StaffApp today; AdminApp/PaymentsManagement in
// Phase B), so Tabs just renders the list/trigger chrome around state the
// caller already has, the same way the existing Button/Input primitives
// don't own form state either.
export function Tabs({ context = 'dark', className, children, ...props }) {
  return (
    <div role="tablist" className={cn(tabsListVariants({ context }), className)} {...props}>
      {children}
    </div>
  );
}

export function TabsTrigger({ context = 'dark', active = false, accent = 'primary', className, children, ...props }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(tabsTriggerVariants({ context, active, accent }), className)}
      {...props}
    >
      {children}
    </button>
  );
}
