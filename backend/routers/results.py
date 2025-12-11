from fastapi import APIRouter, HTTPException
import random
from models.schemas import ResultSubmission
from models.problem_manager import problem_manager

router = APIRouter()

# Mock leaderboard data
@router.get("/api/leaderboard/{problem_id}")
def get_leaderboard(problem_id: str, language: str, top: int = 10):

    return {
        "problemId": "problem_id",
        "language": "lang",
        "count": "count",
        "entries": "entries",
    }

# Submit typing results
@router.post("/api/results")
def submit_results(result: ResultSubmission):
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

    # 5. CONSISTENCY CHECK (The 'Magic' Formula)
    # WPM = (Chars / 5) / (Time_Minutes)
    # We calculate the THEORETICAL MAX WPM for the time they submitted.
    # Example: They claim 100 WPM but timeMs was 10 seconds for 1000 chars.
    
    minutes = result.timeMs / 60000
    if minutes <= 0:
        raise HTTPException(status_code=400, detail="Time cannot be 0")

    # This is the WPM if they typed perfectly with zero pauses
    calculated_wpm = (result.rawLength / 5) / minutes
    
    # Buffer allows for network latency or slight calc diffs in frontend
    # We allow Submitted WPM to be at most 10% higher than Calculated WPM
    # (It's usually lower because of backspaces/pauses)
    buffer = 1.2 

    if result.wpm > (calculated_wpm * buffer):
         raise HTTPException(
            status_code=400, 
            detail=f"Cheating detected: WPM {result.wpm} is impossible given time {result.timeMs}ms"
        )

    # --- SUCCESS ---
    
    # Calculate rank (Mock logic)
    user_rank = random.randint(1, 100) 

    return {
        "status": "ok",
        "rank": user_rank,
        "received": result.dict()
    }
