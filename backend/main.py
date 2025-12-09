from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import random

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
        "content": """class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        prevMap = {}  # val : index
        for i, n in enumerate(nums):
            diff = target - n
            if diff in prevMap:
                return [prevMap[diff], i]
            prevMap[n] = i
        return []"""
    },
    "2": {
        "id": "2",
        "title": "Contains Duplicate",
        "difficulty": "Easy",
        "content": """class Solution:
    def containsDuplicate(self, nums: List[int]) -> bool:
        hashset = set()
        for n in nums:
            if n in hashset:
                return True
            hashset.add(n)
        return False"""
    }
}

# Data Models
class ScoreSubmission(BaseModel):
    wpm: int
    accuracy: float
    timeMs: int
    problemId: str
    keystrokeLog: List[dict]

@app.get("/")
def read_root():
    return {"status": "active", "message": "Speed(t)Code API is running"}

@app.get("/api/problems")
def get_problems():
    # Return a list of summaries
    return [
        {"id": k, "title": v["title"], "difficulty": v["difficulty"]} 
        for k, v in PROBLEMS_DB.items()
    ]

@app.get("/api/problems/{problem_id}")
def get_problem(problem_id: str):
    problem = PROBLEMS_DB.get(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem

@app.post("/api/leaderbard/submit")
def submit_score(submission: ScoreSubmission):
    print(f"New Score: {submission.wpm} WPM on Problem {submission.problemId}")
    
    # Return a mock rank for now
    return {
        "status": "success", 
        "rank": random.randint(1, 100), 
        "percentile": random.randint(50, 99)
    }
