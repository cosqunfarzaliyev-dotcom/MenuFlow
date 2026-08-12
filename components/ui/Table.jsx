"use client";

import React from 'react';
import { cn } from '@/lib/utils';

// Consolidates 3 identical raw `<table className="w-full text-sm">` blocks
// in AdminApp.jsx (DashboardHome's recent-orders table, OrdersManagement,
// PaymentSchemaTable) — same header/row/empty-state classes copy-pasted
// three times, down to the literal `w-full text-sm` string. A pure
// deletion, not a restyle: every default below is lifted verbatim from
// whichever of the three had it (the table-cell padding had drifted to
// `py-3`/`py-3.5` and the empty-row padding to `py-8`/`py-10` between
// copies — picked the majority value, an invisible ~2px normalization).
//
// SuperAdmin's own two tables (`RestaurantsTab.jsx`, `UsersTab.jsx`) are
// deliberately NOT migrated onto this — they use `.sa-caption` typography
// and per-row `motion.tr` stagger-in animation, a different, already-
// polished system (same category of decision already made for SuperAdmin's
// CRUD modals and its own `Sidebar.jsx`: preserve, don't flatten).
//
// Only the chrome is a primitive — column definitions, row data, and the
// surrounding card wrapper stay exactly what each call site already had.
export function Table({ className, children, ...props }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-sm', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ className, children, ...props }) {
  return (
    <thead>
      <tr className={cn('text-left text-slate-500 text-xs font-bold uppercase tracking-wide', className)} {...props}>
        {children}
      </tr>
    </thead>
  );
}

export function TableHeaderCell({ className, children, ...props }) {
  return (
    <th className={cn('px-6 py-3 font-bold', className)} {...props}>
      {children}
    </th>
  );
}

export function TableBody({ children }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({ className, children, ...props }) {
  return (
    <tr className={cn('hover:bg-slate-800/40 transition-colors border-t border-slate-800/60', className)} {...props}>
      {children}
    </tr>
  );
}

export function TableCell({ className, children, ...props }) {
  return (
    <td className={cn('px-6 py-3.5', className)} {...props}>
      {children}
    </td>
  );
}

// One `<tr>`/`<td colSpan>` row spanning the full table width — every table
// this replaces had its own copy of exactly this shape for "no rows yet".
export function TableEmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-10 text-center text-slate-500 text-sm">
        {children}
      </td>
    </tr>
  );
}
