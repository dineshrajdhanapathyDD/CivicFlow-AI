// Dashboard statistics — real aggregation from DynamoDB reports + issues.
import type { Category, Report, Issue } from '../shared/types.js';
import { listReports, listIssues } from '../data/repo.js';
import { CATEGORIES } from '../shared/types.js';

export interface DashboardStats {
  totals: { reports: number; activeIssues: number; highPriority: number; resolved: number };
  categoryBreakdown: { category: Category; pct: number; count: number }[];
  statusDistribution: { status: string; count: number }[];
  duplicateClusters: number;
  recentReports: {
    reportId: string;
    title: string;
    status: string;
    severity?: string;
    category?: string;
    createdAt: string;
  }[];
}

export async function computeDashboardStats(): Promise<DashboardStats> {
  const [reports, issues] = await Promise.all([listReports(500), listIssues(500)]);

  const activeIssues = issues.filter((i) => i.status !== 'RESOLVED').length;
  const resolved = issues.filter((i) => i.status === 'RESOLVED').length;
  const highPriority = issues.filter(
    (i) => i.priority === 'HIGH' || i.priority === 'CRITICAL',
  ).length;

  // Category breakdown by report count.
  const catCounts = new Map<Category, number>();
  for (const c of CATEGORIES) catCounts.set(c, 0);
  for (const r of reports) {
    const c = (r.category || 'other') as Category;
    catCounts.set(c, (catCounts.get(c) || 0) + 1);
  }
  const totalCategorized = reports.length || 1;
  const categoryBreakdown = Array.from(catCounts.entries())
    .map(([category, count]) => ({
      category,
      count,
      pct: Math.round((count / totalCategorized) * 100),
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  // Issue status distribution.
  const statusCounts = new Map<string, number>();
  for (const i of issues) statusCounts.set(i.status, (statusCounts.get(i.status) || 0) + 1);
  const statusDistribution = Array.from(statusCounts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // Duplicate clusters = issues with more than one related report.
  const duplicateClusters = issues.filter((i) => i.reportCount > 1).length;

  const recentReports = reports.slice(0, 8).map((r) => ({
    reportId: r.reportId,
    title: r.title,
    status: r.status,
    severity: r.severity,
    category: r.category,
    createdAt: r.createdAt,
  }));

  return {
    totals: { reports: reports.length, activeIssues, highPriority, resolved },
    categoryBreakdown,
    statusDistribution,
    duplicateClusters,
    recentReports,
  };
}

// Expose raw collections for the agent tools (used by Ask CivicFlow).
export async function loadAll(): Promise<{ reports: Report[]; issues: Issue[] }> {
  const [reports, issues] = await Promise.all([listReports(500), listIssues(500)]);
  return { reports, issues };
}
