"use client";

// ---------------------------------------------------------------------------
// components/kit/LanguageToggle.jsx
//
// Behaviourally identical to the old kit's LanguageSwitcher — same
// `useLanguage()` store read, same `setLanguageAndSync(code, profile)` write
// (which persists to profiles.locale via the update_my_locale RPC when a
// profile is passed). Only the chrome differs.
//
// It exists as a separate component because the old switcher paints its active
// pill with an INLINE `style` carrying the violet gradient
// (LANGUAGE_SWITCHER_ACTIVE_STYLE) — inline styles cannot be overridden from a
// call site's className, so there was no way to re-skin it for the redesign
// without editing a file the marketing site, /login and /onboarding also
// render. Those nine pages keep the original untouched.
// ---------------------------------------------------------------------------
import React from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import { setLanguageAndSync } from '@/hooks/useLocaleSync';
import { FOCUS } from './variants';

const CODES = ['az', 'en', 'ru'];

export function LanguageToggle({ profile = null, className, ...props }) {
  const { language } = useLanguage();

  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-[var(--k-r)] border border-[var(--k-border)] bg-[var(--k-surface-2)] p-0.5',
        className,
      )}
      {...props}
    >
      {CODES.map((code) => {
        const active = language === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLanguageAndSync(code, profile)}
            className={cn(
              'h-7 rounded-[var(--k-r-sm)] px-2 text-[11px] font-medium uppercase tracking-wide',
              'transition-colors duration-[var(--k-dur)] ease-[var(--k-ease)]',
              FOCUS,
              active
                ? 'bg-[var(--k-surface)] text-[var(--k-text)]'
                : 'text-[var(--k-text-3)] hover:text-[var(--k-text-2)]',
            )}
            id={`lang-btn-${code}`}
            aria-pressed={active}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
