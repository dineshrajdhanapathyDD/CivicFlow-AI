# CivicFlow AI — Design

## 1. Architecture

```
React (Vite/TS/Tailwind)  ──build──▶  S3 (static site)  ◀──  CloudFront (public URL)
        │
        │ HTTPS (fetch)
        ▼
   API Gateway (HTTP API)
        │
        ▼
     AWS Lambda (Node 20, TypeScript)   ── CloudWatch Logs
        │
   ┌────┼───────────────┬───────────────┬───────────────┐
   ▼    ▼               ▼               ▼               ▼
DynamoDB  S3 (images)   Rekognition     Bedrock         (app tools /
(single-table)          (DetectLabels)  (Nova Lite      agent logic)
                                         Converse)
```

- One HTTP API (API Gateway v2) fronts a small set of Lambda handlers.
- Frontend is fully static (S3 + CloudFront). No credentials shipped to the browser.
- Image upload path: browser asks API for a presigned PUT URL → uploads directly to S3.

## 2. Data model (DynamoDB single-table)

Table `civicflow` — single-table design. Keys:

| Entity  | PK                 | SK                    | Purpose                    |
|---------|--------------------|-----------------------|----------------------------|
| Report  | `REPORT#<id>`      | `REPORT#<id>`         | report item                |
| Issue   | `ISSUE#<id>`       | `ISSUE#<id>`          | issue cluster item         |
| Link    | `ISSUE#<id>`       | `REPORT#<id>`         | report↔issue membership    |
| User    | `USER#<id>`        | `USER#<id>`           | lightweight user           |

### GSIs
- **GSI1 (by type + recency):** `GSI1PK = TYPE#REPORT | TYPE#ISSUE`, `GSI1SK = <createdAt ISO>`.
  Powers "recent reports", "all issues", dashboard scans without full-table scan.
- **GSI2 (by category):** `GSI2PK = CAT#<category>`, `GSI2SK = <createdAt>`. Category queries.
- **GSI3 (by status):** `GSI3PK = STATUS#<status>`, `GSI3SK = <createdAt>`. Status queries.

### Report attributes
`reportId, userId, createdAt, title, text, imageKey, imageUrl, location{label,lat,lng},
category, status, severity, confidence, issueId, aiAnalysis{...}, rekognition{labels[]},
priorityFactors{...}`

### Issue attributes
`issueId, category, issueType, summary, severity, priority, priorityFactors,
status, location, reportCount, confidence, recommendedAction, reportIds[],
createdAt, updatedAt`

Enums:
- `category`: `road_infrastructure | streetlight | waste | water | drainage | public_property | other`
- `status` (report): `NEW | AI_ANALYZED | CLUSTERED`
- `status` (issue): `NEW | AI_ANALYZED | VERIFIED | IN_PROGRESS | RESOLVED`
- `severity`: `LOW | MEDIUM | HIGH | CRITICAL`
- `priority`: `LOW | MEDIUM | HIGH | CRITICAL`

## 3. AI pipeline (server-side, on `/analyze` or right after create)

```
1. extractTextEvidence(text, title)      → keyword/phrase evidence (deterministic)
2. extractImageEvidence(imageKey)        → Rekognition DetectLabels → label evidence
3. gatherContext(category, location)     → nearby/recent existing reports (DynamoDB)
4. fuseAndReason(...)                     → Bedrock Nova Lite (multimodal: image bytes +
                                            text + evidence + context) → structured JSON
5. validateAiOutput(json)                 → zod schema; repair/fallback on malformed output
6. findSimilarReports(...)                → similarity score vs existing reports
7. clusterDecision(...)                   → attach to existing Issue or create new Issue
8. computePriority(factors)               → transparent factor model
9. persist                                → update Report + Issue, log events
```

- **Bedrock call:** Converse API. If an image exists, include it as an image content block
  (Nova Lite is multimodal). Response requested as strict JSON; parsed and validated.
- **Separation of concerns in output:** `evidence.text[]` and `evidence.image[]` are
  observed; `summary` + `issue_type` + `reasoning_summary` are interpretation;
  `recommended_action` is action.
- **Failure handling:** any AWS failure → report stays saved, `aiAnalysis.status =
  "PENDING_RETRY"`, user sees a friendly message. Priority/cluster steps are skipped until
  a successful analysis exists.

### Similarity (application-level, no vector DB for MVP)
Score = weighted sum of:
- Token/Jaccard overlap of normalized text + AI summary (0..1, weight 0.5)
- Same category (weight 0.25)
- Location proximity: same label or haversine < 250m (weight 0.25)
Threshold ≥ 0.55 → "possible duplicate" → cluster with the best-matching open issue.

### Priority model (deterministic, explainable)
```
score = severityWeight(severity)            // LOW1 MED2 HIGH3 CRIT4
      + min(relatedReports, 5) * 0.6
      + recencyBoost(createdAt)             // <24h +1, <72h +0.5
      + (publicInfrastructure ? 1 : 0)
      + (status != RESOLVED ? 0.5 : 0)
priority = bucket(score)                     // thresholds → LOW/MED/HIGH/CRITICAL
```
`priorityFactors` stores each contributing factor for display.

## 4. API contracts (see API.md for full detail)

```
POST   /reports                 create report (metadata; returns reportId + upload URL if image)
GET    /reports                 list (query: status, category, limit)
GET    /reports/{id}            get one
POST   /reports/{id}/analyze    run/re-run AI pipeline
GET    /issues                  list issues
GET    /issues/{id}             get issue + member reports
PATCH  /issues/{id}/status      admin: advance lifecycle (x-admin-key)
GET    /dashboard/stats         aggregate stats
POST   /ask                     Ask CivicFlow (data-grounded)
POST   /uploads/presign         (used by create when image included)
```

All responses JSON `{ ok: boolean, data?: ..., error?: string }`. Validation via zod.

## 5. Agent tools (deterministic)

`search_reports`, `get_report`, `search_similar_reports`, `get_issue`,
`get_dashboard_statistics`, `create_or_attach_issue`, `update_issue_status`.
Ask CivicFlow uses `get_dashboard_statistics` + `search_reports` before Bedrock summarizes.

## 6. Frontend structure

Routes: `/` dashboard, `/report` submit, `/report/:id` details (primary demo screen),
`/issues` list, `/issues/:id` detail, `/ask`. React Router, Tailwind v4, Nova-agnostic
fetch client. Design follows `.kiro/skills/taste-skill` (anti-slop, real layout variance,
one locked accent, WCAG AA contrast, loading/empty/error states).

## 7. Infrastructure (CDK, TypeScript)

Stacks: one app stack — DynamoDB table + GSIs, images bucket (private, CORS for PUT),
Lambda (single bundled handler with router, or per-route), HTTP API + routes, site bucket
+ CloudFront (OAC), IAM roles least-privilege (DynamoDB CRUD on table, S3 on buckets,
`bedrock:InvokeModel`, `rekognition:DetectLabels`, logs). Outputs: ApiUrl, SiteUrl,
BucketNames, TableName.

## 8. Security specifics

- Admin actions require `x-admin-key` matching an SSM/Lambda env secret (not committed).
- Presigned PUT restricted by content-type and key prefix; size enforced client-side +
  bucket policy guidance in docs.
- Input sanitized (strip HTML) before persist/display.
- CloudFront serves frontend over HTTPS; API CORS locked to the CloudFront origin in prod.
