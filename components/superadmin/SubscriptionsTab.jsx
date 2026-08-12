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
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="sa-card p-5 flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: `${meta.color}1a`, border: `1px solid ${meta.color}33` }}
                >
                  <Icon className="w-5 h-5" style={{ color: meta.color }} />
                </div>
                <span className="sa-caption font-bold text-slate-500">{share}%</span>
              </div>
              <p className="sa-heading-4 text-white mb-0.5">{meta.label}</p>
              <p className="sa-caption text-slate-500 mb-4">
                {meta.price === 0 ? t('freeLabel') : `${formatMoney(meta.price)} ${t('perMonthSuffix')}`}
              </p>

              <div className="mt-auto space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-white text-2xl font-bold tabular-nums">{count}</span>
                  <span className="sa-caption text-slate-500">{t('restaurantsSuffixLower')}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${share}%` }}
                    transition={{ delay: 0.3 + i * 0.06, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                </div>
                {planId !== 'free' && (
                  <p className="sa-caption text-slate-400 pt-1">{formatMoney(revenue)} {t('monthlyRevenueSuffix')}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.35 }}
        className="sa-card p-5 grid grid-cols-2 sm:grid-cols-3 gap-4"
      >
        <div>
          <p className="sa-caption text-slate-500 mb-1">{t('payingRestaurantsLabel')}</p>
          <p className="sa-heading-4 text-white">{totalPaying}</p>
        </div>
        <div>
          <p className="sa-caption text-slate-500 mb-1">{t('mrrLabel')}</p>
          <p className="sa-heading-4 text-white">{formatMoney(metrics.mrr)}</p>
        </div>
        <div>
          <p className="sa-caption text-slate-500 mb-1">{t('arrLabel')}</p>
          <p className="sa-heading-4 text-white">{formatMoney(metrics.arr)}</p>
        </div>
      </motion.div>
    </div>
  );
}

export default SubscriptionsTab;
