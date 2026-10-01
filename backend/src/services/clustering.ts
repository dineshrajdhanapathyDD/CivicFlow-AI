// Issue clustering: decide whether a newly analyzed report joins an existing issue
// cluster or forms a new one. Also (re)computes issue-level severity, priority, and
// recommended action from its member reports.
import type { AiAnalysis, Issue, Report, Severity } from '../shared/types.js';
import {
  putIssue,
  getIssue,
  getReport,
  linkReportToIssue,
  listIssueReportIds,
} from '../data/repo.js';
import { findSimilar, type ScoredMatch } from './similarity.js';
import { computePriority } from './priority.js';
import { newIssueId, nowIso, logEvent } from '../shared/util.js';

const SEVERITY_ORDER: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}

export interface ClusterResult {
  issue: Issue;
  similar: ScoredMatch[];
  attached: boolean; // true = joined existing issue, false = new issue created
}

/**
 * Cluster a report (which must already have aiAnalysis) against candidate reports.
 * `candidates` are recent reports used for similarity search.
 */
export async function clusterReport(
  report: Report,
  ai: AiAnalysis,
  candidates: Report[],
): Promise<ClusterResult> {
  const similar = findSimilar(report, candidates);

  // Prefer attaching to an existing, non-resolved issue among the matches.
  const existingIssueId = await firstOpenIssueId(similar);

  if (existingIssueId) {
    const issue = await attachToIssue(existingIssueId, report, ai);
    logEvent('REPORT_CLUSTERED', {
      reportId: report.reportId,
      issueId: issue.issueId,
      relatedReports: issue.reportCount,
    });
    return { issue, similar, attached: true };
  }

  const issue = await createIssue(report, ai);
  logEvent('ISSUE_CREATED', { issueId: issue.issueId, reportId: report.reportId });
  return { issue, similar, attached: false };
}

async function firstOpenIssueId(similar: ScoredMatch[]): Promise<string | undefined> {
  for (const m of similar) {
    if (!m.issueId) continue;
    const issue = await getIssue(m.issueId);
    if (issue && issue.status !== 'RESOLVED') return issue.issueId;
  }
  return undefined;
}

async function createIssue(report: Report, ai: AiAnalysis): Promise<Issue> {
  const issueId = newIssueId();
  const now = nowIso();

  const prio = computePriority({
    severity: ai.severity,
    category: ai.category,
    reportCount: 1,
    createdAt: report.createdAt,
    resolved: false,
  });

  const issue: Issue = {
    issueId,
    category: ai.category,
    issueType: ai.issue_type,
    summary: ai.summary,
    severity: ai.severity,
    priority: prio.priority,
    priorityFactors: prio.factors,
    status: 'AI_ANALYZED',
    location: report.location,
    reportCount: 1,
    confidence: ai.confidence,
    recommendedAction: ai.recommended_action,
    reportIds: [report.reportId],
    createdAt: now,
    updatedAt: now,
  };

  await putIssue(issue);
  await linkReportToIssue(issueId, report.reportId);
  return issue;
}

async function attachToIssue(
  issueId: string,
  report: Report,
  ai: AiAnalysis,
): Promise<Issue> {
  const existing = await getIssue(issueId);
  if (!existing) return createIssue(report, ai);

  await linkReportToIssue(issueId, report.reportId);
  const reportIds = Array.from(new Set([...(await listIssueReportIds(issueId))]));
  const reportCount = reportIds.length;

  // Issue severity is the strongest observed among members.
  const severity = maxSeverity(existing.severity, ai.severity);

  const prio = computePriority({
    severity,
    category: existing.category,
    reportCount,
    createdAt: report.createdAt, // newest related report drives recency
    resolved: existing.status === 'RESOLVED',
  });

  const updated: Issue = {
    ...existing,
    severity,
    priority: prio.priority,
    priorityFactors: prio.factors,
    reportCount,
    reportIds,
    confidence: Math.max(existing.confidence, ai.confidence),
    // Keep the clearest summary/action; prefer the higher-confidence analysis.
    summary: ai.confidence > existing.confidence ? ai.summary : existing.summary,
    recommendedAction:
      ai.confidence > existing.confidence
        ? ai.recommended_action
        : existing.recommendedAction,
    updatedAt: nowIso(),
  };

  await putIssue(updated);
  return updated;
}

/** Fetch an issue plus its member reports for the issue-detail endpoint. */
export async function getIssueWithReports(
  issueId: string,
): Promise<{ issue: Issue; reports: Report[] } | undefined> {
  const issue = await getIssue(issueId);
  if (!issue) return undefined;
  const ids = await listIssueReportIds(issueId);
  const reports = (await Promise.all(ids.map((id) => getReport(id)))).filter(
    (r): r is Report => !!r,
  );
  return { issue, reports };
}
