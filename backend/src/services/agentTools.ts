// Deterministic agent tools. The AI must use these to retrieve factual application
// data — it never fabricates database records or statistics.
import type { Category, Issue, Report } from '../shared/types.js';
import { getReport, getIssue, listReports, listIssues } from '../data/repo.js';
import { getIssueWithReports } from './clustering.js';
import { computeDashboardStats } from './dashboard.js';
import { findSimilar } from './similarity.js';

export const TOOL_NAMES = [
  'get_dashboard_statistics',
  'search_reports',
  'get_report',
  'search_similar_reports',
  'get_issue',
  'get_issue_history',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export async function get_dashboard_statistics() {
  return computeDashboardStats();
}

export async function search_reports(opts: {
  status?: string;
  category?: Category;
  keyword?: string;
  limit?: number;
}): Promise<Report[]> {
  let items = await listReports(500);
  if (opts.status) items = items.filter((r) => r.status === opts.status);
  if (opts.category) items = items.filter((r) => r.category === opts.category);
  if (opts.keyword) {
    const kw = opts.keyword.toLowerCase();
    items = items.filter(
      (r) =>
        `${r.title} ${r.text} ${r.aiAnalysis?.summary || ''}`.toLowerCase().includes(kw),
    );
  }
  return items.slice(0, opts.limit || 20);
}

export async function search_similar_reports(reportId: string): Promise<
  { reportId: string; score: number }[]
> {
  const target = await getReport(reportId);
  if (!target) return [];
  const candidates = await listReports(200);
  return findSimilar(target, candidates).map((m) => ({
    reportId: m.reportId,
    score: m.score,
  }));
}

export async function get_report(reportId: string): Promise<Report | undefined> {
  return getReport(reportId);
}

export async function get_issue(issueId: string): Promise<Issue | undefined> {
  return getIssue(issueId);
}

export async function get_issue_history(
  issueId: string,
): Promise<{ issue: Issue; reports: Report[] } | undefined> {
  return getIssueWithReports(issueId);
}

/** Snapshot used to ground Ask CivicFlow. Compact, factual, no invented numbers. */
export async function buildGroundingContext(question: string): Promise<{
  context: string;
  used: string[];
}> {
  const used: string[] = ['get_dashboard_statistics'];
  const stats = await computeDashboardStats();

  const lines: string[] = [];
  lines.push('DASHBOARD STATISTICS (authoritative, do not alter these numbers):');
  lines.push(
    `- Total reports: ${stats.totals.reports}; Active issues: ${stats.totals.activeIssues}; High priority: ${stats.totals.highPriority}; Resolved: ${stats.totals.resolved}`,
  );
  lines.push(
    `- Duplicate clusters (issues with >1 report): ${stats.duplicateClusters}`,
  );
  lines.push(
    `- Category breakdown: ${stats.categoryBreakdown
      .map((c) => `${c.category}=${c.count} (${c.pct}%)`)
      .join(', ')}`,
  );
  lines.push(
    `- Issue status distribution: ${stats.statusDistribution
      .map((s) => `${s.status}=${s.count}`)
      .join(', ')}`,
  );

  // Pull the most relevant reports for the question (keyword match on nouns).
  const keyword = pickKeyword(question);
  if (keyword) {
    used.push('search_reports');
    const matched = await search_reports({ keyword, limit: 8 });
    if (matched.length) {
      lines.push(`\nREPORTS MATCHING "${keyword}":`);
      for (const r of matched) {
        lines.push(
          `- ${r.reportId}: "${r.title}" [${r.category || 'uncategorized'}, ${r.status}${
            r.severity ? ', ' + r.severity : ''
          }]`,
        );
      }
    }
  }

  // Top open issues by priority for "highest priority / unresolved" questions.
  used.push('get_issue');
  const issues = await listIssues(500);
  const openRanked = issues
    .filter((i) => i.status !== 'RESOLVED')
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
    .slice(0, 6);
  if (openRanked.length) {
    lines.push('\nTOP OPEN ISSUES (by priority):');
    for (const i of openRanked) {
      lines.push(
        `- ${i.issueId}: "${i.summary}" [${i.category}, priority ${i.priority}, ${i.reportCount} reports, ${i.status}]`,
      );
    }
  }

  return { context: lines.join('\n'), used: Array.from(new Set(used)) };
}

function priorityRank(p: string): number {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[p] || 0;
}

const KEYWORD_MAP: { re: RegExp; kw: string }[] = [
  { re: /street ?light|light|lamp/i, kw: 'streetlight' },
  { re: /pothole|road|pavement/i, kw: 'road' },
  { re: /waste|garbage|trash|litter/i, kw: 'waste' },
  { re: /water|leak|pipe/i, kw: 'water' },
  { re: /drain|sewer/i, kw: 'drain' },
];

function pickKeyword(question: string): string | undefined {
  for (const { re, kw } of KEYWORD_MAP) if (re.test(question)) return kw;
  return undefined;
}
