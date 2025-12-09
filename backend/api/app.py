# imports
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes.problems import router as problems_router
from backend.api.routes.leaderboard import router as leaderboard_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:3000/'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],

)

# routes
app.include_router(problems_router, tags=["problems"])
app.include_router(leaderboard_router, tags=["leaderboard"])

@app.get("/")
def health_check():
    return 'Hello world'