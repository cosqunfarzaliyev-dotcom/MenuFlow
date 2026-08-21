"use client";

// Fade-up-on-scroll wrapper for marketing sections ("saytı scrol etdikcə
// yazılar/şəkillər gəlsin") — a `whileInView` reveal, not the scroll-linked
// parallax TableHero.jsx uses (useScroll/useTransform tracks continuous
// scroll position; this is a one-time "this section arrived on screen"
// trigger, the right primitive for "content appears as you scroll to it").
// `viewport={{ once: true }}` so a section never re-plays scrolling back up.
//
// Timing/easing (0.5s, cubic-bezier(0.16, 1, 0.3, 1)) matches
// components/mkt/tokens.css's --mkt-dur-slow/--mkt-ease exactly — motion's
// `transition` prop needs real numbers, not CSS var strings, so these are
// hardcoded to the token's current values rather than reading the token
// itself; keep them in sync if tokens.css's motion values ever change.
// Collapses to an instant, no-motion reveal under prefers-reduced-motion,
// mirroring TableHero.jsx's own useReducedMotion handling.
import { motion, useReducedMotion } from 'motion/react';

export function Reveal({ children, className = '', delay = 0 }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default Reveal;
