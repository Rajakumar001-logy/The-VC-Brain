from fastapi import APIRouter, HTTPException, Query, Depends

from app.models.schemas import Founder
from app.services.data_store import store
from app.core.auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[Founder])
async def list_founders():
    return store.list_founders()


@router.get("/search", response_model=list[Founder])
async def search_founders(q: str = Query(..., min_length=1)):
    return store.search_founders(q)


@router.get("/{founder_id}", response_model=Founder)
async def get_founder(founder_id: str):
    founder = store.get_founder(founder_id)
    if not founder:
        raise HTTPException(status_code=404, detail="Founder not found")
    return founder
