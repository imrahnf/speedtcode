from pydantic import BaseModel
from typing import List

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
    mode: str = "singleplayer"

class LobbyCreate(BaseModel):
    hostId: str
    problemId: str
    language: str
