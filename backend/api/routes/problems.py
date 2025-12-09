# imports
from fastapi import APIRouter

router = APIRouter(prefix="/api/problems")

# /api/problems/
@router.get("/")
def problems():
    return 'hit problems endpoint'

# /api/problems/{id}
@router.get("/{id}")
def get_problem(id: int):
    return f'fetching problem with id: {id}'