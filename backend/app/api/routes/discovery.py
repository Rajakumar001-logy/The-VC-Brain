from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.models.schemas import DiscoveryScanRequest, DiscoveryScanResponse, DiscoveredFounder, OutreachStatusRequest
from app.services.discovery_service import discovery_service

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.post("/scan", response_model=DiscoveryScanResponse)
async def scan_platforms(
    payload: DiscoveryScanRequest
):
    """
    Triggers the Discovery Agent to crawl developer and creator platforms 
    (GitHub, Product Hunt, arXiv, Devpost, Accelerators, Hackathons), 
    filter candidates by rating threshold, and generate outreach email drafts.
    """
    try:
        discovered = await discovery_service.scan_platforms(threshold=payload.threshold)
        return DiscoveryScanResponse(
            scanned_count=len(discovered),
            discovered=discovered
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Founder platform scanning failed: {str(e)}"
        )

@router.get("", response_model=list[DiscoveredFounder])
async def list_discovered_founders():
    """
    Retrieves all discovered founder leads sorted by calculated score.
    """
    try:
        results = await discovery_service.list_discovered()
        return results
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve discovered founders list: {str(e)}"
        )

@router.post("/{id}/outreach", response_model=dict)
async def update_outreach_status(
    id: str,
    payload: OutreachStatusRequest
):
    """
    Updates the outreach email text and transitions the lead status to 'sent' or 'draft'.
    """
    try:
        await discovery_service.update_outreach(
            founder_id=id,
            status=payload.status,
            email_body=payload.email_body
        )
        return {"status": "success", "message": f"Outreach lead status updated to {payload.status}."}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Outreach log update failed: {str(e)}"
        )
