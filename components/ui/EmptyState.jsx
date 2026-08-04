"use client";

import React from 'react';
import { FolderOpen } from 'lucide-react';

export function EmptyState({
  icon,
  title = 'Məlumat tapılmadı',
  description = 'Burada göstəriləcək məzmun yoxdur.',
  actionLabel,
  onAction,
}) {
  return (
    <div className="w-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl glass-panel border border-slate-800/80 rounded-3xl p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 border border-slate-800 text-blue-400">
          {icon || <FolderOpen className="w-8 h-8" />}
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-slate-400 text-sm mb-6">{description}</p>
        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {actionLabel || 'Əlavə et'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default EmptyState;
