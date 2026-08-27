"use client";

import React from 'react';
import { motion } from 'motion/react';
import { Building2, CheckCircle2, Clock, XCircle, Wallet, Users } from 'lucide-react';
import { planMeta, subscriptionMeta, formatMoney, formatDate, LOCALE_TAGS } from './constants';
import { Tag, StatTile } from '@/components/kit';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';

export function DashboardTab({ restaurants, metrics, onOpenRestaurant }) {
  const { t, language } = useSuperAdminTranslation();
  const localeTag = LOCALE_TAGS[language] || 'az-AZ';
  // Whole counts stay locale-grouped (1 234, not 1234) while counting up.
  const counted = (v) => Math.round(v).toLocaleString(localeTag);
  const recent = [...restaurants]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Accents were raw hex here (#3b82f6, #34d399, …) composed into
            `${accent}1a` fills. They are tokens now: a tile whose figure means
            something wears the matching semantic tone, and the two that are
            just counts wear a chart slot. */}
        <StatTile index={0} icon={Building2} colorIndex={1} label={t('totalRestaurantsLabel')} countTo={metrics.total} formatCount={counted} />
        <StatTile index={1} icon={CheckCircle2} tone="success" label={t('activeRestaurantLabel')} countTo={metrics.active} formatCount={counted} />
        <StatTile index={2} icon={Clock} tone="warning" label={t('trialLabel')} countTo={metrics.trialing} formatCount={counted} />
        <StatTile index={3} icon={XCircle} tone="danger" label={t('cancelledLabel')} countTo={metrics.cancelled} formatCount={counted} />
        <StatTile index={4} icon={Wallet} colorIndex={4} label={t('monthlyRevenueLabel')} countTo={metrics.mrr} formatCount={(v) => formatMoney(v, '₼', localeTag)} />
        <StatTile index={5} icon={Users} colorIndex={3} label={t('activeUserLabel')} countTo={metrics.activeUsers} formatCount={counted} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[var(--k-r-lg)] border border-[var(--k-border)] bg-[var(--k-surface)] p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-[var(--k-text)]">{t('recentRestaurantsTitle')}</h3>
        </div>
        {recent.length === 0 ? (
          <p className="text-[13px] text-[var(--k-text-3)] text-center py-8">{t('noRestaurantsYet')}</p>
        ) : (
          <div className="space-y-1.5">
            {recent.map((r) => {
              const plan = planMeta(r.plan, t);
              const status = subscriptionMeta(r.subscription_status, t);
              return (
                <button
                  key={r.id}
                  onClick={() => onOpenRestaurant?.(r)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--k-r)] hover:bg-[var(--k-surface-2)] transition-colors text-left"
                >
                  {/* Generic icon only — see RestaurantsTab.jsx's row avatar
                      for why a restaurant's own logo is never rendered in the
                      super admin panel. */}
                  <div className="w-9 h-9 rounded-[var(--k-r)] bg-[var(--k-surface-3)] flex items-center justify-center overflow-hidden shrink-0">
                    <Building2 className="w-4 h-4 text-[var(--k-text-3)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--k-text)] text-sm font-medium truncate">{r.name}</p>
                    <p className="text-[13px] text-[var(--k-text-3)]">{formatDate(r.created_at, localeTag)}</p>
                  </div>
                  <span className="text-[13px] font-medium" style={{ color: plan.color }}>{plan.label}</span>
                  {/* tone is a closest-match placeholder; className override
                      reproduces subscriptionMeta()'s exact per-status colors
                      (same technique used in RestaurantsTab/UsersTab/PlansTab). */}
                  <Tag tone="neutral" className={`border ${status.bg} ${status.text} ${status.border}`}>
                    {status.label}
                  </Tag>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default DashboardTab;
