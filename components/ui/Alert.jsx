"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { alertVariants } from './variants';

// Structural banner strip — the 3 instances this consolidates (AdminApp
// trial-expiring notice, AdminApp wallet-disabled notice, DesignTab
// banner-disabled notice) all share this shape but differ in whether they
// carry an icon and/or a trailing action. Both are optional slots rather
// than separate props for icon-only vs. dot-only, so a call site keeps full
// control of what its icon looks like (a `<span>` dot today, a lucide icon
// tomorrow) instead of Alert inventing an icon-name API nothing asked for.
export function Alert({ tone = 'info', icon, action, className, children, ...props }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      {icon}
      <div className="flex-1 min-w-0">{children}</div>
      {action}
    </div>
  );
}
