"use client";

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Building2, CreditCard, LineChart, Users, ShieldCheck,
  LogOut, ChevronLeft, ChevronRight, X,
} from 'lucide-react';

export const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'restaurants', label: 'Restoranlar', icon: Building2 },
  { id: 'subscriptions', label: 'Abunəliklər', icon: CreditCard },
  { id: 'analytics', label: 'Analitika', icon: LineChart },
  { id: 'users', label: 'İstifadəçilər', icon: Users },
];

export function Sidebar({ activeTab, onTabChange, restaurantCount, collapsed, onToggleCollapse, onLogout, mobileOpen, onCloseMobile }) {
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
            <div className="w-9 h-9 shrink-0 bg-amber-500/15 rounded-2xl flex items-center justify-center border border-amber-500/25">
              <ShieldCheck className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  <p className="text-white font-bold text-sm leading-tight">Super Admin</p>
                  <p className="text-slate-500 text-[11px]">{restaurantCount} restoran</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={onCloseMobile} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {TABS.map((tab, i) => {
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
            {!collapsed && <span>Yığ</span>}
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span>Çıxış</span>}
          </button>
        </div>
      </motion.aside>
    </>
  );
}

export default Sidebar;
