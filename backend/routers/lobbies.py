from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from datetime import datetime
from models.schemas import LobbyCreate
from services.lobby_manager import lobby_manager
from models.problem_manager import problem_manager

router = APIRouter()

# Create a new lobby
@router.post("/api/lobbies")
def create_lobby(data: LobbyCreate):
    if not problem_manager.get_problem_metadata(data.problemId):
        raise HTTPException(400, "Invalid problem ID")
    
    lobby_id = lobby_manager.create_lobby(data.hostId, data.problemId, data.language)
    return {"lobbyId": lobby_id}

# Get lobby info
@router.get("/api/lobbies/{lobby_id}")
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

# WebSocket endpoint for lobby interactions
@router.websocket("/ws/lobby/{lobby_id}/{user_id}/{username}")
async def websocket_endpoint(websocket: WebSocket, lobby_id: str, user_id: str, username: str):
    connected = await lobby_manager.connect(websocket, lobby_id, user_id, username)
    if not connected:
        return
        
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

            elif data["type"] == "CANCEL_AUTO_RETURN":
                await lobby_manager.cancel_auto_return(lobby_id, user_id)

            elif data["type"] == "KICK_PARTICIPANT":
                await lobby_manager.kick_participant(lobby_id, user_id, data["targetId"])
                
    except WebSocketDisconnect:
        await lobby_manager.disconnect(lobby_id, user_id)
