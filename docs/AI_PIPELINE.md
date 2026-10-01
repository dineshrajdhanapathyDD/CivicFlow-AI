# CivicFlow AI — Evidence Analysis Pipeline

The pipeline is explicit and staged. CivicFlow does not send the whole complaint to an LLM
and return a generic answer. Each stage produces inspectable output, and the final result
separates **observed evidence**, **AI interpretation**, and **recommended action**.

## Stages

```
Citizen Report (text ± image)
        │
        ▼
1. Evidence Extraction
   ├─ Text analysis   (deterministic keyword/phrase extraction)
   └─ Image analysis  (Amazon Rekognition DetectLabels → visual evidence)
        │
        ▼
2. Context Gather      (nearby / recent existing reports from DynamoDB)
        │
        ▼
3. Evidence Fusion + Reasoning  (Amazon Bedrock, Nova Lite, Converse, multimodal)
        │
        ▼
4. Structured Output Validation (zod schema; repair or fallback if malformed)
        │
        ▼
5. Similarity / Duplicate Analysis
        │
        ▼
6. Issue Cluster (create new OR attach to existing)
        │
        ▼
7. Priority (transparent factor model)
        │
        ▼
8. Recommended Action  →  persist + log
```

## 1. Evidence extraction

- **Text:** normalize, strip HTML, extract salient phrases (infrastructure nouns, damage
  verbs, time cues). These become `evidence.text[]`.
- **Image:** Rekognition `DetectLabels` (minConfidence ~70). Labels such as `Pothole`,
  `Road`, `Street Light`, `Garbage`, `Water` become `evidence.image[]`. Labels are visual
  evidence, **not** the diagnosis.

## 2. Context gather

Query DynamoDB for recent reports in the same category and/or near the location. This gives
the model prior art so it can note "previous reports exist nearby".

## 3. Fusion + reasoning (Bedrock Nova Lite)

Single Converse call. Content blocks:
- System guidance: role, strict JSON contract, evidence-vs-interpretation separation,
  probabilistic language for duplicates, no chain-of-thought exposure.
- The citizen text + extracted text evidence.
- The Rekognition labels.
- A compact summary of nearby existing reports.
- The image itself (image content block) when present — Nova Lite is multimodal.

Model is configurable via `BEDROCK_MODEL_ID` (default `amazon.nova-lite-v1:0`).

## 4. Structured output contract

```json
{
  "category": "road_infrastructure",
  "issue_type": "pothole",
  "summary": "Large pothole reported near school entrance",
  "severity": "HIGH",
  "confidence": 0.94,
  "evidence": {
    "text": ["Citizen reports damaged road near school"],
    "image": ["Visible road surface damage", "Large depression in road surface"]
  },
  "recommended_action": "Inspect and repair damaged road surface",
  "reasoning_summary": "Text and image evidence indicate a significant road hazard."
}
```

Validated with zod. On malformed JSON: attempt to extract the first JSON object; if that
fails, fall back to a deterministic heuristic result and mark `aiAnalysis.degraded = true`.
The application never crashes on a bad model response.

## 5. Similarity / duplicate analysis

Application-level score (0..1):
- Text/summary token (Jaccard) overlap — weight 0.5
- Same category — weight 0.25
- Location proximity (same label or haversine < 250 m) — weight 0.25

Score ≥ 0.55 → treat as a **possible duplicate**. Language stays probabilistic:
"potentially related", "possible duplicate", with a confidence value.

## 6. Issue clustering

- If a similar open Issue exists → attach report, increment `reportCount`, recompute
  Issue-level severity/priority/summary.
- Otherwise → create a new Issue from this report's analysis.

## 7. Priority (transparent)

Deterministic factor model (not LLM-decided):

```
score = severityWeight(severity)          // LOW1 MED2 HIGH3 CRIT4
      + min(relatedReports,5) * 0.6
      + recencyBoost(createdAt)           // <24h +1, <72h +0.5
      + (publicInfrastructure ? 1 : 0)
      + (unresolved ? 0.5 : 0)
priority = bucket(score)                  // LOW / MEDIUM / HIGH / CRITICAL
```

`priorityFactors` is stored and shown to the user ("High severity · 4 related reports ·
Recently reported · Public infrastructure").

## 8. Recommended action

Comes from the model's `recommended_action`, constrained to be concise and practical, with
deterministic fallbacks per category if the model output is degraded.

## Failure handling matrix

| Failure            | Behavior                                                        |
|--------------------|-----------------------------------------------------------------|
| Bedrock unavailable| Report saved; `PENDING_RETRY`; heuristic fallback; friendly msg |
| Rekognition fails  | Continue text-only; note image evidence unavailable             |
| Invalid image      | Rejected at upload (type/size)                                  |
| DynamoDB failure   | Surface generic error; no partial corruption; ret/ry safe       |
| Malformed model    | JSON extract → heuristic fallback; `degraded=true`              |
| API timeout        | Client shows retry; analyze is idempotent                       |

---

## Ask CivicFlow — AWS Strands tool-using agent

`POST /ask` is served by a dedicated Python Lambda built on the **AWS Strands Agents SDK**.
Unlike a single grounded prompt, this is a real agent loop: the model is given
deterministic, read-only tools and decides which to call to answer the question.

Agent tools (`@tool`-decorated, read DynamoDB directly via boto3):
- `get_dashboard_statistics` — community-wide totals, category/status breakdown, duplicate clusters
- `search_reports(keyword, category, status)` — filtered report search
- `list_top_open_issues(limit)` — highest-priority unresolved issues
- `get_issue(issue_id)` — one issue's full detail
- `get_issue_history(issue_id)` — issue plus its clustered member reports

Model: Amazon Bedrock Nova (`BEDROCK_MODEL_ID`, default `amazon.nova-lite-v1:0`),
temperature 0.1. The system prompt forbids inventing statistics — every number must come
from a tool result. Any `<thinking>` the model emits is stripped before returning, so no
chain-of-thought is exposed. The response reports which tools the agent actually invoked.

Reliability: if the agent Lambda errors, it returns a friendly message with HTTP 200 so the
UI stays usable. The TypeScript backend also retains a grounded `/ask` implementation
(`backend/src/services/ask.ts`) that can be swapped in if needed. The deployed application
works entirely without any local MCP server.
