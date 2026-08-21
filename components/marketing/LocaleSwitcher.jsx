"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LOCALES } from '@/lib/i18n/server';
import { useLanguageStore } from '@/lib/i18n/languageStore';

// Replaces the old kit's LanguageSwitcher on the marketing site: that one
// mutates the client-side languageStore only, which does nothing to a
// server-rendered /[locale]/* URL. This one navigates via a real <Link> (so
// the new locale's Server Component actually renders) AND calls
// setLanguage(next, { explicit: true }) — a deliberate ONE-WAY write,
// marketing -> store, so a visitor reading /en/pricing who then clicks
// "Login" (outside app/[locale]/, still store-driven) lands on an English
// /login. The store never writes back to this URL; see
// components/marketing/MarketingHeader.jsx's header comment for the full
// "URL is the only source of truth under /[locale]/" rule this is the one
// deliberate exception to.
export function LocaleSwitcher({ locale }) {
  const pathname = usePathname() || `/${locale}`;
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const swapLocale = (next) => {
    const segments = pathname.split('/');
    segments[1] = next; // ['', 'az', 'pricing'] -> ['', 'en', 'pricing']
    return segments.join('/') || `/${next}`;
  };

  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] p-0.5">
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <Link
            key={code}
            href={swapLocale(code)}
            onClick={() => setLanguage(code, { explicit: true })}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide transition-colors',
              active ? 'bg-[var(--mkt-brass)] text-[var(--mkt-brass-fg)]' : 'text-[var(--mkt-text-2)] hover:text-[var(--mkt-text)]',
            )}
          >
            {code}
          </Link>
        );
      })}
    </div>
  );
}

export default LocaleSwitcher;
