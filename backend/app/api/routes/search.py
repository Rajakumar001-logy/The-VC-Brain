from fastapi import APIRouter, Depends

from app.models.schemas import SearchRequest, SearchResponse
from app.services.search_service import search_service
from app.core.auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.post("", response_model=SearchResponse)
async def semantic_search(payload: SearchRequest):
    results = await search_service.search(payload.query, limit=payload.limit)
    return SearchResponse(query=payload.query, results=results)
