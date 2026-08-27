"use client";

// ---------------------------------------------------------------------------
// One category in the customer menu's horizontal category strip: a rounded
// icon square with its label underneath.
//
// Extracted out of CustomerApp.jsx so the marketing site's phone mockup
// (components/marketing/PhoneShowcase.jsx) renders the REAL tile instead of a
// look-alike. It previously drew its own pill-shaped tabs, which is how the
// "demo menu" and the actual menu drifted into looking like two different
// products — the thing this file now makes impossible.
//
// Reads --k-* tokens, so it must live under a .kit-light/.kit-dark ancestor
// (components/kit/tokens.css). Both call sites already provide one.
// ---------------------------------------------------------------------------
import React from 'react';
import { cn } from '@/lib/utils';

export function CategoryTile({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="group flex w-[68px] shrink-0 flex-col items-center gap-1.5 focus-visible:outline-none"
    >
      <span
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-[var(--k-r-lg)] border transition-colors duration-[var(--k-dur)]',
          'group-focus-visible:ring-2 group-focus-visible:ring-[var(--k-focus)]',
          active
            ? 'border-[var(--k-accent)] bg-[var(--k-accent)] text-[var(--k-accent-fg)]'
            : 'border-transparent bg-[var(--k-accent-soft)] text-[var(--k-accent)]',
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          'line-clamp-2 w-full text-center text-[11px] leading-tight',
          active ? 'font-semibold text-[var(--k-text)]' : 'font-medium text-[var(--k-text-3)]',
        )}
      >
        {label}
      </span>
    </button>
  );
}

export default CategoryTile;
