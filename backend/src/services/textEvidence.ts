// Deterministic text evidence extraction. No LLM — this is the "observed" text layer.
import type { Category } from '../shared/types.js';

const INFRA_TERMS: { term: RegExp; category: Category }[] = [
  { term: /pothole|road|pavement|asphalt|crack|road surface|street\b/i, category: 'road_infrastructure' },
  { term: /street ?light|lamp ?post|lamp|lighting|bulb/i, category: 'streetlight' },
  { term: /garbage|trash|waste|rubbish|litter|dump|bin\b/i, category: 'waste' },
  { term: /water leak|leak|pipe|burst|water main|flooding/i, category: 'water' },
  { term: /drain|sewer|sewage|clog|blocked drain|gutter/i, category: 'drainage' },
  { term: /bench|sign|fence|playground|wall|park|public/i, category: 'public_property' },
];

const TIME_CUES =
  /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|several|many|few)\s*(day|days|night|nights|week|weeks|month|months|hour|hours)\b/i;
const SEVERITY_CUES = /\b(large|deep|huge|dangerous|hazard|urgent|broken|severe|major|blocked|overflow)/i;

export interface TextEvidence {
  phrases: string[];
  categoryHint?: Category;
  hasTimeCue: boolean;
  hasSeverityCue: boolean;
}

/** Extract salient phrases and a category hint from the citizen's text + title. */
export function extractTextEvidence(title: string, text: string): TextEvidence {
  const combined = `${title || ''}. ${text || ''}`.trim();
  const phrases: string[] = [];
  let categoryHint: Category | undefined;

  for (const { term, category } of INFRA_TERMS) {
    const m = combined.match(term);
    if (m) {
      if (!categoryHint) categoryHint = category;
      phrases.push(`Citizen mentions "${m[0]}"`);
    }
  }

  const timeMatch = combined.match(TIME_CUES);
  if (timeMatch) phrases.push(`Duration cue: ${timeMatch[0]}`);

  const sevMatch = combined.match(SEVERITY_CUES);
  if (sevMatch) phrases.push(`Severity language: "${sevMatch[0]}"`);

  if (phrases.length === 0 && combined.length > 3) {
    phrases.push('Citizen provided a free-text description');
  }

  return {
    phrases: phrases.slice(0, 8),
    categoryHint,
    hasTimeCue: !!timeMatch,
    hasSeverityCue: !!sevMatch,
  };
}
