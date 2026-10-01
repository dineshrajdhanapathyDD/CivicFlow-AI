// Application-level similarity / duplicate detection.
// Score = text overlap (0.5) + same category (0.25) + location proximity (0.25).
// Language is always probabilistic ("possible duplicate"), never absolute.
import type { Report, SimilarMatch } from '../shared/types.js';
import { config } from '../shared/config.js';
import { haversineMeters } from '../shared/util.js';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'near', 'at', 'in', 'on', 'of', 'to',
  'and', 'or', 'for', 'with', 'by', 'from', 'there', 'this', 'that', 'has', 'have',
  'it', 'not', 'no', 'been', 'be', 'my', 'our', 'your', 'their', 'i', 'we', 'they',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

/** Jaccard similarity between two token sets (0..1). */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function reportText(r: Report): string {
  const summary = r.aiAnalysis?.summary || '';
  return `${r.title || ''} ${r.text || ''} ${summary}`;
}

function locationScore(a: Report, b: Report): number {
  const la = a.location;
  const lb = b.location;
  if (!la || !lb) return 0;
  // Same textual label is a strong signal.
  if (la.label && lb.label && la.label.trim().toLowerCase() === lb.label.trim().toLowerCase()) {
    return 1;
  }
  const dist = haversineMeters(la, lb);
  if (dist == null) return 0;
  if (dist <= config.locationProximityMeters) return 1;
  if (dist <= config.locationProximityMeters * 4) return 0.5;
  return 0;
}

export interface ScoredMatch extends SimilarMatch {
  report: Report;
}

/**
 * Score a target report against candidate reports and return matches at or above
 * the configured threshold, sorted by descending score.
 */
export function findSimilar(target: Report, candidates: Report[]): ScoredMatch[] {
  const targetTokens = tokenize(reportText(target));
  const matches: ScoredMatch[] = [];

  for (const cand of candidates) {
    if (cand.reportId === target.reportId) continue;

    const textScore = jaccard(targetTokens, tokenize(reportText(cand)));
    const categoryScore =
      target.category && cand.category && target.category === cand.category ? 1 : 0;
    const locScore = locationScore(target, cand);

    const score = textScore * 0.5 + categoryScore * 0.25 + locScore * 0.25;

    if (score >= config.similarityThreshold) {
      matches.push({
        reportId: cand.reportId,
        issueId: cand.issueId,
        score: Math.round(score * 100) / 100,
        report: cand,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}
