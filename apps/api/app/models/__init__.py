"""ORM models. Import every model here so Alembic sees metadata.

Phase 2+ will add Agent, Scenario, Run, Failure, Score, etc.
"""

from app.db.base import Base

__all__ = ["Base"]
