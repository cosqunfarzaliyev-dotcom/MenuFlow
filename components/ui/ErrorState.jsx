"use client";

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function ErrorState({ title = 'Xəta baş verdi', description = 'Yenidən cəhd edin və ya səhifəni yeniləyin.', actionLabel = 'Təkrar cəhd et', onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white px-4 py-8">
      <div className="w-full max-w-md glass-panel border border-slate-800/80 rounded-3xl p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-rose-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
        <p className="text-slate-400 text-sm mb-6">{description}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <RefreshCw className="w-4 h-4" />
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default ErrorState;
