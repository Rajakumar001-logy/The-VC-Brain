from fastapi import APIRouter, Depends, HTTPException
from typing import List

from app.core.auth import get_current_investor_profile, require_admin
from app.models.schemas import InvestorProfile, InvestorUpdate, InvestorRoleUpdate
from app.core.config import settings
from app.services.supabase_client import supabase_client

router = APIRouter()

# In-memory store for mock profiles to persist updates during development session
MOCK_INVESTORS = [
    {
        "id": "mock-admin-id",
        "auth_user_id": "mock-admin-id",
        "email": "admin@vcbrain.ai",
        "full_name": "Admin User",
        "role": "admin",
        "title": "Administrator",
        "bio": "VC Brain primary administrator. Offline test profile.",
        "is_active": True
    },
    {
        "id": "mock-investor-id",
        "auth_user_id": "mock-investor-id",
        "email": "investor@vcbrain.ai",
        "full_name": "Investor User",
        "role": "analyst",
        "title": "Analyst",
        "bio": "VC Brain investor analyst. Offline test profile.",
        "is_active": True
    }
]

@router.get("/me", response_model=InvestorProfile)
async def get_my_profile(profile: dict = Depends(get_current_investor_profile)):
    return profile

@router.put("/me", response_model=InvestorProfile)
async def update_my_profile(
    payload: InvestorUpdate,
    profile: dict = Depends(get_current_investor_profile)
):
    user_id = profile.get("auth_user_id")

    if not settings.supabase_url or not settings.supabase_service_role_key:
        # Dev fallback: Update local mock profile
        mock_prof = next((x for x in MOCK_INVESTORS if x["auth_user_id"] == user_id), None)
        if not mock_prof:
            mock_prof = profile.copy()
            MOCK_INVESTORS.append(mock_prof)
            
        if payload.full_name is not None:
            mock_prof["full_name"] = payload.full_name
        if payload.title is not None:
            mock_prof["title"] = payload.title
        if payload.bio is not None:
            mock_prof["bio"] = payload.bio
        if payload.avatar_url is not None:
            mock_prof["avatar_url"] = payload.avatar_url
            
        return mock_prof

    # Supabase DB update
    try:
        update_data = {}
        if payload.full_name is not None:
            update_data["full_name"] = payload.full_name
        if payload.title is not None:
            update_data["title"] = payload.title
        if payload.bio is not None:
            update_data["bio"] = payload.bio
        if payload.avatar_url is not None:
            update_data["avatar_url"] = payload.avatar_url

        response = supabase_client._client.table("investors")\
            .update(update_data)\
            .eq("auth_user_id", user_id)\
            .execute()
            
        if not response.data:
            raise HTTPException(status_code=404, detail="Profile not found to update")
            
        return response.data[0]
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update database profile: {str(e)}"
        )

@router.get("", response_model=List[InvestorProfile])
async def list_investors(_admin: dict = Depends(require_admin)):
    """
    List all investors in the platform. Admin restricted.
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return MOCK_INVESTORS

    try:
        response = supabase_client._client.table("investors").select("*").execute()
        return response.data or []
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to query database investors: {str(e)}"
        )

@router.put("/{investor_id}/role", response_model=InvestorProfile)
async def update_investor_role(
    investor_id: str,
    payload: InvestorRoleUpdate,
    _admin: dict = Depends(require_admin)
):
    """
    Update another investor's role. Admin restricted.
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        # Dev fallback: Update local mock profile
        mock_prof = next((x for x in MOCK_INVESTORS if x["id"] == investor_id), None)
        if not mock_prof:
            raise HTTPException(status_code=404, detail="Mock investor not found")
        mock_prof["role"] = payload.role
        mock_prof["title"] = payload.role.capitalize()
        return mock_prof

    try:
        response = supabase_client._client.table("investors")\
            .update({"role": payload.role, "title": payload.role.capitalize()})\
            .eq("id", investor_id)\
            .execute()
            
        if not response.data:
            raise HTTPException(status_code=404, detail="Investor profile not found to update")
            
        return response.data[0]
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update database role: {str(e)}"
        )
