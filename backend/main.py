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
    # ========== SERVER-SIDE VALIDATION ==========
    
    # validate problem exists
    problem = PROBLEMS_DB.get(result.problemId)
    if not problem:
        raise HTTPException(status_code=400, detail=f"Problem {result.problemId} not found")
    
    # validate language is available for this problem
    if result.language not in problem["languages"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Language '{result.language}' not available for problem {result.problemId}"
        )
    
    # validate rawLength matches the target code length
    target_code = problem["content"][result.language]
    expected_length = len(target_code)
    if result.rawLength != expected_length:
        raise HTTPException(
            status_code=400, 
            detail=f"Code length mismatch: expected {expected_length}, got {result.rawLength}"
        )
    
    # validate accuracy is between 0 and 100
    if not (0 <= result.accuracy <= 100):
        raise HTTPException(status_code=400, detail="Accuracy must be between 0 and 100")
    
    # validate WPM is reasonable (sanity check)
    # WPM formula: (characters / 5) / (minutes)
    # Minimum realistic: 1 WPM, Maximum realistic: 300 WPM
    if not (1 <= result.wpm <= 300):
        raise HTTPException(status_code=400, detail=f"WPM {result.wpm} is unrealistic (expected 1-300)")
    
    # validate time is reasonable
    # For rawLength characters at claimed WPM: timeMs = (rawLength / 5) / (wpm / 60000)
    expected_time_ms = (result.rawLength / 5) / (result.wpm / 60000)
    time_tolerance = 0.3  # Allow 30% variance for network/UI delays
    
    if result.timeMs < expected_time_ms * (1 - time_tolerance):
        raise HTTPException(
            status_code=400, 
            detail=f"Time mismatch: expected ~{int(expected_time_ms)}ms at {result.wpm} WPM, got {result.timeMs}ms. "
                   f"This suggests either: (1) accuracy is too low, or (2) you typed much fewer characters than submitted."
        )
    
    # VALIDATION PASSED
    print(
        f"✓ Valid submission: {result.wpm} WPM on {problem['title']} ({result.language}), "
        f"Accuracy: {result.accuracy}%, Time: {result.timeMs}ms"
    )

    # calculate submission's rank in the leaderboard
    user_rank = random.randint(1, 100) # offload to service soon

    return {
        "status": "ok",
        "message": "Result validated and queued for storage",
        "received": {
            "wpm": result.wpm,
            "accuracy": result.accuracy,
            "timeMs": result.timeMs,
            "problemId": result.problemId,
            "rawLength": result.rawLength,
            "language": result.language,
        },
        "rank" : user_rank
    }
