from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.services.dashboard_service import dashboard_service

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("", response_model=dict)
async def get_dashboard_metrics():
    """
    Returns unified portfolio, deal pipelines, score distributions, 
    and recent discoveries metrics for the main platform dashboard.
    """
    try:
        metrics = await dashboard_service.get_dashboard_metrics()
        return metrics
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to compile dashboard metrics: {str(e)}"
        )
