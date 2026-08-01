"use client";

import React from 'react';

const skeletonClass = 'animate-pulse bg-slate-800/70 rounded-2xl';

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#050505] px-4 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="glass-panel border border-slate-800/80 rounded-3xl p-6 shadow-xl">
          <div className="h-10 w-3/12 mb-6 rounded-full bg-slate-800/70 animate-pulse" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className={`${skeletonClass} h-28`} />
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className={`${skeletonClass} h-40`} />
          <div className={`${skeletonClass} h-40`} />
          <div className={`${skeletonClass} h-40`} />
        </div>

        <div className="glass-panel border border-slate-800/80 rounded-3xl p-6 shadow-xl">
          <div className="space-y-4">
            <div className={`${skeletonClass} h-8 w-1/3`} />
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="grid gap-4 sm:grid-cols-3">
                <div className={`${skeletonClass} h-14 sm:col-span-2`} />
                <div className={`${skeletonClass} h-14`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PageSkeleton;
