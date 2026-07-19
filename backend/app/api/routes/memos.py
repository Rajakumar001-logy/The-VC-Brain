from fastapi import APIRouter, HTTPException, Depends

from app.models.schemas import GenerateMemoRequest, InvestmentMemo, MemoGenerateResponse
from app.services.data_store import store
from app.services.openai_service import openai_service
from app.core.auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[InvestmentMemo])
async def list_memos():
    return store.list_memos()


@router.get("/{memo_id}", response_model=InvestmentMemo)
async def get_memo(memo_id: str):
    memo = store.get_memo(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    return memo


@router.post("/generate", response_model=MemoGenerateResponse)
async def generate_memo(payload: GenerateMemoRequest):
    startup = store.get_startup(payload.startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")

    draft = await openai_service.generate_memo(
        startup_name=startup.name,
        sector=startup.sector,
        description=startup.description,
        traction=startup.traction,
        notes=payload.notes,
    )
    return MemoGenerateResponse(startup_id=startup.id, draft=draft)
