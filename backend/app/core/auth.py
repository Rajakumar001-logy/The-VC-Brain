import httpx
from fastapi import Header, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Any

from app.core.config import settings
from app.services.supabase_client import supabase_client

# Define security scheme
security_scheme = HTTPBearer(auto_error=False)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> Dict[str, Any]:
    """
    Extracts the Bearer token and verifies it using Supabase Auth.
    Falls back to mock mode if Supabase environment variables are not set.
    """
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header"
        )
    
    token = credentials.credentials

    # If Supabase is not configured, fall back to mock authentication
    if not settings.supabase_url or not settings.supabase_service_role_key:
        if token == "mock-admin-token":
            return {
                "id": "mock-admin-id",
                "email": "admin@vcbrain.ai",
                "user_metadata": {
                    "full_name": "Admin User",
                    "role": "admin"
                }
            }
        elif token == "mock-investor-token" or token.startswith("mock-investor-"):
            # Allow mock email suffix tracking, e.g. mock-investor-alex
            email = "investor@vcbrain.ai"
            name = "Investor User"
            if "-" in token:
                name_part = token.split("-")[-1].capitalize()
                email = f"{name_part.lower()}@vcbrain.ai"
                name = f"{name_part} User"
            return {
                "id": f"mock-investor-id-{token}",
                "email": email,
                "user_metadata": {
                    "full_name": name,
                    "role": "analyst"
                }
            }
        else:
            raise HTTPException(
                status_code=401,
                detail="Invalid mock credentials. Use mock-admin-token or mock-investor-token."
            )

    # Standard Supabase verification
    async with httpx.AsyncClient() as client:
        headers = {
            "Authorization": f"Bearer {token}",
            "apikey": settings.supabase_service_role_key
        }
        try:
            # Call Supabase user retrieval endpoint
            url = f"{settings.supabase_url.rstrip('/')}/auth/v1/user"
            response = await client.get(url, headers=headers)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid or expired authentication session"
                )
            
            return response.json()
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=401,
                detail=f"Token verification failed: {str(e)}"
            )

async def get_current_investor_profile(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Retrieves the investor profile from the public.investors table.
    Falls back to mock profiles in development mode.
    """
    user_id = user.get("id")
    email = user.get("email")
    metadata = user.get("user_metadata", {})
    
    if not settings.supabase_url or not settings.supabase_service_role_key:
        # Dev fallback profile
        return {
            "id": user_id,
            "auth_user_id": user_id,
            "email": email,
            "full_name": metadata.get("full_name", "Mock User"),
            "role": metadata.get("role", "analyst"),
            "title": "Analyst" if metadata.get("role") != "admin" else "Administrator",
            "bio": "Mock investor profile for testing VC Brain offline.",
            "is_active": True
        }

    # Query Supabase DB for investor record
    try:
        if not supabase_client.enabled:
            raise HTTPException(status_code=500, detail="Supabase client not initialized")
        
        response = supabase_client._client.table("investors").select("*").eq("auth_user_id", user_id).execute()
        if not response.data:
            # If the user is authenticated in auth.users but has no profile row, 
            # we can create one as a safety net (e.g. if triggers were disabled or delayed)
            full_name = metadata.get("full_name") or metadata.get("name") or "New Investor"
            role = metadata.get("role") or "analyst"
            
            insert_data = {
                "auth_user_id": user_id,
                "email": email,
                "full_name": full_name,
                "role": role,
                "title": role.capitalize(),
                "is_active": True
            }
            
            new_profile = supabase_client._client.table("investors").insert(insert_data).execute()
            if not new_profile.data:
                raise HTTPException(status_code=404, detail="Investor profile could not be retrieved or created")
            return new_profile.data[0]
            
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database profile query failed: {str(e)}"
        )

async def require_admin(profile: Dict[str, Any] = Depends(get_current_investor_profile)) -> Dict[str, Any]:
    """
    Enforces that the authenticated user possesses an 'admin' role.
    """
    if profile.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access privileges required to perform this action"
        )
    return profile
