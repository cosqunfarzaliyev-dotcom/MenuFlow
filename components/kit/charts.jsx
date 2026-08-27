"use client";

// ---------------------------------------------------------------------------
// components/kit/charts.jsx — the shared data-visualisation layer for the four
// panels. Everything here reads --k-* tokens only, so a chart renders correctly
// in .kit-dark and .kit-light without branching.
//
// Why this file exists: the Admin and SuperAdmin dashboards had six charts and
// four independent copies of the same stat tile, each with its own inline
// palette, its own tooltip style object and its own animation curve. Beyond the
// duplication, the shared recipe carried real defects — dashed gridlines,
// semantic status colours used as a categorical palette, donuts with a legend
// underneath restating the exact same numbers, and bars left to fill their whole
// band. This module is the single recipe all of them now follow.
//
// The rules encoded below (thin marks, solid hairline grid, capped bar width,
// 2px surface ring on markers, no number on every point, text never wears the
// series colour) are the same ones the palette in tokens.css was validated
// against — they are a set, not preferences. Changing one in a call site
// re-introduces the thing it was written to prevent.
// ---------------------------------------------------------------------------
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardBody } from './primitives';
import { EmptyState } from './states';

/* ── Palette ──────────────────────────────────────────────────────────────
   Fixed order, never cycled. Colour follows the entity, not its rank: a filter
   that drops a series must not repaint the survivors, so call sites index this
   by a stable key's position, never by the current row number when that row
   number can change. Past six, fold the tail into "Other" (see foldToTop)
   rather than reaching for a seventh hue — a generated one is indistinguishable
   from an existing slot under colour blindness. */
export const CHART_COLORS = [
  'var(--k-chart-1)',
  'var(--k-chart-2)',
  'var(--k-chart-3)',
  'var(--k-chart-4)',
  'var(--k-chart-5)',
  'var(--k-chart-6)',
];

export const chartColor = (i) => CHART_COLORS[i % CHART_COLORS.length];

/**
 * Keep the top `limit` rows and sum the rest into a single "other" row, so a
 * long tail never forces a 7th colour or an unreadable axis.
 * `rows` are `{ name, value }`; returns the same shape.
 */
export function foldToTop(rows, limit, otherLabel) {
  if (!Array.isArray(rows) || rows.length <= limit) return rows || [];
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, limit);
  const tail = sorted.slice(limit).reduce((sum, r) => sum + (Number(r.value) || 0), 0);
  return tail > 0 ? [...head, { name: otherLabel, value: tail, isOther: true }] : head;
}

/* ── Motion ───────────────────────────────────────────────────────────────
   One duration for every chart. recharts takes milliseconds and a named easing
   rather than a CSS variable, so --k-dur-slow can't be referenced directly;
   420ms is that curve's feel at a length that still reads as a chart drawing
   itself. The old values (1100ms here, 900ms on the count-up, 500ms on the
   plan bars) made three surfaces of the same product animate at three speeds. */
export const CHART_ANIM_MS = 420;

/** recharts animation props, honouring the user's reduced-motion setting. */
export function useChartAnim() {
  const reduced = useReducedMotion();
  return useMemo(
    () => ({
      isAnimationActive: !reduced,
      animationDuration: CHART_ANIM_MS,
      animationEasing: 'ease-out',
    }),
    [reduced],
  );
}

/* ── Axes & grid ──────────────────────────────────────────────────────────
   Recessive by design: the data is the only thing allowed to be loud. The grid
   is SOLID — dashes add ink that isn't data and read as "threshold" or
   "projection" when it is only a reference line. */
export const chartAxisProps = {
  stroke: 'var(--k-text-3)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
};

export const chartGridProps = {
  stroke: 'var(--k-grid)',
  vertical: false,
  strokeWidth: 1,
};

/** Hover band behind the tooltip — a wash, not a block. */
export const chartCursor = { fill: 'var(--k-surface-3)', fillOpacity: 0.5 };

/** Crosshair for line/area charts, where a filled band would hide the mark. */
export const chartLineCursor = { stroke: 'var(--k-border-2)', strokeWidth: 1 };

/* ── Tooltip ──────────────────────────────────────────────────────────────
   A component rather than recharts' `contentStyle` object, because the default
   markup puts the value in the series colour — and a chart hue is chosen to sit
   on a surface as a *mark*, not to be legible as text. Identity comes from the
   dot beside the label; the text itself wears text tokens. */
export function ChartTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--k-r)] border border-[var(--k-border)] bg-[var(--k-surface-2)] px-3 py-2">
      {label != null && label !== '' && (
        <p className="mb-1.5 text-[11px] font-medium text-[var(--k-text-3)]">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2.5 text-[13px]">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.color || entry.payload?.fill }}
          />
          <span className="text-[var(--k-text-2)]">{entry.name}</span>
          <span className="k-nums ml-auto pl-3 font-semibold text-[var(--k-text)]">
            {formatter ? formatter(entry.value, entry) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Chart card ───────────────────────────────────────────────────────────
   Wraps a plot in the kit Card and carries the accessibility contract every
   chart in the panels was missing: `role="img"` + a label that states what is
   plotted, so the chart is not a blank div to a screen reader.

   `height` sizes the plot only — the x-axis band lives inside it, which is why
   the value is passed to the inner div rather than to the Card: a fixed height
   on the card is how a chart ends up with its own tiny nested scrollbar. */
export function ChartCard({
  title,
  icon,
  description,
  actions,
  ariaLabel,
  height = 260,
  isEmpty = false,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  className,
  children,
}) {
  return (
    <Card variant="plain" className={className}>
      {/* CardHeader takes EITHER title/description/actions OR children — passing
          children means its own actions slot is ignored, so the header row is
          composed here instead. */}
      <CardHeader>
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 truncate text-sm font-semibold text-[var(--k-text)]">
            {icon}
            {title}
          </h3>
          {description && <p className="mt-0.5 text-xs text-[var(--k-text-3)]">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardBody>
        {isEmpty ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
        ) : (
          <div role="img" aria-label={ariaLabel || title} style={{ height }}>
            {children}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ── Ranked bar list ──────────────────────────────────────────────────────
   The replacement for the two donuts and the two hand-rolled progress lists.

   A donut can only be read at a glance for part-to-whole; it cannot be used to
   compare values that sit close together, which is exactly what "revenue by
   table" and "items sold by category" are. Both donuts also had a legend
   underneath printing the same numbers — so the ring cost a third of the card
   and added nothing the list didn't already say. One ranked row carries name,
   magnitude (bar length), exact value and share at once.

   Every row is one colour on purpose. This is a ranking of one measure, not six
   identities; colouring each row differently would burn the only free channel
   on information the bar length already encodes. */
export function RankedBarList({
  rows,
  total,
  formatValue,
  showShare = true,
  colorIndex = 0,
  numbered = true,
  className,
}) {
  const reduced = useReducedMotion();
  const sum = total ?? rows.reduce((acc, r) => acc + (Number(r.value) || 0), 0);
  const max = rows.reduce((acc, r) => Math.max(acc, Number(r.value) || 0), 0);
  const fill = chartColor(colorIndex);

  return (
    <ul className={cn('space-y-3', className)}>
      {rows.map((row, i) => {
        // Bars scale to the LARGEST row, not to the total: against the total a
        // top item holding 12% of revenue draws a stub, and the ranking — the
        // whole point of the list — becomes unreadable. The share percentage
        // beside it carries the part-to-whole reading instead.
        const width = max > 0 ? Math.max(2, (Number(row.value) / max) * 100) : 0;
        const share = sum > 0 ? Math.round((Number(row.value) / sum) * 100) : 0;
        return (
          <li key={row.key ?? row.name ?? i} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate font-medium text-[var(--k-text-2)]">
                {numbered && <span className="text-[var(--k-text-3)]">{i + 1}. </span>}
                {row.name}
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="k-nums font-semibold text-[var(--k-text)]">
                  {formatValue ? formatValue(row.value) : row.value}
                </span>
                {showShare && <span className="k-nums text-[11px] text-[var(--k-text-3)]">{share}%</span>}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--k-surface-3)]">
              <motion.div
                initial={reduced ? false : { width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: reduced ? 0 : 0.42, delay: reduced ? 0 : i * 0.04, ease: [0.2, 0, 0, 1] }}
                className="h-full rounded-full"
                style={{ backgroundColor: row.color || fill }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Sparkline ────────────────────────────────────────────────────────────
   Hand-drawn SVG rather than a recharts instance: a dozen 24px-tall sparklines
   on one screen would each mount a ResponsiveContainer and a ResizeObserver for
   a polyline. `preserveAspectRatio="none"` lets one viewBox stretch to whatever
   width the tile gives it. Decorative — the tile's value and delta carry the
   information — so it is hidden from assistive tech rather than labelled. */
export function Sparkline({ values, color, width = 72, height = 24, className }) {
  const points = useMemo(() => {
    const nums = (values || []).map((v) => Number(v) || 0);
    if (nums.length < 2) return null;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const span = max - min || 1;
    const step = 100 / (nums.length - 1);
    // Inset by the stroke's half-width so the extremes aren't clipped.
    return nums
      .map((v, i) => `${(i * step).toFixed(2)},${(94 - ((v - min) / span) * 88).toFixed(2)}`)
      .join(' ');
  }, [values]);

  if (!points) return null;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      width={width}
      height={height}
      className={cn('overflow-visible', className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color || chartColor(0)}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Count-up ─────────────────────────────────────────────────────────────
   Moved here from components/superadmin/StatCard.jsx so the Admin tiles get it
   too, and given the reduced-motion check it never had: an animated number is
   exactly the kind of motion the setting exists to suppress. */
export function useCountUp(value, duration = CHART_ANIM_MS + 260) {
  const reduced = useReducedMotion();
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(0);
  const frame = useRef(null);

  useEffect(() => {
    // The reduced-motion case returns `target` below instead of writing it to
    // state here: a synchronous setState in an effect body cascades a render,
    // and it is the one branch that needs no animation state at all.
    if (reduced) return undefined;
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration, reduced]);

  return reduced ? target : display;
}

/* ── Stat tile ────────────────────────────────────────────────────────────
   One tile for all four panels. It replaces AdminApp's KpiCard, SalesReportView's
   ReportKpiCard, SuperAdmin's StatCard and AnalyticsTab's MetricTile — four
   copies that had drifted into two visibly different designs (Admin: small
   horizontal row, no animation; SuperAdmin: large vertical number with a
   count-up), so the same figure looked like it belonged to a different product
   depending on which panel you were in.

   `value` is pre-formatted by the caller (currency, locale, percent) — the tile
   has no opinion about units. Pass `countTo` as well to animate a number in;
   the animated digits then replace `value` while counting, which is why
   `formatCount` is required alongside it.

   Numbers here use PROPORTIONAL figures, not tabular: tabular-nums gives every
   digit the width of a zero, which reads loose at 26px. Tabular is for columns
   that must align vertically — table rows and axis ticks (the .k-nums class). */
export function StatTile({
  icon: Icon,
  label,
  value,
  countTo,
  formatCount,
  tone = 'accent',
  colorIndex,
  delta,
  deltaLabel,
  deltaGood = true,
  sparkline,
  index = 0,
  className,
}) {
  const reduced = useReducedMotion();
  const animated = useCountUp(countTo ?? 0);
  const hasCount = countTo != null && typeof formatCount === 'function';

  // Tonal icon well. `colorIndex` opts a tile into the chart palette so it can
  // match the series it summarises; otherwise it wears a semantic tone, which
  // is legitimate here — a tile means something (revenue, failures), unlike a
  // categorical series which only has identity.
  const seriesColor = colorIndex != null ? chartColor(colorIndex) : null;
  const toneClass = {
    accent: 'bg-[var(--k-accent-soft)] text-[var(--k-accent)]',
    success: 'bg-[var(--k-success-soft)] text-[var(--k-success)]',
    warning: 'bg-[var(--k-warning-soft)] text-[var(--k-warning)]',
    danger: 'bg-[var(--k-danger-soft)] text-[var(--k-danger)]',
    info: 'bg-[var(--k-info-soft)] text-[var(--k-info)]',
    neutral: 'bg-[var(--k-surface-3)] text-[var(--k-text-2)]',
  }[tone] || 'bg-[var(--k-accent-soft)] text-[var(--k-accent)]';

  // The sparkline follows whatever the icon well wears, so the trend line and
  // the tile read as one object. Without this it fell back to muted grey on
  // every tile that used a semantic tone rather than a chart slot.
  const sparkColor = seriesColor || {
    accent: 'var(--k-accent)',
    success: 'var(--k-success)',
    warning: 'var(--k-warning)',
    danger: 'var(--k-danger)',
    info: 'var(--k-info)',
    neutral: 'var(--k-text-3)',
  }[tone] || 'var(--k-accent)';

  const deltaTone = delta == null
    ? null
    : (delta === 0
      ? 'text-[var(--k-text-3)]'
      : ((delta > 0) === deltaGood ? 'text-[var(--k-success)]' : 'text-[var(--k-danger)]'));

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduced ? 0 : index * 0.04, duration: 0.24, ease: [0.2, 0, 0, 1] }}
      className={cn(
        'rounded-[var(--k-r-lg)] border border-[var(--k-border)] bg-[var(--k-surface)] p-4 sm:p-5',
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        {Icon && (
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--k-r)]',
              seriesColor ? '' : toneClass,
            )}
            style={seriesColor
              ? { backgroundColor: `color-mix(in srgb, ${seriesColor} 14%, transparent)`, color: seriesColor }
              : undefined}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        {sparkline?.length > 1 && (
          <Sparkline values={sparkline} color={sparkColor} className="mt-1" />
        )}
      </div>

      <p className="mb-1 truncate text-[26px] font-semibold leading-none tracking-[-0.02em] text-[var(--k-text)]">
        {hasCount ? formatCount(animated) : value}
      </p>

      <div className="flex items-baseline gap-2">
        <p className="min-w-0 truncate text-[13px] font-medium text-[var(--k-text-3)]">{label}</p>
        {deltaTone && (
          <span className={cn('k-nums shrink-0 text-[12px] font-semibold', deltaTone)}>
            {delta > 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      {deltaTone && deltaLabel && (
        <p className="mt-0.5 truncate text-[11px] text-[var(--k-text-3)]">{deltaLabel}</p>
      )}
    </motion.div>
  );
}
