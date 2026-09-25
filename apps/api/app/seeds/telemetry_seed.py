"""
Phase 1/2 dev seed: one organization, project, environment and API key,
plus a sample conversation so the evidence explorer (Phase 4) has
something to show on first boot.

Idempotent: only seeds when telemetry tables are empty. Prints the dev
API key ONCE when it is created — store it; it cannot be recovered
(only the hash is persisted).
"""

import datetime
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.database import SessionLocal
from app.models.telemetry import Conversation, Environment, Organization, Project
from app.services.api_keys import create_key
from app.services.ingestion import ingest_event, ingest_trace


def seed_telemetry() -> str | None:
    """Seed dev telemetry scope. Returns the dev API key plaintext (once) or None."""
    db = SessionLocal()
    try:
        if db.query(Organization).count() > 0:
            return None
        org = Organization(name="RAVEN Dev")
        db.add(org)
        db.flush()
        project = Project(organization_id=org.id, name="Support Copilot", slug="support-copilot")
        db.add(project)
        db.flush()
        env = Environment(project_id=project.id, name="development",
                          capture_input=True, capture_output=True)
        db.add(env)
        db.flush()

        _, plaintext = create_key(db, project_id=project.id, environment_id=env.id, name="dev-key")

        # One sample conversation: user asks, tool runs, agent answers.
        ingest_trace(
            db, project, env,
            trace_id="seed-trace-0001",
            conversation_ext_id="seed-conv-0001",
            user_id="seed-user-1",
            agent_version="1.0.0",
            model="gpt-4o-mini",
            provider="openai",
            status="ok",
            started_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=6),
            ended_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=5),
            spans=[
                {"span_id": "seed-span-llm-1", "kind": "llm", "name": "llm.plan",
                 "status": "ok",
                 "attributes": {"input": "where is my order ORD-9921?"},
                 "model": {"provider": "openai", "model": "gpt-4o-mini",
                           "input_tokens": 128, "output_tokens": 24}},
                {"span_id": "seed-span-tool-1", "parent_span_id": "seed-span-llm-1",
                 "kind": "tool", "name": "tool.get_order", "status": "ok",
                 "tool": {"tool_name": "get_order",
                          "arguments": {"order_id": "ORD-9921"},
                          "result": {"status": "shipped", "eta": "2026-10-02"},
                          "outcome": "ok"}},
                {"span_id": "seed-span-llm-2", "parent_span_id": "seed-span-tool-1",
                 "kind": "llm", "name": "llm.respond", "status": "ok",
                 "attributes": {"output": "Order ORD-9921 shipped, arriving Oct 2."},
                 "model": {"provider": "openai", "model": "gpt-4o-mini",
                           "input_tokens": 210, "output_tokens": 18}},
            ],
        )
        conv = db.query(Conversation).filter(
            Conversation.project_id == project.id,
            Conversation.external_id == "seed-conv-0001").first()
        if conv:
            conv.status = "completed"
            conv.ended_at = datetime.datetime.utcnow() - datetime.timedelta(minutes=5)
        ingest_event(db, project, env, event_id="seed-event-0001", kind="conversation.completed",
                     name="conversation.completed",
                     payload={"conversation": "seed-conv-0001"},
                     conversation_ext_id="seed-conv-0001")
        db.commit()
        print("📡 Telemetry seed complete: org 'RAVEN Dev' / project 'support-copilot'.")
        print(f"🔑 DEV API KEY (shown once): {plaintext}")
        return plaintext
    finally:
        db.close()


if __name__ == "__main__":
    seed_telemetry()
