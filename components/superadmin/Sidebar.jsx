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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        animate={{ width: collapsed ? 84 : 260 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed lg:sticky top-0 h-screen z-50 shrink-0 flex-col bg-[#0a0a0c] border-r border-slate-800/80 py-5 px-3
          ${mobileOpen ? 'flex' : 'hidden lg:flex'}`}
      >
        <div className="flex items-center justify-between px-2 mb-8">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {collapsed ? (
              <div className="w-9 h-9 shrink-0 bg-amber-500/15 rounded-2xl flex items-center justify-center border border-amber-500/25">
                <ShieldCheck className="w-4.5 h-4.5 text-amber-400" />
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
                  className="overflow-hidden whitespace-nowrap pl-0.5 border-l border-slate-800 ml-1"
                >
                  <p className="text-white font-bold text-sm leading-tight pl-2">{t('superAdminLabel')}</p>
                  <p className="text-slate-500 text-[11px] pl-2">{restaurantCount} {t('restaurantsSuffix')}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={onCloseMobile} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {tabs.map((tab, i) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { onTabChange(tab.id); onCloseMobile?.(); }}
                style={{ animationDelay: `${i * 0.04}s` }}
                className={`sa-sidebar-item sa-btn w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold relative
                  ${active ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
              >
                {active && (
                  <motion.div
                    layoutId="sa-sidebar-active"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    className="absolute inset-0 bg-blue-600/90 sa-radius-button shadow-lg shadow-blue-600/25"
                  />
                )}
                <Icon className="w-[18px] h-[18px] shrink-0 relative z-10" />
                {!collapsed && <span className="relative z-10 whitespace-nowrap">{tab.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="space-y-1 pt-3 border-t border-slate-800/80">
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-white hover:bg-slate-800/50"
          >
            {collapsed ? <ChevronRight className="w-[18px] h-[18px]" /> : <ChevronLeft className="w-[18px] h-[18px]" />}
            {!collapsed && <span>{t('collapseButton')}</span>}
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
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
