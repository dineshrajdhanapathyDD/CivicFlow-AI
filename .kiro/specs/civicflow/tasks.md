# CivicFlow AI — Implementation Tasks

## Phase 1 — Foundation
- [ ] 1.1 Monorepo scaffold: `/infra` (CDK), `/backend` (Lambda + shared lib), `/frontend` (Vite React TS).
- [ ] 1.2 Shared types + zod schemas (`backend/src/shared`).
- [ ] 1.3 DynamoDB access layer (single-table repo functions).
- [ ] 1.4 CDK app stack: table + GSIs, images bucket, site bucket, HTTP API, Lambda, CloudFront.
- [ ] 1.5 Report create/list/get handlers + presign. Local unit tests.
- [ ] 1.6 Frontend shell: routing, layout, API client, dashboard + report form (no AI yet).

## Phase 2 — Multimodal AI
- [ ] 2.1 S3 presigned upload wired end to end (browser → S3).
- [ ] 2.2 Rekognition image evidence extractor.
- [ ] 2.3 Bedrock Nova Lite reasoning (Converse, multimodal), zod-validated structured output.
- [ ] 2.4 Evidence fusion + `/analyze` endpoint. Graceful failure handling + retry state.

## Phase 3 — Intelligence
- [ ] 3.1 Similarity/duplicate detection (text + category + location).
- [ ] 3.2 Issue clustering (create vs attach).
- [ ] 3.3 Transparent priority model with stored factors.
- [ ] 3.4 Recommended action surfaced on issue.

## Phase 4 — Community
- [ ] 4.1 Dashboard stats endpoint + UI.
- [ ] 4.2 Issues list + issue detail (member reports, cluster info).
- [ ] 4.3 Status lifecycle PATCH + admin control.
- [ ] 4.4 Ask CivicFlow (tool retrieval → Bedrock summary).

## Phase 5 — Production
- [ ] 5.1 Backend + frontend tests (Vitest).
- [ ] 5.2 Security hardening + input sanitization + CORS lock.
- [ ] 5.3 CloudWatch structured logging for event set.
- [ ] 5.4 Loading/empty/error states across UI.
- [ ] 5.5 CDK deploy; seed demo data (incl. duplicate cluster set).
- [ ] 5.6 End-to-end verification against public URL.

## Phase 6 — Hackathon docs
- [ ] 6.1 README, ARCHITECTURE, API, AI_PIPELINE, DEPLOYMENT, DEMO.
- [ ] 6.2 Coding-agent evidence + demo script + submission content.
