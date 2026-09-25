"""
Phase 1+2 acceptance tests: telemetry model + /v1 ingestion.

Exit criterion (Phase 2): an external app can send a real agent
interaction and retrieve the persisted conversation.
"""

import os
import tempfile

_db_file = os.path.join(tempfile.gettempdir(), "raven-telemetry-test.db")
if os.path.exists(_db_file):
    os.remove(_db_file)
os.environ["DATABASE_URL"] = f"sqlite:///{_db_file}"
os.environ["RAVEN_BOOTSTRAP_TOKEN"] = "test-bootstrap"
os.environ["RAVEN_RATE_LIMIT_PER_MINUTE"] = "1000"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.telemetry import Project  # noqa: E402
from app.services.api_keys import create_key  # noqa: E402

client = TestClient(app, raise_server_exceptions=False)


def _auth_headers() -> dict:
    db = SessionLocal()
    try:
        project = db.query(Project).first()
        assert project is not None, "telemetry seed should have created a project"
        _, plaintext = create_key(db, project_id=project.id, name="test-key")
        return {"X-RAVEN-API-KEY": plaintext}
    finally:
        db.close()


HEADERS = None


def setup_module():
    global HEADERS
    HEADERS = _auth_headers()


def test_unauthorized_without_key():
    r = client.post("/v1/conversations", json={"external_id": "nope"})
    assert r.status_code == 401


def test_key_provisioning_gated():
    r = client.post("/v1/keys", json={"bootstrap_token": "wrong", "project_id": 1})
    assert r.status_code == 403


def test_conversation_roundtrip_exit_criterion():
    """External app sends an interaction, then retrieves the conversation."""
    r = client.post("/v1/conversations", headers=HEADERS,
                    json={"external_id": "e2e-conv-1", "user_id": "user-42",
                          "agent_version": "1.4.0", "metadata": {"channel": "web"}})
    assert r.status_code == 200, r.text
    conv_id = r.json()["id"]

    r = client.post("/v1/traces", headers=HEADERS, json={
        "trace_id": "e2e-trace-1", "conversation_id": "e2e-conv-1",
        "user_id": "user-42", "model": "gpt-4o-mini", "provider": "openai",
        "spans": [
            {"span_id": "s-llm", "kind": "llm", "name": "llm.plan",
             "attributes": {"input": "where is my order?"},
             "model": {"provider": "openai", "model": "gpt-4o-mini",
                       "input_tokens": 50, "output_tokens": 10}},
            {"span_id": "s-tool", "parent_span_id": "s-llm", "kind": "tool",
             "name": "tool.get_order",
             "tool": {"tool_name": "get_order", "arguments": {"order_id": "1"},
                      "result": {"status": "shipped"}, "outcome": "ok"}},
        ]})
    assert r.status_code == 200, r.text

    r = client.post("/v1/events", headers=HEADERS, json={
        "event_id": "e2e-ev-1", "kind": "conversation.completed",
        "name": "conversation.completed", "conversation_id": "e2e-conv-1"})
    assert r.status_code == 200, r.text

    r = client.get(f"/v1/conversations/{conv_id}", headers=HEADERS)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["external_id"] == "e2e-conv-1"
    assert len(body["traces"]) == 1
    assert len(body["traces"][0]["spans"]) == 2
    assert body["traces"][0]["input_tokens"] == 50
    assert len(body["events"]) == 1


def test_idempotency_no_duplicates():
    first = client.post("/v1/traces", headers=HEADERS,
                        json={"trace_id": "dup-trace-1", "conversation_id": "dup-conv-1"})
    second = client.post("/v1/traces", headers=HEADERS,
                         json={"trace_id": "dup-trace-1", "conversation_id": "dup-conv-1"})
    assert first.json()["id"] == second.json()["id"]
    assert second.json()["deduped"] is True

    e1 = client.post("/v1/events", headers=HEADERS,
                     json={"event_id": "dup-ev-1", "name": "x"})
    e2 = client.post("/v1/events", headers=HEADERS,
                     json={"event_id": "dup-ev-1", "name": "x"})
    assert e1.json()["items"][0]["id"] == e2.json()["items"][0]["id"]
    assert e2.json()["items"][0]["deduped"] is True


def test_batch_with_per_item_isolation():
    big = "x" * (70 * 1024)  # exceeds 64 KB field cap for one item
    r = client.post("/v1/events/batch", headers=HEADERS, json={"events": [
        {"event_id": "b-ok-1", "name": "good"},
        {"event_id": "b-big-1", "name": "too-big", "payload": {"blob": big}},
    ]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["received"] == 2 and body["failed"] == 1
    assert body["items"][0]["error"] is None
    assert body["items"][1]["error"] is not None


def test_pii_redaction():
    r = client.post("/v1/events", headers=HEADERS, json={
        "event_id": "pii-ev-1", "name": "contact",
        "payload": {"email": "jane@example.com", "password": "hunter2",
                    "note": "call jane@example.com back"}})
    assert r.status_code == 200
    db = SessionLocal()
    try:
        from app.models.telemetry import TelemetryEvent
        ev = db.query(TelemetryEvent).filter(TelemetryEvent.event_id == "pii-ev-1").first()
        assert ev.payload_json["password"] == "[redacted]"
        assert "jane@example.com" not in str(ev.payload_json)
    finally:
        db.close()


def test_otel_ingestion():
    r = client.post("/v1/otel/v1/traces", headers=HEADERS, json={
        "resourceSpans": [{
            "scopeSpans": [{
                "spans": [
                    {"traceId": "otel-trace-aaa", "spanId": "otel-span-1",
                     "name": "llm.plan", "startTimeUnixNano": "1758800000000000000",
                     "endTimeUnixNano": "1758800001000000000",
                     "attributes": {"session.id": "otel-conv-1", "user.id": "u-9",
                                    "llm.model_name": "gpt-4o-mini",
                                    "llm.usage.prompt_tokens": 30,
                                    "llm.usage.completion_tokens": 12}},
                    {"traceId": "otel-trace-aaa", "spanId": "otel-span-2",
                     "parentSpanId": "otel-span-1", "name": "get_order",
                     "startTimeUnixNano": "1758800000500000000",
                     "endTimeUnixNano": "1758800000800000000",
                     "attributes": {"tool.name": "get_order",
                                    "tool.arguments": {"order_id": "7"}}},
                ]}]}]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["received"] == 1 and body["failed"] == 0

    db = SessionLocal()
    try:
        from app.models.telemetry import Conversation, Span, Trace
        conv = db.query(Conversation).filter(Conversation.external_id == "otel-conv-1").first()
        assert conv is not None
        trace = db.query(Trace).filter(Trace.trace_id == "otel-trace-aaa").first()
        assert trace.input_tokens == 30 and trace.output_tokens == 12
        assert trace.cost_usd is not None
        spans = db.query(Span).filter(Span.trace_id == trace.id).all()
        assert {s.kind for s in spans} == {"llm", "tool"}
    finally:
        db.close()


def test_scope_isolation_between_projects():
    db = SessionLocal()
    try:
        from app.models.telemetry import Organization
        org = Organization(name="Other Org")
        db.add(org)
        db.flush()
        from app.models.telemetry import Environment, Project
        proj = Project(organization_id=org.id, name="Other", slug="other")
        db.add(proj)
        db.flush()
        env = Environment(project_id=proj.id, name="production")
        db.add(env)
        db.flush()
        _, other_secret = create_key(db, project_id=proj.id, environment_id=env.id)
    finally:
        db.close()
    other = {"X-RAVEN-API-KEY": other_secret}
    r = client.post("/v1/conversations", headers=other, json={"external_id": "e2e-conv-1"})
    assert r.status_code == 200
    # Same external_id in another project is a DIFFERENT conversation.
    mine = client.post("/v1/conversations", headers=HEADERS, json={"external_id": "e2e-conv-1"})
    assert mine.json()["id"] != r.json()["id"]


# ── Phase 4/5 observe ─────────────────────────────────────────

def test_conversation_list_and_filters():
    r = client.get("/v1/conversations", headers=HEADERS)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 2  # seed conversations
    assert body["items"][0]["external_id"]

    r = client.get("/v1/conversations?error=true", headers=HEADERS)
    assert all(i["errors"] > 0 for i in r.json()["items"])
    assert any(i["external_id"] == "seed-conv-0002" for i in r.json()["items"])

    r = client.get("/v1/conversations?tool=refund_order", headers=HEADERS)
    assert any(i["external_id"] == "seed-conv-0002" for i in r.json()["items"])

    r = client.get("/v1/conversations?q=seed-conv-0001", headers=HEADERS)
    assert r.json()["total"] >= 1

    r = client.get("/v1/conversations?limit=1&offset=0", headers=HEADERS)
    assert len(r.json()["items"]) == 1


def test_events_and_tool_calls_lists():
    r = client.get("/v1/events?kind=user.frustration", headers=HEADERS)
    assert r.status_code == 200 and r.json()["total"] >= 1

    r = client.get("/v1/tool-calls", headers=HEADERS)
    assert r.status_code == 200, r.text
    body = r.json()
    names = {s["tool"] for s in body["summary"]}
    assert {"get_order", "refund_order"} <= names
    refund = next(s for s in body["summary"] if s["tool"] == "refund_order")
    assert refund["errors"] >= 1 and refund["error_rate"] > 0

    r = client.get("/v1/tool-calls?outcome=error", headers=HEADERS)
    assert all(i["outcome"] == "error" for i in r.json()["items"])


def test_analytics_overview_is_real():
    r = client.get("/v1/analytics/overview?days=7", headers=HEADERS)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["totals"]["conversations"] >= 2
    assert body["totals"]["traces"] >= 2
    assert body["totals"]["error_rate"] > 0
    assert body["latency_ms"]["p95"] is not None
    assert body["tokens"]["total"] > 0
    assert len(body["timeseries"]) == 7
    assert any(t["tool"] == "refund_order" for t in body["tools"])
    assert any("gpt-4o-mini" in (m["model"] or "") for m in body["models"])
    assert body["top_errors"], "seed error trace should surface"


def test_activity_and_stream_auth():
    r = client.get("/v1/activity?limit=5", headers=HEADERS)
    assert r.status_code == 200 and r.json()["items"]

    r = client.get("/v1/activity/stream")
    assert r.status_code == 401
