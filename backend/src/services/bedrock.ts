// Bedrock reasoning layer (Amazon Nova Lite, Converse API, multimodal).
// Produces validated structured JSON. Never throws to the caller — always returns
// a usable AiAnalysis, marking degraded=true when a heuristic fallback is used.
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { config } from '../shared/config.js';
import { aiAnalysisSchema } from '../shared/schemas.js';
import type { AiAnalysis, Category, RekognitionResult, Report } from '../shared/types.js';
import { logEvent, nowIso } from '../shared/util.js';
import type { TextEvidence } from './textEvidence.js';
import { heuristicAnalysis } from './heuristic.js';

const client = new BedrockRuntimeClient({ region: config.region });

const SYSTEM_PROMPT = `You are CivicFlow's civic-issue analyst. You analyze citizen reports about community infrastructure problems.

Rules:
- Return ONLY a single JSON object. No prose, no markdown fences, no explanation.
- Separate observed evidence from interpretation. evidence.text is what the citizen stated; evidence.image is what the vision system detected.
- Do NOT expose step-by-step reasoning. reasoning_summary must be one concise sentence.
- category must be one of: road_infrastructure, streetlight, waste, water, drainage, public_property, other.
- severity must be one of: LOW, MEDIUM, HIGH, CRITICAL. confidence is a number 0..1.
- recommended_action must be one concise, practical municipal action.

JSON shape:
{"category":"...","issue_type":"...","summary":"...","severity":"...","confidence":0.0,"evidence":{"text":["..."],"image":["..."]},"recommended_action":"...","reasoning_summary":"..."}`;

const IMAGE_FORMAT: Record<string, 'jpeg' | 'png' | 'webp'> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
};

function buildUserContext(
  report: Report,
  textEv: TextEvidence,
  vision: RekognitionResult,
  nearby: Report[],
): string {
  const lines: string[] = [];
  lines.push(`CITIZEN TITLE: ${report.title || '(none)'}`);
  lines.push(`CITIZEN TEXT: ${report.text || '(none — image only)'}`);
  if (report.category) lines.push(`CITIZEN-SELECTED CATEGORY: ${report.category}`);
  if (report.location?.label) lines.push(`LOCATION: ${report.location.label}`);
  lines.push(
    `TEXT EVIDENCE (observed): ${textEv.phrases.length ? textEv.phrases.join('; ') : '(none)'}`,
  );
  lines.push(
    `IMAGE EVIDENCE (Rekognition labels): ${
      vision.available && vision.labels.length
        ? vision.labels.map((l) => `${l.name} ${l.confidence}%`).join(', ')
        : '(no image analysis available)'
    }`,
  );
  if (nearby.length) {
    lines.push(
      `NEARBY EXISTING REPORTS: ${nearby
        .slice(0, 5)
        .map((r) => `"${r.title}"`)
        .join(', ')}`,
    );
  }
  lines.push('\nAnalyze and return the JSON object described in the system prompt.');
  return lines.join('\n');
}

/** Extract the first JSON object from a model response that may include stray text. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

export async function reason(
  report: Report,
  textEv: TextEvidence,
  vision: RekognitionResult,
  nearby: Report[],
  imageBytes?: Buffer,
): Promise<AiAnalysis> {
  const content: ContentBlock[] = [{ text: buildUserContext(report, textEv, vision, nearby) }];

  // Add the image as a multimodal content block when available.
  if (imageBytes && report.imageKey) {
    const ext = report.imageKey.split('.').pop()?.toLowerCase() || 'jpeg';
    const format = IMAGE_FORMAT[ext] || 'jpeg';
    content.push({ image: { format, source: { bytes: imageBytes } } });
  }

  try {
    const res = await client.send(
      new ConverseCommand({
        modelId: config.bedrockModelId,
        system: [{ text: SYSTEM_PROMPT }],
        messages: [{ role: 'user', content }],
        inferenceConfig: { maxTokens: 600, temperature: 0.2 },
      }),
    );

    const raw = res.output?.message?.content?.find((c) => 'text' in c)?.text || '';
    const parsed = extractJson(raw);
    const validated = aiAnalysisSchema.safeParse(parsed);

    if (!validated.success) {
      logEvent('AI_OUTPUT_MALFORMED', { reportId: report.reportId });
      return degrade(report, textEv, vision);
    }

    logEvent('AI_ANALYSIS_COMPLETED', {
      reportId: report.reportId,
      category: validated.data.category,
      severity: validated.data.severity,
    });

    return {
      ...validated.data,
      // Ensure observed evidence always includes what we actually detected.
      evidence: {
        text: dedupe([...validated.data.evidence.text, ...textEv.phrases]),
        image: dedupe([
          ...validated.data.evidence.image,
          ...vision.labels.slice(0, 6).map((l) => l.name),
        ]),
      },
      status: 'OK',
      degraded: false,
      analyzedAt: nowIso(),
    };
  } catch (err) {
    logEvent('AI_ANALYSIS_FAILED', {
      reportId: report.reportId,
      message: (err as Error).message,
    });
    return degrade(report, textEv, vision);
  }
}

function degrade(
  report: Report,
  textEv: TextEvidence,
  vision: RekognitionResult,
): AiAnalysis {
  const h = heuristicAnalysis(report, textEv, vision);
  return { ...h, status: 'PENDING_RETRY', degraded: true, analyzedAt: nowIso() };
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean))).slice(0, 10);
}

export type { Category };
