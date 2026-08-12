"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import {
  languageSwitcherContainerVariants,
  languageSwitcherButtonVariants,
  LANGUAGE_SWITCHER_ACTIVE_STYLE,
} from './variants';
import { useLanguage } from '@/hooks/useLanguage';
import { setLanguageAndSync } from '@/hooks/useLocaleSync';

const CODES = ['az', 'en', 'ru'];

// One switcher for every surface (Customer/Admin/Staff/SuperAdmin/Auth/
// Onboarding/Pricing) instead of the CustomerApp-only inline control that
// existed before. `profile` is optional and only meaningful for
// authenticated surfaces — when present, a language change is also
// persisted to profiles.locale (migration 0023) via setLanguageAndSync();
// omitted (Customer/Auth/Onboarding/Pricing, nobody signed in yet) it's
// purely local, same behavior CustomerApp already had.
export function LanguageSwitcher({ context = 'dark', profile = null, className, ...props }) {
  const { language } = useLanguage();

  return (
    <div className={cn(languageSwitcherContainerVariants({ context }), className)} {...props}>
      {CODES.map((code) => {
        const active = language === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLanguageAndSync(code, profile)}
            className={languageSwitcherButtonVariants({ context, active })}
            style={active ? LANGUAGE_SWITCHER_ACTIVE_STYLE[context] : undefined}
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

export default LanguageSwitcher;
