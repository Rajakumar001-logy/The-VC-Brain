from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.models.schemas import TrustEvaluationResponse, VerifyClaimRequest
from app.services.trust_service import trust_service

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.post("/{id}/trust/evaluate", response_model=TrustEvaluationResponse)
async def evaluate_trust(id: str):
    """
    Triggers the Trust Verification Agent to parse claims (Revenue, Team, Education, Users, 
    Funding, GitHub, Website, Product) against active database evidence logs.
    """
    try:
        response = await trust_service.evaluate_trust(founder_id=id)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Trust verification evaluation failed: {str(e)}"
        )

@router.get("/{id}/trust/latest", response_model=TrustEvaluationResponse)
async def get_latest_trust_report(id: str):
    """
    Retrieves the most recent verified trust report and claim confirmations 
    for a specific founder.
    """
    try:
        details = await trust_service.get_latest_trust_report(founder_id=id)
        return details
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch latest trust details: {str(e)}"
        )

@router.post("/{id}/trust/verify-claim", response_model=TrustEvaluationResponse)
async def verify_claim_override(
    id: str,
    payload: VerifyClaimRequest
):
    """
    Allows investors to manually override and verify/contradict a specific claim, 
    re-running the Trust Score calculation dynamically.
    """
    try:
        response = await trust_service.verify_claim_override(
            founder_id=id,
            claim_type=payload.claim_type,
            status=payload.status
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Claim status override override failed: {str(e)}"
        )
