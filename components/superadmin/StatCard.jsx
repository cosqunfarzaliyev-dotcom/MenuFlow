"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { LOCALE_TAGS } from './constants';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';

// Animates from 0 to `value` over ~900ms using an ease-out curve.
function useCountUp(value, duration = 900) {
  const [display, setDisplay] = useState(0);
  const frame = useRef(null);

  useEffect(() => {
    const target = Number(value) || 0;
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
  }, [value, duration]);

  return display;
}

export function StatCard({ icon: Icon, label, value, prefix = '', suffix = '', decimals = 0, accent = '#3b82f6', index = 0 }) {
  const { language } = useSuperAdminTranslation();
  const animated = useCountUp(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="sa-card p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: `${accent}1a`, border: `1px solid ${accent}33` }}
        >
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
      </div>
      <p className="sa-heading-2 text-white tabular-nums leading-none mb-1">
        {prefix}
        {animated.toLocaleString(LOCALE_TAGS[language] || 'az-AZ', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
        {suffix}
      </p>
      <p className="sa-caption text-slate-500 font-medium">{label}</p>
    </motion.div>
  );
}

export default StatCard;
