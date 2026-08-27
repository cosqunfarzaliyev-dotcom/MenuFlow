"use client";

import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Wallet, Landmark, Percent, Activity } from 'lucide-react';
import {
  ChartCard, ChartTooltip, StatTile,
  chartAxisProps, chartGridProps, chartLineCursor, useChartAnim,
} from '@/components/kit';
import { formatMoney, LOCALE_TAGS } from './constants';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';

// MetricTile used to live here — a fourth copy of the same stat tile, with its
// accent passed in as a raw hex string and composed with `${accent}1a` alpha
// suffixes, which is how hardcoded colour leaked past the token layer on this
// surface. It is now kit's StatTile.
//
// The old tile also carried a bare trend arrow with no number. On the churn and
// growth tiles that arrow duplicated the direction of the percentage already
// shown as the tile's own value, so it is not reproduced: StatTile's `delta` is
// for a change measured against a *different* period than the value itself.

export function AnalyticsTab({ metrics }) {
  const { t, language } = useSuperAdminTranslation();
  const localeTag = LOCALE_TAGS[language] || 'az-AZ';
  const chartAnim = useChartAnim();

  // metrics.js hands back an ISO month start, not a pre-formatted label, so the
  // x-axis follows the panel's selected language. Built from the dictionary's
  // `shortMonthLabel` table rather than `toLocaleDateString(..., { month:
  // 'short' })`: that rendered as a bare "M08" instead of "Avq" wherever the
  // browser's ICU data has no az-AZ month names — a real gap for a locale this
  // uncommon, not just a headless-browser quirk. `getUTCMonth()` matters here
  // too — monthStart is UTC midnight, and a local getMonth() rolls back a day
  // (and a month, at a year boundary) in any negative-UTC-offset timezone.
  const chartData = useMemo(
    () => (metrics.monthlySignups || []).map((row) => ({
      month: t('shortMonthLabel')(new Date(row.monthStart).getUTCMonth()),
      count: row.count,
    })),
    [metrics.monthlySignups, t]
  );

  const signupSeries = useMemo(() => chartData.map((row) => row.count), [chartData]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile index={0} icon={Wallet} colorIndex={1} label={t('mrrTileLabel')} value={formatMoney(metrics.mrr, '₼', localeTag)} />
        <StatTile index={1} icon={Landmark} colorIndex={0} label={t('arrTileLabel')} value={formatMoney(metrics.arr, '₼', localeTag)} />
        <StatTile index={2} icon={Percent} tone="danger" label={t('churnRateLabel')} value={`${metrics.churnRate}%`} />
        {/* The one tile with a real trend to show: the value is this month's
            growth rate, the sparkline is where it came from. */}
        <StatTile
          index={3}
          icon={Activity}
          tone="success"
          label={t('growthThisMonthLabel')}
          value={`${metrics.growthRate > 0 ? '+' : ''}${metrics.growthRate}%`}
          sparkline={signupSeries}
        />
      </div>

      <ChartCard
        title={t('last6MonthsTitle')}
        ariaLabel={t('last6MonthsAria')}
        height={256}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="saGrowthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--k-chart-1)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--k-chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="month" {...chartAxisProps} />
            <YAxis {...chartAxisProps} allowDecimals={false} width={40} />
            <Tooltip cursor={chartLineCursor} content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              name={t('newRestaurantSeriesLabel')}
              stroke="var(--k-chart-1)"
              strokeWidth={2}
              fill="url(#saGrowthFill)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--k-surface)' }}
              {...chartAnim}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

export default AnalyticsTab;
