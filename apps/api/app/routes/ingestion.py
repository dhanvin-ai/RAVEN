"""
Phase 2 — Telemetry ingestion API (versioned /v1 surface).

    POST /v1/keys                  provision an API key (bootstrap token)
    POST /v1/conversations         create-or-get a conversation (idempotent)
    GET  /v1/conversations/{id}    retrieve a persisted conversation (exit criterion)
    POST /v1/events                single event (idempotent via event_id)
    POST /v1/events/batch          up to 500 events, per-item results
    POST /v1/traces                trace + nested spans (idempotent via trace_id)
    POST /v1/otel/v1/traces        OpenTelemetry JSON ingestion

Guards on every write path: API-key auth + per-key rate limit, JSON size
caps (413), per-item error isolation in batch/OTel (failures land in the
``ingestion_failures`` dead-letter table, never 500 the whole request).
"""

import datetime
import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.telemetry import (
    Conversation,
    IngestionFailure,
    Project,
    TelemetryEvent,
    Trace,
)
from app.schemas.telemetry import (
    ConversationIn,
    ConversationOut,
    EventBatchIn,
    EventIn,
    EventOut,
    KeyOut,
    KeyProvisionIn,
    SpanOut,
    TraceIn,
    TraceOut,
)
from app.services import ingestion as ing
from app.services.api_keys import AuthContext, create_key, require_api_key
from app.services.otel import map_otel

router = APIRouter(prefix="/v1", tags=["Telemetry Ingestion"])

MAX_BATCH = 500
MAX_BODY_BYTES = 1 * 1024 * 1024


def _body_guard(request: Request) -> None:
    length = request.headers.get("content-length")
    if length and int(length) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Request body exceeds 1 MB cap")


def _dead_letter(db: Session, project_id: int | None, endpoint: str,
                 error: str, payload: Any) -> None:
    try:
        db.add(IngestionFailure(project_id=project_id, endpoint=endpoint,
                                error=error[:2000],
                                payload_json=payload if isinstance(payload, dict) else {"raw": str(payload)[:4000]}))
        db.commit()
    except Exception:
        db.rollback()


# ── Key provisioning ──────────────────────────────────────────

@router.post("/keys", response_model=KeyOut, status_code=201)
def provision_key(payload: KeyProvisionIn, db: Session = Depends(get_db)):
    expected = os.getenv("RAVEN_BOOTSTRAP_TOKEN", "")
    if not expected or payload.bootstrap_token != expected:
        raise HTTPException(status_code=403, detail="Key provisioning is disabled")
    project = db.query(Project).filter(Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    row, plaintext = create_key(db, project_id=project.id,
                                environment_id=payload.environment_id, name=payload.name)
    return KeyOut(id=row.id, project_id=row.project_id, name=row.name,
                  key_prefix=row.key_prefix, plaintext=plaintext)


# ── Conversations ─────────────────────────────────────────────

@router.post("/conversations", status_code=200)
def create_conversation(payload: ConversationIn, request: Request,
                        auth: AuthContext = Depends(require_api_key),
                        db: Session = Depends(get_db)):
    _body_guard(request)
    try:
        conv, created = ing.upsert_conversation(
            db, auth.project, auth.environment, external_id=payload.external_id,
            user_id=payload.user_id, agent_id=payload.agent_id,
            agent_version=payload.agent_version, metadata=payload.metadata,
            started_at=payload.started_at)
        db.commit()
    except ValueError as ve:
        raise HTTPException(status_code=413, detail=str(ve))
    except Exception as exc:
        db.rollback()
        _dead_letter(db, auth.project.id, "/v1/conversations", str(exc), payload.model_dump(mode="json"))
        raise HTTPException(status_code=500, detail="Failed to persist conversation")
    return {"success": True, "created": created, "id": conv.id, "external_id": conv.external_id}


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: int,
                     auth: AuthContext = Depends(require_api_key),
                     db: Session = Depends(get_db)):
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.project_id == auth.project.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    traces = (
        db.query(Trace)
        .filter(Trace.conversation_id == conv.id)
        .order_by(Trace.id)
        .limit(200)
        .all()
    )
    trace_outs = []
    for trace in traces[:200]:
        spans = sorted(trace.spans, key=lambda s: s.id)[:200]
        trace_outs.append(TraceOut(
            id=trace.id, trace_id=trace.trace_id, status=trace.status,
            model=trace.model, provider=trace.provider, latency_ms=trace.latency_ms,
            input_tokens=trace.input_tokens, output_tokens=trace.output_tokens,
            cost_usd=trace.cost_usd,
            spans=[SpanOut(id=s.id, span_id=s.span_id, parent_span_id=s.parent_span_id,
                           kind=s.kind, name=s.name, status=s.status, latency_ms=s.latency_ms,
                           tool_name=s.tool_call.tool_name if s.tool_call else None,
                           model=(s.model_call.model if s.model_call else None)) for s in spans],
        ))
    events = (
        db.query(TelemetryEvent)
        .filter(TelemetryEvent.conversation_id == conv.id)
        .order_by(TelemetryEvent.id)
        .limit(200)
        .all()
    )
    return ConversationOut(
        id=conv.id, external_id=conv.external_id, status=conv.status,
        message_count=conv.message_count, traces=trace_outs,
        events=[EventOut(id=e.id, event_id=e.event_id, kind=e.kind, name=e.name,
                         occurred_at=e.occurred_at) for e in events],
    )


# ── Events ────────────────────────────────────────────────────

def _ingest_one_event(db: Session, auth: AuthContext, payload: EventIn) -> dict:
    try:
        ev, created = ing.ingest_event(
            db, auth.project, auth.environment, event_id=payload.event_id,
            kind=payload.kind, name=payload.name, payload=payload.payload,
            trace_ext_id=payload.trace_id, conversation_ext_id=payload.conversation_id,
            occurred_at=payload.occurred_at)
        db.commit()
        return {"event_id": payload.event_id, "id": ev.id, "deduped": not created, "error": None}
    except ValueError as ve:
        db.rollback()
        return {"event_id": payload.event_id, "id": None, "deduped": False, "error": str(ve)}
    except Exception as exc:
        db.rollback()
        _dead_letter(db, auth.project.id, "/v1/events", str(exc), payload.model_dump(mode="json"))
        return {"event_id": payload.event_id, "id": None, "deduped": False, "error": "processing failed"}


@router.post("/events", status_code=200)
def post_event(payload: EventIn, request: Request,
               auth: AuthContext = Depends(require_api_key),
               db: Session = Depends(get_db)):
    _body_guard(request)
    return {"success": True, "items": [_ingest_one_event(db, auth, payload)]}


@router.post("/events/batch", status_code=200)
def post_event_batch(payload: EventBatchIn, request: Request,
                     auth: AuthContext = Depends(require_api_key),
                     db: Session = Depends(get_db)):
    _body_guard(request)
    if len(payload.events) > MAX_BATCH:
        raise HTTPException(status_code=413, detail=f"Batch exceeds {MAX_BATCH} events")
    items = [_ingest_one_event(db, auth, item) for item in payload.events]
    failed = sum(1 for i in items if i["error"])
    return {"success": failed == 0, "received": len(items), "failed": failed, "items": items}


# ── Traces ────────────────────────────────────────────────────

def _ingest_trace_payload(db: Session, auth: AuthContext, payload: TraceIn) -> dict:
    try:
        spec_spans = []
        for span in payload.spans:
            spec_spans.append({
                "span_id": span.span_id, "parent_span_id": span.parent_span_id,
                "kind": span.kind, "name": span.name, "status": span.status,
                "error_type": span.error_type, "error_message": span.error_message,
                "latency_ms": span.latency_ms, "started_at": span.started_at,
                "ended_at": span.ended_at, "attributes": span.attributes,
                "tool": span.tool.model_dump() if span.tool else {},
                "model": span.model.model_dump() if span.model else {},
            })
        trace, created = ing.ingest_trace(
            db, auth.project, auth.environment, trace_id=payload.trace_id,
            conversation_ext_id=payload.conversation_id, user_id=payload.user_id,
            agent_id=payload.agent_id, agent_version=payload.agent_version,
            model=payload.model, provider=payload.provider, status=payload.status,
            error_type=payload.error_type, error_message=payload.error_message,
            latency_ms=payload.latency_ms, started_at=payload.started_at,
            ended_at=payload.ended_at, spans=spec_spans)
        db.commit()
        return {"trace_id": payload.trace_id, "id": trace.id, "deduped": not created, "error": None}
    except ValueError as ve:
        db.rollback()
        return {"trace_id": payload.trace_id, "id": None, "deduped": False, "error": str(ve)}
    except Exception as exc:
        db.rollback()
        _dead_letter(db, auth.project.id, "/v1/traces", str(exc), {"trace_id": payload.trace_id})
        return {"trace_id": payload.trace_id, "id": None, "deduped": False, "error": "processing failed"}


@router.post("/traces", status_code=200)
def post_trace(payload: TraceIn, request: Request,
               auth: AuthContext = Depends(require_api_key),
               db: Session = Depends(get_db)):
    _body_guard(request)
    result = _ingest_trace_payload(db, auth, payload)
    return {"success": result["error"] is None, **result}


# ── OpenTelemetry ─────────────────────────────────────────────

@router.post("/otel/v1/traces", status_code=200)
async def post_otel_traces(request: Request,
                           auth: AuthContext = Depends(require_api_key),
                           db: Session = Depends(get_db)):
    _body_guard(request)
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    try:
        specs = map_otel(payload if isinstance(payload, dict) else {})
    except Exception as exc:
        _dead_letter(db, auth.project.id, "/v1/otel/v1/traces", f"mapper failed: {exc}", {})
        raise HTTPException(status_code=400, detail="Unrecognized OTel payload")
    results = []
    for spec in specs:
        try:
            trace_in = TraceIn(
                trace_id=spec["trace_id"], conversation_id=spec.get("conversation_id"),
                user_id=spec.get("user_id"), model=spec.get("model"),
                provider=spec.get("provider"), status=spec.get("status", "ok"),
                spans=spec.get("spans", []),
            )
        except Exception as exc:
            _dead_letter(db, auth.project.id, "/v1/otel/v1/traces", str(exc), {"trace_id": spec.get("trace_id")})
            results.append({"trace_id": spec.get("trace_id"), "id": None, "deduped": False, "error": "invalid span data"})
            continue
        results.append(_ingest_trace_payload(db, auth, trace_in))
    failed = sum(1 for r in results if r["error"])
    return {"success": failed == 0, "received": len(results), "failed": failed, "traces": results}


@router.get("/health")
def ingestion_health():
    return {"status": "ok", "service": "telemetry-ingestion",
            "time": datetime.datetime.utcnow().isoformat()}
