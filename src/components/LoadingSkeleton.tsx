import React from 'react';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Loading environmental telemetry">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="h-4 w-44 rounded bg-slate-200 dark:bg-slate-800 mb-4" />
          <div className="h-12 w-32 rounded bg-slate-200 dark:bg-slate-800 mb-3" />
          <div className="h-3 w-72 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="h-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800 mb-4" />
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-5/6 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-4/6 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="h-24 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
          >
            <div className="h-3 w-12 rounded bg-slate-200 dark:bg-slate-800 mb-3" />
            <div className="h-6 w-16 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
      <div className="h-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden animate-pulse">
      <div className="h-10 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800" />
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 px-4 flex items-center gap-4">
            <div className="h-3 w-32 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-800 ml-auto" />
            <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
