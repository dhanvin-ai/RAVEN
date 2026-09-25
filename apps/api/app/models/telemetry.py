"""
Phase 1 — Production telemetry data model (Agnost-style observability layer).

Hierarchy:
    Organization
    └── Project
        ├── Environment          (capture controls live here)
        ├── ProjectAPIKey         (ingestion auth)
        ├── EndUser
        └── Conversation         (stable session grouping, external_id unique per project)
            └── Trace             (one execution; trace_id unique per project)
                ├── Span          (llm / tool / http / custom; parent_span_id self-ref)
                │   ├── ToolCall  (1-1 detail for kind == "tool")
                │   └── ModelCall (1-1 detail for kind == "llm")
                └── TelemetryEvent (lightweight timestamped facts)

Design notes (per roadmap):
- Normalized RAW events only. No precomputed trend strings, no hard-coded
  overview totals — aggregates are computed at query time (Phase 5).
- Every external identifier is idempotent per project: re-sending the same
  trace_id / span_id / event_id / conversation external_id returns the
  existing row instead of duplicating it.
- Large / sensitive payloads stay in JSON columns; object storage can be
  introduced later without schema changes.
"""

import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import JSON as GenericJSON
from sqlalchemy.orm import relationship

from app.database import Base

# SQLite (local/dev fallback) has no JSONB — use generic JSON there.
JSONType = GenericJSON


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    projects = relationship("Project", back_populates="organization", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    slug = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("organization_id", "slug", name="uq_project_org_slug"),)

    organization = relationship("Organization", back_populates="projects")
    environments = relationship("Environment", back_populates="project", cascade="all, delete-orphan")
    api_keys = relationship("ProjectAPIKey", back_populates="project", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="project", cascade="all, delete-orphan")


class Environment(Base):
    __tablename__ = "environments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False, default="production")
    # Capture controls: when False, inputs/outputs are stored as "[redacted]".
    capture_input = Column(Boolean, default=True, nullable=False)
    capture_output = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_env_project_name"),)

    project = relationship("Project", back_populates="environments")


class ProjectAPIKey(Base):
    __tablename__ = "project_api_keys"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    environment_id = Column(Integer, ForeignKey("environments.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(200), nullable=False, default="default")
    # Lookup prefix (first chars of the secret) + SHA-256 of the full secret.
    # The plaintext secret is shown ONCE at creation and never stored.
    key_prefix = Column(String(16), nullable=False, index=True)
    key_hash = Column(String(64), nullable=False, unique=True)
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="api_keys")


class EndUser(Base):
    __tablename__ = "end_users"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    external_id = Column(String(200), nullable=False)
    metadata_json = Column(JSONType, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("project_id", "external_id", name="uq_enduser_project_ext"),)


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    environment_id = Column(Integer, ForeignKey("environments.id", ondelete="SET NULL"), nullable=True)
    # Stable session identifier supplied by the SDK / OTel mapper.
    external_id = Column(String(200), nullable=False)
    end_user_id = Column(Integer, ForeignKey("end_users.id", ondelete="SET NULL"), nullable=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    agent_version = Column(String(50), nullable=True)
    status = Column(String(30), default="open", nullable=False)  # open | completed | error
    message_count = Column(Integer, default=0, nullable=False)
    metadata_json = Column(JSONType, nullable=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("project_id", "external_id", name="uq_conversation_project_ext"),)

    project = relationship("Project", back_populates="conversations")
    traces = relationship("Trace", back_populates="conversation", cascade="all, delete-orphan")


class Trace(Base):
    __tablename__ = "traces"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=True)
    trace_id = Column(String(100), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    agent_version = Column(String(50), nullable=True)
    model = Column(String(100), nullable=True)
    provider = Column(String(100), nullable=True)
    status = Column(String(30), default="ok", nullable=False)  # ok | error
    error_type = Column(String(200), nullable=True)
    error_message = Column(Text, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    cost_usd = Column(Float, nullable=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("project_id", "trace_id", name="uq_trace_project_ext"),)

    conversation = relationship("Conversation", back_populates="traces")
    spans = relationship("Span", back_populates="trace", cascade="all, delete-orphan")
    events = relationship("TelemetryEvent", back_populates="trace", cascade="all, delete-orphan")


class Span(Base):
    __tablename__ = "spans"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    trace_id = Column(Integer, ForeignKey("traces.id", ondelete="CASCADE"), nullable=False)
    span_id = Column(String(100), nullable=False)
    parent_span_id = Column(String(100), nullable=True)
    kind = Column(String(30), default="custom", nullable=False)  # llm | tool | http | custom | event
    name = Column(String(300), nullable=False, default="span")
    status = Column(String(30), default="ok", nullable=False)  # ok | error
    error_type = Column(String(200), nullable=True)
    error_message = Column(Text, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    attributes_json = Column(JSONType, nullable=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("trace_id", "span_id", name="uq_span_trace_ext"),)

    trace = relationship("Trace", back_populates="spans")
    tool_call = relationship("ToolCall", back_populates="span", uselist=False, cascade="all, delete-orphan")
    model_call = relationship("ModelCall", back_populates="span", uselist=False, cascade="all, delete-orphan")


class TelemetryEvent(Base):
    __tablename__ = "telemetry_events"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    trace_id = Column(Integer, ForeignKey("traces.id", ondelete="CASCADE"), nullable=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=True)
    # Client-supplied idempotency key, unique per project.
    event_id = Column(String(100), nullable=False)
    kind = Column(String(50), nullable=False, default="custom")
    name = Column(String(300), nullable=False, default="event")
    payload_json = Column(JSONType, nullable=True)
    occurred_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("project_id", "event_id", name="uq_event_project_ext"),)

    trace = relationship("Trace", back_populates="events")


class ToolCall(Base):
    __tablename__ = "tool_calls"

    id = Column(Integer, primary_key=True, index=True)
    span_id = Column(Integer, ForeignKey("spans.id", ondelete="CASCADE"), nullable=False, unique=True)
    tool_name = Column(String(200), nullable=False)
    arguments_json = Column(JSONType, nullable=True)
    result_json = Column(JSONType, nullable=True)
    outcome = Column(String(30), default="ok", nullable=False)  # ok | error
    latency_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    span = relationship("Span", back_populates="tool_call")


class ModelCall(Base):
    __tablename__ = "model_calls"

    id = Column(Integer, primary_key=True, index=True)
    span_id = Column(Integer, ForeignKey("spans.id", ondelete="CASCADE"), nullable=False, unique=True)
    provider = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    cost_usd = Column(Float, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    span = relationship("Span", back_populates="model_call")


class IngestionFailure(Base):
    """Dead-letter row: payloads that failed validation/processing, kept for inspection."""

    __tablename__ = "ingestion_failures"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    endpoint = Column(String(200), nullable=False)
    error = Column(Text, nullable=False)
    payload_json = Column(JSONType, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)


# Keep JSONB import referenced for future Postgres-specific migration use.
_ = JSONB
