from fastapi import APIRouter

from app.api.routes import founders, health, memos, search, startups, investors, ingestion, pitch_decks, memory, scores, trust, partner, discovery, dashboard, agents

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(founders.router, prefix="/founders", tags=["founders"])
api_router.include_router(startups.router, prefix="/startups", tags=["startups"])
api_router.include_router(memos.router, prefix="/memos", tags=["memos"])
api_router.include_router(investors.router, prefix="/investors", tags=["investors"])
api_router.include_router(ingestion.router, prefix="/ingest", tags=["ingest"])
api_router.include_router(pitch_decks.router, prefix="/pitch-decks", tags=["pitch-decks"])
api_router.include_router(memory.router, prefix="/founders", tags=["memory"])
api_router.include_router(scores.router, prefix="/founders", tags=["scores"])
api_router.include_router(trust.router, prefix="/founders", tags=["trust"])
api_router.include_router(partner.router, prefix="/memos", tags=["partner"])
api_router.include_router(discovery.router, prefix="/discovery", tags=["discovery"])
api_router.include_router(dashboard.router, prefix="/investors/dashboard", tags=["dashboard"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])

