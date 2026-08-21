"use client";

// components/mkt/primitives.jsx — the small set of components the marketing
// site actually needs, ported from the old --mf-* primitives onto --mkt-* tokens.
// Deliberately not a 1:1 port of every ui/ component: this file exists only
// for what app/[locale]/** and components/marketing/** actually import (see
// the grep this replaces: Card/CardBody/Badge/Tabs/TabsTrigger/EmptyState).
import React from 'react';
import { cn } from '@/lib/utils';
import { cardVariants, badgeVariants, tabsListVariants, tabsTriggerVariants } from './variants';

export function Card({ variant, className, children, ...props }) {
  return <div className={cn(cardVariants({ variant }), className)} {...props}>{children}</div>;
}

export function CardBody({ className, children, ...props }) {
  return <div className={cn('p-5 sm:p-6', className)} {...props}>{children}</div>;
}

export function Badge({ tone, className, children, ...props }) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props}>{children}</span>;
}

// Underline tabs — navigation between views of the same data (billing
// interval, in PricingToggle's case), same intent as kit's Tabs
// (components/kit/variants.js's comment on why this is an underline and not
// a filled segmented control applies here too).
export function Tabs({ className, children, ...props }) {
  return <div role="tablist" className={cn(tabsListVariants, className)} {...props}>{children}</div>;
}

export function TabsTrigger({ active, className, children, ...props }) {
  return (
    <button type="button" role="tab" aria-selected={active} className={cn(tabsTriggerVariants({ active }), className)} {...props}>
      {children}
    </button>
  );
}

export function EmptyState({ icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-[var(--mkt-r-lg)] border border-dashed border-[var(--mkt-line)] px-6 py-16 text-center', className)}>
      {icon && <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--mkt-surface-2)] text-[var(--mkt-text-3)]">{icon}</div>}
      {title && <h3 className="text-[var(--mkt-text)] font-semibold">{title}</h3>}
      {description && <p className="max-w-sm text-sm text-[var(--mkt-text-3)]">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

