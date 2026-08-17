"use client";

import React from 'react';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Landmark, Percent, Activity } from 'lucide-react';
import { formatMoney } from './constants';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';

function MetricTile({ icon: Icon, label, value, delta, deltaGood, accent, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-[var(--k-r-lg)] border border-[var(--k-border)] bg-[var(--k-surface)] p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-[var(--k-r)] flex items-center justify-center" style={{ backgroundColor: `${accent}1a`, border: `1px solid ${accent}33` }}>
          <Icon className="w-[18px] h-[18px]" style={{ color: accent }} />
        </div>
        {delta !== undefined && (
          <span className={`text-[13px] font-medium flex items-center gap-0.5 ${deltaGood ? 'text-[var(--k-success)]' : 'text-[var(--k-danger)]'}`}>
            {deltaGood ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="text-[26px] font-semibold text-[var(--k-text)] leading-none mb-1 tracking-[-0.02em]">{value}</p>
      <p className="text-[13px] text-[var(--k-text-3)] font-medium">{label}</p>
    </motion.div>
  );
}

export function AnalyticsTab({ metrics }) {
  const { t } = useSuperAdminTranslation();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricTile index={0} icon={Wallet} label={t('mrrTileLabel')} value={formatMoney(metrics.mrr)} accent="#60A5FA" />
        <MetricTile index={1} icon={Landmark} label={t('arrTileLabel')} value={formatMoney(metrics.arr)} accent="#F97316" />
        <MetricTile index={2} icon={Percent} label={t('churnRateLabel')} value={`${metrics.churnRate}%`} delta={metrics.churnRate} deltaGood={metrics.churnRate === 0} accent="#F87171" />
        <MetricTile
          index={3}
          icon={Activity}
          label={t('growthThisMonthLabel')}
          value={`${metrics.growthRate > 0 ? '+' : ''}${metrics.growthRate}%`}
          delta={metrics.growthRate}
          deltaGood={metrics.growthRate >= 0}
          accent="#34D399"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[var(--k-r-lg)] border border-[var(--k-border)] bg-[var(--k-surface)] p-5"
      >
        <h3 className="text-[15px] font-semibold text-[var(--k-text)] mb-4">{t('last6MonthsTitle')}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.monthlySignups} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="saGrowthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--k-accent)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--k-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--k-border)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--k-text-3)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--k-text-3)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip
                contentStyle={{ background: 'var(--k-surface-2)', border: '1px solid var(--k-border)', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: 'var(--k-text-3)' }}
                itemStyle={{ color: 'var(--k-text)' }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name={t('newRestaurantSeriesLabel')}
                stroke="var(--k-accent)"
                strokeWidth={2.5}
                fill="url(#saGrowthFill)"
                animationDuration={1100}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}

export default AnalyticsTab;
