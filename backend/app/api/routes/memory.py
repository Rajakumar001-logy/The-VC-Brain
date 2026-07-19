from fastapi import APIRouter, Depends, HTTPException
from typing import List

from app.core.auth import get_current_user
from app.models.schemas import AddMemoryRequest, MemoryResponse, FounderTimelineEvent, SemanticQueryRequest
from app.services.memory_service import memory_service

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.post("/{id}/memory")
async def add_founder_memory(
    id: str,
    payload: AddMemoryRequest
):
    """
    Ingests a new factual observation/memory event for a founder, checks 
    for duplicate statements, and recalculates the founder rating.
    """
    try:
        fact = await memory_service.add_memory(
            founder_id=id,
            title=payload.title,
            body=payload.body,
            observed_at=payload.observed_at,
            source_kind=payload.source_kind,
            confidence=payload.confidence
        )
        return {"status": "success", "data": fact}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to record founder memory: {str(e)}"
        )

@router.get("/{id}/timeline", response_model=List[FounderTimelineEvent])
async def get_founder_timeline(id: str):
    """
    Retrieves the complete chronological timeline of events (memories and score logs) 
    for a specific founder.
    """
    try:
        timeline = await memory_service.get_timeline(founder_id=id)
        return timeline
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve founder timeline: {str(e)}"
        )

@router.post("/{id}/query", response_model=List[MemoryResponse])
async def semantic_query_memory(
    id: str,
    payload: SemanticQueryRequest
):
    """
    Performs a pgvector cosine similarity match over the founder's memory logs 
    to answer semantic inquiries in natural language.
    """
    try:
        matches = await memory_service.semantic_query(
            founder_id=id,
            query=payload.query,
            limit=payload.limit
        )
        return matches
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Semantic memory query failed: {str(e)}"
        )
