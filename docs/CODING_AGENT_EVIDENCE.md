# Coding Agent Evidence — Built with Kiro

CivicFlow AI was built collaboratively with the **Kiro** coding agent, connected to AWS,
using a spec-driven, phased workflow. This document records how the agent contributed at
each stage. It reflects the actual build; nothing here is fabricated.

## 1. Spec-driven architecture generation

The agent first verified the environment and the AI foundation before writing application
code:
- Confirmed AWS credentials, region (`us-east-1`), Node/CDK toolchain.
- Queried Bedrock for available models and **verified Amazon Nova Lite via the Converse API**
  before committing to it — avoiding a hard-coded, unavailable model.

It then authored the spec and architecture docs under `.kiro/specs/civicflow/`
(`requirements.md`, `design.md`, `tasks.md`) and top-level `ARCHITECTURE.md`, `API.md`,
`AI_PIPELINE.md`, `DEPLOYMENT.md`, plus `.env.example` and `.gitignore` — before
implementation.

## 2. Phased code generation

The agent implemented in verifiable phases, type-checking and testing at each step:

- **Phase 1 — Foundation:** monorepo scaffold, shared zod schemas/types, DynamoDB
  single-table repository, CDK stack (DynamoDB + GSIs, S3, API Gateway, Lambda, CloudFront),
  report CRUD, and the React/Vite/Tailwind frontend shell.
- **Phase 2 — Multimodal AI:** Rekognition image evidence, Bedrock Nova reasoning via the
  Converse API with zod-validated structured output, evidence fusion, and a heuristic
  fallback so a malformed or unavailable model never crashes the app.
- **Phase 3 — Intelligence:** similarity/duplicate detection, issue clustering, and a
  transparent priority factor model.
- **Phase 4 — Community:** real dashboard aggregation, agent tools, and the data-grounded
  Ask CivicFlow feature.

## 3. AWS integration

- Infrastructure authored as **AWS CDK** (TypeScript) — reproducible, least-privilege IAM,
  CloudFront with Origin Access Control over private S3 buckets.
- Node.js Lambda bundled with esbuild; Python Lambda bundled via the SAM build image.
- The agent iterated on real CDK synth errors (CommonJS vs ESM module resolution, the
  `NodejsFunction` project-root constraint, duplicate construct ids, the deprecated
  `pointInTimeRecovery` property, and the deprecated Node 20 runtime → Node 22).

## 4. AWS Strands Agents integration

When asked to make the Ask feature a real agent, the agent read the Strands SDK
documentation (via the Strands docs tooling), then built a dedicated Python Lambda with
`@tool`-decorated CivicFlow tools over DynamoDB and a `BedrockModel` on Nova. It validated
the agent locally against real Bedrock before wiring it into the API.

## 5. Debugging a real production issue

After deploy, `POST /ask` returned the graceful fallback instead of an answer. The agent:
1. Pulled CloudWatch logs and observed a fast (~266 ms) failure — ruling out a timeout.
2. Reproduced locally and isolated the cause: **Strands streams Nova via a cross-region
   inference profile**, so the bare model id `amazon.nova-lite-v1:0` was rejected; the
   `us.amazon.nova-lite-v1:0` profile id is required.
3. Fixed the model id (with auto-upgrade + override env) and broadened the agent's Bedrock
   IAM to include `InvokeModelWithResponseStream` and cross-region inference-profile ARNs.
4. Verified the fix locally, redeployed, and confirmed the live agent answered correctly
   using two tools with numbers matching the dashboard.

## 6. Testing

The agent wrote and ran unit tests throughout:
- Backend (Vitest): JSON extraction from messy model output, schema validation, duplicate
  detection (the exact three-pothole scenario), priority factors, dashboard aggregation,
  and the empty-data edge case.
- Frontend (Vitest + Testing Library): report form validation and image upload
  type/size validation.

## 7. Deployment & production verification

The agent deployed with CDK, published the frontend to S3 + CloudFront, seeded realistic
demo data by running the full analysis pipeline against the live table, and then verified
the end-to-end checklist against the **public URL** — including confirming that the three
near-duplicate pothole reports clustered into a single community issue with a `reportCount`
of 3 and `CRITICAL` priority.

## Live artifacts
- Site: https://d2ei9x9420h4oc.cloudfront.net
- API: https://zwasktmpei.execute-api.us-east-1.amazonaws.com
- Region: `us-east-1` · Model: Amazon Nova Lite
