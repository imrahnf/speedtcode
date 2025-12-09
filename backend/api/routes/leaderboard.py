# imports
from fastapi import APIRouter

router = APIRouter(prefix="/api/leaderboard")

# /api/leaderboard/{id}
@router.get("/{id}")
def get_leaderboard(id: int):
    return f'fetching leaderboard {id} scores'

@router.post("/{id}")
def update_leaderboard(id: int):
    return f'updating scores to leaderboard {id}'