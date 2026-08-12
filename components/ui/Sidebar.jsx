"use client";

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Generalizes the mobile scrim + off-canvas drawer + hamburger-close pattern
// already proven in components/superadmin/Sidebar.jsx — that file is kept
// exactly as-is (it's SuperAdmin's own `.sa-*` visual language, already
// polished, not broken) rather than migrated onto this, but a SECOND
// dashboard shouldn't have to reinvent the same interaction from scratch.
// AdminApp's sidebar had none of this at all: `hidden md:flex` with no
// fallback meant a restaurant_admin on a phone could never switch tabs.
//
// `breakpoint` is a literal lookup, not string interpolation, so every class
// name Tailwind needs to see stays a real substring in this file regardless
// of what any consumer passes at runtime.
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
  width = 280,
  breakpoint = 'md',
  className,
}) {
  const bp = BREAKPOINT_CLASSES[breakpoint] || BREAKPOINT_CLASSES.md;

  // Picking a nav item on mobile also closes the drawer — every consumer
  // wants this, and it's the single easiest thing to forget when porting a
  // sidebar to a new dashboard.
  const handleSelect = (key) => {
    onSelect(key);
    onCloseMobile?.();
  };

  // Escape closes the drawer too. Not a dialog (no focus trap — a
  // persistent nav landmark, not a modal task), but the same "give the
  // keyboard user an exit" reasoning Modal uses applies to any dismissible
  // overlay.
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
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCloseMobile}
            className={cn('fixed inset-0 bg-black/60 backdrop-blur-sm z-40 motion-reduce:transition-none', bp.hidden)}
          />
        )}
      </AnimatePresence>

      <aside
        style={{ width }}
        className={cn(
          'fixed top-0 h-screen z-50 shrink-0 flex-col bg-[var(--mf-bg)] border-r border-[var(--mf-border)]',
          bp.sticky,
          mobileOpen ? 'flex' : cn('hidden', bp.flex),
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2 px-6 h-20 border-b border-[var(--mf-border)] shrink-0">
          <div className="min-w-0 flex-1">{header}</div>
          <button
            onClick={onCloseMobile}
            aria-label="Naviqasiyanı bağla"
            className={cn(
              'p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-400 shrink-0',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mf-focus)]',
              bp.hidden,
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {items.map((item) => {
            const active = activeKey === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleSelect(item.key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mf-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mf-bg)]',
                  active
                    ? 'bg-[var(--mf-primary)] text-white shadow-md shadow-blue-600/25'
                    : 'text-[var(--mf-text-muted)] hover:text-white hover:bg-slate-800/70',
                )}
              >
                <span className={active ? 'text-white shrink-0' : 'text-[var(--mf-text-muted)] shrink-0'}>
                  {item.icon && React.cloneElement(item.icon, { className: 'w-[18px] h-[18px]' })}
                </span>
                <span className="truncate">{item.label}</span>
                {item.badge}
              </button>
            );
          })}
        </nav>

        {footer && <div className="p-4 border-t border-[var(--mf-border)] space-y-2 shrink-0">{footer}</div>}
      </aside>
    </>
  );
}

// Matching hamburger trigger for the topbar — same icon/behavior SuperAdmin
// already hand-rolls next to its own Sidebar, promoted here so a second
// dashboard doesn't re-invent it either.
export function SidebarMenuButton({ onClick, breakpoint = 'md', className, ...props }) {
  const bp = BREAKPOINT_CLASSES[breakpoint] || BREAKPOINT_CLASSES.md;
  return (
    <button
      onClick={onClick}
      aria-label="Naviqasiyanı aç"
      className={cn(
        'p-2 -ml-2 rounded-xl hover:bg-slate-800/80 text-slate-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mf-focus)]',
        bp.hidden,
        className,
      )}
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
