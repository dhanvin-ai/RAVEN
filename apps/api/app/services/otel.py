"""
Minimal OpenTelemetry trace mapper (Phase 2).

Accepts OTel JSON (``{"resourceSpans": [...]}``) and returns normalized
ingestion specs. Tolerant by design: unknown shapes are skipped, never
fatal — per-span failures land in the dead-letter table via the route.

Recognized conventions:
- Session grouping: ``session.id`` or ``raven.conversation_id`` attribute.
- User: ``user.id`` / ``enduser.id``.
- LLM: ``llm.system``/``llm.provider``, ``llm.model_name``/``llm.request.model``,
  ``llm.usage.prompt_tokens`` / ``input_tokens``,
  ``llm.usage.completion_tokens`` / ``output_tokens``.
- Tool: ``tool.name``, ``tool.arguments``/``tool.parameters``,
  ``tool.result``/``tool.response``.
- Errors: span ``status.code`` != OK/UNSET, or ``events`` entries named
  ``exception`` with ``exception.type`` / ``exception.message``.
- Times: ``startTimeUnixNano`` / ``endTimeUnixNano`` (also camelCase-less
  and epoch-seconds fallbacks).
"""

import datetime
from typing import Any


def _attrs(span: dict) -> dict[str, Any]:
    """OTel attributes may be a dict or a [{key, value:{...}}] list."""
    raw = span.get("attributes", {}) or {}
    if isinstance(raw, dict):
        return raw
    out: dict[str, Any] = {}
    for item in raw:
        key = item.get("key")
        val = item.get("value", {})
        if isinstance(val, dict):
            for field in ("stringValue", "boolValue", "intValue", "doubleValue"):
                if field in val:
                    out[key] = val[field]
                    break
            else:
                out[key] = val.get("arrayValue", val)
        else:
            out[key] = val
    return out


def _get(attrs: dict, *names: str, default=None):
    for name in names:
        if name in attrs and attrs[name] is not None:
            return attrs[name]
    return default


def _to_dt(value) -> datetime.datetime | None:
    if value is None:
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    # Nanoseconds (>1e15), microseconds, milliseconds, seconds.
    if num > 1e15:
        num /= 1e9
    elif num > 1e12:
        num /= 1e6
    elif num > 1e9:
        num /= 1e3
    return datetime.datetime.fromtimestamp(num, tz=datetime.timezone.utc)


def _span_time(span: dict, *names: str):
    for name in names:
        if name in span:
            dt = _to_dt(span[name])
            if dt:
                return dt.replace(tzinfo=None)
    return None


def _error_from_span(span: dict, attrs: dict) -> tuple[str, str | None, str | None]:
    status = "ok"
    err_type = _get(attrs, "error.type", "exception.type")
    err_msg = _get(attrs, "error.message", "exception.message")
    code = (span.get("status") or {}).get("code") if isinstance(span.get("status"), dict) else span.get("statusCode")
    if isinstance(code, str) and code.upper() not in ("OK", "UNSET", "STATUS_CODE_OK", "STATUS_CODE_UNSET", ""):
        status = "error"
    for ev in span.get("events") or []:
        if (ev.get("name") or "").lower() == "exception":
            status = "error"
            ev_attrs = ev.get("attributes", {}) or {}
            if isinstance(ev_attrs, dict):
                err_type = err_type or ev_attrs.get("exception.type")
                err_msg = err_msg or ev_attrs.get("exception.message")
    return status, err_type, err_msg


def map_otel(payload: dict) -> list[dict]:
    """Map an OTel ``resourceSpans`` payload to trace ingestion specs."""
    by_trace: dict[str, dict] = {}
    resources = payload.get("resourceSpans") or payload.get("resource_spans") or []
    for resource in resources:
        scopes = resource.get("scopeSpans") or resource.get("scope_spans") or []
        for scope in scopes:
            for span in scope.get("spans") or []:
                trace_hex = span.get("traceId") or span.get("trace_id") or ""
                span_hex = span.get("spanId") or span.get("span_id") or ""
                if not trace_hex or not span_hex:
                    continue
                attrs = _attrs(span)
                status, err_type, err_msg = _error_from_span(span, attrs)

                conv_id = _get(attrs, "session.id", "raven.conversation_id",
                               "conversation.id", "session_id")
                user_id = _get(attrs, "user.id", "enduser.id", "user_id")
                model = _get(attrs, "llm.model_name", "llm.request.model", "gen_ai.request.model",
                             "model", "llm.model")
                provider = _get(attrs, "llm.system", "llm.provider", "gen_ai.system", "provider")
                in_tok = _get(attrs, "llm.usage.prompt_tokens", "llm.usage.input_tokens",
                              "gen_ai.usage.input_tokens", "input_tokens")
                out_tok = _get(attrs, "llm.usage.completion_tokens", "llm.usage.output_tokens",
                               "gen_ai.usage.output_tokens", "output_tokens")

                kind = "custom"
                name = span.get("name", "span")
                tool_name = _get(attrs, "tool.name", "mcp.tool.name", "gen_ai.tool.name")
                if tool_name or "tool" in name.lower():
                    kind = "tool"
                elif model or _get(attrs, "llm.request.type", "gen_ai.operation.name") or "llm" in name.lower():
                    kind = "llm"
                elif (span.get("kind") or "") in ("SPAN_KIND_CLIENT", "SPAN_KIND_SERVER", 2, 3):
                    kind = "http"

                parent = span.get("parentSpanId") or span.get("parent_span_id") or None
                started = _span_time(span, "startTimeUnixNano", "start_time_unix_nano", "startTime")
                ended = _span_time(span, "endTimeUnixNano", "end_time_unix_nano", "endTime")

                spec = by_trace.setdefault(trace_hex, {
                    "trace_id": trace_hex,
                    "conversation_id": conv_id,
                    "user_id": user_id,
                    "model": model,
                    "provider": provider,
                    "status": "ok",
                    "spans": [],
                })
                if user_id and not spec["user_id"]:
                    spec["user_id"] = user_id
                if conv_id and not spec["conversation_id"]:
                    spec["conversation_id"] = conv_id
                if model and not spec["model"]:
                    spec["model"] = model
                if provider and not spec["provider"]:
                    spec["provider"] = provider
                if status == "error":
                    spec["status"] = "error"

                span_spec: dict[str, Any] = {
                    "span_id": span_hex,
                    "parent_span_id": parent,
                    "kind": kind,
                    "name": name,
                    "status": status,
                    "error_type": err_type,
                    "error_message": err_msg,
                    "started_at": started,
                    "ended_at": ended,
                    "attributes": {k: v for k, v in attrs.items()},
                }
                if kind == "tool":
                    span_spec["tool"] = {
                        "tool_name": tool_name or name,
                        "arguments": _get(attrs, "tool.arguments", "tool.parameters",
                                          "mcp.tool.arguments", default={}) or {},
                        "result": _get(attrs, "tool.result", "tool.response",
                                       "mcp.tool.result", default={}) or {},
                        "outcome": "error" if status == "error" else "ok",
                    }
                if kind == "llm":
                    try:
                        in_tok = int(in_tok) if in_tok is not None else None
                    except (TypeError, ValueError):
                        in_tok = None
                    try:
                        out_tok = int(out_tok) if out_tok is not None else None
                    except (TypeError, ValueError):
                        out_tok = None
                    span_spec["model"] = {"provider": provider, "model": model,
                                          "input_tokens": in_tok, "output_tokens": out_tok}
                spec["spans"].append(span_spec)
    return list(by_trace.values())
