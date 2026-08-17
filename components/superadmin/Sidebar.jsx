"use client";

import React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Building2, CreditCard, LineChart, Users, ShieldCheck,
  LogOut, ChevronLeft, ChevronRight, X, Package,
} from 'lucide-react';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';

// Kept as a function (not a static array) now that labels are translated —
// SuperAdminApp.jsx's own `activeMeta` lookup calls this with its own `t`
// too, so the header title and this sidebar always agree.
export const getTabs = (t) => [
  { id: 'dashboard', label: t('tabDashboard'), icon: LayoutDashboard },
  { id: 'restaurants', label: t('tabRestaurants'), icon: Building2 },
  { id: 'plans', label: t('tabPlans'), icon: Package },
  { id: 'subscriptions', label: t('tabSubscriptions'), icon: CreditCard },
  { id: 'analytics', label: t('tabAnalytics'), icon: LineChart },
  { id: 'users', label: t('tabUsers'), icon: Users },
];

// Back-compat static export (AZ-only) for any import this pass didn't
// catch — TABS.find(...) still works, just won't be reactive to language.
export const TABS = getTabs((key) => ({
  tabDashboard: 'Dashboard', tabRestaurants: 'Restoranlar', tabPlans: 'Planlar',
  tabSubscriptions: 'Abunəliklər', tabAnalytics: 'Analitika', tabUsers: 'İstifadəçilər',
}[key]));

export function Sidebar({ activeTab, onTabChange, restaurantCount, collapsed, onToggleCollapse, onLogout, mobileOpen, onCloseMobile }) {
  const { t } = useSuperAdminTranslation();
  const tabs = getTabs(t);
  return (
    <>
      {/* Mobile scrim */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCloseMobile}
            className="fixed inset-0 bg-[var(--k-scrim)] backdrop-blur-[2px] z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        animate={{ width: collapsed ? 84 : 256 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed lg:sticky top-0 h-screen z-50 shrink-0 flex-col bg-[var(--k-bg)] border-r border-[var(--k-border)] py-5 px-3
          ${mobileOpen ? 'flex' : 'hidden lg:flex'}`}
      >
        <div className="flex items-center justify-between px-2 mb-8">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {collapsed ? (
              <div className="w-9 h-9 shrink-0 bg-[var(--k-warning-soft)] rounded-[var(--k-r)] flex items-center justify-center border border-[color:var(--k-warning)]/25">
                <ShieldCheck className="w-[18px] h-[18px] text-[var(--k-warning)]" />
              </div>
            ) : (
              <Image src="/brand/menuflow-logo-dark-bg-h48.png" alt="MenuFlow" width={90} height={14} className="h-4 w-auto object-contain shrink-0" unoptimized />
            )}
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden whitespace-nowrap pl-0.5 border-l border-[var(--k-border)] ml-1"
                >
                  <p className="text-[var(--k-text)] font-semibold text-sm leading-tight pl-2">{t('superAdminLabel')}</p>
                  <p className="text-[var(--k-text-3)] text-[11px] pl-2">{restaurantCount} {t('restaurantsSuffix')}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={onCloseMobile} className="lg:hidden p-1.5 rounded-[var(--k-r-sm)] hover:bg-[var(--k-surface-2)] text-[var(--k-text-3)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5">
          {tabs.map((tab, i) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { onTabChange(tab.id); onCloseMobile?.(); }}
                className={`k-anim-in w-full flex items-center gap-3 px-3 h-10 rounded-[var(--k-r)] text-[13px] font-medium relative
                  transition-colors duration-[var(--k-dur)] ease-[var(--k-ease)]
                  ${active ? 'text-[var(--k-accent-fg)]' : 'text-[var(--k-text-2)] hover:text-[var(--k-text)] hover:bg-[var(--k-surface-2)]'}`}
                style={{ animationDelay: `${Math.min(i * 0.03, 0.15)}s` }}
              >
                {active && (
                  <motion.div
                    layoutId="sa-sidebar-active"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    className="absolute inset-0 bg-[var(--k-accent)] rounded-[var(--k-r)]"
                  />
                )}
                <Icon className="w-[17px] h-[17px] shrink-0 relative z-10" />
                {!collapsed && <span className="relative z-10 whitespace-nowrap">{tab.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="space-y-0.5 pt-3 border-t border-[var(--k-border)]">
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex w-full items-center gap-3 px-3 h-10 rounded-[var(--k-r)] text-[13px] font-medium text-[var(--k-text-3)] hover:text-[var(--k-text)] hover:bg-[var(--k-surface-2)] transition-colors"
          >
            {collapsed ? <ChevronRight className="w-[17px] h-[17px]" /> : <ChevronLeft className="w-[17px] h-[17px]" />}
            {!collapsed && <span>{t('collapseButton')}</span>}
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 h-10 rounded-[var(--k-r)] text-[13px] font-medium text-[var(--k-text-3)] hover:text-[var(--k-danger)] hover:bg-[var(--k-danger-soft)] transition-colors"
          >
            <LogOut className="w-[17px] h-[17px] shrink-0" />
            {!collapsed && <span>{t('logoutShort')}</span>}
          </button>
          {!collapsed && (
            <div className="flex items-center justify-center pt-3">
              <Image src="/brand/menuflow-logo-dark-bg-h48.png" alt="MenuFlow" width={90} height={14} className="h-3.5 w-auto object-contain opacity-70" unoptimized />
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
}

export default Sidebar;
