from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        decoded_token = auth.verify_id_token(token)
        return {
            "uid": decoded_token["uid"],
            "username": decoded_token.get("name", "User"),
            "email": decoded_token.get("email"),
            "avatar_url": decoded_token.get("picture")
        }
    
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="Invalid authentication credentials")