# RAVEN API

FastAPI backend for the Reliability & Adversarial Validation Engine.

## Layout

```
app/
  main.py              ASGI entrypoint
  core/                settings, logging, errors
  db/                  SQLAlchemy engine, session, Base
  api/routes/          HTTP routes
  models/              ORM models (domain models from Phase 2)
  schemas/             Pydantic request/response models
alembic/               migrations
```

## Run

From this directory, with PostgreSQL up:

```bash
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
```
