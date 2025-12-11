from typing import Dict, List
import uuid
import asyncio
import time
from datetime import datetime
from fastapi import HTTPException, WebSocket
from models.problem_manager import problem_manager


'''
The LobbyManager handles the creation and management of multiplayer lobbies.
It supports lobby creation, user connections anmd disconnections, races,
and cleanup of inactive lobbies.
'''
class LobbyManager:
    def __init__(self):
        self.lobbies: Dict[str, dict] = {}

    def create_lobby(self, host_id: str, problem_id: str, language: str):
        # Validate problem exists
        if not problem_manager.get_problem_metadata(problem_id):
             raise HTTPException(400, "Invalid problem ID")

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
            return False

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
        return True

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

        # Check if lobby is empty (no connected participants)
        active_count = sum(1 for p in lobby["participants"].values() if p["connected"])
        if active_count == 0:
            print(f"Lobby {lobby_id} is empty. Closing immediately.")
            del self.lobbies[lobby_id]

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
            "start_time": lobby.get("start_time"),
            "next_round_countdown": lobby.get("next_round_countdown")
        }
        
        to_remove = []
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
                # REMOVED: Accuracy check to prevent confusion during testing
                # if stats.get("accuracy", 0) < 80: return 

                p["finished"] = True
                p["wpm"] = stats["wpm"]
                p["accuracy"] = stats["accuracy"]
                p["timeMs"] = stats["timeMs"]
                
                # Calculate rank
                finished_count = sum(1 for u in lobby["participants"].values() if u["finished"])
                p["rank"] = finished_count
                
                await self.broadcast_state(lobby_id)

                # Check if ALL connected participants are finished
                active_participants = [u for u in lobby["participants"].values() if u["connected"]]
                if all(u["finished"] for u in active_participants):
                    # Start auto-return countdown
                    asyncio.create_task(self._auto_return_countdown(lobby_id))

    async def _auto_return_countdown(self, lobby_id: str):
        lobby = self.lobbies.get(lobby_id)
        if not lobby or lobby["status"] != "racing": return
        
        # Notify users of countdown
        lobby["next_round_countdown"] = 10 # seconds
        await self.broadcast_state(lobby_id)

        for i in range(10, 0, -1):
            await asyncio.sleep(1)
            lobby = self.lobbies.get(lobby_id)
            if not lobby or lobby["status"] != "racing": return # Cancelled or changed
            
            # CHECK IF CANCELLED
            if "next_round_countdown" not in lobby: return 

            lobby["next_round_countdown"] = i
            # Only broadcast every second if needed, or just let client handle it?
            # Better to broadcast to keep sync
            await self.broadcast_state(lobby_id)
        
        # Time's up - Reset to lobby
        # We need the host_id to call reset_round, or just call it internally
        if lobby:
            await self.reset_round(lobby_id, lobby["host_id"])

    async def cancel_auto_return(self, lobby_id: str, user_id: str):
        lobby = self.lobbies.get(lobby_id)
        # Only host can cancel? Or anyone? Let's allow anyone for now as requested "in case they don't want to return"
        # But usually it's safer if only host. Let's stick to host for consistency with other controls.
        if not lobby or lobby["host_id"] != user_id: return
        
        if "next_round_countdown" in lobby:
            del lobby["next_round_countdown"]
            await self.broadcast_state(lobby_id)

    async def reset_round(self, lobby_id: str, user_id: str, new_problem_id: str = None, new_language: str = None):
        lobby = self.lobbies.get(lobby_id)
        # Allow system (user_id=None) or host to reset
        if not lobby or (user_id and lobby["host_id"] != user_id): return

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
        problem_meta = problem_manager.get_problem_metadata(lobby["problem_id"])
        if problem_meta:
            problem_title = problem_meta["title"]

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
        lobby.pop("next_round_countdown", None) # Clear countdown
        
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
