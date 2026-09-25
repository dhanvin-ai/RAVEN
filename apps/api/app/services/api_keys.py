"""
Project API-key lifecycle + request authentication for /v1 ingestion.

- Keys look like ``rvn_<32 url-safe chars>`` and are accepted via the
  ``X-RAVEN-API-KEY`` header (``Authorization: Bearer`` also works).
- Only ``key_prefix`` + SHA-256 hash are stored; plaintext is returned
  ONCE at creation time.
- Key provisioning (POST /v1/keys) requires a bootstrap token
  (``RAVEN_BOOTSTRAP_TOKEN`` env) so production can disable open
  provisioning by leaving it unset. The dev seed provisions one key
  directly and prints it.
- Rate limiting is an in-memory per-key token bucket (single-process).
  A shared Redis limiter can replace ``_check_rate_limit`` later.
"""

import hashlib
import os
import secrets
import time
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.telemetry import Environment, Project, ProjectAPIKey

KEY_PREFIX_LEN = 10
RATE_LIMIT_PER_MINUTE = 600

_buckets: dict[int, tuple[float, int]] = {}


def _hash(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def create_key(db: Session, *, project_id: int, environment_id: int | None = None,
               name: str = "default") -> tuple[ProjectAPIKey, str]:
    """Create a key; returns (row, PLAINTEXT secret — show once)."""
    secret = "rvn_" + secrets.token_urlsafe(32)
    row = ProjectAPIKey(
        project_id=project_id,
        environment_id=environment_id,
        name=name,
        key_prefix=secret[:KEY_PREFIX_LEN],
        key_hash=_hash(secret),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, secret


def _lookup(db: Session, secret: str) -> ProjectAPIKey | None:
    if not secret or not secret.startswith("rvn_"):
        return None
    row = (
        db.query(ProjectAPIKey)
        .filter(ProjectAPIKey.key_prefix == secret[:KEY_PREFIX_LEN])
        .first()
    )
    if not row or row.revoked or row.key_hash != _hash(secret):
        return None
    return row


def _check_rate_limit(key_id: int) -> None:
    limit = int(os.getenv("RAVEN_RATE_LIMIT_PER_MINUTE", str(RATE_LIMIT_PER_MINUTE)))
    now = time.time()
    window_start, count = _buckets.get(key_id, (now, 0))
    if now - window_start >= 60:
        _buckets[key_id] = (now, 1)
        return
    if count >= limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded",
                            headers={"Retry-After": str(int(60 - (now - window_start)))})
    _buckets[key_id] = (window_start, count + 1)


@dataclass
class AuthContext:
    key: ProjectAPIKey
    project: Project
    environment: Environment | None


def require_api_key(
    db: Session = Depends(get_db),
    x_raven_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> AuthContext:
    secret = x_raven_api_key
    if not secret and authorization and authorization.lower().startswith("bearer "):
        secret = authorization.split(" ", 1)[1].strip()
    row = _lookup(db, secret or "")
    if not row:
        raise HTTPException(status_code=401, detail="Missing or invalid API key")
    _check_rate_limit(row.id)
    project = db.query(Project).filter(Project.id == row.project_id).first()
    if not project:
        raise HTTPException(status_code=401, detail="API key project not found")
    env = None
    if row.environment_id:
        env = db.query(Environment).filter(Environment.id == row.environment_id).first()
    if env is None:
        env = db.query(Environment).filter(Environment.project_id == project.id).first()
    return AuthContext(key=row, project=project, environment=env)


def require_bootstrap() -> None:
    """Gate key provisioning: needs the bootstrap token env var."""
    expected = os.getenv("RAVEN_BOOTSTRAP_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=403, detail="Key provisioning is disabled")
    # The actual comparison happens in the route (token comes in the body).
    return None
