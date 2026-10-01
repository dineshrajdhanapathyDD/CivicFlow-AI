import { describe, it, expect } from 'vitest';
import { findSimilar } from './similarity.js';
import { computePriority } from './priority.js';
import type { Report } from '../shared/types.js';

function report(partial: Partial<Report> & { reportId: string }): Report {
  return {
    userId: 'u',
    createdAt: new Date().toISOString(),
    title: '',
    text: '',
    status: 'NEW',
    ...partial,
  };
}

describe('findSimilar (duplicate detection)', () => {
  const target = report({
    reportId: 'A',
    title: 'Big pothole near school gate',
    text: 'Large pothole near the school entrance',
    category: 'road_infrastructure',
    location: { label: 'School gate' },
  });

  it('groups semantically similar reports about the same problem', () => {
    const candidates = [
      report({
        reportId: 'B',
        title: 'Deep hole beside school entrance',
        text: 'Deep road hole beside the school gate',
        category: 'road_infrastructure',
        location: { label: 'School gate' },
      }),
      report({
        reportId: 'C',
        title: 'Damaged road near government school',
        text: 'Damaged road surface near the school',
        category: 'road_infrastructure',
        location: { label: 'School gate' },
      }),
    ];
    const matches = findSimilar(target, candidates);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].score).toBeGreaterThanOrEqual(0.55);
  });

  it('does not match unrelated reports', () => {
    const candidates = [
      report({
        reportId: 'D',
        title: 'Overflowing garbage bin downtown',
        text: 'Trash piling up at the market square',
        category: 'waste',
        location: { label: 'Market square' },
      }),
    ];
    const matches = findSimilar(target, candidates);
    expect(matches.length).toBe(0);
  });

  it('excludes the target itself', () => {
    const matches = findSimilar(target, [target]);
    expect(matches.length).toBe(0);
  });
});

describe('computePriority (transparent factors)', () => {
  it('raises priority for high severity with multiple related reports', () => {
    const result = computePriority({
      severity: 'HIGH',
      category: 'road_infrastructure',
      reportCount: 4,
      createdAt: new Date().toISOString(),
      resolved: false,
    });
    expect(['HIGH', 'CRITICAL']).toContain(result.priority);
    // Every contributing factor is captured for display.
    expect(result.factors.some((f) => f.label.includes('severity'))).toBe(true);
    expect(result.factors.some((f) => f.label.includes('related reports'))).toBe(true);
    expect(result.factors.some((f) => f.label === 'Public infrastructure')).toBe(true);
  });

  it('keeps low-severity single reports at low priority', () => {
    const result = computePriority({
      severity: 'LOW',
      category: 'other',
      reportCount: 1,
      createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(), // old
      resolved: false,
    });
    expect(result.priority).toBe('LOW');
  });
});
