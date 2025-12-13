from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from dotenv import load_dotenv
import os
from pathlib import Path
import firebase_admin
from firebase_admin import credentials
import json

env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

if not firebase_admin._apps:
    root_cred_path = Path(__file__).resolve().parent.parent / "firebase-credentials.json"
    
    if root_cred_path.exists():
        print(f"Loading Firebase credentials from: {root_cred_path}")
        cred = credentials.Certificate(str(root_cred_path))
        firebase_admin.initialize_app(cred)

    elif os.getenv("FIREBASE_CREDENTIALS_JSON"):
        try:
            cred_dict = json.loads(os.getenv("FIREBASE_CREDENTIALS_JSON"))
            if "private_key" in cred_dict:
                cred_dict["private_key"] = cred_dict["private_key"].replace("\\n", "\n")
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
        except Exception as e:
            print(f"Error initializing Firebase from env: {e}")

    elif os.path.exists("firebase-credentials.json"):
        cred = credentials.Certificate("firebase-credentials.json")
        firebase_admin.initialize_app(cred)
    else:
        print("Warning: Firebase credentials not found. Auth will fail.")

from services.lobby_manager import lobby_manager
from routers import lobbies, problems, results, general, users

app = FastAPI()

allow_origins = [
    "http://localhost:3000",  # local dev
    "https://speedtcode-hx4o.vercel.app",  # vercel
    "https://speedtcode.dev" ,  # old domain  
    "https://www.speedtcode.dev", # production
    "http://192.168.0.109:3000" # local network testing
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
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