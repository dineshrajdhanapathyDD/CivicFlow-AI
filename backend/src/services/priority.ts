// Transparent, deterministic priority model. The LLM never sets priority alone —
// it is computed from structured factors that are stored and displayed.
import type { Category, Priority, PriorityFactor, Severity } from '../shared/types.js';

const SEVERITY_WEIGHT: Record<Severity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const PUBLIC_INFRA: Category[] = [
  'road_infrastructure',
  'streetlight',
  'water',
  'drainage',
  'public_property',
];

export interface PriorityInput {
  severity: Severity;
  category: Category;
  reportCount: number;
  createdAt: string; // most recent related report time
  resolved: boolean;
}

export interface PriorityResult {
  priority: Priority;
  score: number;
  factors: PriorityFactor[];
}

function recencyBoost(createdAt: string): { points: number; label?: string } {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const hours = ageMs / (1000 * 60 * 60);
  if (hours < 24) return { points: 1, label: 'Recently reported (last 24h)' };
  if (hours < 72) return { points: 0.5, label: 'Reported in the last 3 days' };
  return { points: 0 };
}

export function computePriority(input: PriorityInput): PriorityResult {
  const factors: PriorityFactor[] = [];

  const sevPoints = SEVERITY_WEIGHT[input.severity];
  factors.push({ label: `${input.severity} severity`, points: sevPoints });

  const relatedPoints = Math.min(input.reportCount, 5) * 0.6;
  if (input.reportCount > 1) {
    factors.push({
      label: `${input.reportCount} related reports`,
      points: Math.round(relatedPoints * 100) / 100,
    });
  }

  const recency = recencyBoost(input.createdAt);
  if (recency.points > 0 && recency.label) {
    factors.push({ label: recency.label, points: recency.points });
  }

  let publicPoints = 0;
  if (PUBLIC_INFRA.includes(input.category)) {
    publicPoints = 1;
    factors.push({ label: 'Public infrastructure', points: 1 });
  }

  let unresolvedPoints = 0;
  if (!input.resolved) {
    unresolvedPoints = 0.5;
    factors.push({ label: 'Currently unresolved', points: 0.5 });
  }

  const score =
    sevPoints + relatedPoints + recency.points + publicPoints + unresolvedPoints;

  return { priority: bucket(score), score: Math.round(score * 100) / 100, factors };
}

function bucket(score: number): Priority {
  if (score >= 6) return 'CRITICAL';
  if (score >= 4.2) return 'HIGH';
  if (score >= 2.6) return 'MEDIUM';
  return 'LOW';
}
