# CivicFlow AI — Demo Script

**Live app:** https://d2ei9x9420h4oc.cloudfront.net
**Core statement:** CivicFlow doesn't count complaints. It understands the problem behind them.

The deployed app is pre-seeded with realistic Bengaluru demo data, including three
near-duplicate pothole reports that demonstrate clustering.

## The story (≈3 minutes)

```
A citizen sees a problem.
      ↓ submits text + photo
CivicFlow analyzes both (Rekognition + Bedrock Nova).
      ↓ separates observed evidence from AI interpretation
The system checks similar reports.
      ↓ semantic + location similarity
Multiple reports become ONE underlying issue.
      ↓ transparent priority
CivicFlow prioritizes and recommends an action.
      ↓
The community dashboard measures progress.
```

## Walkthrough

### 1. Dashboard (home)
Open the live app. Point out the real numbers: total reports, active issues, high priority,
and **duplicate clusters**. Note the category breakdown (Road, Streetlight, Waste, …) — all
from live DynamoDB data.

### 2. Submit a report (the multimodal moment)
Go to **Report an issue**. Submit:
- Text: *"Large pothole right outside the government school gate on 100 Feet Road,
  Indiranagar. Autos swerve around it."*
- Optionally attach a photo of a pothole.

Submit. CivicFlow saves the report immediately (never lost) and runs the pipeline.

### 3. Report details (the primary demo screen)
On the report page, show the AI analysis card:
- **Issue** and **Category** (identified by the AI)
- **Severity** and a **Confidence** bar
- **Text evidence** vs **Visual evidence** (observed, separated from interpretation)
- **AI interpretation** (a concise one-line summary — no exposed chain-of-thought)
- **Recommended action** (concrete and practical)
- A link to the **Community issue** it was clustered into

### 4. The clustering payoff
Open **Issues** and find the Indiranagar pothole issue. It shows **3 related reports**
grouped into one issue, priority **CRITICAL**, with a transparent **"Why this priority"**
breakdown ("HIGH severity", "3 related reports", "Recently reported", "Public
infrastructure"). This is the heart of the product: three complaints, one understood problem.

### 5. Ask CivicFlow (the agent)
Go to **Ask** and try:
- *"Which issues have the highest priority?"*
- *"How many streetlight reports are active?"*
- *"What areas have repeated complaints?"*

The answer footer shows the tools the agent actually called (e.g.
`get_dashboard_statistics`, `list_top_open_issues`). The numbers always match the dashboard —
the agent retrieves real data and never invents statistics.

### 6. Staff lifecycle (closing the loop)
Open a high-priority issue (e.g. the Indiranagar pothole cluster). Scroll to **Staff
controls**:
1. Enter the **admin key** in the "Admin key" field (it's saved for the session).
2. Set **Status** to `IN_PROGRESS` (or `VERIFIED`, then `RESOLVED` to show the full path).
3. Click **Update status** — the status badge flips and you'll see "Status updated."

Then open the **Dashboard**: the status distribution reflects the change, and a `RESOLVED`
issue moves out of the active/high-priority counts. Talking point: the change is **audited**
(CloudWatch `ISSUE_STATUS_CHANGED`) and gated by the admin key — citizens can watch status,
staff drive it. This is CivicFlow closing the loop from report to resolution, not just
analyzing.

> The admin key is the `ADMIN_KEY` set at deploy time (`-c adminKey=<secret>`). A wrong key
> returns 401 and changes nothing — safe to demo live.

## Resilience talking points
- A report is saved before AI runs, so no citizen report is ever lost.
- If Bedrock or Rekognition fails, CivicFlow degrades gracefully (heuristic analysis,
  text-only) and marks the result rather than crashing.
- The Ask agent falls back to a friendly message if the model is unavailable.

## Verified end-to-end (against the public URL)
Frontend · API · report submission · image upload · Rekognition · Bedrock · issue creation ·
duplicate detection · dashboard · Ask CivicFlow — all confirmed working on the live stack.
