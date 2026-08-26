"use client";

import React from 'react';
import { motion } from 'motion/react';
import { Building2, CheckCircle2, Clock, XCircle, Wallet, Users } from 'lucide-react';
import { StatCard } from './StatCard';
import { planMeta, subscriptionMeta, formatMoney, formatDate, LOCALE_TAGS } from './constants';
import { Tag } from '@/components/kit';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';

export function DashboardTab({ restaurants, metrics, onOpenRestaurant }) {
  const { t, language } = useSuperAdminTranslation();
  const localeTag = LOCALE_TAGS[language] || 'az-AZ';
  const recent = [...restaurants]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard index={0} icon={Building2} label={t('totalRestaurantsLabel')} value={metrics.total} accent="#3b82f6" />
        <StatCard index={1} icon={CheckCircle2} label={t('activeRestaurantLabel')} value={metrics.active} accent="#34d399" />
        <StatCard index={2} icon={Clock} label={t('trialLabel')} value={metrics.trialing} accent="#fbbf24" />
        <StatCard index={3} icon={XCircle} label={t('cancelledLabel')} value={metrics.cancelled} accent="#f87171" />
        <StatCard index={4} icon={Wallet} label={t('monthlyRevenueLabel')} value={metrics.mrr} prefix="" suffix=" ₼" accent="#a78bfa" />
        <StatCard index={5} icon={Users} label={t('activeUserLabel')} value={metrics.activeUsers} accent="#38bdf8" />
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
