from collections.abc import Awaitable, Callable
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from structlog.contextvars import bind_contextvars, clear_contextvars

from app.core.config import get_settings


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Attach a request ID to logs and the response."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        settings = get_settings()
        incoming = request.headers.get(settings.request_id_header)
        request_id = incoming.strip() if incoming else str(uuid4())
        request.state.request_id = request_id

        clear_contextvars()
        bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )
        try:
            response = await call_next(request)
        finally:
            clear_contextvars()

        response.headers[settings.request_id_header] = request_id
        return response
