"use client";

// ---------------------------------------------------------------------------
// components/superadmin/ModeSwitcher.jsx
//
// Switches the SuperAdmin panel between "Restaurants" (the panel's original
// six tabs — dashboard/restaurants/plans/subscriptions/analytics/users) and
// "Website" (the Phase 4 addition: SitePagesTab/SiteContactTab/SiteFaqTab,
// managing supabase/migrations/0032_site_content_cms.sql's tables).
//
// Deliberately NOT `kit`'s Tabs: components/kit/variants.js (L183-187)
// documents that Tabs is an underline treatment because it reads as
// NAVIGATION between views of the same data. A mode switch is a CONTROL —
// it changes which six-vs-three tab SET even exists in the sidebar below —
// so a filled segmented pill is the correct shape here, not a contradiction
// of that comment. The class recipe is lifted from components/kit/
// LanguageToggle.jsx (container: border + bg-[var(--k-surface-2)] + p-0.5;
// active cell: bg-[var(--k-surface)]) so this reads as the same design
// system, not a one-off.
//
// Reuses the SuperAdmin bespoke Sidebar (not `kit`'s Sidebar) because that
// one has the collapse animation + shared-layout active pill this panel
// already depends on — see Sidebar.jsx's header comment.
// ---------------------------------------------------------------------------
import React from 'react';
import { motion } from 'motion/react';
import { Building2, Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';
import { MODES } from './modes';

const OPTIONS = [
  { mode: MODES.RESTAURANTS, icon: Building2, labelKey: 'modeRestaurants' },
  { mode: MODES.WEBSITE, icon: Globe2, labelKey: 'modeWebsite' },
];

export function ModeSwitcher({ mode, onModeChange, collapsed }) {
  const { t } = useSuperAdminTranslation();

  if (collapsed) {
    const current = OPTIONS.find((o) => o.mode === mode) || OPTIONS[0];
    const next = OPTIONS.find((o) => o.mode !== mode) || OPTIONS[1];
    const NextIcon = next.icon;
    return (
      <button
        type="button"
        onClick={() => onModeChange(next.mode)}
        title={t(next.labelKey)}
        aria-label={t(next.labelKey)}
        className="mx-auto flex h-9 w-9 items-center justify-center rounded-[var(--k-r)] border border-[var(--k-border)] bg-[var(--k-surface-2)] text-[var(--k-text-2)] hover:text-[var(--k-text)] transition-colors"
      >
        <NextIcon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-0.5 rounded-[var(--k-r)] border border-[var(--k-border)] bg-[var(--k-surface-2)] p-0.5">
      {OPTIONS.map(({ mode: optionMode, icon: Icon, labelKey }) => {
        const active = mode === optionMode;
        return (
          <button
            key={optionMode}
            type="button"
            onClick={() => onModeChange(optionMode)}
            aria-pressed={active}
            className={cn(
              'relative flex h-8 items-center justify-center gap-1.5 rounded-[var(--k-r-sm)] text-[12px] font-medium transition-colors duration-[var(--k-dur)]',
              active ? 'text-[var(--k-text)]' : 'text-[var(--k-text-3)] hover:text-[var(--k-text-2)]',
            )}
          >
            {active && (
              <motion.div
                layoutId="sa-mode-active"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                className="absolute inset-0 rounded-[var(--k-r-sm)] bg-[var(--k-surface)]"
              />
            )}
            <Icon className="h-3.5 w-3.5 shrink-0 relative z-10" />
            <span className="relative z-10 whitespace-nowrap">{t(labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ModeSwitcher;
