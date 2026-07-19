"""VC Brain API — FastAPI entrypoint."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.rate_limit import RateLimitMiddleware
from app.core.error_handler import GlobalExceptionHandlerMiddleware

# Configure logging format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()]
)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


app = FastAPI(
    title="VC Brain API",
    description="AI-powered venture capital intelligence API",
    version="1.0.0",
    lifespan=lifespan,
)

# Register global security middlewares
app.add_middleware(GlobalExceptionHandlerMiddleware)
app.add_middleware(RateLimitMiddleware, requests_limit=100, window_seconds=60)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    db_status = "offline"
    if settings.supabase_url and settings.supabase_service_role_key:
        from app.services.supabase_client import supabase_client
        if supabase_client.enabled:
            db_status = "connected"
            
    return {
        "status": "ok",
        "service": "vc-brain-api",
        "database": db_status
    }
