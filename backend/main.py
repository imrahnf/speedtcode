from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import random

# TODO: decouple validation, submission, db, models
# TODO: add db, auth, cache

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://192.168.0.100:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# placeholder
PROBLEMS_DB = {
    "1": {
        "id": "1",
        "title": "Two Sum",
        "difficulty": "Easy",
        "languages": ["python", "javascript", "cpp"],
        "content": {
            "python": """class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        prevMap = {}  # val : index
        for i, n in enumerate(nums):
            diff = target - n
            if diff in prevMap:
                return [prevMap[diff], i]
            prevMap[n] = i
        return []""",
            "javascript": """class Solution {
    twoSum(nums, target) {
        const prevMap = {};
        for (let i = 0; i < nums.length; i++) {
            const diff = target - nums[i];
            if (diff in prevMap) {
                return [prevMap[diff], i];
            }
            prevMap[nums[i]] = i;
        }
        return [];
    }
}""",
            "cpp": """class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> prevMap;
        for (int i = 0; i < nums.size(); i++) {
            int diff = target - nums[i];
            if (prevMap.find(diff) != prevMap.end()) {
                return {prevMap[diff], i};
            }
            prevMap[nums[i]] = i;
        }
        return {};
    }
};"""
        }
    },
    "2": {
        "id": "2",
        "title": "Contains Duplicate",
        "difficulty": "Easy",
        "languages": ["python"],
        "content": {
            "python": """class Solution:
    def containsDuplicate(self, nums: List[int]) -> bool:
        hashset = set()
        for n in nums:
            if n in hashset:
                return True
            hashset.add(n)
        return False"""
        }
    },
    "3": {
        "id": "3",
        "title": "test",
        "difficulty": "Easy",
        "languages": ["javascript", "cpp"],
        "content": {
            "javascript": """function test() {
    return false;
}""",
            "cpp": """bool test() {
    return false;
}"""
        }
    }
}

# Data Models
class ScoreSubmission(BaseModel):
    wpm: int
    accuracy: float
    timeMs: int
    problemId: str
    keystrokeLog: List[dict]

class ResultSubmission(BaseModel):
    wpm: int
    accuracy: float
    timeMs: int
    problemId: str
    rawLength: int
    language: str

# health check
@app.get("/")
def read_root():
    return {"status": "active", "message": "Speed(t)Code API is running"}

# summary of all problems (not yet used)
@app.get("/api/problems")
def get_problems():
    # Return a list of summaries
    return [
        {"id": k, "title": v["title"], "difficulty": v["difficulty"], "languages": v["languages"]} 
        for k, v in PROBLEMS_DB.items()
    ]

# get full problem data (title, languages, and code variants)
@app.get("/api/problems/{problem_id}")
def get_problem(problem_id: str):
    problem = PROBLEMS_DB.get(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem

# get leaderboard for a problem (for each problem and language with top n submissions)
@app.get("/api/leaderboard/{problem_id}")
def get_leaderboard(problem_id: str, language: str, top: int = 10):

    return {
        "problemId": "problem_id",
        "language": "lang",
        "count": "count",
        "entries": "entries",
    }

# submit game results with validation
@app.post("/api/results")
def submit_results(result: ResultSubmission):
    # 1. INTEGRITY CHECKS (Does the problem exist?)
    problem = PROBLEMS_DB.get(result.problemId)
    if not problem:
        raise HTTPException(status_code=400, detail=f"Problem {result.problemId} not found")
    
    if result.language not in problem["languages"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Language '{result.language}' not available"
        )
    
    # 2. MATCH CHECK (Did they type the whole thing?)
    # We rely on rawLength to ensure they didn't just type 5 chars and hit submit.
    target_code = problem["content"][result.language]
    expected_length = len(target_code)
    
    if result.rawLength != expected_length:
        raise HTTPException(
            status_code=400, 
            detail=f"Length mismatch: Server expects {expected_length}, got {result.rawLength}"
        )
    
    # 3. BOUNDARY CHECKS (Are numbers within data limits?)
    # Relaxed lower bounds. 0 accuracy is valid (just terrible).
    if not (0 <= result.accuracy <= 100):
        raise HTTPException(status_code=400, detail="Accuracy must be 0-100")

    # 4. ANTI-CHEAT / PHYSICS CHECK
    # We only block SUPERHUMAN speeds. 
    # World record typing is ~220 WPM. Let's cap at 350 to be safe.
    if result.wpm > 350:
         raise HTTPException(status_code=400, detail="WPM exceeds human limitations.")

    # 5. CONSISTENCY CHECK (The 'Magic' Formula)
    # WPM = (Chars / 5) / (Time_Minutes)
    # We calculate the THEORETICAL MAX WPM for the time they submitted.
    # If their submitted WPM is significantly HIGHER than what is mathematically 
    # possible given the time they took, they are lying.
    
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