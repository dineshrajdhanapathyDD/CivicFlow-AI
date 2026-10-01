# CivicFlow AI — Architecture

> CivicFlow doesn't count complaints. It understands the problem behind them.

## Overview

CivicFlow AI is a serverless, multimodal community issue-to-action platform on AWS.
Citizens submit reports (text, image, or both). An explicit evidence pipeline analyzes
them with Amazon Rekognition (visual evidence) and Amazon Bedrock / Nova Lite (reasoning),
fuses the evidence, detects potential duplicates, clusters related reports into a single
community **Issue**, assigns a transparent priority, and recommends an action. A dashboard
measures community progress.

## High-level diagram

![CivicFlow AI AWS architecture](architecture.svg)

> Editable source: [`architecture.drawio`](architecture.drawio) (open in
> [diagrams.net](https://app.diagrams.net) / draw.io). The ASCII version below is a quick
> text reference.

```
                    React Frontend (Vite + TS + Tailwind)
                              │
                         CloudFront  ──────────────▶  public URL
                              │
                             S3 (static site)
                              │  HTTPS fetch
                        API Gateway (HTTP API)
                              │
                           AWS Lambda (Node 20 / TS)
                              │
        ┌─────────────┬───────┴────────┬───────────────┬──────────────┐
        ▼             ▼                ▼               ▼              ▼
    DynamoDB      S3 (images)     Rekognition       Bedrock       CloudWatch
  (single-table)  (presigned)    (DetectLabels)    (Nova Lite)     (logs)
        │
   Issue / cluster / priority logic (application tools)
```

## Components

- **Frontend** — Static SPA on S3, served via CloudFront over HTTPS. No AWS credentials.
- **API** — API Gateway HTTP API → Lambda. JSON REST, zod-validated.
- **Compute** — AWS Lambda (Node 20, TypeScript, esbuild bundle). One router handler.
- **Data** — DynamoDB single-table (`civicflow`) with GSIs for recency, category, status.
- **Images** — Private S3 bucket; browser uploads via presigned PUT (type + size limited).
- **Vision** — Amazon Rekognition `DetectLabels` → visual evidence.
- **Reasoning** — Amazon Bedrock, model `amazon.nova-lite-v1:0` (multimodal, configurable
  via `BEDROCK_MODEL_ID`). Converse API. Returns validated structured JSON.
- **Ask agent** — a dedicated Python Lambda built on the **AWS Strands Agents SDK** serves
  `POST /ask`. It runs a real tool-using agent loop (Bedrock Nova + read-only CivicFlow
  tools over DynamoDB), so the model retrieves facts before answering and never invents
  statistics. The TypeScript backend keeps a grounded `/ask` fallback.
- **Observability** — CloudWatch structured logs for the documented event set.
- **IAM** — Least-privilege execution role (DynamoDB table CRUD, S3 buckets, Bedrock
  invoke, Rekognition detect, logs).

## Why these choices

- **Serverless** keeps the deployment reproducible, cheap, and judge-friendly.
- **Nova Lite** is multimodal, low-cost, and access-verified in us-east-1; configurable so
  the deployment is never pinned to an unavailable model.
- **Single-table DynamoDB** avoids unnecessary tables while supporting the required access
  patterns (by recency, category, status, and issue membership) through GSIs.
- **Application-level similarity** (text + category + location) avoids standing up a vector
  DB for the MVP while still demonstrating real clustering.

## Data flow: report → action

1. Citizen submits report; if an image is included, the browser gets a presigned PUT URL
   and uploads directly to S3. Report is saved with status `NEW` immediately.
2. `/reports/{id}/analyze` runs the pipeline: Rekognition labels → context gather →
   Bedrock fusion → validated JSON → similarity → cluster → priority → persist.
3. Report becomes `CLUSTERED` and points to an Issue; the Issue carries severity,
   priority, recommended action, and member report count.
4. Dashboard and Ask CivicFlow read real data from DynamoDB.

See `AI_PIPELINE.md` for the reasoning detail and `API.md` for endpoints.
