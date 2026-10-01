import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { CATEGORY_LABELS, type Issue } from '../lib/types.js';
import { Card, SkeletonRows, ErrorState, EmptyState, SeverityBadge, StatusBadge } from '../components/ui.js';

export default function Issues() {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    api
      .get<{ items?: Issue[]; pending?: boolean }>('/issues')
      .then((d) => {
        if (d.pending) setPending(true);
        else setIssues(d.items || []);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Community issues</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Related reports are grouped into single underlying issues, prioritized by severity and
        community confirmation.
      </p>

      <div className="mt-6">
        {loading && <SkeletonRows count={4} />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}
        {!loading && pending && (
          <EmptyState
            title="Issue clustering arrives with Phase 3"
            hint="The issues endpoint is wired and will populate once clustering lands."
          />
        )}
        {!loading && issues && issues.length === 0 && (
          <EmptyState title="No issues yet" hint="Issues appear once reports are analyzed." />
        )}
        {!loading && issues && issues.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {issues.map((iss) => (
              <Card key={iss.issueId} className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">{iss.issueId}</span>
                  <StatusBadge value={iss.status} />
                </div>
                <Link
                  to={`/issues/${iss.issueId}`}
                  className="mt-2 block font-semibold text-slate-900 hover:text-teal-700"
                >
                  {iss.summary}
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <SeverityBadge value={iss.severity} />
                  <span>{CATEGORY_LABELS[iss.category]}</span>
                  <span>·</span>
                  <span>{iss.reportCount} related reports</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
