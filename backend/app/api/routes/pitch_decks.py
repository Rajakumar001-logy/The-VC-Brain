from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException

from app.core.auth import get_current_user
from app.models.schemas import PitchDeckResponse
from app.services.pitch_deck_service import pitch_deck_service

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.post("/analyze", response_model=PitchDeckResponse)
async def analyze_pitch_deck(
    file: UploadFile = File(...),
    company_id: str = Form(None)
):
    """
    Ingests and analyzes a pitch deck PDF, extracting 12 business categories 
    using OpenAI, and saves the details into PostgreSQL.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF format pitch decks are supported."
        )

    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read file: {str(e)}"
        )

    try:
        response = await pitch_deck_service.analyze_deck(
            file_bytes=file_bytes,
            filename=file.filename,
            company_id=company_id
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Diligence analysis failed: {str(e)}"
        )
