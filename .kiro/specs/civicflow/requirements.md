# CivicFlow AI — Requirements

> **CivicFlow doesn't count complaints. It understands the problem behind them.**

AWS Zero to Shipped Hackathon · Category `#social-good` · Lane `#community`

## 1. Product summary

CivicFlow AI lets citizens report real-world community problems using text, an image,
or both. The system analyzes the evidence with multimodal AI, identifies the underlying
issue, estimates severity and confidence, detects potentially duplicate reports, groups
related reports into a single community issue, prioritizes it transparently, and
recommends a concrete action. A community dashboard measures progress.

## 2. Users and roles

- **Citizen** — submits reports, views report/issue status. Anonymous-friendly (a
  lightweight `userId` is generated client-side; no account wall for the MVP).
- **Admin/Staff** — updates issue status through the lifecycle. Gated by an
  `x-admin-key` header checked in Lambda (simple shared secret for the MVP; documented
  as a hardening point).

## 3. Functional requirements

### FR1 — Report submission
- Citizen can submit: title/short description, detailed text, optional image, optional
  location (free text + optional lat/lng), optional category.
- Three modes must all work: text-only, image-only, text+image.
- Image upload uses an S3 presigned PUT URL. Allowed types: JPEG, PNG, WebP. Max 8 MB.
- Report is persisted immediately with status `NEW` before AI runs, so no report is ever
  lost if AI fails.

### FR2 — Multimodal evidence analysis pipeline
Explicit pipeline (not a single blind LLM call):
1. Evidence extraction — text analysis + image analysis (Rekognition labels).
2. Evidence fusion — combine text evidence, image evidence, existing nearby reports, context.
3. Issue identification — category, issue type, summary.
4. Severity + confidence.
5. Duplicate/similarity analysis.
6. Issue cluster assignment (new or existing).
7. Recommended action.
- Output separates **observed evidence** vs **AI interpretation** vs **recommended action**.
- Hidden chain-of-thought is never exposed; only a concise `reasoning_summary`.

### FR3 — Image analysis (Rekognition)
- Extract relevant objects, infrastructure elements, visible damage, environmental context.
- Rekognition labels are treated as visual **evidence**, not the final diagnosis.

### FR4 — Bedrock reasoning
- Amazon Bedrock (Nova Lite, configurable) reasons over citizen text + Rekognition results
  + existing nearby reports + location/context.
- Returns structured JSON matching a fixed schema (category, issue_type, summary, severity,
  confidence, evidence.text[], evidence.image[], recommended_action, reasoning_summary).
- Malformed model output must be handled gracefully (validate, repair, or fall back).

### FR5 — Duplicate detection & clustering
- Search existing reports; identify potentially similar ones (semantic token overlap +
  category + location proximity).
- Decide: create a new Issue or attach the report to an existing Issue cluster.
- Language is always probabilistic: "potentially related", "possible duplicate",
  "confidence" — never absolute certainty.
- Display related report count and community confirmations.

### FR6 — Transparent priority
- Priority (`LOW|MEDIUM|HIGH|CRITICAL`) computed from structured factors: AI severity,
  related report count, recency, public-infrastructure flag, unresolved status.
- The factor breakdown is stored and displayed. The LLM does not set priority alone.

### FR7 — Recommended action
- Every confirmed issue has a concise, practical recommended action.

### FR8 — Issue lifecycle
- `NEW → AI_ANALYZED → VERIFIED → IN_PROGRESS → RESOLVED`.
- Admin can advance status. Citizens can view status.

### FR9 — Community dashboard
- Totals: total reports, active issues, high-priority issues, resolved.
- Category breakdown (%), status distribution, potential duplicate clusters, recent reports.
- Uses real DynamoDB data; deployed app is seeded with realistic demo data.

### FR10 — Ask CivicFlow
- Natural-language questions answered from application data only.
- The agent retrieves data via deterministic tools first, then Bedrock summarizes. No
  invented statistics.

## 4. Non-functional requirements

- **Security:** no AWS credentials in the frontend; IAM roles with least privilege; input
  validation; upload type/size restrictions; sanitized user content; internal AWS errors
  never surfaced to users; CloudWatch logging; secrets not committed.
- **Reliability:** report persists before AI; AI failures are retryable and non-fatal.
- **Observability:** structured CloudWatch logs for the documented event set.
- **Performance:** report submit < 1s (AI runs async or on-demand via `/analyze`).
- **Responsiveness:** mobile-first, polished UI (taste-skill design guidance).
- **Reproducibility:** all infra via AWS CDK; documented deploy commands.

## 5. AWS services

S3, CloudFront, API Gateway (HTTP API), Lambda (Node.js/TypeScript), DynamoDB, Bedrock
(Nova Lite), Rekognition, CloudWatch, IAM. No extra services unless they add clear value.

## 6. Out of scope (MVP)

Real user accounts/auth provider, push notifications, native mobile app, vector DB
(similarity is application-level for the MVP), MCP server as a hard dependency (optional).

## 7. Acceptance (deploy checklist)

Frontend URL, API, report submission, image upload, Rekognition, Bedrock, issue creation,
duplicate detection, dashboard, and Ask CivicFlow all verified against the public URL.
