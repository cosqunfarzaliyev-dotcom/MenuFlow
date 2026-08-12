"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/variants';
import { LanguageSwitcher } from '@/components/ui';
import { useMarketingTranslation } from '@/lib/i18n/dictionaries/marketing';

// Shared top nav for the public marketing site (/, /features, /faq, /demo,
// /contact, /pricing). Deliberately NOT the dashboard `Sidebar` primitive —
// that's a vertical drawer built for app shells; this is a horizontal
// top-bar with a simple collapsible mobile panel, a different UX shape.
// `context="dark"` throughout, same as every other primitive here — the
// whole marketing site rides the `.mf-dark` tokens already mounted on
// <body> (app/layout.jsx), no extra theming needed.
const NAV_ITEMS = [
  { href: '/features', key: 'navFeatures' },
  { href: '/pricing', key: 'navPricing' },
  { href: '/faq', key: 'navFaq' },
  { href: '/demo', key: 'navDemo' },
  { href: '/contact', key: 'navContact' },
];

export function MarketingHeader() {
  const { t } = useMarketingTranslation();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#050505]/85 backdrop-blur-xl border-b border-slate-800/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="shrink-0 flex items-center" onClick={() => setMobileOpen(false)}>
          <Image src="/brand/menuflow-logo-dark-bg-h48.png" alt="MenuFlow" width={120} height={18} className="h-5 w-auto object-contain" unoptimized />
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors',
                  active ? 'text-white bg-slate-900' : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:flex items-center gap-3 shrink-0">
          <LanguageSwitcher context="dark" />
          <Link href="/login" className={cn(buttonVariants({ context: 'dark', variant: 'ghost', size: 'sm' }))}>
            {t('loginLink')}
          </Link>
          <Link href="/login?mode=signup" className={cn(buttonVariants({ context: 'dark', variant: 'primary', size: 'sm' }))}>
            {t('getStartedButton')}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? t('closeMenuAriaLabel') : t('openMenuAriaLabel')}
          className="lg:hidden p-2 -mr-2 rounded-xl text-slate-300 hover:bg-slate-900"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-800/80 bg-[#050505] px-4 sm:px-6 py-4 space-y-3">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                    active ? 'text-white bg-slate-900' : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                  )}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            <LanguageSwitcher context="dark" />
            <div className="flex items-center gap-2">
              <Link href="/login" className={cn(buttonVariants({ context: 'dark', variant: 'ghost', size: 'sm' }))}>
                {t('loginLink')}
              </Link>
              <Link href="/login?mode=signup" className={cn(buttonVariants({ context: 'dark', variant: 'primary', size: 'sm' }))}>
                {t('getStartedButton')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default MarketingHeader;
