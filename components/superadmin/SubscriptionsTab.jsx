"use client";

import React from 'react';
import { motion } from 'motion/react';
import { PLAN_ORDER, planMeta, formatMoney } from './constants';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';

export function SubscriptionsTab({ metrics }) {
  const { t } = useSuperAdminTranslation();
  const totalPaying = PLAN_ORDER.reduce((sum, p) => sum + (p === 'free' ? 0 : metrics.planCounts[p] || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {PLAN_ORDER.map((planId, i) => {
          const meta = planMeta(planId, t);
          const Icon = meta.icon;
          const count = metrics.planCounts[planId] || 0;
          const revenue = metrics.planRevenue[planId] || 0;
          const share = metrics.total === 0 ? 0 : Math.round((count / metrics.total) * 100);
          return (
            <motion.div
              key={planId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-[var(--k-r-lg)] border border-[var(--k-border)] bg-[var(--k-surface)] p-5 flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-11 h-11 rounded-[var(--k-r)] flex items-center justify-center"
                  style={{ backgroundColor: `${meta.color}1a`, border: `1px solid ${meta.color}33` }}
                >
                  <Icon className="w-5 h-5" style={{ color: meta.color }} />
                </div>
                <span className="text-[13px] font-medium text-[var(--k-text-3)]">{share}%</span>
              </div>
              <p className="text-lg font-semibold text-[var(--k-text)] mb-0.5">{meta.label}</p>
              <p className="text-[13px] text-[var(--k-text-3)] mb-4">
                {meta.price === 0 ? t('freeLabel') : `${formatMoney(meta.price)} ${t('perMonthSuffix')}`}
              </p>

              <div className="mt-auto space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[var(--k-text)] text-2xl font-semibold tabular-nums">{count}</span>
                  <span className="text-[13px] text-[var(--k-text-3)]">{t('restaurantsSuffixLower')}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--k-surface-3)] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${share}%` }}
                    transition={{ delay: 0.25 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                </div>
                {planId !== 'free' && (
                  <p className="text-[13px] text-[var(--k-text-2)] pt-1">{formatMoney(revenue)} {t('monthlyRevenueSuffix')}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[var(--k-r-lg)] border border-[var(--k-border)] bg-[var(--k-surface)] p-5 grid grid-cols-2 sm:grid-cols-3 gap-4"
      >
        <div>
          <p className="text-[13px] text-[var(--k-text-3)] mb-1">{t('payingRestaurantsLabel')}</p>
          <p className="text-lg font-semibold text-[var(--k-text)]">{totalPaying}</p>
        </div>
        <div>
          <p className="text-[13px] text-[var(--k-text-3)] mb-1">{t('mrrLabel')}</p>
          <p className="text-lg font-semibold text-[var(--k-text)]">{formatMoney(metrics.mrr)}</p>
        </div>
        <div>
          <p className="text-[13px] text-[var(--k-text-3)] mb-1">{t('arrLabel')}</p>
          <p className="text-lg font-semibold text-[var(--k-text)]">{formatMoney(metrics.arr)}</p>
        </div>
      </motion.div>
    </div>
  );
}

export default SubscriptionsTab;
