from fastapi import APIRouter, HTTPException, Depends
from models.schemas import AuthRequest, AuthResponse
from services.supabase_client import supabase

router = APIRouter()

@router.post("/verify", response_model=AuthResponse)
async def verify_token(req: AuthRequest):
    """
    Verifies a Supabase JWT token and returns user details.
    """
    if not supabase:
        # Mock successful auth if supabase isn't configured
        return AuthResponse(user_id="mock-id", email="admin@threathunt.local", role="admin")
        
    try:
        user = supabase.auth.get_user(req.token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        return AuthResponse(
            user_id=user.user.id,
            email=user.user.email,
            role=user.user.role or "user"
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))
