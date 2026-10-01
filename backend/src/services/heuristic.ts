// Deterministic fallback analysis. Used when Bedrock is unavailable or returns
// malformed output. Guarantees a usable AiAnalysis so a report is never lost.
import type { AiAnalysis, Category, RekognitionResult, Report, Severity } from '../shared/types.js';
import type { TextEvidence } from './textEvidence.js';
import { labelsToEvidence } from './vision.js';

const CATEGORY_ACTION: Record<Category, { issueType: string; action: string }> = {
  road_infrastructure: {
    issueType: 'road damage',
    action: 'Conduct a road inspection and repair the damaged surface.',
  },
  streetlight: {
    issueType: 'streetlight failure',
    action: 'Inspect the electrical connection and repair or replace the faulty lighting.',
  },
  waste: {
    issueType: 'waste accumulation',
    action: 'Schedule waste collection and inspect the affected area.',
  },
  water: {
    issueType: 'water leakage',
    action: 'Inspect water infrastructure and identify the source of the leak.',
  },
  drainage: {
    issueType: 'drainage blockage',
    action: 'Inspect and clear the affected drainage to restore flow.',
  },
  public_property: {
    issueType: 'public property damage',
    action: 'Inspect the damaged public property and schedule repair.',
  },
  other: {
    issueType: 'community issue',
    action: 'Review the report and route it to the appropriate department.',
  },
};

// Map common Rekognition labels to a category when text gives no hint.
const LABEL_CATEGORY: { match: RegExp; category: Category }[] = [
  { match: /pothole|road|asphalt|tarmac|gravel/i, category: 'road_infrastructure' },
  { match: /street ?light|lamp|lighting/i, category: 'streetlight' },
  { match: /garbage|trash|waste|litter|rubbish/i, category: 'waste' },
  { match: /water|flood|puddle|leak/i, category: 'water' },
  { match: /drain|sewer|gutter/i, category: 'drainage' },
];

function inferCategory(textEv: TextEvidence, vision: RekognitionResult): Category {
  if (textEv.categoryHint) return textEv.categoryHint;
  for (const label of vision.labels) {
    for (const { match, category } of LABEL_CATEGORY) {
      if (match.test(label.name)) return category;
    }
  }
  return 'other';
}

function inferSeverity(textEv: TextEvidence, vision: RekognitionResult): Severity {
  let score = 1;
  if (textEv.hasSeverityCue) score += 1;
  if (textEv.hasTimeCue) score += 1;
  if (vision.available && vision.labels.length > 4) score += 1;
  if (score >= 3) return 'HIGH';
  if (score === 2) return 'MEDIUM';
  return 'LOW';
}

export function heuristicAnalysis(
  report: Report,
  textEv: TextEvidence,
  vision: RekognitionResult,
): AiAnalysis {
  const category = inferCategory(textEv, vision);
  const severity = inferSeverity(textEv, vision);
  const { issueType, action } = CATEGORY_ACTION[category];
  const title = report.title || issueType;

  return {
    category,
    issue_type: issueType,
    summary: `${title.charAt(0).toUpperCase()}${title.slice(1)}`.slice(0, 200),
    severity,
    confidence: vision.available ? 0.6 : 0.5,
    evidence: {
      text: textEv.phrases,
      image: labelsToEvidence(vision),
    },
    recommended_action: action,
    reasoning_summary:
      'Assessed from available text and visual evidence using CivicFlow rules while AI reasoning was unavailable.',
  };
}
