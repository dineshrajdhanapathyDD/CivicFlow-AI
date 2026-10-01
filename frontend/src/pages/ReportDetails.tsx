import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { CATEGORY_LABELS, type Report } from '../lib/types.js';
import { Card, Spinner, ErrorState, SeverityBadge, StatusBadge } from '../components/ui.js';

export default function ReportDetails() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    api
      .get<Report>(`/reports/${id}`)
      .then(setReport)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  async function runAnalysis() {
    if (!id) return;
    setAnalyzing(true);
    try {
      await api.post(`/reports/${id}/analyze`);
      load();
    } catch {
      /* analysis is non-fatal; report is still saved */
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) return <Spinner label="Loading report…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!report) return <ErrorState message="Report not found." />;

  const ai = report.aiAnalysis;
  const pendingAi = !ai || ai.status === 'PENDING_RETRY';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
            Report {report.reportId}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{report.title}</h1>
        </div>
        <StatusBadge value={report.status} />
      </div>

      {/* Citizen report */}
      <Card className="mt-6 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Citizen report
        </h2>
        {report.text ? (
          <p className="mt-2 text-slate-800">“{report.text}”</p>
        ) : (
          <p className="mt-2 italic text-slate-400">No text provided — image only.</p>
        )}
        {report.location?.label && (
          <p className="mt-3 text-sm text-slate-500">Location: {report.location.label}</p>
        )}
        {report.imageUrl && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-600">Evidence</h3>
            <img
              src={report.imageUrl}
              alt="Citizen-submitted evidence"
              className="mt-2 max-h-80 w-auto rounded-lg border border-slate-200 object-cover"
            />
          </div>
        )}
      </Card>

      {/* AI analysis */}
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            CivicFlow AI analysis
          </h2>
          {ai?.degraded && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Partial (AI degraded)
            </span>
          )}
        </div>

        {pendingAi ? (
          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              {analyzing
                ? 'Analyzing the evidence…'
                : 'Analysis is not ready yet. Your report has been saved successfully.'}
            </p>
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="mt-3 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition active:translate-y-px hover:bg-teal-700 disabled:bg-slate-300"
            >
              {analyzing ? 'Working…' : 'Run analysis'}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Issue">{ai.issue_type}</Field>
              <Field label="Category">{CATEGORY_LABELS[ai.category]}</Field>
              <Field label="Severity">
                <SeverityBadge value={ai.severity} />
              </Field>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-600">Confidence</p>
              <div className="mt-1 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{ width: `${Math.round(ai.confidence * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-slate-700">
                  {Math.round(ai.confidence * 100)}%
                </span>
              </div>
            </div>

            <EvidenceList title="Text evidence" items={ai.evidence.text} />
            <EvidenceList title="Visual evidence" items={ai.evidence.image} />

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-600">AI interpretation</p>
              <p className="mt-1 text-sm text-slate-700">{ai.reasoning_summary}</p>
            </div>

            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
              <p className="text-sm font-semibold text-teal-800">Recommended action</p>
              <p className="mt-1 text-sm text-teal-900">{ai.recommended_action}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Community issue link */}
      {report.issueId && (
        <Card className="mt-6 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Community issue
          </h2>
          <Link
            to={`/issues/${report.issueId}`}
            className="mt-2 inline-block font-semibold text-teal-700 hover:underline"
          >
            {report.issueId} →
          </Link>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-1 text-slate-900">{children}</p>
    </div>
  );
}

function EvidenceList({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
            <span className="mt-0.5 text-teal-600">✓</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
