// Evidence Analysis Pipeline orchestrator (Phase 2).
// Stages: text evidence -> image evidence (Rekognition) -> context -> fusion (Bedrock)
// -> validate -> persist. Clustering + priority are layered in Phase 3.
import type { Report } from '../shared/types.js';
import { getReport, updateReport, listReports } from '../data/repo.js';
import { extractTextEvidence } from './textEvidence.js';
import { analyzeImage, getImageBytes } from './vision.js';
import { reason } from './bedrock.js';
import { clusterReport } from './clustering.js';
import { logEvent } from '../shared/util.js';
import type { Issue, SimilarMatch } from '../shared/types.js';

export interface AnalyzeResult {
  report: Report;
  issue?: Issue;
  similar?: SimilarMatch[];
}

/** Gather recent reports as context (same category preferred). Best-effort. */
async function gatherContext(report: Report): Promise<Report[]> {
  try {
    const recent = await listReports(40);
    return recent
      .filter((r) => r.reportId !== report.reportId)
      .filter((r) => !report.category || r.category === report.category || !r.category)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export async function analyzeReport(reportId: string): Promise<AnalyzeResult | undefined> {
  const report = await getReport(reportId);
  if (!report) return undefined;

  logEvent('AI_ANALYSIS_STARTED', { reportId });

  // 1. Text evidence (deterministic)
  const textEv = extractTextEvidence(report.title, report.text);

  // 2. Image evidence (Rekognition) — best-effort, never fatal
  let imageBytes: Buffer | undefined;
  if (report.imageKey) {
    imageBytes = await getImageBytes(report.imageKey);
  }
  const vision = await analyzeImage(imageBytes);

  // 3. Context: nearby / recent reports
  const nearby = await gatherContext(report);

  // 4. Evidence fusion + reasoning (Bedrock Nova Lite, multimodal). Never throws.
  const ai = await reason(report, textEv, vision, nearby, imageBytes);

  // Persist analysis onto the report first so it is never lost.
  const analyzed = await updateReport(reportId, {
    aiAnalysis: ai,
    rekognition: vision,
    category: ai.category,
    severity: ai.severity,
    confidence: ai.confidence,
    status: 'AI_ANALYZED',
  });
  const reportForCluster = analyzed || { ...report, aiAnalysis: ai, category: ai.category };

  // 5. Duplicate detection + issue clustering (Phase 3). Best-effort.
  logEvent('DUPLICATE_CHECK_COMPLETED', { reportId, candidates: nearby.length });
  try {
    const cluster = await clusterReport(reportForCluster, ai, nearby);

    // 6. Link report to its issue cluster.
    const clustered = await updateReport(reportId, {
      issueId: cluster.issue.issueId,
      status: 'CLUSTERED',
    });

    return {
      report: clustered || reportForCluster,
      issue: cluster.issue,
      similar: cluster.similar.map((m) => ({
        reportId: m.reportId,
        issueId: m.issueId,
        score: m.score,
      })),
    };
  } catch (err) {
    // Clustering failure must not lose the analysis; report stays AI_ANALYZED.
    logEvent('CLUSTERING_FAILED', { reportId, message: (err as Error).message });
    return { report: reportForCluster };
  }
}
