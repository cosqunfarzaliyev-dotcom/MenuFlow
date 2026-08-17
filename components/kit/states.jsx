"use client";

// ---------------------------------------------------------------------------
// components/kit/states.jsx — empty / loading / error.
//
// Unlike the older kit's four state components (which hardcode bg-[#050505],
// glass-panel and bg-blue-600 and therefore only ever worked on the dark
// shell), these read tokens only — so the exact same component renders
// correctly inside .kit-dark and .kit-light. That was the blocker that kept
// the customer menu from using EmptyState at all.
//
// `inline` vs full-page is an explicit prop rather than two component pairs:
// the same empty state is used both as a whole-tab replacement and inside a
// single card, and those differ only in vertical padding.
// ---------------------------------------------------------------------------
import React from 'react';
import { Inbox, TriangleAlert, RotateCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './primitives';

function StateShell({ full, className, children }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6',
        full ? 'min-h-[60vh] py-16' : 'py-14',
        className,
      )}
    >
      <div className="max-w-sm">{children}</div>
    </div>
  );
}

function StateIcon({ tone = 'neutral', children }) {
  return (
    <div
      className={cn(
        'mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--k-r)]',
        'border border-[var(--k-border)] bg-[var(--k-surface-2)]',
        tone === 'danger' ? 'text-[var(--k-danger)]' : 'text-[var(--k-text-3)]',
      )}
    >
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, full = false, className }) {
  return (
    <StateShell full={full} className={className}>
      <StateIcon>{icon || <Inbox className="w-5 h-5" />}</StateIcon>
      {title && <h3 className="text-[15px] font-semibold text-[var(--k-text)]">{title}</h3>}
      {description && <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--k-text-3)]">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </StateShell>
  );
}

export function LoadingState({ title, description, full = true, className }) {
  return (
    <StateShell full={full} className={className}>
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--k-r)] border border-[var(--k-border)] bg-[var(--k-surface-2)] text-[var(--k-accent)]">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
      {title && <h3 className="text-[15px] font-semibold text-[var(--k-text)]">{title}</h3>}
      {description && <p className="mt-1.5 text-[13px] text-[var(--k-text-3)]">{description}</p>}
    </StateShell>
  );
}

export function ErrorState({ title, description, actionLabel, onRetry, full = true, className }) {
  return (
    <StateShell full={full} className={className}>
      <StateIcon tone="danger"><TriangleAlert className="w-5 h-5" /></StateIcon>
      {title && <h3 className="text-[15px] font-semibold text-[var(--k-text)]">{title}</h3>}
      {description && <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--k-text-3)] break-words">{description}</p>}
      {onRetry && (
        <div className="mt-5 flex justify-center">
          <Button variant="secondary" onClick={onRetry} icon={<RotateCw className="w-3.5 h-3.5" />}>
            {actionLabel}
          </Button>
        </div>
      )}
    </StateShell>
  );
}

/* Whole-page skeleton for the pre-auth / pre-hydration flash. Deliberately
   generic: it stands in for a dashboard, so it sketches a header bar, a stat
   row and a list rather than trying to match any specific screen. */
export function PageSkeleton({ className }) {
  return (
    <div className={cn('min-h-screen bg-[var(--k-bg)] p-4 sm:p-8', className)}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-[var(--k-surface-3)]" />
            <div className="h-3 w-64 animate-pulse rounded bg-[var(--k-surface-2)]" />
          </div>
          <div className="h-9 w-28 animate-pulse rounded-[var(--k-r)] bg-[var(--k-surface-3)]" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[var(--k-r-lg)] border border-[var(--k-border)] bg-[var(--k-surface)]" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-[var(--k-r-lg)] border border-[var(--k-border)] bg-[var(--k-surface)]" />
      </div>
    </div>
  );
}
