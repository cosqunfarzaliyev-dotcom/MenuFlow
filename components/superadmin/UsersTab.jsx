"use client";

import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Search, Users as UsersIcon, ShieldCheck, UserCog, UserRound } from 'lucide-react';
import { roleLabel, formatRelativeTime, LOCALE_TAGS } from './constants';
import { Field, Input, Tabs, TabsTrigger, Table, TableHead, TableHeaderCell, TableBody, TableCell, Tag, EmptyState } from '@/components/kit';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';

// Kept as a function now that labels are translated.
const roleFilters = (t) => [
  { id: 'all', label: t('roleFilterAll') },
  { id: 'super_admin', label: t('roleFilterOwner') },
  { id: 'restaurant_admin', label: t('roleFilterAdmin') },
  { id: 'staff', label: t('roleFilterStaff') },
];

const roleIcon = (role) => {
  if (role === 'super_admin') return ShieldCheck;
  if (role === 'restaurant_admin') return UserCog;
  return UserRound;
};

export function UsersTab({ users, loading }) {
  const { t, language } = useSuperAdminTranslation();
  const localeTag = LOCALE_TAGS[language] || 'az-AZ';
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
          <Search className="w-4 h-4 text-[var(--k-text-3)] absolute left-3.5 top-1/2 -translate-y-1/2 z-10" />
          {/* No visible <label> existed before — Field used unlabeled, only
              for the Input primitive's id/aria wiring. */}
          <Field>
            {(id, a11y) => (
              <Input
                id={id}
                {...a11y}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchUsersPlaceholder')}
                className="pl-10"
              />
            )}
          </Field>
        </div>
        {/* Segmented single-select role filter. */}
        <Tabs className="overflow-x-auto no-scrollbar">
          {roleFilters(t).map((f) => (
            <TabsTrigger key={f.id} active={roleFilter === f.id} onClick={() => setRoleFilter(f.id)}>
              {f.label}
            </TabsTrigger>
          ))}
        </Tabs>
      </div>

      {/* EmptyState renders as its own top-level replacement (not nested
          inside a card). The loading and table branches keep a plain kit
          Card-style surface. */}
      {loading ? (
        <div className="rounded-[var(--k-r-lg)] border border-[var(--k-border)] bg-[var(--k-surface)] overflow-hidden">
          <div className="py-16 text-center text-[13px] text-[var(--k-text-3)]">{t('loadingText')}</div>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="w-5 h-5" />}
          title={query ? t('noResultsFound') : t('noUsersYet')}
          description=""
        />
      ) : (
        <div className="rounded-[var(--k-r-lg)] border border-[var(--k-border)] bg-[var(--k-surface)] overflow-hidden">
          <Table>
            <TableHead>
              {[t('colUser'), t('colRestaurant'), t('colRole'), t('colStatus'), t('colLastLogin')].map((h) => (
                <TableHeaderCell key={h}>{h}</TableHeaderCell>
              ))}
            </TableHead>
            <TableBody>
              {filtered.map((u, idx) => {
                const Icon = roleIcon(u.role);
                const isOnline = u.last_sign_in_at && (Date.now() - new Date(u.last_sign_in_at).getTime()) < 15 * 60 * 1000;
                return (
                  // motion.tr (not TableRow) — preserves the stagger-in
                  // animation, using the exact same visual classes TableRow
                  // itself applies.
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.025, 0.25) }}
                    className="hover:bg-[var(--k-surface-2)] transition-colors border-t border-[var(--k-border)]"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[var(--k-surface-3)] flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-[var(--k-text-3)]" />
                        </div>
                        <span className="text-[var(--k-text)] font-medium whitespace-nowrap">{u.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[var(--k-text-3)] whitespace-nowrap">{u.restaurant_name || '—'}</TableCell>
                    <TableCell>
                      <span className="text-[13px] font-medium text-[var(--k-text-2)] whitespace-nowrap">{roleLabel(u.role, t)}</span>
                    </TableCell>
                    <TableCell>
                      <Tag tone={isOnline ? 'success' : 'neutral'} className="whitespace-nowrap">
                        {isOnline ? t('onlineLabel') : t('offlineLabel')}
                      </Tag>
                    </TableCell>
                    <TableCell className="text-[var(--k-text-3)] whitespace-nowrap">{formatRelativeTime(u.last_sign_in_at, t, localeTag)}</TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default UsersTab;
