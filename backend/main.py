from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import random
import uuid
import asyncio
import time
from datetime import datetime

# TODO: decouple validation, submission, db, models
# TODO: add db, auth, cache

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- LOBBY MANAGER ---
class LobbyManager:
    def __init__(self):
        self.lobbies: Dict[str, dict] = {}

    def create_lobby(self, host_id: str, problem_id: str, language: str):
        lobby_id = str(uuid.uuid4())[:6].upper()
        self.lobbies[lobby_id] = {
            "id": lobby_id,
            "host_id": host_id,
            "problem_id": problem_id,
            "language": language,
            "status": "waiting", # waiting, racing, finished
            "participants": {}, # {user_id: {username, ready, progress, wpm, rank}}
            "connections": {}, # {user_id: websocket}
            "history": [], # List of past match results
            "round_number": 1,
            "created_at": datetime.now(),
            "last_activity": datetime.now(),
            "host_left_at": None
        }
        return lobby_id

    async def connect(self, websocket: WebSocket, lobby_id: str, user_id: str, username: str):
        await websocket.accept()
        lobby = self.lobbies.get(lobby_id)
        if not lobby:
            await websocket.close(code=4000, reason="Lobby not found")
            return

        lobby["connections"][user_id] = websocket
        lobby["last_activity"] = datetime.now()
        
        if user_id == lobby["host_id"]:
            lobby["host_left_at"] = None

        # Always update username if they rejoin or join
        if user_id not in lobby["participants"]:
            lobby["participants"][user_id] = {
                "username": username,
                "ready": False,
                "progress": 0,
                "wpm": 0,
                "rank": None,
                "finished": False,
                "connected": True,
                "last_seen": datetime.now()
            }
        else:
            # Update username just in case
            lobby["participants"][user_id]["username"] = username
            lobby["participants"][user_id]["connected"] = True
            lobby["participants"][user_id]["last_seen"] = datetime.now()
        
        await self.broadcast_state(lobby_id)

    async def disconnect(self, lobby_id: str, user_id: str):
        lobby = self.lobbies.get(lobby_id)
        if not lobby: return

        if user_id in lobby["connections"]:
            del lobby["connections"][user_id]

        # If host leaves, DO NOT close the lobby immediately. 
        # Just mark as disconnected so they can reconnect.
        if user_id == lobby["host_id"]:
            print(f"Host {user_id} disconnected from lobby {lobby_id}.")
            lobby["host_left_at"] = datetime.now()
            if user_id in lobby["participants"]:
                lobby["participants"][user_id]["connected"] = False
            await self.broadcast_state(lobby_id)
            return

        # If normal user leaves
        if lobby["status"] == "waiting":
            if user_id in lobby["participants"]:
                del lobby["participants"][user_id]
        else:
            # If racing or finished, mark as disconnected
            if user_id in lobby["participants"]:
                lobby["participants"][user_id]["connected"] = False
        
        # Always broadcast state after a disconnect (unless lobby is gone)
        await self.broadcast_state(lobby_id)

    async def broadcast_state(self, lobby_id: str):
        lobby = self.lobbies.get(lobby_id)
        if not lobby: return

        # Helper to serialize datetime objects
        def serialize_participant(uid, p):
            data = p.copy()
            data["id"] = uid
            if "last_seen" in data and isinstance(data["last_seen"], datetime):
                data["last_seen"] = data["last_seen"].isoformat()
            return data

        state = {
            "type": "STATE_UPDATE",
            "status": lobby["status"],
            "participants": [
                serialize_participant(uid, p) for uid, p in lobby["participants"].items()
            ],
            "problemId": lobby["problem_id"],
            "language": lobby["language"],
            "history": lobby["history"],
            "roundNumber": lobby["round_number"],
            "start_time": lobby.get("start_time")
        }
        
        to_remove = []
        # Create a copy of items to avoid "dictionary changed size during iteration"
        for uid, ws in list(lobby["connections"].items()):
            try:
                await ws.send_json(state)
            except:
                to_remove.append(uid)
        
        for uid in to_remove:
            await self.disconnect(lobby_id, uid)

    async def start_race(self, lobby_id: str, user_id: str):
        lobby = self.lobbies.get(lobby_id)
        if lobby and lobby["host_id"] == user_id and lobby["status"] == "waiting":
            # Start countdown
            lobby["status"] = "starting"
            lobby["start_time"] = int(time.time() * 1000) + 3000 # 3 seconds from now
            await self.broadcast_state(lobby_id)
            
            asyncio.create_task(self._run_countdown(lobby_id))

    async def _run_countdown(self, lobby_id: str):
        await asyncio.sleep(3)
        lobby = self.lobbies.get(lobby_id)
        if lobby and lobby["status"] == "starting":
            lobby["status"] = "racing"
            lobby["start_time"] = int(time.time() * 1000)
            await self.broadcast_state(lobby_id)

    async def kick_participant(self, lobby_id: str, host_id: str, target_user_id: str):
        lobby = self.lobbies.get(lobby_id)
        if not lobby or lobby["host_id"] != host_id: return
        
        if target_user_id in lobby["participants"]:
            # Close connection if active
            if target_user_id in lobby["connections"]:
                ws = lobby["connections"][target_user_id]
                try:
                    await ws.send_json({"type": "KICKED"})
                    await ws.close()
                except:
                    pass
                del lobby["connections"][target_user_id]
            
            # Remove from participants
            del lobby["participants"][target_user_id]
            await self.broadcast_state(lobby_id)

    async def force_end_race(self, lobby_id: str, user_id: str):
        lobby = self.lobbies.get(lobby_id)
        if lobby and lobby["host_id"] == user_id and lobby["status"] == "racing":
            # Force finish for everyone who hasn't finished
            for uid, p in lobby["participants"].items():
                if not p["finished"]:
                    p["finished"] = True
                    # Keep existing stats or set to 0/DNF if needed
            
            await self.broadcast_state(lobby_id)

    async def update_settings(self, lobby_id: str, user_id: str, problem_id: str, language: str):
        lobby = self.lobbies.get(lobby_id)
        if lobby and lobby["host_id"] == user_id and lobby["status"] == "waiting":
            if problem_id:
                lobby["problem_id"] = problem_id
            if language:
                lobby["language"] = language
            await self.broadcast_state(lobby_id)

    async def update_progress(self, lobby_id: str, user_id: str, progress: int, wpm: int):
        lobby = self.lobbies.get(lobby_id)
        if lobby and lobby["status"] == "racing":
            p = lobby["participants"].get(user_id)
            if p:
                p["progress"] = progress
                p["wpm"] = wpm
                await self.broadcast_state(lobby_id)

    async def finish_race(self, lobby_id: str, user_id: str, stats: dict):
        lobby = self.lobbies.get(lobby_id)
        if lobby and lobby["status"] == "racing":
            p = lobby["participants"].get(user_id)
            if p and not p["finished"]:
                # Enforce minimum accuracy to finish (e.g., 80%)
                # This prevents button mashers from "winning" with 9% accuracy
                if stats.get("accuracy", 0) < 80:
                    return # Ignore finish request if accuracy is too low

                p["finished"] = True
                p["wpm"] = stats["wpm"]
                p["accuracy"] = stats["accuracy"]
                p["timeMs"] = stats["timeMs"]
                
                # Calculate rank
                finished_count = sum(1 for u in lobby["participants"].values() if u["finished"])
                p["rank"] = finished_count
                
                await self.broadcast_state(lobby_id)

    async def reset_round(self, lobby_id: str, user_id: str, new_problem_id: str = None, new_language: str = None):
        lobby = self.lobbies.get(lobby_id)
        if not lobby or lobby["host_id"] != user_id: return

        # Archive current results
        results = []
        for uid, p in lobby["participants"].items():
            if p["finished"]:
                results.append({
                    "username": p["username"],
                    "rank": p["rank"],
                    "wpm": p["wpm"],
                    "accuracy": p.get("accuracy", 0),
                    "timeMs": p.get("timeMs", 0)
                })
        
        # Sort by rank
        results.sort(key=lambda x: x["rank"] if x["rank"] else 999)

        # Get problem title
        problem_title = "Unknown Problem"
        if lobby["problem_id"] in PROBLEMS_DB:
            problem_title = PROBLEMS_DB[lobby["problem_id"]]["title"]

        lobby["history"].append({
            "round": lobby["round_number"],
            "problemId": lobby["problem_id"],
            "problemTitle": problem_title,
            "language": lobby["language"],
            "results": results,
            "timestamp": datetime.now().isoformat()
        })

        # Reset for next round
        lobby["round_number"] += 1
        lobby["status"] = "waiting"
        
        if new_problem_id:
            lobby["problem_id"] = new_problem_id
        if new_language:
            lobby["language"] = new_language

        for uid, p in lobby["participants"].items():
            p["ready"] = False
            p["progress"] = 0
            p["wpm"] = 0
            p["rank"] = None
            p["finished"] = False
            # Keep 'connected' status as is

        await self.broadcast_state(lobby_id)

    async def cleanup_inactive(self):
        while True:
            await asyncio.sleep(60) # Check every minute
            now = datetime.now()
            lobbies_to_remove = []
            
            for lobby_id, lobby in list(self.lobbies.items()):
                # 1. Check Lobby Inactivity
                if (now - lobby["last_activity"]).total_seconds() > 300: # 5 mins
                    print(f"Lobby {lobby_id} inactive for > 5 mins. Closing.")
                    lobbies_to_remove.append(lobby_id)
                    continue
                
                # 2. Check Host Disconnect
                if lobby["host_left_at"] and (now - lobby["host_left_at"]).total_seconds() > 60: # 1 min grace
                    print(f"Host of lobby {lobby_id} disconnected for > 1 min. Closing.")
                    lobbies_to_remove.append(lobby_id)
                    continue

                # 3. Check Participant Inactivity
                participants_to_kick = []
                for uid, p in lobby["participants"].items():
                    # If connected but no activity (no PINGs) for 5 mins
                    if p.get("last_seen") and (now - p["last_seen"]).total_seconds() > 300:
                        participants_to_kick.append(uid)
                
                for uid in participants_to_kick:
                    print(f"User {uid} inactive for > 5 mins. Kicking.")
                    await self.kick_participant(lobby_id, lobby["host_id"], uid)
            
            for lobby_id in lobbies_to_remove:
                # Close all connections
                lobby = self.lobbies[lobby_id]
                for ws in lobby["connections"].values():
                    try:
                        await ws.close(code=4000, reason="Lobby closed due to inactivity")
                    except:
                        pass
                del self.lobbies[lobby_id]

lobby_manager = LobbyManager()

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(lobby_manager.cleanup_inactive())

# placeholder
PROBLEMS_DB = {
    "1": {
        "id": "1",
        "title": "Two Sum",
        "difficulty": "Easy",
        "languages": ["python", "javascript", "cpp"],
        "content": {
            "python": """class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        prevMap = {}  # val : index
        for i, n in enumerate(nums):
            diff = target - n
            if diff in prevMap:
                return [prevMap[diff], i]
            prevMap[n] = i
        return []""",
            "javascript": """class Solution {
    twoSum(nums, target) {
        const prevMap = {};
        for (let i = 0; i < nums.length; i++) {
            const diff = target - nums[i];
            if (diff in prevMap) {
                return [prevMap[diff], i];
            }
            prevMap[nums[i]] = i;
        }
        return [];
    }
}""",
            "cpp": """class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> prevMap;
        for (int i = 0; i < nums.size(); i++) {
            int diff = target - nums[i];
            if (prevMap.find(diff) != prevMap.end()) {
                return {prevMap[diff], i};
            }
            prevMap[nums[i]] = i;
        }
        return {};
    }
};"""
        }
    },
    "2": {
        "id": "2",
        "title": "Contains Duplicate",
        "difficulty": "Easy",
        "languages": ["python"],
        "content": {
            "python": """class Solution:
    def containsDuplicate(self, nums: List[int]) -> bool:
        hashset = set()
        for n in nums:
            if n in hashset:
                return True
            hashset.add(n)
        return False"""
        }
    },
    "3": {
        "id": "3",
        "title": "test",
        "difficulty": "Easy",
        "languages": ["javascript", "cpp"],
        "content": {
            "javascript": """function test() {
    return false;
}""",
            "cpp": """bool test() {
    return false;
}"""
        }
    }
}

# Data Models
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

class LobbyCreate(BaseModel):
    hostId: str
    problemId: str
    language: str

# health check
@app.get("/")
def read_root():
    return {"status": "active", "message": "Speed(t)Code API is running"}

# --- LOBBY ENDPOINTS ---

@app.post("/api/lobbies")
def create_lobby(data: LobbyCreate):
    if data.problemId not in PROBLEMS_DB:
        raise HTTPException(400, "Invalid problem ID")
    
    lobby_id = lobby_manager.create_lobby(data.hostId, data.problemId, data.language)
    return {"lobbyId": lobby_id}

@app.get("/api/lobbies/{lobby_id}")
def get_lobby(lobby_id: str):
    lobby = lobby_manager.lobbies.get(lobby_id)
    if not lobby:
        raise HTTPException(404, "Lobby not found")
    
    # Return public info
    return {
        "id": lobby["id"],
        "hostId": lobby["host_id"],
        "problemId": lobby["problem_id"],
        "language": lobby["language"],
        "status": lobby["status"],
        "participants": len(lobby["participants"])
    }

# Lobby manager
@app.websocket("/ws/lobby/{lobby_id}/{user_id}/{username}")
async def websocket_endpoint(websocket: WebSocket, lobby_id: str, user_id: str, username: str):
    await lobby_manager.connect(websocket, lobby_id, user_id, username)
    try:
        while True:
            data = await websocket.receive_json()
            
            # Update activity
            lobby = lobby_manager.lobbies.get(lobby_id)
            if lobby:
                lobby["last_activity"] = datetime.now()
                if user_id in lobby["participants"]:
                    lobby["participants"][user_id]["last_seen"] = datetime.now()

            if data["type"] == "PING":
                pass # Keep-alive

            elif data["type"] == "START_RACE":
                await lobby_manager.start_race(lobby_id, user_id)
            
            elif data["type"] == "UPDATE_PROGRESS":
                await lobby_manager.update_progress(lobby_id, user_id, data["progress"], data["wpm"])
            
            elif data["type"] == "FINISH_RACE":
                await lobby_manager.finish_race(lobby_id, user_id, data["stats"])

            elif data["type"] == "RESET_ROUND":
                await lobby_manager.reset_round(
                    lobby_id, 
                    user_id, 
                    data.get("problemId"), 
                    data.get("language")
                )

            elif data["type"] == "UPDATE_SETTINGS":
                await lobby_manager.update_settings(
                    lobby_id,
                    user_id,
                    data.get("problemId"),
                    data.get("language")
                )

            elif data["type"] == "FORCE_END":
                await lobby_manager.force_end_race(lobby_id, user_id)

            elif data["type"] == "KICK_PARTICIPANT":
                await lobby_manager.kick_participant(lobby_id, user_id, data["targetId"])
                
    except WebSocketDisconnect:
        await lobby_manager.disconnect(lobby_id, user_id)

# summary of all problems (not yet used)
@app.get("/api/problems")
def get_problems():
    # Return a list of summaries
    return [
        {"id": k, "title": v["title"], "difficulty": v["difficulty"], "languages": v["languages"]} 
        for k, v in PROBLEMS_DB.items()
    ]

# get full problem data (title, languages, and code variants)
@app.get("/api/problems/{problem_id}")
def get_problem(problem_id: str):
    problem = PROBLEMS_DB.get(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem

# get leaderboard for a problem (for each problem and language with top n submissions)
@app.get("/api/leaderboard/{problem_id}")
def get_leaderboard(problem_id: str, language: str, top: int = 10):

    return {
        "problemId": "problem_id",
        "language": "lang",
        "count": "count",
        "entries": "entries",
    }

# submit game results with validation
@app.post("/api/results")
def submit_results(result: ResultSubmission):
    # 1. INTEGRITY CHECKS (Does the problem exist?)
    problem = PROBLEMS_DB.get(result.problemId)
    if not problem:
        raise HTTPException(status_code=400, detail=f"Problem {result.problemId} not found")
    
    if result.language not in problem["languages"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Language '{result.language}' not available"
        )
    
    # 2. MATCH CHECK (Did they type the whole thing?)
    # We rely on rawLength to ensure they didn't just type 5 chars and hit submit.
    target_code = problem["content"][result.language]
    expected_length = len(target_code)
    
    if result.rawLength != expected_length:
        raise HTTPException(
            status_code=400, 
            detail=f"Length mismatch: Server expects {expected_length}, got {result.rawLength}"
        )
    
    # 3. BOUNDARY CHECKS (Are numbers within data limits?)
    # Relaxed lower bounds. 0 accuracy is valid (just terrible).
    if not (0 <= result.accuracy <= 100):
        raise HTTPException(status_code=400, detail="Accuracy must be 0-100")

    # 4. ANTI-CHEAT / PHYSICS CHECK
    # We only block SUPERHUMAN speeds. 
    # World record typing is ~220 WPM. Let's cap at 350 to be safe.
    if result.wpm > 350:
         raise HTTPException(status_code=400, detail="WPM exceeds human limitations.")

    # 5. CONSISTENCY CHECK (The 'Magic' Formula)
    # WPM = (Chars / 5) / (Time_Minutes)
    # We calculate the THEORETICAL MAX WPM for the time they submitted.
    # If their submitted WPM is significantly HIGHER than what is mathematically 
    # possible given the time they took, they are lying.
    
    # Example: They claim 100 WPM but timeMs was 10 seconds for 1000 chars.
    
    minutes = result.timeMs / 60000
    if minutes <= 0:
        raise HTTPException(status_code=400, detail="Time cannot be 0")

    # This is the WPM if they typed perfectly with zero pauses
    calculated_wpm = (result.rawLength / 5) / minutes
    
    # Buffer allows for network latency or slight calc diffs in frontend
    # We allow Submitted WPM to be at most 10% higher than Calculated WPM
    # (It's usually lower because of backspaces/pauses)
    buffer = 1.2 

    if result.wpm > (calculated_wpm * buffer):
         raise HTTPException(
            status_code=400, 
            detail=f"Cheating detected: WPM {result.wpm} is impossible given time {result.timeMs}ms"
        )

    # --- SUCCESS ---
    
    # Calculate rank (Mock logic)
    user_rank = random.randint(1, 100) 

    return {
        "status": "ok",
        "rank": user_rank,
        "received": result.dict()
    }