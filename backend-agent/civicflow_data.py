"""Read-only DynamoDB access for the CivicFlow Strands agent.

Mirrors the single-table design used by the TypeScript backend:
- Report item:  PK = REPORT#<id>, SK = REPORT#<id>
- Issue item:   PK = ISSUE#<id>,  SK = ISSUE#<id>
- Link item:    PK = ISSUE#<id>,  SK = REPORT#<id>
- GSI1: GSI1PK = TYPE#REPORT | TYPE#ISSUE, GSI1SK = createdAt/updatedAt
"""
import os
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key

_REGION = os.environ.get("AWS_REGION", "us-east-1")
_TABLE = os.environ.get("DYNAMODB_TABLE", "civicflow")

_ddb = boto3.resource("dynamodb", region_name=_REGION)
_table = _ddb.Table(_TABLE)

# Internal key attributes stripped before returning domain objects.
_INTERNAL = {"PK", "SK", "GSI1PK", "GSI1SK", "GSI2PK", "GSI2SK", "GSI3PK", "GSI3SK", "entity"}


def _clean(item: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in item.items():
        if k in _INTERNAL:
            continue
        out[k] = float(v) if isinstance(v, Decimal) else v
    return out


def list_reports(limit: int = 500) -> list[dict[str, Any]]:
    res = _table.query(
        IndexName="GSI1",
        KeyConditionExpression=Key("GSI1PK").eq("TYPE#REPORT"),
        ScanIndexForward=False,
        Limit=limit,
    )
    return [_clean(i) for i in res.get("Items", [])]


def list_issues(limit: int = 500) -> list[dict[str, Any]]:
    res = _table.query(
        IndexName="GSI1",
        KeyConditionExpression=Key("GSI1PK").eq("TYPE#ISSUE"),
        ScanIndexForward=False,
        Limit=limit,
    )
    return [_clean(i) for i in res.get("Items", [])]


def get_report_item(report_id: str) -> dict[str, Any] | None:
    res = _table.get_item(Key={"PK": f"REPORT#{report_id}", "SK": f"REPORT#{report_id}"})
    item = res.get("Item")
    return _clean(item) if item else None


def get_issue_item(issue_id: str) -> dict[str, Any] | None:
    res = _table.get_item(Key={"PK": f"ISSUE#{issue_id}", "SK": f"ISSUE#{issue_id}"})
    item = res.get("Item")
    return _clean(item) if item else None


def list_issue_report_ids(issue_id: str) -> list[str]:
    res = _table.query(
        KeyConditionExpression=Key("PK").eq(f"ISSUE#{issue_id}")
        & Key("SK").begins_with("REPORT#"),
    )
    return [i.get("reportId", "") for i in res.get("Items", []) if i.get("reportId")]
