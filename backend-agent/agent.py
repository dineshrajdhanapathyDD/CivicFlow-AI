"""CivicFlow Ask agent built on the AWS Strands Agents SDK.

The agent is given deterministic, read-only tools over CivicFlow's data. The model
decides which tools to call to answer a citizen's question. It must never invent
statistics — every number must come from a tool result.
"""
import os
from collections import Counter
from typing import Any

from strands import Agent, tool
from strands.models import BedrockModel

import civicflow_data as data

# Strands' BedrockModel streams via Converse; Amazon Nova is invoked through a
# cross-region inference profile (us.*), so default to that form. Overridable.
_MODEL_ID = os.environ.get("AGENT_MODEL_ID") or os.environ.get(
    "BEDROCK_MODEL_ID", "us.amazon.nova-lite-v1:0"
)
if _MODEL_ID == "amazon.nova-lite-v1:0":
    _MODEL_ID = "us.amazon.nova-lite-v1:0"
_REGION = os.environ.get("AWS_REGION", "us-east-1")

_PRIORITY_RANK = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}

SYSTEM_PROMPT = """You are CivicFlow's community assistant. You answer questions about \
community infrastructure issues using ONLY data returned by your tools.

Rules:
- ALWAYS call a tool to get facts before answering. Never guess counts or IDs.
- Never invent statistics. Every number you state must come from a tool result.
- Be concise (2-4 sentences), in plain language a citizen understands.
- If the tools do not contain the answer, say so and suggest what would help.
- Do not expose your step-by-step reasoning; give the answer directly."""


# ---------------------------------------------------------------- tools
@tool
def get_dashboard_statistics() -> dict[str, Any]:
    """Return community-wide statistics: total reports, active/resolved/high-priority
    issue counts, category breakdown, issue status distribution, and duplicate cluster
    count. Call this for any "how many" or overview question."""
    reports = data.list_reports()
    issues = data.list_issues()

    active = sum(1 for i in issues if i.get("status") != "RESOLVED")
    resolved = sum(1 for i in issues if i.get("status") == "RESOLVED")
    high = sum(1 for i in issues if i.get("priority") in ("HIGH", "CRITICAL"))

    cat_counts = Counter((r.get("category") or "other") for r in reports)
    total = len(reports) or 1
    category_breakdown = [
        {"category": c, "count": n, "pct": round(n / total * 100)}
        for c, n in cat_counts.most_common()
    ]
    status_dist = Counter(i.get("status") for i in issues)
    duplicate_clusters = sum(1 for i in issues if (i.get("reportCount") or 0) > 1)

    return {
        "totals": {
            "reports": len(reports),
            "activeIssues": active,
            "highPriority": high,
            "resolved": resolved,
        },
        "categoryBreakdown": category_breakdown,
        "statusDistribution": [{"status": s, "count": n} for s, n in status_dist.items()],
        "duplicateClusters": duplicate_clusters,
    }


@tool
def search_reports(keyword: str = "", category: str = "", status: str = "") -> list[dict]:
    """Search citizen reports. Optionally filter by keyword (matches title/text/summary),
    category (road_infrastructure, streetlight, waste, water, drainage, public_property,
    other), or status. Returns up to 15 matching reports with id, title, category,
    status, severity."""
    items = data.list_reports()
    kw = keyword.lower().strip()
    if category:
        items = [r for r in items if r.get("category") == category]
    if status:
        items = [r for r in items if r.get("status") == status]
    if kw:
        items = [
            r
            for r in items
            if kw in f"{r.get('title','')} {r.get('text','')} "
            f"{(r.get('aiAnalysis') or {}).get('summary','')}".lower()
        ]
    return [
        {
            "reportId": r.get("reportId"),
            "title": r.get("title"),
            "category": r.get("category"),
            "status": r.get("status"),
            "severity": r.get("severity"),
        }
        for r in items[:15]
    ]


@tool
def list_top_open_issues(limit: int = 6) -> list[dict]:
    """Return the highest-priority unresolved community issues, ranked by priority.
    Use for questions about the most urgent, highest-priority, or most-reported
    unresolved problems."""
    issues = [i for i in data.list_issues() if i.get("status") != "RESOLVED"]
    issues.sort(key=lambda i: _PRIORITY_RANK.get(i.get("priority", ""), 0), reverse=True)
    return [
        {
            "issueId": i.get("issueId"),
            "summary": i.get("summary"),
            "category": i.get("category"),
            "priority": i.get("priority"),
            "reportCount": i.get("reportCount"),
            "status": i.get("status"),
        }
        for i in issues[:limit]
    ]


@tool
def get_issue(issue_id: str) -> dict | None:
    """Get full details of one community issue by its ID (e.g. CF-ISSUE-042), including
    severity, priority, recommended action, and related report count."""
    return data.get_issue_item(issue_id)


@tool
def get_issue_history(issue_id: str) -> dict | None:
    """Get an issue plus the list of citizen reports that have been clustered into it.
    Use to explain how many reports confirm an issue or what citizens said."""
    issue = data.get_issue_item(issue_id)
    if not issue:
        return None
    report_ids = data.list_issue_report_ids(issue_id)
    reports = [r for rid in report_ids if (r := data.get_report_item(rid))]
    return {"issue": issue, "reports": reports}


_TOOLS = [
    get_dashboard_statistics,
    search_reports,
    list_top_open_issues,
    get_issue,
    get_issue_history,
]
_TOOL_NAMES = [t.__name__ for t in _TOOLS]


def build_agent() -> Agent:
    model = BedrockModel(model_id=_MODEL_ID, region_name=_REGION, temperature=0.1, max_tokens=600)
    return Agent(model=model, tools=_TOOLS, system_prompt=SYSTEM_PROMPT)


def _strip_reasoning(text: str) -> str:
    """Remove any chain-of-thought the model may emit (e.g. <thinking>...</thinking>)."""
    import re

    cleaned = re.sub(r"<thinking>.*?</thinking>", "", text, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r"</?thinking>", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def ask(question: str) -> dict[str, Any]:
    """Run the agent for one question and return {answer, used}."""
    agent = build_agent()
    result = agent(question)
    answer = _strip_reasoning(str(result))

    # Report which tools the agent actually invoked (from the message history).
    used: list[str] = []
    try:
        for msg in agent.messages:
            for block in msg.get("content", []):
                tu = block.get("toolUse") if isinstance(block, dict) else None
                if tu and tu.get("name") in _TOOL_NAMES:
                    used.append(tu["name"])
    except Exception:  # noqa: BLE001 - telemetry only, never fail the request
        pass

    return {"answer": answer, "used": sorted(set(used)) or ["agent"]}
