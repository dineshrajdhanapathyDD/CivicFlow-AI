# CivicFlow AI — Screenshots

Full-functionality screenshots captured from the live app
(https://d2ei9x9420h4oc.cloudfront.net) with Playwright.

| # | File | What it shows |
|---|------|---------------|
| 1 | [01-dashboard.png](01-dashboard.png) | Community dashboard — real totals (reports, active issues, high priority, resolved), top issue categories, and recent reports from live DynamoDB data. |
| 2 | [02-report-form.png](02-report-form.png) | Report submission — text, optional category/location, and image upload (type + 8 MB validation). Supports text-only, image-only, or text + image. |
| 3 | [03-issues-list.png](03-issues-list.png) | Community issues — related reports grouped into single underlying issues, each with severity, category, and related-report count. |
| 4 | [04-issue-detail-cluster.png](04-issue-detail-cluster.png) | Issue detail — the pothole cluster of **3 related reports**, **CRITICAL** priority with a transparent "why this priority" factor breakdown, recommended action, staff lifecycle controls, and member reports. |
| 5 | [05-report-detail-ai.png](05-report-detail-ai.png) | Report detail (primary demo screen) — AI analysis separating **observed evidence** (text + visual) from **interpretation**, a confidence score, the recommended action, and the linked community issue. |
| 6 | [06-ask-civicflow.png](06-ask-civicflow.png) | Ask CivicFlow — the AWS Strands agent answers from live data and cites the tools it used (`list_top_open_issues`); numbers match the dashboard, no invented statistics. |

> These demonstrate the full journey: report → multimodal AI analysis → evidence fusion →
> duplicate detection → issue clustering → transparent priority → recommended action →
> dashboard → data-grounded agent.
