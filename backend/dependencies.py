from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        decoded_token = auth.verify_id_token(token)
        
        # Try to get GitHub username first
        username = None
        firebase_claims = decoded_token.get("firebase", {})
        identities = firebase_claims.get("identities", {})
        
        # If signed in with GitHub, use that username (it's often in the email field or we can try to parse it)
        # Note: Firebase doesn't always expose the raw GitHub username directly in the top level token.
        # But often the 'name' field is the GitHub display name.
        
        # Strategy:
        # 1. Use 'name' (Display Name)
        # 2. Use email prefix
        
        # If you specifically want the GitHub handle (e.g. 'imrahnf'), it is NOT guaranteed to be in the token
        # unless you sync it to a custom claim or if it happens to be the display name.
        # However, for many users, the display name IS the best identifier we have.
        
        # Let's try to be smarter:
        username = decoded_token.get("name")
        
        # If we really want the handle and it's not in 'name', we might need to look at the email
        # if the email is like 'handle@users.noreply.github.com'
        email = decoded_token.get("email", "")
        if email and "users.noreply.github.com" in email:
             # Extract handle from 123456+handle@users.noreply.github.com
             parts = email.split("@")[0].split("+")
             if len(parts) > 1:
                 username = parts[-1]
             else:
                 username = parts[0]

        if not username:
             username = decoded_token.get("name")

        if not username:
            if email:
                username = email.split("@")[0]
            else:
                username = "User"

        return {
            "uid": decoded_token["uid"],
            "username": username,
            "email": decoded_token.get("email"),
            "avatar_url": decoded_token.get("picture")
        }
    
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="Invalid authentication credentials")