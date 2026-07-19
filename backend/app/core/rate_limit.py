import time
from typing import Dict, Tuple
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_limit: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        # Maps client IP -> (requests count, window start timestamp)
        self.clients: Dict[str, Tuple[int, float]] = {}

    async def dispatch(self, request: Request, call_next) -> Response:
        # Resolve client IP
        client_ip = request.client.host if request.client else "unknown-ip"
        
        # Bypass rate limits on swagger/docs
        if request.url.path in ["/docs", "/openapi.json", "/redoc", "/health"]:
            return await call_next(request)

        current_time = time.time()
        
        if client_ip not in self.clients:
            self.clients[client_ip] = (1, current_time)
        else:
            count, window_start = self.clients[client_ip]
            if current_time - window_start > self.window_seconds:
                # Reset window
                self.clients[client_ip] = (1, current_time)
            else:
                if count >= self.requests_limit:
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Too many requests. Rate limit exceeded."}
                    )
                self.clients[client_ip] = (count + 1, window_start)

        return await call_next(request)
