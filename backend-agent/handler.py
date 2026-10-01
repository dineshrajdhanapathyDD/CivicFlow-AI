"""Lambda handler for POST /ask backed by the Strands agent.

Returns the standard CivicFlow envelope { ok, data?, error? }. Never leaks internal
errors to the client. If the agent fails, returns a friendly message so the UI stays
usable (the TypeScript backend also keeps a grounded fallback).
"""
import json
import logging

import agent as civic_agent

logger = logging.getLogger()
logger.setLevel(logging.INFO)

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,x-admin-key",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
}


def _resp(status: int, body: dict) -> dict:
    return {"statusCode": status, "headers": CORS, "body": json.dumps(body)}


def handler(event, _context):
    method = (event.get("requestContext", {}).get("http", {}) or {}).get("method", "POST")
    if method == "OPTIONS":
        return _resp(204, {"ok": True})

    try:
        raw = event.get("body") or "{}"
        payload = json.loads(raw)
        question = (payload.get("question") or "").strip()
        if len(question) < 3:
            return _resp(400, {"ok": False, "error": "Please ask a longer question."})

        logger.info(json.dumps({"event": "ASK_QUERY", "len": len(question)}))
        result = civic_agent.ask(question)
        logger.info(json.dumps({"event": "ASK_COMPLETED", "used": result.get("used")}))
        return _resp(200, {"ok": True, "data": result})

    except json.JSONDecodeError:
        return _resp(400, {"ok": False, "error": "Invalid request body."})
    except Exception as exc:  # noqa: BLE001
        logger.exception("ASK_FAILED")
        logger.info(json.dumps({"event": "ASK_FAILED", "message": str(exc)[:200]}))
        return _resp(
            200,
            {
                "ok": True,
                "data": {
                    "answer": "The assistant is temporarily unavailable. Please try again shortly.",
                    "used": [],
                },
            },
        )
