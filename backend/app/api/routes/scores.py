from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.models.schemas import ScoreEvaluationResponse
from app.services.score_service import score_service

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.post("/{id}/score/evaluate", response_model=ScoreEvaluationResponse)
async def evaluate_founder_score(id: str):
    """
    Triggers the AI scoring algorithm to gather GitHub logs, exits, education lists, 
    and memory events, calculating specialized sub-scores (Technical, Business, Execution, 
    Innovation, Risk) and logging them in historical records.
    """
    try:
        response = await score_service.evaluate_founder_score(founder_id=id)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Founder score re-evaluation failed: {str(e)}"
        )

@router.get("/{id}/score/latest", response_model=ScoreEvaluationResponse)
async def get_latest_score_details(id: str):
    """
    Retrieves the most recent structured score breakdown, explanations, and 
    dimensions evaluation for a specific founder.
    """
    try:
        details = await score_service.get_latest_score_details(founder_id=id)
        if not details:
            # Fallback to run evaluation if no history exists yet
            details = await score_service.evaluate_founder_score(founder_id=id)
        return details
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch latest founder score details: {str(e)}"
        )
