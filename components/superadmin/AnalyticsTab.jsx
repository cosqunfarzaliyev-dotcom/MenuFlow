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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="sa-card p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${accent}1a`, border: `1px solid ${accent}33` }}>
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
        {delta !== undefined && (
          <span className={`sa-caption font-bold flex items-center gap-0.5 ${deltaGood ? 'text-emerald-400' : 'text-rose-400'}`}>
            {deltaGood ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="sa-heading-2 text-white leading-none mb-1">{value}</p>
      <p className="sa-caption text-slate-500 font-medium">{label}</p>
    </motion.div>
  );
}

export function AnalyticsTab({ metrics }) {
  const { t } = useSuperAdminTranslation();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricTile index={0} icon={Wallet} label={t('mrrTileLabel')} value={formatMoney(metrics.mrr)} accent="#38bdf8" />
        <MetricTile index={1} icon={Landmark} label={t('arrTileLabel')} value={formatMoney(metrics.arr)} accent="#a78bfa" />
        <MetricTile index={2} icon={Percent} label={t('churnRateLabel')} value={`${metrics.churnRate}%`} delta={metrics.churnRate} deltaGood={metrics.churnRate === 0} accent="#f87171" />
        <MetricTile
          index={3}
          icon={Activity}
          label={t('growthThisMonthLabel')}
          value={`${metrics.growthRate > 0 ? '+' : ''}${metrics.growthRate}%`}
          delta={metrics.growthRate}
          deltaGood={metrics.growthRate >= 0}
          accent="#34d399"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.35 }}
        className="sa-card p-5"
      >
        <h3 className="sa-heading-4 text-white mb-4">{t('last6MonthsTitle')}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.monthlySignups} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="saGrowthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#fff' }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name={t('newRestaurantSeriesLabel')}
                stroke="#3b82f6"
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
