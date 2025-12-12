from fastapi import APIRouter, HTTPException, Depends
import random
from models.schemas import ResultSubmission
from models.problem_manager import problem_manager
from services.redis_service import redis_service
from dependencies import get_current_user

router = APIRouter()

# Mock leaderboard data
@router.get("/api/leaderboard/{problem_id}")
def get_leaderboard(problem_id: str, language: str, top: int = 10):
    # Fetch gloabal leaderboard from Redis
    if not redis_service.enabled:
        return {
            "problemId": problem_id,
            "language": language,
            "count": 0,
            "entries": [],
            "status": "unavailable"
        }

    entries = redis_service.get_leaderboard(problem_id, language, limit=top)
    
    return {
        "problemId": problem_id,
        "language": language,
        "count": len(entries),
        "entries": entries,
        "status": "active"
    }

# Submit typing results
@router.post("/api/results")
def submit_results(result: ResultSubmission, user: dict = Depends(get_current_user)):
    # 0. AUTH CHECK
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    else:
        username = user["username"]

    # 1. INTEGRITY CHECKS
    problem = problem_manager.get_problem_metadata(result.problemId)
    if not problem:
        raise HTTPException(status_code=400, detail=f"Problem {result.problemId} not found")
    
    if result.language not in problem["languages"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Language '{result.language}' not available"
        )
    
    # 2. MATCH CHECK
    target_code = problem_manager.get_problem_content(result.problemId, result.language)
    if not target_code:
         raise HTTPException(status_code=500, detail="Could not load problem content")

    expected_length = len(target_code)
    
    if result.rawLength != expected_length:
        raise HTTPException(
            status_code=400, 
            detail=f"Length mismatch: Server expects {expected_length}, got {result.rawLength}"
        )
    
    # 3. BOUNDARY CHECKS
    if not (0 <= result.accuracy <= 100):
        raise HTTPException(status_code=400, detail="Accuracy must be 0-100")

    # 4. ANTI-CHEAT / PHYSICS CHECK
    # World record typing is ~220 WPM - cap at 350 to be safe.
    if result.wpm > 350:
         raise HTTPException(status_code=400, detail="WPM exceeds human limitations.")

    minutes = result.timeMs / 60000
    if minutes <= 0:
        raise HTTPException(status_code=400, detail="Time cannot be 0")

    # This is the WPM if they typed perfectly with zero pauses
    calculated_wpm = (result.rawLength / 5) / minutes
    buffer = 1.2 

    if result.wpm > (calculated_wpm * buffer):
         raise HTTPException(
            status_code=400, 
            detail=f"Cheating detected: WPM {result.wpm} is impossible given time {result.timeMs}ms"
        )

    # Save to leaderboard
    # username is already set above based on auth status
    
    # Calculate Score: WPM * (Accuracy/100)^2
    # This penalizes low accuracy significantly.
    score = result.wpm * ((result.accuracy / 100.0) ** 2)

    redis_service.add_score(
        problem_id=result.problemId,
        language=result.language,
        username=username, 
        wpm=result.wpm,
        accuracy=result.accuracy,
        score=score
    )

    # Update User Profile Stats (Only for Singleplayer)
    if result.mode == "singleplayer":
        redis_service.update_user_stats(username, result.wpm, result.accuracy)

    rank = redis_service.get_user_rank(result.problemId, result.language, username)

    return {"status": "success", "rank" : rank}
