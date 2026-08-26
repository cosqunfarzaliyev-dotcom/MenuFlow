"use client";

// ---------------------------------------------------------------------------
// components/kit/Sidebar.jsx — ported from the old primitive kit for the
// Admin panel (the first kit-based panel that needs a persistent nav rail;
// Customer/Staff had no equivalent). Same mobile scrim + off-canvas drawer +
// Escape-to-close behavior, restyled onto --k-* tokens instead of --mf-*.
// No Framer Motion here (the older version used it only for the mobile
// scrim's fade) — a plain CSS opacity transition covers that one case
// without pulling motion/react into the kit's dependency footprint.
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS } from './variants';

const BREAKPOINT_CLASSES = {
  md: { sticky: 'md:sticky', flex: 'md:flex', hidden: 'md:hidden' },
  lg: { sticky: 'lg:sticky', flex: 'lg:flex', hidden: 'lg:hidden' },
};

export function Sidebar({
  items,
  activeKey,
  onSelect,
  mobileOpen = false,
  onCloseMobile,
  header,
  footer,
  width = 272,
  breakpoint = 'md',
  className,
}) {
  const bp = BREAKPOINT_CLASSES[breakpoint] || BREAKPOINT_CLASSES.md;
  // Mount the scrim only while open (or animating out) so it doesn't sit in
  // the DOM (and eat clicks) when closed — same two-phase idea Sheet uses,
  // simplified since a scrim fade doesn't need the enter-transition dance.
  const [scrimMounted, setScrimMounted] = useState(mobileOpen);
  useEffect(() => {
    if (mobileOpen) { setScrimMounted(true); return undefined; }
    const timer = setTimeout(() => setScrimMounted(false), 200);
    return () => clearTimeout(timer);
  }, [mobileOpen]);

  const handleSelect = (key) => {
    onSelect(key);
    onCloseMobile?.();
  };

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCloseMobile?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {scrimMounted && (
        <div
          onClick={onCloseMobile}
          className={cn(
            'fixed inset-0 bg-[var(--k-scrim)] backdrop-blur-[2px] z-40',
            'transition-opacity duration-200 ease-[var(--k-ease)]',
            mobileOpen ? 'opacity-100' : 'opacity-0',
            bp.hidden,
          )}
        />
      )}

      <aside
        style={{ width }}
        className={cn(
          'fixed top-0 h-screen z-50 shrink-0 flex-col bg-[var(--k-bg)] border-r border-[var(--k-border)]',
          bp.sticky,
          mobileOpen ? 'flex' : cn('hidden', bp.flex),
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2 px-5 h-16 border-b border-[var(--k-border)] shrink-0">
          <div className="min-w-0 flex-1">{header}</div>
          <button
            onClick={onCloseMobile}
            aria-label="Naviqasiyanı bağla"
            className={cn('p-1.5 rounded-[var(--k-r-sm)] hover:bg-[var(--k-surface-2)] text-[var(--k-text-3)] shrink-0', FOCUS, bp.hidden)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-0.5">
          {items.map((item) => {
            const active = activeKey === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleSelect(item.key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'w-full flex items-center gap-3 px-3 h-10 rounded-[var(--k-r)] text-[13px] font-medium',
                  'transition-colors duration-[var(--k-dur)] ease-[var(--k-ease)]',
                  FOCUS,
                  active
                    ? 'bg-[var(--k-accent-soft)] text-[var(--k-accent)]'
                    : 'text-[var(--k-text-2)] hover:text-[var(--k-text)] hover:bg-[var(--k-surface-2)]',
                )}
              >
                <span className="shrink-0">
                  {item.icon && React.cloneElement(item.icon, { className: 'w-[17px] h-[17px]' })}
                </span>
                <span className="truncate">{item.label}</span>
                {item.badge}
              </button>
            );
          })}
        </nav>

        {footer && <div className="p-3 border-t border-[var(--k-border)] space-y-2 shrink-0">{footer}</div>}
      </aside>
    </>
  );
}

export function SidebarMenuButton({ onClick, breakpoint = 'md', className, ...props }) {
  const bp = BREAKPOINT_CLASSES[breakpoint] || BREAKPOINT_CLASSES.md;
  return (
    <button
      onClick={onClick}
      aria-label="Naviqasiyanı aç"
      className={cn('p-2 -ml-2 rounded-[var(--k-r)] hover:bg-[var(--k-surface-2)] text-[var(--k-text-2)]', FOCUS, bp.hidden, className)}
      {...props}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="18" x2="20" y2="18" />
      </svg>
    </button>
  );
}
