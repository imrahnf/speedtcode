from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from dotenv import load_dotenv
import os

# Load environment variables from .env file (looks in current and parent dirs)
load_dotenv()

from services.lobby_manager import lobby_manager
from routers import lobbies, problems, results, general

app = FastAPI()

# Edit Later: restrict origins in prod
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(lobby_manager.cleanup_inactive())

# Endpoint Routers
app.include_router(general.router)
app.include_router(lobbies.router)
app.include_router(problems.router)
app.include_router(results.router)