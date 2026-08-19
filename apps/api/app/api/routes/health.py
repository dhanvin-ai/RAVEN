from datetime import UTC, datetime

from fastapi import APIRouter, Request, status
from sqlalchemy.exc import SQLAlchemyError

from app import __version__
from app.core.config import get_settings
from app.core.errors import AppError
from app.db.session import ping_database
from app.schemas.health import HealthResponse, ReadinessResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        environment=settings.app_env,
        version=__version__,
        time=datetime.now(UTC),
    )


@router.get("/health/ready", response_model=ReadinessResponse)
async def ready(request: Request) -> ReadinessResponse:
    settings = get_settings()
    try:
        await ping_database(request.app.state.engine)
        database = "ok"
        status_value = "ok"
    except (SQLAlchemyError, OSError) as exc:
        raise AppError(
            "Database is not reachable",
            code="DATABASE_UNAVAILABLE",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details={"reason": str(exc.__class__.__name__)},
        ) from exc

    return ReadinessResponse(
        status=status_value,
        service=settings.app_name,
        database=database,
        time=datetime.now(UTC),
    )
