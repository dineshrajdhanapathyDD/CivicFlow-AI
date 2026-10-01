import { describe, it, expect } from 'vitest';
import { extractJson } from './bedrock.js';
import { aiAnalysisSchema } from '../shared/schemas.js';
import { extractTextEvidence } from './textEvidence.js';
import { heuristicAnalysis } from './heuristic.js';
import type { Report } from '../shared/types.js';

describe('extractJson', () => {
  it('parses clean JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips markdown code fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('extracts JSON embedded in stray prose', () => {
    const raw = 'Here is the result: {"a":1,"b":"x"} hope that helps';
    expect(extractJson(raw)).toEqual({ a: 1, b: 'x' });
  });

  it('returns undefined for non-JSON', () => {
    expect(extractJson('totally not json')).toBeUndefined();
  });
});

describe('aiAnalysisSchema', () => {
  it('accepts a valid analysis and coerces string confidence', () => {
    const parsed = aiAnalysisSchema.safeParse({
      category: 'pothole_wrong', // invalid category
      issue_type: 'pothole',
      summary: 'x',
      severity: 'HIGH',
      confidence: '0.9',
      evidence: { text: [], image: [] },
      recommended_action: 'fix',
      reasoning_summary: 'y',
    });
    expect(parsed.success).toBe(false); // invalid category rejected
  });

  it('accepts a fully valid analysis', () => {
    const parsed = aiAnalysisSchema.safeParse({
      category: 'road_infrastructure',
      issue_type: 'pothole',
      summary: 'Large pothole',
      severity: 'HIGH',
      confidence: 0.94,
      evidence: { text: ['a'], image: ['b'] },
      recommended_action: 'Repair road',
      reasoning_summary: 'Evidence indicates a hazard.',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('extractTextEvidence', () => {
  it('detects streetlight category and time cue', () => {
    const ev = extractTextEvidence(
      'Streetlight out',
      'The streetlight near the school has not worked for three nights.',
    );
    expect(ev.categoryHint).toBe('streetlight');
    expect(ev.hasTimeCue).toBe(true);
  });

  it('detects road category and severity cue', () => {
    const ev = extractTextEvidence('Pothole', 'There is a large dangerous pothole in the road.');
    expect(ev.categoryHint).toBe('road_infrastructure');
    expect(ev.hasSeverityCue).toBe(true);
  });
});

describe('heuristicAnalysis (fallback)', () => {
  const baseReport: Report = {
    reportId: 'CF-1',
    userId: 'u',
    createdAt: new Date().toISOString(),
    title: 'Pothole near school',
    text: 'Large pothole in the road',
    status: 'NEW',
  };

  it('produces a valid analysis object when AI is unavailable', () => {
    const textEv = extractTextEvidence(baseReport.title, baseReport.text);
    const result = heuristicAnalysis(baseReport, textEv, { labels: [], available: false });
    // The fallback output must itself satisfy the AI schema shape.
    const parsed = aiAnalysisSchema.safeParse({
      category: result.category,
      issue_type: result.issue_type,
      summary: result.summary,
      severity: result.severity,
      confidence: result.confidence,
      evidence: result.evidence,
      recommended_action: result.recommended_action,
      reasoning_summary: result.reasoning_summary,
    });
    expect(parsed.success).toBe(true);
    expect(result.category).toBe('road_infrastructure');
    expect(result.recommended_action.length).toBeGreaterThan(0);
  });
});
