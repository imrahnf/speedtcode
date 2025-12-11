from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def read_root():
    return {"status": "active", "message": "Speed(t)Code API is running"}

@router.get("/healthz")
async def health_check():
    return {"status": "ok"}