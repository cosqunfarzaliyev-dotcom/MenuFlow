"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingState({ title = 'Yüklənir…', subtitle }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white px-4 py-8">
      <div className="w-full max-w-md glass-panel border border-slate-800/80 rounded-3xl p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-blue-400 animate-spin">
          <Loader2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
        {subtitle ? <p className="text-slate-400 text-sm">{subtitle}</p> : <p className="text-slate-400 text-sm">Zəhmət olmasa bir neçə saniyə gözləyin.</p>}
      </div>
    </div>
  );
}

export default LoadingState;
