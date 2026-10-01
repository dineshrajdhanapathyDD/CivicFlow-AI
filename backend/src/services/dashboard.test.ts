import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the repo so we can aggregate deterministic fixtures without AWS.
vi.mock('../data/repo.js', () => ({
  listReports: vi.fn(),
  listIssues: vi.fn(),
}));

import { listReports, listIssues } from '../data/repo.js';
import { computeDashboardStats } from './dashboard.js';
import type { Issue, Report } from '../shared/types.js';

const now = new Date().toISOString();

function report(p: Partial<Report> & { reportId: string }): Report {
  return { userId: 'u', createdAt: now, title: 't', text: '', status: 'NEW', ...p };
}
function issue(p: Partial<Issue> & { issueId: string }): Issue {
  return {
    category: 'road_infrastructure',
    issueType: 'x',
    summary: 's',
    severity: 'HIGH',
    priority: 'HIGH',
    priorityFactors: [],
    status: 'AI_ANALYZED',
    reportCount: 1,
    confidence: 0.8,
    recommendedAction: 'a',
    reportIds: [],
    createdAt: now,
    updatedAt: now,
    ...p,
  };
}

describe('computeDashboardStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aggregates totals, categories, status, and duplicate clusters from real data', async () => {
    vi.mocked(listReports).mockResolvedValue([
      report({ reportId: 'R1', category: 'streetlight' }),
      report({ reportId: 'R2', category: 'streetlight' }),
      report({ reportId: 'R3', category: 'road_infrastructure' }),
      report({ reportId: 'R4', category: 'waste' }),
    ]);
    vi.mocked(listIssues).mockResolvedValue([
      issue({ issueId: 'I1', priority: 'HIGH', status: 'IN_PROGRESS', reportCount: 3 }),
      issue({ issueId: 'I2', priority: 'LOW', status: 'RESOLVED', reportCount: 1 }),
      issue({ issueId: 'I3', priority: 'CRITICAL', status: 'NEW', reportCount: 2 }),
    ]);

    const stats = await computeDashboardStats();

    expect(stats.totals.reports).toBe(4);
    expect(stats.totals.resolved).toBe(1);
    expect(stats.totals.activeIssues).toBe(2);
    expect(stats.totals.highPriority).toBe(2); // HIGH + CRITICAL
    expect(stats.duplicateClusters).toBe(2); // I1(3) + I3(2)

    const streetlight = stats.categoryBreakdown.find((c) => c.category === 'streetlight');
    expect(streetlight?.count).toBe(2);
    expect(streetlight?.pct).toBe(50); // 2/4
  });

  it('handles empty data without dividing by zero', async () => {
    vi.mocked(listReports).mockResolvedValue([]);
    vi.mocked(listIssues).mockResolvedValue([]);
    const stats = await computeDashboardStats();
    expect(stats.totals.reports).toBe(0);
    expect(stats.categoryBreakdown).toEqual([]);
    expect(stats.duplicateClusters).toBe(0);
  });
});
