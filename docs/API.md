# CivicFlow AI — API

Base URL: the API Gateway HTTP API invoke URL (CDK output `ApiUrl`).
All responses: `{ "ok": boolean, "data"?: <payload>, "error"?: string }`.
All bodies are JSON. Input is validated with zod; validation failures return `400`.
Admin endpoints require header `x-admin-key: <secret>`.

## POST /reports
Create a report. If `hasImage` is true, the response includes a presigned S3 PUT URL that
the client uses to upload the image before calling `/analyze`.

Request:
```json
{
  "title": "Streetlight out near school",
  "text": "The streetlight near the school has not worked for three nights.",
  "category": "streetlight",          // optional; AI can infer
  "location": { "label": "5th Ave near Lincoln School", "lat": 40.71, "lng": -74.0 },
  "hasImage": true,
  "imageContentType": "image/jpeg"    // required when hasImage
}
```
Response `201`:
```json
{ "ok": true, "data": {
  "reportId": "CF-1024",
  "status": "NEW",
  "upload": { "url": "https://...s3...", "key": "reports/CF-1024/photo.jpg" }
}}
```

## POST /uploads/presign
(Used internally by create; also standalone.) Returns a presigned PUT URL for an allowed
content type. Types: `image/jpeg|png|webp`. Client enforces max 8 MB.

## GET /reports
Query params: `status`, `category`, `limit` (default 20). Returns recent reports.
```json
{ "ok": true, "data": { "items": [ { "reportId": "...", "title": "...", "status": "...", "severity": "...", "category": "...", "createdAt": "..." } ] } }
```

## GET /reports/{id}
Returns the full report incl. `aiAnalysis`, `rekognition`, `priorityFactors`, `issueId`.

## POST /reports/{id}/analyze
Runs (or re-runs) the evidence pipeline. Idempotent. Returns the analyzed report and the
resulting issue reference.
```json
{ "ok": true, "data": {
  "report": { "reportId": "CF-1024", "status": "CLUSTERED", "severity": "HIGH", "confidence": 0.94, "issueId": "CF-ISSUE-042", "aiAnalysis": { "...": "..." } },
  "issue":  { "issueId": "CF-ISSUE-042", "reportCount": 4, "priority": "HIGH", "recommendedAction": "Inspect and repair streetlight" },
  "similar": [ { "reportId": "CF-1019", "score": 0.72 } ]
}}
```

## GET /issues
Query: `status`, `category`, `priority`, `limit`. Returns issues sorted by recency.

## GET /issues/{id}
Returns the issue plus member reports.
```json
{ "ok": true, "data": { "issue": { "...": "..." }, "reports": [ { "...": "..." } ] } }
```

## PATCH /issues/{id}/status  (admin)
```json
{ "status": "IN_PROGRESS" }   // NEW|AI_ANALYZED|VERIFIED|IN_PROGRESS|RESOLVED
```
Validates the transition; updates `updatedAt`; logs `ISSUE_STATUS_CHANGED`.

## GET /dashboard/stats
```json
{ "ok": true, "data": {
  "totals": { "reports": 128, "activeIssues": 47, "highPriority": 12, "resolved": 81 },
  "categoryBreakdown": [ { "category": "streetlight", "pct": 31 } ],
  "statusDistribution": [ { "status": "IN_PROGRESS", "count": 20 } ],
  "duplicateClusters": 9,
  "recentReports": [ { "reportId": "...", "title": "...", "createdAt": "..." } ]
}}
```

## POST /ask
Ask CivicFlow. The agent retrieves data via tools first, then Bedrock summarizes. Never
invents statistics.
```json
{ "question": "What are the most common unresolved problems?" }
```
Response:
```json
{ "ok": true, "data": { "answer": "...", "used": ["get_dashboard_statistics", "search_reports"] } }
```

## Error handling
- `400` validation error (safe message). `401` missing/invalid admin key. `404` not found.
- `502` upstream AI/vision failure — report is still saved; message is friendly and never
  leaks internal AWS errors.
