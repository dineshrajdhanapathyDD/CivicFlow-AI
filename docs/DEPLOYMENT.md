# CivicFlow AI — Deployment

## Prerequisites
- AWS account with credentials configured (`aws sts get-caller-identity` works).
- Region with Bedrock Nova Lite + Rekognition (default `us-east-1`).
- Node 20+, npm, AWS CDK v2 (`cdk --version`).
- Bedrock model access granted for `amazon.nova-lite-v1:0` (verified via Converse).

## Repository layout
```
/infra          AWS CDK app (TypeScript) — all infrastructure
/backend        Node.js/TypeScript Lambda — API, AI pipeline, clustering, seed
/backend-agent  Python Lambda — AWS Strands Agents SDK (Ask CivicFlow)
/frontend       React + Vite + TS + Tailwind SPA
```

## Current live deployment (us-east-1)
| Output | Value |
|---|---|
| Site (public) | https://d2ei9x9420h4oc.cloudfront.net |
| API | https://zwasktmpei.execute-api.us-east-1.amazonaws.com |
| DistributionId | E27GW360BEW7AT |
| SiteBucket | civicflowstack-sitebucket397a1860-1i1bi41qqdfv |
| ImagesBucket | civicflowstack-imagesbucket1e86afb2-dfnviidpm4tp |
| TableName | civicflow |

## Model configuration note (important)
- The **main API Lambda** uses the Converse API with `BEDROCK_MODEL_ID`
  (default `amazon.nova-lite-v1:0`).
- The **Strands agent Lambda** streams Nova and therefore uses the cross-region
  **inference-profile** id `us.amazon.nova-lite-v1:0` (via `AGENT_MODEL_ID`; a bare
  `amazon.nova-lite-v1:0` is auto-upgraded to the `us.` profile). The agent's IAM allows
  `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` on foundation-model and
  inference-profile ARNs. Prerequisites: Docker (for Python bundling) and Bedrock model
  access for Nova in the deployment account.

## Environment configuration
Copy `.env.example` to `.env` (never commit `.env`). Backend reads config from Lambda
environment variables set by CDK; the values below document them.

```
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
DYNAMODB_TABLE=civicflow
IMAGES_BUCKET=<set by CDK output>
ADMIN_KEY=<set a strong secret; not committed>
```
Frontend build reads:
```
VITE_API_BASE_URL=<CDK output ApiUrl>
```

## Deploy steps
```powershell
# 1. Install
cd infra;    npm install
cd ../backend; npm install
cd ../frontend; npm install

# 2. Bootstrap (first time per account/region)
cd ../infra; npx cdk bootstrap

# 3. Deploy backend + infra
npx cdk deploy --require-approval never
#   note outputs: ApiUrl, ImagesBucket, SiteBucket, SiteUrl, TableName

# 4. Build + upload frontend
cd ../frontend
$env:VITE_API_BASE_URL="<ApiUrl>"; npm run build
aws s3 sync dist/ s3://<SiteBucket> --delete
aws cloudfront create-invalidation --distribution-id <DistId> --paths "/*"

# 5. Seed demo data
cd ../backend; npm run seed   # writes realistic reports incl. a duplicate cluster
```

## Verification checklist (run against the public URL)
- [ ] Frontend URL loads (CloudFront)
- [ ] API reachable
- [ ] Report submission (text only)
- [ ] Image upload (presigned PUT)
- [ ] Rekognition labels returned
- [ ] Bedrock structured analysis returned
- [ ] Issue creation
- [ ] Duplicate detection groups the seeded similar reports
- [ ] Dashboard shows real counts
- [ ] Ask CivicFlow answers from data

## IAM (least privilege, set by CDK)
Lambda execution role: DynamoDB CRUD on the table + indexes, S3 get/put on images bucket,
`bedrock:InvokeModel` on the configured model, `rekognition:DetectLabels`, CloudWatch Logs.
CloudFront uses Origin Access Control to read the private site bucket.

## Teardown
```powershell
cd infra; npx cdk destroy
```
