# Builder Center 
Verified live via AWS (stack CivicFlowStack = UPDATE_COMPLETE):
Node 22 API Lambda + Python 3.12 Strands agent Lambda; DynamoDB = 10 reports, 8 issues,
10 links (the 3-report pothole cluster is why reports > issues).

Live app: https://d2ei9x9420h4oc.cloudfront.net
Live API: https://zwasktmpei.execute-api.us-east-1.amazonaws.com
Repo: https://github.com/dineshrajdhanapathyDD/CivicFlow-AI.git

---

## Title (<= 60 chars)

CivicFlow AI: Citizen Reports Into Community Action  (49)

Alternatives:
- CivicFlow AI - Understand the Problem, Not the Count  (51)
- CivicFlow AI: Multimodal Civic Issue Platform  (44)

## Description (<= 160 chars)

Citizens report problems with text or photos; multimodal AI on AWS fuses the evidence,
groups duplicates into one issue, prioritizes it, and recommends action.  (159)

## Tags

#social-good   #community
(plus optional discovery tags: aws, bedrock, amazon-nova, rekognition, serverless,
cdk, strands-agents, lambda, dynamodb, civic-tech, climate-resilience)

## GitHub repository

https://github.com/dineshrajdhanapathyDD/CivicFlow-AI.git

## Endpoint / live demo

https://d2ei9x9420h4oc.cloudfront.net

---

# Body

## What Your App Does

CivicFlow AI is a community issue-to-action platform. A citizen reports a real-world
problem - a pothole, a dead streetlight, overflowing waste, a water leak, a blocked storm
drain - using **text, a photo, or both**. CivicFlow analyzes the evidence, identifies the
underlying issue, estimates severity and confidence, and recommends a concrete action.

Its core idea: **CivicFlow doesn't count complaints, it understands the problem behind
them.** When three residents report "a pothole near the school" three different ways, most
systems create three tickets. CivicFlow recognizes they describe one physical problem and
groups them into a single community issue with a transparent priority - so staff act on the
real problem instead of drowning in duplicates.

From a user's perspective:
1. **Report** - fill a short form, optionally attach a photo, optionally add a location.
2. **See the analysis** - a report page shows the AI's findings with **observed evidence**
   (what the citizen said + what the image showed) kept separate from **AI interpretation**
   and the **recommended action**, plus a confidence score.
3. **Watch it cluster** - related reports collapse into one community issue; the issue shows
   how many reports confirm it and a plain-English "why this priority" breakdown.
4. **Ask CivicFlow** - a natural-language assistant answers questions ("Which issues are
   highest priority? How many streetlight reports are active?") strictly from live data.
5. **Track to resolution** - staff advance an issue through its lifecycle, and a dashboard
   measures community progress.

**Staff controls (closing the loop).** CivicFlow isn't just analysis - it drives issues to
resolution. On any issue page, authorized staff use the **Staff controls** panel to advance
an issue through its lifecycle: **NEW → AI_ANALYZED → VERIFIED → IN_PROGRESS → RESOLVED**.
Citizens can watch an issue's status; only staff can change it. The action is gated by an
admin key (sent as an `x-admin-key` header and validated server-side; a wrong or missing key
returns 401 and changes nothing) and every change is audited to CloudWatch
(`ISSUE_STATUS_CHANGED`). As issues are resolved, they move out of the active and
high-priority counts on the dashboard, so the community can measure real progress - not just
how many complaints came in. (For the MVP the gate is a shared key; production would put
Amazon Cognito in front of staff actions.)

**Focus (Social Good → Climate resilience):** many of the issues CivicFlow handles -
waterlogging, blocked drains, water-main leaks, monsoon road damage - are climate-stress
problems where fast, prioritized response matters. The **Community** lane fits because it is
built for residents to surface and track the problems that affect their own neighborhood.

## How You Built It

I built CivicFlow with the **Kiro coding agent connected to AWS**, using a spec-driven,
phased process rather than generating everything at once.

- **Spec first.** Before writing code, the agent wrote requirements, a design, a data model,
  API contracts, and an AI-pipeline spec. Crucially, it **verified Amazon Bedrock model
  availability first** (via the Converse API) so the project never hard-coded an
  unavailable model - it chose **Amazon Nova**.
- **Phased delivery.** Foundation (CDK infra + report CRUD) → Multimodal AI (Rekognition +
  Bedrock + evidence fusion) → Intelligence (duplicate detection, clustering, transparent
  priority) → Community (dashboard, lifecycle, Ask) → Production (tests, security,
  deploy, seed, verify). Each phase was type-checked and tested before moving on.
- **Two-language serverless design.** The main API is a Node.js/TypeScript Lambda. The
  **Ask CivicFlow** feature is a separate **Python Lambda built on the AWS Strands Agents
  SDK** - a real tool-using agent that calls read-only data tools before answering, so it
  never invents statistics.
- **Infrastructure as code.** All resources are AWS CDK; the agent iterated through real
  build errors (ESM vs CommonJS resolution, the Lambda bundler's project-root rule,
  duplicate construct ids, a deprecated runtime).

**Biggest challenge - a real production bug.** After deploy, `POST /ask` returned a fallback
message. I pulled CloudWatch logs and saw a fast (~266 ms) failure, which ruled out a
timeout. Reproducing locally revealed the cause: the Strands SDK streams Nova through a
**cross-region inference profile**, so the bare model id `amazon.nova-lite-v1:0` was
rejected - it needs `us.amazon.nova-lite-v1:0`. The fix was to use the inference-profile id
(with an auto-upgrade + override env) and broaden the agent's Bedrock IAM to include
`InvokeModelWithResponseStream` and inference-profile ARNs. Redeploy took 29 seconds and the
agent then answered correctly, citing the exact tools it used.

**Reliability built in.** A report is saved before AI runs, so a report is never lost; if
Bedrock or Rekognition fails, the pipeline degrades gracefully (heuristic analysis,
text-only) instead of crashing; the agent falls back to a friendly message. All of this is
tested.

## AWS Services Used / Architecture Overview

**Services:** Amazon S3, Amazon CloudFront, Amazon API Gateway (HTTP API), AWS Lambda
(Node.js 22 **and** Python 3.12), Amazon DynamoDB, Amazon Bedrock (Amazon Nova),
Amazon Rekognition, Amazon CloudWatch, AWS IAM. Infrastructure as code with **AWS CDK**.
Region: us-east-1.

**Flow:**
```
Citizens -> CloudFront + S3 (React SPA) -> API Gateway
  -> API Lambda (Node 22): reports, analyze, issues, dashboard, presign
       -> DynamoDB (read/write) | S3 images (presigned PUT)
       -> Rekognition (DetectLabels) | Bedrock Nova (Converse, text+image)
  -> Ask Agent Lambda (Python, AWS Strands Agents SDK): POST /ask
       -> DynamoDB (read-only tools) | Bedrock Nova (agent reasoning)
All Lambdas -> CloudWatch logs | secured by least-privilege IAM
```

Rekognition is used only by the API Lambda during analysis; Bedrock Nova is shared (the API
Lambda for multimodal reasoning, the agent for data-grounded Q&A). The evidence pipeline:
text + image evidence -> fusion (Bedrock Nova) -> validated structured output -> duplicate
detection -> issue clustering -> transparent priority -> recommended action -> dashboard.
A full diagram is in the repo (docs/architecture.svg and docs/architecture.drawio).

## Screenshots

The full flow is captured in [`docs/screenshots/`](screenshots/):
- `01-dashboard.png` — live community dashboard
- `02-report-form.png` — multimodal report submission
- `03-issues-list.png` — issues clustered from reports
- `04-issue-detail-cluster.png` — 3-report pothole cluster, CRITICAL priority + factors
- `05-report-detail-ai.png` — AI analysis with evidence separated from interpretation
- `06-ask-civicflow.png` — Strands agent answering from live data, citing its tools

(When publishing on Builder Center, upload these inline in the body and set
`01-dashboard.png` or `cover.png` as the cover image.)

## What You Learned

- **Verify the model before you build.** Checking Bedrock availability up front, and making
  the model id configurable, avoided a whole class of "works on my machine" failures.
- **Agent frameworks have real deployment nuances.** The Strands + Nova inference-profile
  issue was invisible until it ran in Lambda - reading CloudWatch and reproducing locally
  beat guessing. Streaming model calls need both the right model id form and the right IAM
  action (`InvokeModelWithResponseStream`).
- **A tool-using agent is more trustworthy than a prompt.** Giving the agent read-only data
  tools and forbidding invented numbers made Ask CivicFlow's answers match the dashboard
  exactly.
- **Spec-driven + phased with a coding agent scales.** Writing the spec first and verifying
  each phase kept a fairly large multi-service app coherent and shippable.
- **Separate evidence from interpretation.** Designing the AI output to distinguish what was
  observed from what the model concluded makes the product more credible and easier to trust.

## Pricing (cost profile)

CivicFlow is fully serverless and pay-per-use, so idle cost is effectively zero and it fits
comfortably in the AWS Free Tier for a demo:
- **Lambda / API Gateway / DynamoDB (on-demand):** a demo's traffic is well within free-tier
  monthly allowances; you pay only per request/read/write.
- **S3 + CloudFront:** a few MB of static site + images; pennies at demo scale.
- **Amazon Rekognition:** priced per image analyzed (DetectLabels) - only on report
  analysis, not on browsing.
- **Amazon Bedrock (Nova Lite):** priced per input/output token; Nova Lite is a low-cost
  multimodal model, and calls happen only on analyze and on Ask queries.
- **CloudWatch:** minimal structured logs.
There are no always-on servers, NAT gateways, or provisioned databases, so the architecture
has no standing hourly cost. At demo scale the whole stack runs within a few US dollars per
month (effectively near-zero under the AWS Free Tier).

**Reference estimate:** a worked monthly estimate for a light-community-usage scale (~10k
reports/month) is in the AWS Pricing Calculator:
https://calculator.aws/#/estimate?id=95b2eadcf0a23a2362ee408343832e3a5f417bad
(Figures are directional; confirm current rates for your region.)

## Future Work

- **Real authentication** for staff actions via Amazon Cognito (the MVP uses a simple admin
  key, documented as a hardening point).
- **Vector similarity** (Amazon Bedrock embeddings + a vector store) to strengthen duplicate
  detection beyond the current text + location heuristic.
- **Notifications** (Amazon SNS / email) when an issue a citizen reported changes status.
- **Map view** of clustered issues and heat maps of repeated-complaint areas.
- **Department routing** and SLA tracking to close the loop with municipal workflows.
- **Multilingual intake** so citizens can report in their own language.
- **Fast agent routing** with the open-source Strands Decider model (a calibrated "system one" decision model) to triage reports to specialized workflows, deployed as a separate fallback-guarded inference service - evaluated and deferred to protect the serverless ship gate (see `docs/STRANDS_DECIDER_EVALUATION.md`).

## Conclusion

CivicFlow AI shows that a small, serverless, agent-assisted build can deliver a genuinely
useful civic tool: it understands the problem behind the complaints, groups duplicates into
one prioritized issue, recommends action, and measures progress - live on AWS. It was built
end-to-end with a coding agent connected to AWS, from spec to a deployed public URL, and it
is reachable now for judging.

> CivicFlow doesn't count complaints. It understands the problem behind them.
