"use client";

import React from 'react';
import { motion } from 'motion/react';
import { Building2, CheckCircle2, Clock, XCircle, Wallet, Users } from 'lucide-react';
import { StatCard } from './StatCard';
import { planMeta, subscriptionMeta, formatMoney, formatDate, LOCALE_TAGS } from './constants';
import { Badge } from '@/components/ui';
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
        transition={{ delay: 0.25, duration: 0.35 }}
        className="sa-card p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="sa-heading-4 text-white">{t('recentRestaurantsTitle')}</h3>
        </div>
        {recent.length === 0 ? (
          <p className="sa-caption text-slate-500 text-center py-8">{t('noRestaurantsYet')}</p>
        ) : (
          <div className="space-y-1.5">
            {recent.map((r) => {
              const plan = planMeta(r.plan, t);
              const status = subscriptionMeta(r.subscription_status, t);
              return (
                <button
                  key={r.id}
                  onClick={() => onOpenRestaurant?.(r)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-slate-800/50 transition text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                    {r.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.logo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{r.name}</p>
                    <p className="sa-caption text-slate-500">{formatDate(r.created_at, localeTag)}</p>
                  </div>
                  <span className="sa-caption font-bold" style={{ color: plan.color }}>{plan.label}</span>
                  {/* tone is a closest-match placeholder; className override
                      reproduces subscriptionMeta()'s exact per-status colors
                      (same technique used in RestaurantsTab/UsersTab/PlansTab). */}
                  <Badge tone="neutral" className={`border ${status.bg} ${status.text} ${status.border}`}>
                    {status.label}
                  </Badge>
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
