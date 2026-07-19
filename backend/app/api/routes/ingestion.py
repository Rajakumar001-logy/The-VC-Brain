from fastapi import APIRouter, Depends, Form, File, UploadFile, HTTPException
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.models.schemas import Founder, Startup
from app.services.ingestion_service import ingestion_service

router = APIRouter(dependencies=[Depends(get_current_user)])

class IngestionResponse(BaseModel):
    founder: Founder
    startup: Startup

@router.post("", response_model=IngestionResponse)
async def ingest_deal(
    company_name: str = Form(...),
    github_username: str = Form(None),
    website_url: str = Form(None),
    pitch_deck: UploadFile = File(None)
):
    """
    Ingest a new startup deal and primary founder profile from GitHub, website url, 
    and/or PDF pitch deck concurrently, reconciling records in PostgreSQL.
    """
    if not company_name.strip():
        raise HTTPException(status_code=400, detail="Company name is required.")

    file_bytes = None
    filename = None
    if pitch_deck:
        # Verify file is PDF
        if not pitch_deck.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF file format pitch decks are supported.")
        try:
            file_bytes = await pitch_deck.read()
            filename = pitch_deck.filename
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read pitch deck file: {str(e)}")

    try:
        founder, startup = await ingestion_service.run_pipeline(
            company_name=company_name,
            github_username=github_username,
            website_url=website_url,
            pitch_deck_bytes=file_bytes,
            pitch_deck_filename=filename
        )
        return IngestionResponse(founder=founder, startup=startup)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ingestion pipeline failed: {str(e)}"
        )
