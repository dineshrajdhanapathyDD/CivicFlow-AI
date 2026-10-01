import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { CATEGORY_LABELS, type DashboardStats } from '../lib/types.js';
import { Card, SkeletonRows, ErrorState, EmptyState, SeverityBadge, StatusBadge } from '../components/ui.js';

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${accent ? 'text-teal-700' : 'text-slate-900'}`}>
        {value}
      </p>
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    api
      .get<DashboardStats & { pending?: boolean }>('/dashboard/stats')
      .then((d) => {
        if ((d as { pending?: boolean }).pending) setPending(true);
        else setStats(d);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div>
      <section className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Community dashboard</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          A live view of what your community is reporting, grouped into the underlying issues that
          actually need action.
        </p>
      </section>

      {loading && <SkeletonRows count={4} />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && pending && (
        <EmptyState
          title="Dashboard data arrives with Phase 4"
          hint="The stats endpoint is wired and will populate once issues and aggregation land."
        />
      )}

      {!loading && stats && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Total Reports" value={stats.totals.reports} />
            <Stat label="Active Issues" value={stats.totals.activeIssues} accent />
            <Stat label="High Priority" value={stats.totals.highPriority} />
            <Stat label="Resolved" value={stats.totals.resolved} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-5">
            <Card className="p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold text-slate-900">Top issue categories</h2>
              <ul className="mt-4 space-y-3">
                {stats.categoryBreakdown.map((c) => (
                  <li key={c.category}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        {CATEGORY_LABELS[c.category]}
                      </span>
                      <span className="text-slate-500">{c.pct}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-teal-500" style={{ width: `${c.pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-6 lg:col-span-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Recent reports</h2>
                <Link to="/issues" className="text-sm font-semibold text-teal-700 hover:underline">
                  View issues
                </Link>
              </div>
              {stats.recentReports.length === 0 ? (
                <div className="mt-4">
                  <EmptyState title="No reports yet" hint="Be the first to report an issue." />
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {stats.recentReports.map((r) => (
                    <li key={r.reportId} className="flex items-center justify-between py-3">
                      <Link to={`/report/${r.reportId}`} className="min-w-0">
                        <p className="truncate font-medium text-slate-800 hover:text-teal-700">
                          {r.title}
                        </p>
                        <p className="text-xs text-slate-400">{r.reportId}</p>
                      </Link>
                      <div className="flex items-center gap-2">
                        <SeverityBadge value={r.severity} />
                        <StatusBadge value={r.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
