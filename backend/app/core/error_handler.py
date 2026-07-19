import logging
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("vc_brain_api")

class GlobalExceptionHandlerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        try:
            return await call_next(request)
        except Exception as e:
            # Log exact stack trace on backend for developers
            logger.error(
                f"Unhandled exception during request {request.method} {request.url.path}: {str(e)}",
                exc_info=True
            )
            # Return clean error responses to production clients
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error. Please try again later."}
            )
