# RAVEN

**Reliability & Adversarial Validation Engine** — a CI/CD, red-team, and observability platform for AI agents.

This repo is a monorepo:

```
apps/api   Python FastAPI backend
apps/web   Next.js dashboard (later)
```

## Phase 1 — Project foundation

Backend stack: FastAPI, PostgreSQL, SQLAlchemy 2 (async), Alembic, Pydantic Settings, structured logging, consistent error envelopes.

### Prerequisites

- Python 3.12+
- Docker Desktop (PostgreSQL via Compose). If Docker is not installed, run Postgres locally and set `DATABASE_URL` in `.env`.

### Setup

```bash
cp .env.example .env
docker compose up -d postgres

cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health:

- `GET http://localhost:8000/health` — process is up
- `GET http://localhost:8000/health/ready` — database is reachable
- `GET http://localhost:8000/docs` — OpenAPI

### Tests

```bash
cd apps/api
pytest
```
