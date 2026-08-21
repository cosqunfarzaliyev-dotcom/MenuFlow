"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/mkt/variants';
import { getMarketingDictionary } from '@/lib/i18n/server';
import { LocaleSwitcher } from './LocaleSwitcher';

// Shared top nav for the public marketing site (/[locale], /[locale]/features,
// /[locale]/faq, /[locale]/demo, /[locale]/contact, /[locale]/pricing).
// Deliberately NOT the dashboard `Sidebar` primitive — that's a vertical
// drawer built for app shells; this is a horizontal top-bar with a simple
// collapsible mobile panel, a different UX shape. `context="dark"`
// throughout, same as every other primitive here — the whole marketing site
// rides the `.mf-dark` tokens already mounted on <body> (app/layout.jsx), no
// extra theming needed.
//
// Client Component (needs usePathname() for active-link state and mobileOpen
// state), but the URL is still the only source of truth for LANGUAGE: this
// takes `locale` as a prop (read from the route segment by the Server
// Component page/layout above it) and resolves its own strings via
// getMarketingDictionary(locale) — a pure function, safe to call
// client-side — rather than the client-store hook useMarketingTranslation()
// (lib/i18n/languageStore.js), which app/[locale]/** must never read from.
const NAV_ITEMS = [
  { slug: 'features', key: 'navFeatures' },
  { slug: 'pricing', key: 'navPricing' },
  { slug: 'faq', key: 'navFaq' },
  { slug: 'demo', key: 'navDemo' },
  { slug: 'contact', key: 'navContact' },
];

export function MarketingHeader({ locale }) {
  const { t } = getMarketingDictionary(locale);
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const href = (slug) => (slug ? `/${locale}/${slug}` : `/${locale}`);

  return (
    <header className="sticky top-0 z-40 bg-[var(--mkt-ground)]/90 backdrop-blur-xl border-b border-[var(--mkt-line)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href={href()} className="shrink-0 flex items-center" onClick={() => setMobileOpen(false)}>
          <Image src="/brand/menuflow-logo-mkt-h48.png" alt="MenuFlow" width={120} height={18} className="h-5 w-auto object-contain" unoptimized />
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === href(item.slug);
            return (
              <Link
                key={item.slug}
                href={href(item.slug)}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors',
                  active ? 'text-[var(--mkt-text)] bg-[var(--mkt-surface-2)]' : 'text-[var(--mkt-text-2)] hover:text-[var(--mkt-text)] hover:bg-[var(--mkt-surface-2)]'
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:flex items-center gap-3 shrink-0">
          <LocaleSwitcher locale={locale} />
          <Link href={href('contact')} className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}>
            {t('getStartedButton')}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? t('closeMenuAriaLabel') : t('openMenuAriaLabel')}
          className="lg:hidden p-2 -mr-2 rounded-xl text-[var(--mkt-text-2)] hover:bg-[var(--mkt-surface-2)]"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-[var(--mkt-line)] bg-[var(--mkt-ground)] px-4 sm:px-6 py-4 space-y-3">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === href(item.slug);
              return (
                <Link
                  key={item.slug}
                  href={href(item.slug)}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                    active ? 'text-[var(--mkt-text)] bg-[var(--mkt-surface-2)]' : 'text-[var(--mkt-text-2)] hover:text-[var(--mkt-text)] hover:bg-[var(--mkt-surface-2)]'
                  )}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--mkt-line)]">
            <LocaleSwitcher locale={locale} />
            <Link href={href('contact')} className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}>
              {t('getStartedButton')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export default MarketingHeader;
