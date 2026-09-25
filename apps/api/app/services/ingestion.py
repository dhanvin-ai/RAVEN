"""
Core ingestion writes: idempotent upserts for conversations, traces,
spans (+ tool/model call details) and events.

All functions are synchronous Session helpers so a background queue worker
can call them unchanged later (Phase 2 keeps processing inline; the queue
is a transport swap, not a rewrite).
"""

import datetime

from sqlalchemy.orm import Session

from app.models.telemetry import (
    Conversation,
    EndUser,
    Environment,
    ModelCall,
    Project,
    Span,
    TelemetryEvent,
    ToolCall,
    Trace,
)
from app.services.pii import redact_value

MAX_JSON_BYTES = 64 * 1024

# Rough per-1k pricing (USD) for cost estimates; unknown models -> None.
_MODEL_PRICES = {
    "gpt-4o": (0.0025, 0.01),
    "gpt-4o-mini": (0.00015, 0.0006),
    "gemini-2.0-flash": (0.0001, 0.0004),
    "gemini-1.5-pro": (0.00125, 0.005),
    "claude-3-5-sonnet": (0.003, 0.015),
}


def estimate_cost(model: str | None, in_tokens: int | None, out_tokens: int | None) -> float | None:
    if not model or in_tokens is None or out_tokens is None:
        return None
    price = _MODEL_PRICES.get(model.lower())
    if not price:
        return None
    return round((in_tokens / 1000) * price[0] + (out_tokens / 1000) * price[1], 6)


def check_json_size(value) -> None:
    """Raise ValueError when a JSON payload exceeds the per-field cap."""
    import json

    if value is None:
        return
    if len(json.dumps(value, default=str).encode("utf-8")) > MAX_JSON_BYTES:
        raise ValueError(f"JSON field exceeds {MAX_JSON_BYTES} byte cap")


def _capture_flags(env: Environment | None) -> tuple[bool, bool]:
    if env is None:
        return True, True
    return bool(env.capture_input), bool(env.capture_output)


def get_or_create_user(db: Session, project: Project, external_id: str | None,
                       metadata: dict | None = None) -> EndUser | None:
    if not external_id:
        return None
    user = (
        db.query(EndUser)
        .filter(EndUser.project_id == project.id, EndUser.external_id == external_id)
        .first()
    )
    if user:
        return user
    user = EndUser(project_id=project.id, external_id=external_id,
                   metadata_json=redact_value(metadata or {}))
    db.add(user)
    db.flush()
    return user


def upsert_conversation(db: Session, project: Project, env: Environment | None, *,
                        external_id: str, user_id: str | None = None,
                        agent_id: int | None = None, agent_version: str | None = None,
                        metadata: dict | None = None,
                        started_at: datetime.datetime | None = None) -> tuple[Conversation, bool]:
    check_json_size(metadata)
    conv = (
        db.query(Conversation)
        .filter(Conversation.project_id == project.id, Conversation.external_id == external_id)
        .first()
    )
    if conv:
        return conv, False
    user = get_or_create_user(db, project, user_id)
    conv = Conversation(
        project_id=project.id,
        environment_id=env.id if env else None,
        external_id=external_id,
        end_user_id=user.id if user else None,
        agent_id=agent_id,
        agent_version=agent_version,
        metadata_json=redact_value(metadata or {}),
        started_at=started_at or datetime.datetime.utcnow(),
    )
    db.add(conv)
    db.flush()
    return conv, True


def _latency(started: datetime.datetime | None, ended: datetime.datetime | None,
             explicit: int | None) -> int | None:
    if explicit is not None:
        return explicit
    if started and ended:
        return max(0, int((ended - started).total_seconds() * 1000))
    return None


def ingest_trace(db: Session, project: Project, env: Environment | None, *,
                 trace_id: str, conversation_ext_id: str | None = None,
                 user_id: str | None = None, agent_id: int | None = None,
                 agent_version: str | None = None, model: str | None = None,
                 provider: str | None = None, status: str = "ok",
                 error_type: str | None = None, error_message: str | None = None,
                 latency_ms: int | None = None,
                 started_at: datetime.datetime | None = None,
                 ended_at: datetime.datetime | None = None,
                 spans: list[dict] | None = None) -> tuple[Trace, bool]:
    existing = (
        db.query(Trace)
        .filter(Trace.project_id == project.id, Trace.trace_id == trace_id)
        .first()
    )
    if existing:
        return existing, False

    conv = None
    if conversation_ext_id:
        conv, _ = upsert_conversation(db, project, env, external_id=conversation_ext_id,
                                      user_id=user_id, agent_id=agent_id,
                                      agent_version=agent_version)
    ci, co = _capture_flags(env)
    trace = Trace(
        project_id=project.id,
        conversation_id=conv.id if conv else None,
        trace_id=trace_id,
        agent_id=agent_id,
        agent_version=agent_version,
        model=model,
        provider=provider,
        status=status,
        error_type=error_type,
        error_message=redact_value(error_message or "", capture_input=ci, capture_output=co)
        if error_message else None,
        latency_ms=_latency(started_at, ended_at, latency_ms),
        started_at=started_at or datetime.datetime.utcnow(),
        ended_at=ended_at,
    )
    db.add(trace)
    db.flush()

    in_total, out_total = 0, 0
    has_tokens = False
    for spec in spans or []:
        span, m_in, m_out = ingest_span(db, project, env, trace, spec)
        if m_in is not None:
            in_total += m_in
            has_tokens = True
        if m_out is not None:
            out_total += m_out
            has_tokens = True
    if has_tokens:
        trace.input_tokens = in_total
        trace.output_tokens = out_total
        trace.cost_usd = estimate_cost(model, in_total, out_total)
    if conv:
        conv.message_count = db.query(Trace).filter(Trace.conversation_id == conv.id).count()
    db.flush()
    return trace, True


def ingest_span(db: Session, project: Project, env: Environment | None,
                trace: Trace, spec: dict) -> tuple[Span, int | None, int | None]:
    """Insert one span (+ tool/model detail). Returns (span, in_tokens, out_tokens)."""
    ci, co = _capture_flags(env)
    check_json_size(spec.get("attributes"))
    check_json_size((spec.get("tool") or {}).get("arguments"))
    check_json_size((spec.get("tool") or {}).get("result"))

    existing = (
        db.query(Span)
        .filter(Span.trace_id == trace.id, Span.span_id == spec["span_id"])
        .first()
    )
    if existing:
        return existing, None, None

    span = Span(
        project_id=project.id,
        trace_id=trace.id,
        span_id=spec["span_id"],
        parent_span_id=spec.get("parent_span_id"),
        kind=spec.get("kind", "custom"),
        name=spec.get("name", "span"),
        status=spec.get("status", "ok"),
        error_type=spec.get("error_type"),
        error_message=spec.get("error_message"),
        latency_ms=_latency(spec.get("started_at"), spec.get("ended_at"), spec.get("latency_ms")),
        attributes_json=redact_value(spec.get("attributes") or {}, capture_input=ci, capture_output=co),
        started_at=spec.get("started_at") or datetime.datetime.utcnow(),
        ended_at=spec.get("ended_at"),
    )
    db.add(span)
    db.flush()

    in_tok = out_tok = None
    tool = spec.get("tool") or {}
    if span.kind == "tool" or tool.get("tool_name"):
        db.add(ToolCall(
            span_id=span.id,
            tool_name=tool.get("tool_name", span.name),
            arguments_json=redact_value(tool.get("arguments") or {}, capture_input=ci, capture_output=co),
            result_json=redact_value(tool.get("result") or {}, capture_input=ci, capture_output=co),
            outcome=tool.get("outcome", "error" if span.status == "error" else "ok"),
            latency_ms=span.latency_ms,
        ))
    model = spec.get("model") or {}
    if span.kind == "llm" or model.get("model"):
        in_tok = model.get("input_tokens")
        out_tok = model.get("output_tokens")
        db.add(ModelCall(
            span_id=span.id,
            provider=model.get("provider") or trace.provider,
            model=model.get("model") or trace.model,
            input_tokens=in_tok,
            output_tokens=out_tok,
            cost_usd=estimate_cost(model.get("model") or trace.model, in_tok, out_tok),
            latency_ms=span.latency_ms,
        ))
    db.flush()
    return span, in_tok, out_tok


def ingest_event(db: Session, project: Project, env: Environment | None, *,
                 event_id: str, kind: str = "custom", name: str = "event",
                 payload: dict | None = None,
                 trace_ext_id: str | None = None,
                 conversation_ext_id: str | None = None,
                 occurred_at: datetime.datetime | None = None) -> tuple[TelemetryEvent, bool]:
    check_json_size(payload)
    existing = (
        db.query(TelemetryEvent)
        .filter(TelemetryEvent.project_id == project.id, TelemetryEvent.event_id == event_id)
        .first()
    )
    if existing:
        return existing, False

    trace = None
    if trace_ext_id:
        trace = (
            db.query(Trace)
            .filter(Trace.project_id == project.id, Trace.trace_id == trace_ext_id)
            .first()
        )
    conv = None
    if conversation_ext_id:
        conv, _ = upsert_conversation(db, project, env, external_id=conversation_ext_id)
    elif trace and trace.conversation_id:
        conv = db.query(Conversation).filter(Conversation.id == trace.conversation_id).first()

    ci, co = _capture_flags(env)
    ev = TelemetryEvent(
        project_id=project.id,
        trace_id=trace.id if trace else None,
        conversation_id=conv.id if conv else None,
        event_id=event_id,
        kind=kind,
        name=name,
        payload_json=redact_value(payload or {}, capture_input=ci, capture_output=co),
        occurred_at=occurred_at or datetime.datetime.utcnow(),
    )
    db.add(ev)
    db.flush()
    return ev, True
