from fastapi import APIRouter, HTTPException, Depends
from services.redis_service import redis_service
from dependencies import get_current_user

router = APIRouter()

@router.get("/api/users/{username}")
def get_user_profile(username: str):
    if not redis_service.enabled:
        return {
            "username": username,
            "races_completed": 0,
            "avg_wpm": 0,
            "max_wpm": 0,
            "status": "unavailable"
        }

    stats = redis_service.get_user_stats(username)
    if not stats:
        return {
            "username": username,
            "races_completed": 0,
            "avg_wpm": 0,
            "max_wpm": 0,
            "status": "active"
        }
    
    return {
        "username": username,
        **stats,
        "status": "active"
    }

@router.get("/api/users/{username}/problems/{problem_id}")
def get_user_problem_performance(username: str, problem_id: str, language: str = "python"):
    if not redis_service.enabled:
        return {"found": False, "status": "unavailable"}

    stats = redis_service.get_user_problem_stats(problem_id, language, username)
    if not stats:
        return {"found": False, "status": "active"}
    
    return {
        "found": True,
        "status": "active",
        "username": username,
        "problemId": problem_id,
        "language": language,
        **stats
    }

@router.get("/api/users/me/stats")
def get_my_stats(user: dict = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return get_user_profile(user["username"])
