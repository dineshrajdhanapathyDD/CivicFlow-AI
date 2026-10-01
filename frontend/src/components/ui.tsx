// Reusable UI primitives: badges, states, cards. Trust-first, high-contrast.
import type { ReactNode } from 'react';
import type { Severity } from '../lib/types.js';

export function SeverityBadge({ value }: { value?: Severity | string }) {
  if (!value) return null;
  return (
    <span
      className={`sev-${value} inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide`}
    >
      {value}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  NEW: 'bg-slate-100 text-slate-700',
  AI_ANALYZED: 'bg-sky-100 text-sky-800',
  CLUSTERED: 'bg-teal-100 text-teal-800',
  VERIFIED: 'bg-indigo-100 text-indigo-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
};

export function StatusBadge({ value }: { value: string }) {
  const cls = STATUS_STYLES[value] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`${cls} inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[--color-line] bg-white ${className}`}>
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-slate-500" role="status" aria-live="polite">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600" />
      <span className="text-sm">{label || 'Loading…'}</span>
    </div>
  );
}

export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-6 text-center" role="alert">
      <p className="font-semibold text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition active:translate-y-px hover:bg-red-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}
