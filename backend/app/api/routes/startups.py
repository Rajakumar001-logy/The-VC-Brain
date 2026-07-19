from fastapi import APIRouter, HTTPException, Depends

from app.models.schemas import Startup
from app.services.data_store import store
from app.core.auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[Startup])
async def list_startups():
    return store.list_startups()


@router.get("/{startup_id}", response_model=Startup)
async def get_startup(startup_id: str):
    startup = store.get_startup(startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    return startup
