# CivicFlow AI — Builder Center Submission

Copy-paste source for the AWS Builder Center project. Fill the live URL and screenshots
where noted, then publish before the deadline (Oct 2, 2026, 11:59 p.m. PT).

---

## Tags (required — add both on Builder Center)

- **App category:** `#social-good`
- **Lane:** `#community`

> Social Good focus area: **Climate resilience** — CivicFlow helps a community report and
> act on climate-stressed public infrastructure (waterlogging, blocked storm drains, water
> leaks, road damage after monsoon rains), which maps to the "adapting to and withstanding
> climate-related challenges" focus. It also carries Health-adjacent impact (unsafe dark
> streets, overflowing waste). This may qualify the project to apply for AWS Social Impact
> Credits.

## One-line pitch

CivicFlow AI turns scattered citizen complaints into understood, prioritized community
issues with a recommended action — so the real problem gets fixed, not just counted.

> **CivicFlow doesn't count complaints. It understands the problem behind them.**

## Live application (ship gate)

- **Live app (public URL):** https://d2ei9x9420h4oc.cloudfront.net
- **Live API:** https://zwasktmpei.execute-api.us-east-1.amazonaws.com
- Reachable by judges and the AI scoring system over public HTTPS. No login required to
  browse the dashboard, submit a report, view issues, or use Ask CivicFlow.
- Pre-seeded with realistic demo data (Bengaluru, India) including a 3-report pothole
  cluster that demonstrates duplicate detection.

## The problem

Communities drown in duplicate complaints about the same physical problem. Three people
report "a pothole near the school" three different ways and the signal is lost. Staff see
ticket volume, not the underlying issues. Climate stress (monsoon flooding, waterlogging,
drainage failure) makes timely, prioritized response matter even more.

## What CivicFlow does

Citizen evidence → multimodal AI analysis → evidence fusion → duplicate detection → issue
clustering → transparent prioritization → recommended action → measurable dashboard.

- **Multimodal reporting:** text, image, or both.
- **Evidence analysis:** Amazon Rekognition extracts visual evidence; Amazon Bedrock
  (Amazon Nova) reasons over text + image + nearby reports and returns a structured
  assessment that separates **observed evidence**, **AI interpretation**, and **recommended
  action** (no exposed chain-of-thought).
- **Duplicate detection & clustering:** related reports are grouped into one community
  issue (semantic text overlap + category + location proximity).
- **Transparent priority:** a deterministic, explainable factor model (severity, related
  report count, recency, public-infrastructure, unresolved) — not an opaque LLM guess.
- **Ask CivicFlow:** a real tool-using agent on the **AWS Strands Agents SDK** that
  retrieves live data via tools before answering — never invents statistics.
- **Community dashboard & lifecycle:** real totals, category breakdown, duplicate clusters;
  staff advance issues NEW → VERIFIED → IN_PROGRESS → RESOLVED.

## Why it fits #social-good / #community

- **Community lane:** built for a local civic community — residents report neighborhood
  problems, and the platform helps the group surface and track the issues that affect them.
- **Social good:** measurable improvement in how an underserved civic process works, with a
  climate-resilience focus (flooding/drainage/water) and public-safety spillover.
- **Measurable:** the dashboard quantifies reports, active issues, high-priority issues,
  resolved issues, and duplicate clusters from real data.

## How the coding agent helped (required)

Built with the **Kiro coding agent connected to AWS**, using a spec-driven, phased workflow.
Full detail in [`CODING_AGENT_EVIDENCE.md`](CODING_AGENT_EVIDENCE.md). Highlights:

- Verified Bedrock model availability before coding (avoided hard-coding an unavailable
  model); chose and confirmed **Amazon Nova** via the Converse API.
- Generated the spec/architecture, then implemented in verifiable phases
  (foundation → multimodal AI → intelligence → community → production).
- Authored all infrastructure as **AWS CDK**; iterated on real synth/deploy errors.
- Integrated the **AWS Strands Agents SDK** for the Ask feature.
- Diagnosed and fixed a real production bug from CloudWatch logs: Strands streams Nova via a
  cross-region inference profile, so the agent needed `us.amazon.nova-lite-v1:0` and
  broadened Bedrock IAM.
- Deployed, seeded, and verified the full flow against the public URL.

**Proof of coding-agent → AWS connection:** the agent authenticated to the account
(`aws sts get-caller-identity`), queried Bedrock, deployed via CDK, published the frontend
to S3 + CloudFront, and read CloudWatch logs — all from the agent session. (Attach a
screenshot of the agent session running an AWS command / the successful `cdk deploy`
outputs.)

## AWS services used

Amazon S3, Amazon CloudFront, Amazon API Gateway, AWS Lambda (Node.js **and** Python),
Amazon DynamoDB, Amazon Bedrock (Amazon Nova), Amazon Rekognition, Amazon CloudWatch,
AWS IAM. Infrastructure as code via AWS CDK. Region: us-east-1.

## Architecture

See [`ARCHITECTURE.md`](ARCHITECTURE.md) and the diagram
([`architecture.svg`](architecture.svg) / editable [`architecture.drawio`](architecture.drawio)).

```
Citizens → CloudFront + S3 (site) → API Gateway
   → API Lambda (Node 22): reports · analyze · issues · dashboard · presign
   → Ask Agent Lambda (Python, AWS Strands): POST /ask
API Lambda → DynamoDB · S3 images · Rekognition · Bedrock Nova
Agent Lambda → DynamoDB (read tools) · Bedrock Nova
All → CloudWatch · secured by IAM (least privilege)
```

## Originality

CivicFlow is an original application created for this hackathon and not previously
published. The issue-centric model (understanding the problem behind the complaints), the
explicit evidence-fusion pipeline, and the Strands tool-using Ask agent are purpose-built.

## Demo

Full script in [`DEMO.md`](DEMO.md). ~3-minute flow: submit a report → see multimodal AI
analysis with separated evidence → watch related reports become one prioritized issue →
ask the agent a question answered from live data → advance the issue through its lifecycle →
see the dashboard update.

## Repository

Monorepo: `/infra` (CDK), `/backend` (Node API + pipeline), `/backend-agent` (Python Strands
agent), `/frontend` (React/Vite/TS/Tailwind), `/docs`, `/.kiro/specs`.

## Submission checklist (map to the rules)

- [x] Coding agent connected to AWS console — documented (CODING_AGENT_EVIDENCE.md + screenshot)
- [x] Live application on AWS, public URL — https://d2ei9x9420h4oc.cloudfront.net
- [x] One of five app categories — Social Good (`#social-good`)
- [x] A lane — Community (`#community`)
- [x] Original, not previously published
- [x] Project describes app, development process, and coding-agent usage
- [x] AWS services and coding agent documented
- [ ] Builder Center project published with both tags before the deadline
- [ ] Proof-of-connection screenshot attached
- [ ] Live URL confirmed reachable at submission time (ship gate)
