from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from dotenv import load_dotenv
import os
import firebase_admin
from firebase_admin import credentials
import json

if not firebase_admin._apps:
    if os.getenv("FIREBASE_CREDENTIALS_JSON"):
        cred_dict = json.loads(os.getenv("FIREBASE_CREDENTIALS_JSON"))
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
    elif os.path.exists("firebase-credentials.json"):
        cred = credentials.Certificate("firebase-credentials.json")
        firebase_admin.initialize_app(cred)
    else:
        print("Warning: Firebase credentials not found. Auth will fail.")

# Load environment variables from .env file (looks in current and parent dirs)
load_dotenv()

from services.lobby_manager import lobby_manager
from routers import lobbies, problems, results, general, users

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
app.include_router(users.router)