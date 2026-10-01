import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { CATEGORY_LABELS, type Issue, type IssueStatus, type Report } from '../lib/types.js';
import { Card, Spinner, ErrorState, SeverityBadge, StatusBadge } from '../components/ui.js';

const LIFECYCLE: IssueStatus[] = ['NEW', 'AI_ANALYZED', 'VERIFIED', 'IN_PROGRESS', 'RESOLVED'];

function AdminStatusControl({
  issue,
  onUpdated,
}: {
  issue: Issue;
  onUpdated: () => void;
}) {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('cf_admin') || '');
  const [status, setStatus] = useState<IssueStatus>(issue.status);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function save() {
    setErr('');
    setMsg('');
    if (!adminKey) {
      setErr('Enter the admin key to update status.');
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/issues/${issue.issueId}/status`, { status }, { 'x-admin-key': adminKey });
      sessionStorage.setItem('cf_admin', adminKey);
      setMsg('Status updated.');
      onUpdated();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Staff controls
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        Authorized staff can advance this issue through its lifecycle.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="admin-key" className="text-xs font-semibold text-slate-600">
            Admin key
          </label>
          <input
            id="admin-key"
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Enter admin key"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status-select" className="text-xs font-semibold text-slate-600">
            Status
          </label>
          <select
            id="status-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as IssueStatus)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          >
            {LIFECYCLE.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition active:translate-y-px hover:bg-slate-800 disabled:bg-slate-300"
        >
          {busy ? 'Updating…' : 'Update status'}
        </button>
      </div>
      {msg && <p className="mt-2 text-sm font-medium text-emerald-700">{msg}</p>}
      {err && <p className="mt-2 text-sm font-medium text-red-600">{err}</p>}
    </Card>
  );
}

interface IssueDetailResp {
  issue?: Issue;
  reports?: Report[];
  pending?: boolean;
}

export default function IssueDetails() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<IssueDetailResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    api
      .get<IssueDetailResp>(`/issues/${id}`)
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  if (loading) return <Spinner label="Loading issue…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data || data.pending || !data.issue)
    return <ErrorState message="Issue details arrive with Phase 3 clustering." />;

  const iss = data.issue;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">{iss.issueId}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{iss.summary}</h1>
        </div>
        <StatusBadge value={iss.status} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-500">Severity</p>
          <div className="mt-1"><SeverityBadge value={iss.severity} /></div>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-500">Priority</p>
          <div className="mt-1"><SeverityBadge value={iss.priority} /></div>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-500">Related reports</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{iss.reportCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-500">Category</p>
          <p className="mt-1 text-sm font-medium text-slate-800">{CATEGORY_LABELS[iss.category]}</p>
        </Card>
      </div>

      {iss.priorityFactors?.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Why this priority
          </h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {iss.priorityFactors.map((f, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-teal-600">•</span> {f.label}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-6 border-teal-200 bg-teal-50 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-800">
          Recommended action
        </h2>
        <p className="mt-2 text-teal-900">{iss.recommendedAction}</p>
      </Card>

      <AdminStatusControl issue={iss} onUpdated={load} />

      {data.reports && data.reports.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Related reports · {data.reports.length}
          </h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {data.reports.map((r) => (
              <li key={r.reportId} className="py-3">
                <Link to={`/report/${r.reportId}`} className="font-medium text-slate-800 hover:text-teal-700">
                  {r.title}
                </Link>
                <p className="text-xs text-slate-400">{r.reportId}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
