"""Pydantic v2 schemas for the /v1 telemetry API (Phase 2 ingestion)."""

import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class ConversationIn(BaseModel):
    external_id: str = Field(..., max_length=200)
    user_id: Optional[str] = Field(default=None, max_length=200)
    agent_id: Optional[int] = None
    agent_version: Optional[str] = Field(default=None, max_length=50)
    metadata: dict[str, Any] = Field(default_factory=dict)
    started_at: Optional[datetime.datetime] = None


class ToolIn(BaseModel):
    tool_name: str = Field(..., max_length=200)
    arguments: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] = Field(default_factory=dict)
    outcome: str = "ok"


class ModelIn(BaseModel):
    provider: Optional[str] = Field(default=None, max_length=100)
    model: Optional[str] = Field(default=None, max_length=100)
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None


class SpanIn(BaseModel):
    span_id: str = Field(..., max_length=100)
    parent_span_id: Optional[str] = Field(default=None, max_length=100)
    kind: str = "custom"
    name: str = Field(default="span", max_length=300)
    status: str = "ok"
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    latency_ms: Optional[int] = None
    started_at: Optional[datetime.datetime] = None
    ended_at: Optional[datetime.datetime] = None
    attributes: dict[str, Any] = Field(default_factory=dict)
    tool: Optional[ToolIn] = None
    model: Optional[ModelIn] = None


class TraceIn(BaseModel):
    trace_id: str = Field(..., max_length=100)
    conversation_id: Optional[str] = Field(default=None, max_length=200)
    user_id: Optional[str] = Field(default=None, max_length=200)
    agent_id: Optional[int] = None
    agent_version: Optional[str] = Field(default=None, max_length=50)
    model: Optional[str] = Field(default=None, max_length=100)
    provider: Optional[str] = Field(default=None, max_length=100)
    status: str = "ok"
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    latency_ms: Optional[int] = None
    started_at: Optional[datetime.datetime] = None
    ended_at: Optional[datetime.datetime] = None
    spans: list[SpanIn] = Field(default_factory=list, max_length=500)


class EventIn(BaseModel):
    event_id: str = Field(..., max_length=100)
    kind: str = "custom"
    name: str = Field(default="event", max_length=300)
    payload: dict[str, Any] = Field(default_factory=dict)
    trace_id: Optional[str] = Field(default=None, max_length=100)
    conversation_id: Optional[str] = Field(default=None, max_length=200)
    occurred_at: Optional[datetime.datetime] = None


class EventBatchIn(BaseModel):
    events: list[EventIn] = Field(..., min_length=1, max_length=500)


class KeyProvisionIn(BaseModel):
    bootstrap_token: str
    project_id: int
    environment_id: Optional[int] = None
    name: str = "default"


class KeyOut(BaseModel):
    id: int
    project_id: int
    name: str
    key_prefix: str
    plaintext: str = Field(description="Shown ONCE — store it securely")


class SpanOut(BaseModel):
    id: int
    span_id: str
    parent_span_id: Optional[str]
    kind: str
    name: str
    status: str
    latency_ms: Optional[int]
    tool_name: Optional[str] = None
    model: Optional[str] = None


class TraceOut(BaseModel):
    id: int
    trace_id: str
    status: str
    model: Optional[str]
    provider: Optional[str]
    latency_ms: Optional[int]
    input_tokens: Optional[int]
    output_tokens: Optional[int]
    cost_usd: Optional[float]
    spans: list[SpanOut] = Field(default_factory=list)


class EventOut(BaseModel):
    id: int
    event_id: str
    kind: str
    name: str
    occurred_at: Optional[datetime.datetime]


class ConversationOut(BaseModel):
    id: int
    external_id: str
    status: str
    message_count: int
    traces: list[TraceOut] = Field(default_factory=list)
    events: list[EventOut] = Field(default_factory=list)
