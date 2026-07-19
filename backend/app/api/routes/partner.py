from fastapi import APIRouter, Depends, HTTPException

import uuid
from app.core.auth import get_current_user
from app.models.schemas import PartnerEvaluationRequest, PartnerEvaluationResponse, SaveMemoRequest, InvestmentMemo
from app.services.partner_service import partner_service

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.post("/partner-evaluate", response_model=PartnerEvaluationResponse)
async def evaluate_deal(
    payload: PartnerEvaluationRequest
):
    """
    Simulates a senior Venture Capital General Partner review. Analyzes founders, 
    markets, products, and competitive positioning, deciding on recommendations (Invest, Pass, Watch) 
    and SAFEs structures.
    """
    try:
        response = await partner_service.evaluate_deal(startup_id=payload.startup_id)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI Venture Partner evaluation failed: {str(e)}"
        )

@router.post("/partner-save-memo", response_model=InvestmentMemo)
async def save_memo(
    payload: SaveMemoRequest,
    current_user = Depends(get_current_user)
):
    """
    Persists the AI VC Partner evaluation report as a formal investment memo 
    in the PostgreSQL database.
    """
    # current_user is a dict containing 'user_id' or 'id'
    author_id = current_user.get("user_id") or current_user.get("id") or str(uuid.uuid4())
    
    try:
        memo = await partner_service.convert_to_memo(
            startup_id=payload.startup_id,
            eval_data=payload.evaluation,
            author_id=author_id
        )
        return memo
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to convert report to investment memo: {str(e)}"
        )
