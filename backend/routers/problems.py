from fastapi import APIRouter, HTTPException
from models.problem_manager import problem_manager

router = APIRouter()

@router.get("/api/problems")
def get_problems():
    return problem_manager.get_all_problems()

@router.get("/api/problems/{problem_id}")
def get_problem(problem_id: str):
    meta = problem_manager.get_problem_metadata(problem_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    content_map = {}
    for lang in meta["languages"]:
        code = problem_manager.get_problem_content(problem_id, lang)
        if code:
            content_map[lang] = code
            
    return {
        **meta,
        "content": content_map
    }

@router.get("/api/problems/{problem_id}/content/{language}")
def get_problem_content(problem_id: str, language: str):
    content = problem_manager.get_problem_content(problem_id, language)
    if not content:
        raise HTTPException(404, "Content not found")
    return {"content": content}
