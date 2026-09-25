"""
Phase 4+5 — Telemetry observe/read API (versioned /v1 surface).

    GET /v1/conversations[?env,agent_id,agent_version,model,provider,tool,
                          status,error,user,q,from,to,limit,offset]
    GET /v1/events[?kind,trace_id,conversation_id,from,to,limit,offset]
    GET /v1/tool-calls[?tool,outcome,from,to,limit,offset]
    GET /v1/analytics/overview[?days,env]      all metrics from REAL rows
    GET /v1/activity[?since_id,limit]          pollable recent timeline
    GET /v1/activity/stream[?since_id]         SSE live tail (key via ?api_key=)

Everything is project-scoped by the API key. No mock calculations:
percentiles/buckets/aggregates are computed from stored telemetry rows.
"""

import asyncio
import datetime
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.telemetry import (
    Conversation,
    EndUser,
    Environment,
    ModelCall,
    ProjectAPIKey,
    Span,
    TelemetryEvent,
    ToolCall,
    Trace,
)
from app.services.api_keys import AuthContext, require_api_key

router = APIRouter(prefix="/v1", tags=["Telemetry Observe"])

DEFAULT_LIMIT = 50
MAX_LIMIT = 200


def _parse_dt(value: str | None) -> datetime.datetime | None:
    if not value:
        return None
    try:
        return datetime.datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid datetime: {value}")


def _resolve_env_id(db: Session, auth: AuthContext, env_name: str | None) -> int | None:
    if not env_name:
        return None
    env = (
        db.query(Environment)
        .filter(Environment.project_id == auth.project.id, Environment.name == env_name)
        .first()
    )
    if not env:
        raise HTTPException(status_code=404, detail=f"Environment not found: {env_name}")
    return env.id


def _pct(sorted_vals: list[float], pct: float) -> float | None:
    if not sorted_vals:
        return None
    if len(sorted_vals) == 1:
        return float(sorted_vals[0])
    rank = (len(sorted_vals) - 1) * (pct / 100)
    low, high = int(rank), min(int(rank) + 1, len(sorted_vals) - 1)
    frac = rank - low
    return float(sorted_vals[low] * (1 - frac) + sorted_vals[high] * frac)


# ── Conversations list ────────────────────────────────────────

@router.get("/conversations")
def list_conversations(
    env: str | None = None,
    agent_id: int | None = None,
    agent_version: str | None = None,
    model: str | None = None,
    provider: str | None = None,
    tool: str | None = None,
    status: str | None = None,
    error: bool | None = None,
    user: str | None = None,
    q: str | None = None,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    limit: int = Query(default=DEFAULT_LIMIT, le=MAX_LIMIT),
    offset: int = 0,
    auth: AuthContext = Depends(require_api_key),
    db: Session = Depends(get_db),
):
    query = db.query(Conversation).filter(Conversation.project_id == auth.project.id)
    env_id = _resolve_env_id(db, auth, env)
    if env_id:
        query = query.filter(Conversation.environment_id == env_id)
    if agent_id is not None:
        query = query.filter(Conversation.agent_id == agent_id)
    if agent_version:
        query = query.filter(Conversation.agent_version == agent_version)
    if status:
        query = query.filter(Conversation.status == status)
    if user:
        query = query.join(EndUser, Conversation.end_user_id == EndUser.id).filter(
            EndUser.external_id == user)
    if q:
        query = query.filter(Conversation.external_id.ilike(f"%{q}%"))
    start = _parse_dt(from_)
    end = _parse_dt(to)
    if start:
        query = query.filter(Conversation.started_at >= start)
    if end:
        query = query.filter(Conversation.started_at <= end)
    if model or provider or tool or error:
        query = query.join(Trace, Trace.conversation_id == Conversation.id)
        if model:
            query = query.filter(Trace.model == model)
        if provider:
            query = query.filter(Trace.provider == provider)
        if error:
            query = query.filter(Trace.status == "error")
        if tool:
            tool_trace_ids = (
                db.query(Span.trace_id)
                .join(ToolCall, ToolCall.span_id == Span.id)
                .filter(Span.project_id == auth.project.id, ToolCall.tool_name == tool)
            )
            query = query.filter(Trace.id.in_(tool_trace_ids))
        query = query.distinct()

    total = query.count()
    rows = (
        query.order_by(desc(Conversation.started_at))
        .offset(offset).limit(limit).all()
    )
    items = []
    for conv in rows:
        n_traces = db.query(func.count(Trace.id)).filter(Trace.conversation_id == conv.id).scalar() or 0
        n_errors = (
            db.query(func.count(Trace.id))
            .filter(Trace.conversation_id == conv.id, Trace.status == "error").scalar() or 0
        )
        user_ext = None
        if conv.end_user_id:
            user_ext = db.query(EndUser.external_id).filter(EndUser.id == conv.end_user_id).scalar()
        items.append({
            "id": conv.id, "external_id": conv.external_id, "status": conv.status,
            "message_count": conv.message_count, "traces": n_traces, "errors": n_errors,
            "user": user_ext, "agent_version": conv.agent_version,
            "started_at": conv.started_at.isoformat() if conv.started_at else None,
        })
    return {"success": True, "total": total, "limit": limit, "offset": offset, "items": items}


# ── Events list ───────────────────────────────────────────────

@router.get("/events")
def list_events(
    kind: str | None = None,
    trace_id: str | None = None,
    conversation_id: int | None = None,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    limit: int = Query(default=DEFAULT_LIMIT, le=MAX_LIMIT),
    offset: int = 0,
    auth: AuthContext = Depends(require_api_key),
    db: Session = Depends(get_db),
):
    query = db.query(TelemetryEvent).filter(TelemetryEvent.project_id == auth.project.id)
    if kind:
        query = query.filter(TelemetryEvent.kind == kind)
    if conversation_id is not None:
        query = query.filter(TelemetryEvent.conversation_id == conversation_id)
    if trace_id:
        trace = (
            db.query(Trace)
            .filter(Trace.project_id == auth.project.id, Trace.trace_id == trace_id)
            .first()
        )
        query = query.filter(TelemetryEvent.trace_id == trace.id) if trace else query.filter(False)
    start = _parse_dt(from_)
    end = _parse_dt(to)
    if start:
        query = query.filter(TelemetryEvent.occurred_at >= start)
    if end:
        query = query.filter(TelemetryEvent.occurred_at <= end)
    total = query.count()
    rows = query.order_by(desc(TelemetryEvent.occurred_at)).offset(offset).limit(limit).all()
    return {"success": True, "total": total, "items": [{
        "id": e.id, "event_id": e.event_id, "kind": e.kind, "name": e.name,
        "trace_id": e.trace_id, "conversation_id": e.conversation_id,
        "payload": e.payload_json or {},
        "occurred_at": e.occurred_at.isoformat() if e.occurred_at else None,
    } for e in rows]}


# ── Tool calls list + summary ─────────────────────────────────

@router.get("/tool-calls")
def list_tool_calls(
    tool: str | None = None,
    outcome: str | None = None,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    limit: int = Query(default=DEFAULT_LIMIT, le=MAX_LIMIT),
    offset: int = 0,
    auth: AuthContext = Depends(require_api_key),
    db: Session = Depends(get_db),
):
    query = (
        db.query(ToolCall, Span, Trace)
        .join(Span, ToolCall.span_id == Span.id)
        .join(Trace, Span.trace_id == Trace.id)
        .filter(Span.project_id == auth.project.id)
    )
    if tool:
        query = query.filter(ToolCall.tool_name == tool)
    if outcome:
        query = query.filter(ToolCall.outcome == outcome)
    start = _parse_dt(from_)
    end = _parse_dt(to)
    if start:
        query = query.filter(Span.started_at >= start)
    if end:
        query = query.filter(Span.started_at <= end)
    total = query.count()
    rows = query.order_by(desc(Span.started_at)).offset(offset).limit(limit).all()

    by_tool: dict[str, dict] = {}
    for tc, _, _ in db.query(ToolCall, Span, Trace).join(
            Span, ToolCall.span_id == Span.id).join(
            Trace, Span.trace_id == Trace.id).filter(Span.project_id == auth.project.id).all():
        agg = by_tool.setdefault(tc.tool_name, {"tool": tc.tool_name, "calls": 0, "errors": 0})
        agg["calls"] += 1
        if tc.outcome == "error":
            agg["errors"] += 1
    for agg in by_tool.values():
        agg["error_rate"] = round(agg["errors"] / agg["calls"], 4) if agg["calls"] else 0

    return {"success": True, "total": total, "summary": sorted(
        by_tool.values(), key=lambda a: a["calls"], reverse=True), "items": [{
            "id": tc.id, "tool": tc.tool_name, "outcome": tc.outcome,
            "latency_ms": tc.latency_ms, "trace_id": tr.trace_id,
            "conversation_id": tr.conversation_id,
            "arguments": tc.arguments_json or {}, "result": tc.result_json or {},
            "started_at": s.started_at.isoformat() if s.started_at else None,
        } for tc, s, tr in rows]}


# ── Analytics overview (Phase 5: computed from real rows) ─────

@router.get("/analytics/overview")
def analytics_overview(
    days: int = Query(default=7, ge=1, le=90),
    env: str | None = None,
    auth: AuthContext = Depends(require_api_key),
    db: Session = Depends(get_db),
):
    since = datetime.datetime.utcnow() - datetime.timedelta(days=days)
    env_id = _resolve_env_id(db, auth, env)

    conv_q = db.query(Conversation).filter(
        Conversation.project_id == auth.project.id, Conversation.started_at >= since)
    if env_id:
        conv_q = conv_q.filter(Conversation.environment_id == env_id)
    conversations = conv_q.all()
    conv_ids = [c.id for c in conversations]

    trace_q = db.query(Trace).filter(
        Trace.project_id == auth.project.id, Trace.started_at >= since,
        Trace.conversation_id.in_(conv_ids) if conv_ids else False)
    traces = trace_q.options(joinedload(Trace.spans)).all()

    event_count = db.query(func.count(TelemetryEvent.id)).filter(
        TelemetryEvent.project_id == auth.project.id, TelemetryEvent.occurred_at >= since).scalar() or 0
    user_count = (
        db.query(func.count(func.distinct(Conversation.end_user_id)))
        .filter(Conversation.project_id == auth.project.id,
                Conversation.started_at >= since,
                Conversation.end_user_id.isnot(None)).scalar() or 0
    )

    latencies = sorted(t.latency_ms for t in traces if t.latency_ms is not None)
    err_traces = [t for t in traces if t.status == "error"]
    in_tok = sum(t.input_tokens or 0 for t in traces)
    out_tok = sum(t.output_tokens or 0 for t in traces)
    cost = round(sum(t.cost_usd or 0 for t in traces), 4)

    # Day buckets (backend-generated, zero-filled).
    buckets: dict[str, dict] = {}
    for i in range(days):
        day = (datetime.datetime.utcnow() - datetime.timedelta(days=days - 1 - i)).date().isoformat()
        buckets[day] = {"day": day, "conversations": 0, "traces": 0, "errors": 0, "latencies": []}
    for c in conversations:
        key = c.started_at.date().isoformat() if c.started_at else None
        if key in buckets:
            buckets[key]["conversations"] += 1
    for t in traces:
        key = t.started_at.date().isoformat() if t.started_at else None
        if key in buckets:
            buckets[key]["traces"] += 1
            if t.status == "error":
                buckets[key]["errors"] += 1
            if t.latency_ms is not None:
                buckets[key]["latencies"].append(t.latency_ms)
    timeseries = [{
        "day": b["day"], "conversations": b["conversations"], "traces": b["traces"],
        "errors": b["errors"],
        "p95_latency_ms": _pct(sorted(b["latencies"]), 95),
    } for b in buckets.values()]

    tools: dict[str, dict] = {}
    models: dict[str, dict] = {}
    versions: dict[str, dict] = {}
    err_types: dict[str, dict] = {}
    for t in traces:
        vkey = t.agent_version or "unknown"
        v = versions.setdefault(vkey, {"version": vkey, "traces": 0, "errors": 0})
        v["traces"] += 1
        if t.status == "error":
            v["errors"] += 1
        mkey = f"{t.provider or 'unknown'}/{t.model or 'unknown'}"
        m = models.setdefault(mkey, {"model": t.model, "provider": t.provider,
                                     "traces": 0, "errors": 0, "tokens": 0, "cost_usd": 0.0,
                                     "latencies": []})
        m["traces"] += 1
        m["tokens"] += (t.input_tokens or 0) + (t.output_tokens or 0)
        m["cost_usd"] = round(m["cost_usd"] + (t.cost_usd or 0), 4)
        if t.status == "error":
            m["errors"] += 1
            ek = t.error_type or "unknown"
            e = err_types.setdefault(ek, {"error_type": ek, "count": 0,
                                          "sample": t.error_message})
            e["count"] += 1
        if t.latency_ms is not None:
            m["latencies"].append(t.latency_ms)
        for s in t.spans or []:
            if s.tool_call:
                tk = s.tool_call.tool_name
                agg = tools.setdefault(tk, {"tool": tk, "calls": 0, "errors": 0})
                agg["calls"] += 1
                if s.tool_call.outcome == "error":
                    agg["errors"] += 1
    for agg in tools.values():
        agg["error_rate"] = round(agg["errors"] / agg["calls"], 4) if agg["calls"] else 0
    for m in models.values():
        m["avg_latency_ms"] = round(sum(m.pop("latencies")) / m["traces"], 1) if m["traces"] else None
    for v in versions.values():
        v["error_rate"] = round(v["errors"] / v["traces"], 4) if v["traces"] else 0

    return {
        "success": True, "days": days,
        "totals": {
            "conversations": len(conversations), "traces": len(traces),
            "events": event_count, "users": user_count,
            "error_traces": len(err_traces),
            "error_rate": round(len(err_traces) / len(traces), 4) if traces else 0,
        },
        "latency_ms": {
            "p50": _pct(latencies, 50), "p95": _pct(latencies, 95),
            "p99": _pct(latencies, 99),
            "avg": round(sum(latencies) / len(latencies), 1) if latencies else None,
        },
        "tokens": {"input": in_tok, "output": out_tok, "total": in_tok + out_tok},
        "cost_usd": cost,
        "timeseries": timeseries,
        "tools": sorted(tools.values(), key=lambda a: a["calls"], reverse=True)[:20],
        "models": sorted(models.values(), key=lambda a: a["traces"], reverse=True),
        "versions": sorted(versions.values(), key=lambda a: a["traces"], reverse=True),
        "top_errors": sorted(err_types.values(), key=lambda a: a["count"], reverse=True)[:10],
    }


# ── Activity: pollable timeline + SSE live tail ────────────────

def _activity_items(db: Session, project_id: int, since_id: int, limit: int) -> list[dict]:
    traces = (
        db.query(Trace)
        .filter(Trace.project_id == project_id, Trace.id > since_id)
        .order_by(Trace.id).limit(limit).all()
    )
    events = (
        db.query(TelemetryEvent)
        .filter(TelemetryEvent.project_id == project_id, TelemetryEvent.id > since_id)
        .order_by(TelemetryEvent.id).limit(limit).all()
    )
    items = [{
        "kind": "trace", "id": t.id, "trace_id": t.trace_id, "status": t.status,
        "model": t.model, "conversation_id": t.conversation_id,
        "at": t.created_at.isoformat() if t.created_at else None,
    } for t in traces] + [{
        "kind": "event", "id": e.id, "event_id": e.event_id, "name": e.name,
        "trace_id": e.trace_id, "conversation_id": e.conversation_id,
        "at": e.created_at.isoformat() if e.created_at else None,
    } for e in events]
    items.sort(key=lambda i: (i["at"] or "", i["kind"], i["id"]))
    return items[:limit]


@router.get("/activity")
def activity(since_id: int = 0, limit: int = Query(default=50, le=200),
             auth: AuthContext = Depends(require_api_key),
             db: Session = Depends(get_db)):
    items = _activity_items(db, auth.project.id, since_id, limit)
    max_id = max([i["id"] for i in items], default=since_id)
    return {"success": True, "items": items, "max_id": max_id}


@router.get("/activity/stream")
async def activity_stream(since_id: int = 0, api_key: str | None = None,
                          db: Session = Depends(get_db)):
    """SSE live tail. EventSource cannot set headers, so the key rides ?api_key=."""
    from app.services.api_keys import _lookup

    row = _lookup(db, api_key or "")
    if not row or row.revoked:
        raise HTTPException(status_code=401, detail="Missing or invalid API key")
    key_row = db.query(ProjectAPIKey).filter(ProjectAPIKey.id == row.id).first()
    project_id = key_row.project_id if key_row else row.project_id

    async def gen():
        cursor = since_id
        for _ in range(30):  # ~60s bounded tail, then reconnect
            items = _activity_items(db, project_id, cursor, 50)
            for item in items:
                cursor = max(cursor, item["id"])
                yield f"data: {json.dumps(item)}\n\n"
            yield ": heartbeat\n\n"
            await asyncio.sleep(2)
    return StreamingResponse(gen(), media_type="text/event-stream")
