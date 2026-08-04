"use client";

import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Search, Users as UsersIcon, ShieldCheck, UserCog, UserRound } from 'lucide-react';
import { ROLE_LABELS, formatRelativeTime } from './constants';

const ROLE_FILTERS = [
  { id: 'all', label: 'Hamısı' },
  { id: 'super_admin', label: 'Owner' },
  { id: 'restaurant_admin', label: 'Admin' },
  { id: 'staff', label: 'Staff' },
];

const roleIcon = (role) => {
  if (role === 'super_admin') return ShieldCheck;
  if (role === 'restaurant_admin') return UserCog;
  return UserRound;
};

export function UsersTab({ users, loading }) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return u.email?.toLowerCase().includes(q) || u.restaurant_name?.toLowerCase().includes(q);
    });
  }, [users, query, roleFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Email və ya restoran adı üzrə axtar…"
            className="w-full bg-slate-900/60 border border-slate-800 sa-radius-input pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setRoleFilter(f.id)}
              className={`sa-btn px-3.5 py-2 text-xs font-bold whitespace-nowrap ${
                roleFilter === f.id ? 'bg-blue-600 text-white' : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sa-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center sa-caption text-slate-500">Yüklənir…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <UsersIcon className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="sa-caption text-slate-500">{query ? 'Nəticə tapılmadı.' : 'Hələ istifadəçi yoxdur.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/80 text-left">
                  {['İstifadəçi', 'Restoran', 'Rol', 'Status', 'Son giriş'].map((h) => (
                    <th key={h} className="sa-caption font-bold text-slate-500 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, idx) => {
                  const Icon = roleIcon(u.role);
                  const isOnline = u.last_sign_in_at && (Date.now() - new Date(u.last_sign_in_at).getTime()) < 15 * 60 * 1000;
                  return (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                            <Icon className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                          <span className="text-white font-semibold whitespace-nowrap">{u.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{u.restaurant_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="sa-caption font-bold text-slate-300 whitespace-nowrap">{ROLE_LABELS[u.role] || u.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`sa-caption font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${
                          isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800/60 text-slate-400 border-slate-700'
                        }`}>
                          {isOnline ? 'Onlayn' : 'Oflayn'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatRelativeTime(u.last_sign_in_at)}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default UsersTab;
