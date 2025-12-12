"use client";

import React, { useState, useEffect, useRef } from "react";
import { API_BASE_URL, WS_BASE_URL } from "@/config";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import TypingEngine from "@/components/typing/TypingEngine";
import LobbySidebar from "@/components/lobby/LobbySidebar";
import HostControls from "@/components/lobby/HostControls";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Copy, Users, Play, Trophy, Crown, ArrowLeft, LogOut, X } from "lucide-react";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const { user, login, logout } = useAuth();
  const lobbyId = params.code as string;
  
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [lobbyState, setLobbyState] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Fetch initial lobby data (for problem content)
  const { data: lobbyInfo, error: lobbyError } = useSWR(
    `${API_BASE_URL}/api/lobbies/${lobbyId}`,
    fetcher,
    { shouldRetryOnError: false }
  );

  // Use WebSocket state for problem ID if available, otherwise fallback to initial fetch
  const currentProblemId = lobbyState?.problemId || lobbyInfo?.problemId;
  const currentLanguage = lobbyState?.language || lobbyInfo?.language;

  const { data: problem, error: problemError } = useSWR(
    currentProblemId ? `${API_BASE_URL}/api/problems/${currentProblemId}` : null,
    fetcher
  );

  // Redirect if lobby not found
  useEffect(() => {
    if (lobbyError) {
      const timer = setTimeout(() => router.push("/"), 3000);
      return () => clearTimeout(timer);
    }
  }, [lobbyError, router]);

  // Initialize User
  useEffect(() => {
    if (user) {
      setUserId(user.uid);
      setUsername(user.username);
      // Auto-join if logged in
      if (!isJoined) {
        setIsJoined(true);
      }
      return;
    }

    let storedId = localStorage.getItem("userId");
    if (!storedId) {
      storedId = "user_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("userId", storedId);
    }
    setUserId(storedId);
    
    const storedName = localStorage.getItem("username");
    // Don't auto-populate if it's "Host" to avoid conflicts
    if (storedName && storedName !== "Host") {
      setUsername(storedName);
    }
  }, [user]);

  // WebSocket Connection
  useEffect(() => {
    if (!isJoined || !userId || !username) return;

    let ws: WebSocket | null = null;
    let pingInterval: NodeJS.Timeout;
    let reconnectTimeout: NodeJS.Timeout;
    let connectionTimeout: NodeJS.Timeout;
    let isUnmounting = false;

    const connect = () => {
      if (isUnmounting) return;

      console.log("Connecting to WebSocket...");
      // Encode username to handle special characters/spaces
      let wsUrl = `${WS_BASE_URL}/ws/lobby/${lobbyId}/${userId}/${encodeURIComponent(username)}`;
      if (user?.photoURL) {
        wsUrl += `?photo_url=${encodeURIComponent(user.photoURL)}`;
      }
      ws = new WebSocket(wsUrl);
      
      // Connection timeout safety
      connectionTimeout = setTimeout(() => {
        if (ws?.readyState !== WebSocket.OPEN) {
          console.error("Connection timed out");
          ws?.close();
          alert("Connection timed out. Please check your network or try again.");
          setIsJoined(false);
        }
      }, 5000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log("Connected to lobby");
        // Send ping every 5s to keep connection alive
        pingInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "PING" }));
          }
        }, 5000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "STATE_UPDATE") {
            setLobbyState(data);
          } else if (data.type === "LOBBY_CLOSED") {
            alert("The host has disbanded the lobby.");
            router.push("/");
          } else if (data.type === "KICKED") {
            alert("You have been kicked from the lobby.");
            router.push("/");
          }
        } catch (err) {
          console.error("Failed to parse WS message", err);
        }
      };

      ws.onclose = (e) => {
        console.log("Disconnected", e.code, e.reason);
        clearInterval(pingInterval);
        
        if (isUnmounting) return;

        // If closed normally (1000) or explicitly by backend (4000), don't reconnect
        if (e.code === 1000 || e.code === 4000) {
           if (e.code === 4000) {
             alert("Lobby not found or has ended.");
             setIsJoined(false);
             router.push("/");
           }
        } else {
          // Try to reconnect in 3 seconds for other errors (network issues, etc)
          console.log("Connection lost. Attempting to reconnect in 3s...");
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
      
      setSocket(ws);
    };

    connect();

    return () => {
      isUnmounting = true;
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      clearTimeout(connectionTimeout);
      if (ws) {
        ws.onclose = null; // Prevent reconnect logic on cleanup
        ws.close();
      }
    };
  }, [isJoined, lobbyId, userId, username, router]);

  // Reset results visibility when race starts
  useEffect(() => {
    if (lobbyState?.status === "racing") {
      setShowResults(true);
      setShowFullLeaderboard(false);
    }
  }, [lobbyState?.status]);

  // Countdown Timer
  useEffect(() => {
    if (lobbyState?.status === "starting") {
      const interval = setInterval(() => setNow(Date.now()), 100);
      return () => clearInterval(interval);
    }
  }, [lobbyState?.status]);

  const handleJoin = () => {
    if (!username.trim()) return;
    localStorage.setItem("username", username);
    setIsJoined(true);
  };

  const handleLeave = () => {
    if (socket) {
      socket.close();
    }
    router.push("/");
  };

  const handleStartRace = () => {
    if (socket) {
      socket.send(JSON.stringify({ type: "START_RACE" }));
    }
  };

  const handleForceEnd = () => {
    if (socket) {
      socket.send(JSON.stringify({ type: "FORCE_END" }));
    }
  };

  const handleKick = (targetId: string) => {
    if (socket) {
      socket.send(JSON.stringify({ type: "KICK_PARTICIPANT", targetId }));
    }
  };

  const handleUpdateSettings = (settings: { problemId: string; language: string }) => {
    if (socket) {
      socket.send(JSON.stringify({
        type: "UPDATE_SETTINGS",
        ...settings
      }));
    }
  };

  const handleLobbySubmit = async (stats: any) => {
    if (socket) {
      socket.send(JSON.stringify({
        type: "FINISH_RACE",
        stats
      }));
    }
    // We don't return rank here because it comes from WS state update
  };

  const handleProgress = (stats: any) => {
    if (socket) {
      socket.send(JSON.stringify({
        type: "UPDATE_PROGRESS",
        wpm: stats.wpm,
        progress: stats.progress
      }));
    }
  };

  const handleNextRound = (settings?: { problemId: string; language: string }) => {
    if (socket) {
      socket.send(JSON.stringify({
        type: "RESET_ROUND",
        ...settings
      }));
    }
  };

  const handleCancelAutoReturn = () => {
    if (socket) {
      socket.send(JSON.stringify({ type: "CANCEL_AUTO_RETURN" }));
    }
  };

  if (lobbyError || problemError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#DDFFF7] text-center p-4">
        <div className="bg-white/80 p-8 rounded-2xl shadow-xl border border-red-100">
          <h2 className="text-2xl font-bold text-red-500 mb-2">Lobby Not Found</h2>
          <p className="text-gray-600 mb-6">This lobby may have ended or does not exist.</p>
          <p className="text-sm text-gray-500 mb-6">Redirecting to home...</p>
          <button 
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-all"
          >
            Go Home Now
          </button>
        </div>
      </div>
    );
  }

  if (!lobbyInfo || !problem) {
    return (
      <div className="min-h-screen bg-[#DDFFF7] flex items-center justify-center text-teal-600">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  // 0. CONNECTING STATE
  if (isJoined && !lobbyState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#DDFFF7]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <p className="font-mono text-gray-500">Connecting to lobby...</p>
        </div>
      </div>
    );
  }

  // 1. JOIN SCREEN
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-[#DDFFF7] flex items-center justify-center p-4 relative">
        <button 
          onClick={() => router.push("/")}
          className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-white/70 hover:bg-white rounded-lg transition-all text-gray-600 hover:text-black font-semibold"
          title="Back to Home"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        {/* Auth Status */}
        <div className="absolute top-6 right-6 flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <button onClick={() => router.push("/profile")} className="text-sm font-bold text-gray-900 hover:text-teal-600 transition-colors">{user.username}</button>
                <button onClick={logout} className="text-xs text-red-500 hover:underline block ml-auto">Sign Out</button>
              </div>
              <button onClick={() => router.push("/profile")} className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-gray-300 hover:ring-2 hover:ring-teal-500 transition-all">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-teal-600 text-white font-bold">
                    {user.username[0].toUpperCase()}
                  </div>
                )}
              </button>
            </div>
          ) : (
            <button 
              onClick={login}
              className="px-4 py-2 bg-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-all"
            >
              Sign In
            </button>
          )}
        </div>

        <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-xl max-w-md w-full border border-white/50 text-center space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Join Lobby</h1>
            <p className="text-sm text-gray-600 mt-1">Enter your name to participate</p>
          </div>
          <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="font-bold text-gray-900">
              <span className="block text-xs text-gray-500 uppercase font-semibold mb-1">Problem</span>
              {problem.title}
            </div>
            <div className="font-bold text-gray-900 mt-2">
              <span className="block text-xs text-gray-500 uppercase font-semibold mb-1">Language</span>
              <span className="font-mono">{lobbyInfo.language.toUpperCase()}</span>
            </div>
          </div>
          
          <input
            type="text"
            placeholder="Enter Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 rounded-xl border-2 border-gray-300 bg-white text-black placeholder:text-gray-500 text-center font-bold focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none shadow-sm"
            maxLength={12}
          />
          
          <div className="flex gap-3 pt-2 border-t border-gray-200">
            <button 
              onClick={() => router.push("/")}
              className="flex-1 py-3 bg-gray-200 text-gray-800 font-bold rounded-xl hover:bg-gray-300 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleJoin}
              disabled={!username.trim()}
              className="flex-1 py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. WAITING ROOM
  if (lobbyState?.status === "waiting" || lobbyState?.status === "starting") {
    const isHost = lobbyInfo.hostId === userId;
    const countdown = lobbyState.start_time ? Math.ceil((lobbyState.start_time - now) / 1000) : 0;
    
    return (
      <div className="min-h-screen bg-[#DDFFF7] flex relative">
        {/* Countdown Overlay */}
        {lobbyState.status === "starting" && (
           <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
             <div className="text-9xl font-black text-white animate-pulse">
               {countdown > 0 ? countdown : "GO!"}
             </div>
           </div>
        )}

        <div className={`flex-1 p-8 flex flex-col items-center transition-all duration-500 ${lobbyState.status === 'racing' ? 'mr-0' : 'mr-80'}`}>
          <div className="w-full max-w-4xl space-y-8">
          
          {/* Header */}
          <div className="flex justify-between items-center bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-sm">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-gray-900">Lobby <span className="font-mono text-teal-600">#{lobbyId}</span></h1>
              <p className="text-gray-700 font-medium mt-1">
                Round {lobbyState.roundNumber || 1} • Waiting for players...
              </p>
            </div>
            <div className="flex gap-4 items-center">
               {/* Auth Status */}
               <div className="flex items-center gap-4 mr-4 border-r border-gray-300 pr-4">
                  {user ? (
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <button onClick={() => router.push("/profile")} className="text-sm font-bold text-gray-900 hover:text-teal-600 transition-colors">{user.username}</button>
                        <button onClick={logout} className="text-xs text-red-500 hover:underline block ml-auto">Sign Out</button>
                      </div>
                      <button onClick={() => router.push("/profile")} className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-gray-300 hover:ring-2 hover:ring-teal-500 transition-all">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-teal-600 text-white font-bold">
                            {user.username[0].toUpperCase()}
                          </div>
                        )}
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={login}
                      className="px-4 py-2 bg-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-all"
                    >
                      Sign In
                    </button>
                  )}
               </div>

               <div className="px-4 py-2 bg-white rounded-lg border border-gray-200 font-mono text-sm flex items-center gap-2 text-gray-800">
                 <span className="text-gray-500">CODE:</span>
                 <span className="font-bold select-all">{lobbyId}</span>
                 <button onClick={() => navigator.clipboard.writeText(lobbyId)} className="hover:text-teal-600">
                   <Copy className="w-4 h-4" />
                 </button>
               </div>
               
               <button 
                 onClick={handleLeave}
                 className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                 title={isHost ? "Disband Lobby" : "Leave Lobby"}
               >
                 <LogOut className="w-5 h-5" />
               </button>
            </div>
          </div>

          {/* Settings Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/80 p-6 rounded-2xl shadow-sm border border-white/50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Match Settings</h3>
                {isHost && (
                  <div className="scale-75 origin-right">
                    <HostControls 
                      onNextRound={(s) => s && handleUpdateSettings(s)} 
                      currentProblemId={currentProblemId}
                      currentLanguage={currentLanguage}
                      compact={true}
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2 text-gray-800">
                <div className="flex justify-between">
                  <span className="text-gray-600">Problem</span>
                  <span className="font-bold">{problem?.title || "Loading..."}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Language</span>
                  <span className="font-bold uppercase">{currentLanguage}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Difficulty</span>
                  <span className={`font-bold ${problem?.difficulty === 'Easy' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {problem?.difficulty || "..."}
                  </span>
                </div>
              </div>
            </div>

            {/* Players List */}
            <div className="bg-white/80 p-6 rounded-2xl shadow-sm border border-white/50">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex justify-between">
                <span>Players</span>
                <span>{lobbyState.participants.length} Joined</span>
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {lobbyState.participants.map((p: any) => (
                  <div key={p.id} className={`flex items-center gap-3 p-2 rounded-lg bg-white/50 ${!p.connected ? 'opacity-50 grayscale' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden">
                      {p.photoURL ? (
                        <img src={p.photoURL} alt={p.username} className="w-full h-full object-cover" />
                      ) : (
                        p.username[0].toUpperCase()
                      )}
                    </div>
                    <span className={`font-medium flex-1 ${p.id === userId ? 'text-teal-700 font-bold' : 'text-gray-800'}`}>
                      {p.username} {p.id === userId && "(You)"} {p.connected === false && "(Disconnected)"}
                    </span>
                    {p.id === lobbyInfo.hostId && <Crown className="w-4 h-4 text-yellow-500" />}
                    {isHost && p.id !== userId && (
                      <button 
                        onClick={() => handleKick(p.id)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Kick Player"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Start Button (Host Only) */}
          {isHost ? (
            <button 
              onClick={handleStartRace}
              className="w-full py-6 bg-black text-white text-xl font-black tracking-widest rounded-2xl hover:bg-gray-900 transition-all shadow-xl hover:scale-[1.01] flex items-center justify-center gap-3"
            >
              <Play className="w-6 h-6 fill-white" />
              START RACE
            </button>
          ) : (
            <div className="text-center p-8 text-gray-600 font-mono animate-pulse">
              Waiting for host to start...
            </div>
          )}

        </div>
      </div>
      
      <LobbySidebar history={lobbyState.history || []} currentRound={lobbyState.roundNumber || 1} />
    </div>
    );
  }

  // 3. RACING / FINISHED
  const isHost = lobbyInfo.hostId === userId;

  return (
    <div className="min-h-screen bg-[#DDFFF7] flex">
      <div className={`flex-1 flex flex-col transition-all duration-500 ${lobbyState?.status === 'racing' ? 'mr-0' : 'mr-80'}`}>
        {/* Race Header */}
        <div className="bg-white/80 backdrop-blur-md p-4 border-b border-white/20 flex justify-between items-center sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleLeave}
              className="p-2 hover:bg-red-100 text-gray-500 hover:text-red-600 rounded-lg transition-colors"
              title="Leave Race"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="font-bold text-lg flex items-center gap-2 text-gray-900">
              <Trophy className="w-5 h-5 text-teal-600" />
              <span>{problem?.title || "Loading..."}</span>
              <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600 font-mono">Round {lobbyState?.roundNumber || 1}</span>
            </div>
          </div>
          <div className="flex gap-3 items-center">
             {/* Auth Status */}
             <div className="flex items-center gap-4 mr-4 border-r border-gray-300 pr-4">
                {user ? (
                  <div className="flex items-center gap-3">
                    <button onClick={() => router.push("/profile")} className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden border border-gray-300 hover:ring-2 hover:ring-teal-500 transition-all">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-teal-600 text-white font-bold text-xs">
                          {user.username[0].toUpperCase()}
                        </div>
                      )}
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={login}
                    className="px-3 py-1 bg-black text-white text-xs font-bold rounded hover:bg-gray-800 transition-all"
                  >
                    Sign In
                  </button>
                )}
             </div>

             {isHost && lobbyState?.status === "racing" && (
               <button 
                 onClick={handleForceEnd}
                 className="px-3 py-1 bg-red-100 text-red-600 text-xs font-bold rounded hover:bg-red-200 mr-4"
               >
                 END RACE
               </button>
             )}
             {lobbyState?.participants.map((p: any) => (
               <div key={p.id} className={`flex flex-col items-center gap-1 ${!p.connected ? 'opacity-40' : ''}`}>
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all relative overflow-hidden ${p.finished ? 'bg-green-500 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-500'}`} title={p.username}>
                   <span className="z-10">
                     {p.finished ? '✓' : (
                       p.photoURL ? <img src={p.photoURL} alt={p.username} className="w-full h-full object-cover" /> : p.username[0].toUpperCase()
                     )}
                   </span>
                   {!p.finished && (
                      <svg className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-gray-100"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        />
                        <path
                          className="text-teal-500 transition-all duration-500 ease-out"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeDasharray={`${p.progress || 0}, 100`}
                        />
                      </svg>
                   )}
                 </div>
                 <div className="text-[10px] font-mono font-bold text-gray-600">{p.wpm || 0} WPM</div>
               </div>
             ))}
          </div>
        </div>

        {/* Game Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-4xl">
            {problem && (
              <>
                {/* If user is finished, show waiting message or leaderboard instead of typing engine */}
                {lobbyState?.participants.find((p: any) => p.id === userId)?.finished ? (
                  <div className="flex flex-col items-center justify-center gap-6 animate-in fade-in zoom-in duration-300 w-full">
                    
                    {/* Results Card */}
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
                      <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center shrink-0">
                        <h2 className="text-2xl font-black text-gray-900">Race Results</h2>
                        <div className="text-sm font-bold text-teal-600">
                          {lobbyState.participants.filter((p: any) => p.finished).length} / {lobbyState.participants.length} Finished
                        </div>
                      </div>
                      
                      <div className="divide-y divide-gray-100 overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                        {[...lobbyState.participants]
                          .sort((a: any, b: any) => {
                            if (a.finished && b.finished) return a.rank - b.rank;
                            if (a.finished) return -1;
                            if (b.finished) return 1;
                            return b.progress - a.progress;
                          })
                          .map((p: any) => (
                          <div key={p.id} className={`p-4 flex items-center gap-4 transition-colors ${p.id === userId ? 'bg-teal-50 border-l-4 border-teal-500' : 'hover:bg-gray-50'}`}>
                            <div className={`w-8 h-8 flex items-center justify-center font-black text-lg ${p.finished ? (p.rank === 1 ? 'text-yellow-500' : p.rank === 2 ? 'text-gray-400' : p.rank === 3 ? 'text-orange-400' : 'text-gray-300') : 'text-gray-200'}`}>
                              {p.finished ? `#${p.rank}` : '•'}
                            </div>
                            <div className="flex-1 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0">
                                {p.photoURL ? (
                                  <img src={p.photoURL} alt={p.username} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-teal-600 text-white font-bold text-xs">
                                    {p.username[0].toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className={`font-bold text-lg ${p.id === userId ? 'text-teal-900' : 'text-gray-900'}`}>
                                  {p.username} {p.id === userId && "(You)"}
                                </div>
                                {p.finished ? (
                                  <div className="text-xs text-gray-500 font-mono">{(p.timeMs / 1000).toFixed(2)}s</div>
                                ) : (
                                  <div className="w-full max-w-[200px] h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                                    <div 
                                      className="h-full bg-teal-500 transition-all duration-500 ease-out"
                                      style={{ width: `${p.progress}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-black text-xl text-gray-900">{p.wpm} <span className="text-xs font-medium text-gray-400">WPM</span></div>
                              {p.finished ? (
                                <div className="text-xs font-bold text-green-600">{p.accuracy}% Acc</div>
                              ) : (
                                <div className="text-xs font-bold text-teal-600 animate-pulse">Racing...</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Auto Return Countdown */}
                      {lobbyState.next_round_countdown && (
                        <div className="p-4 bg-teal-600 text-white flex items-center justify-between shrink-0">
                          <div className="font-bold animate-pulse">
                            Returning to lobby in {lobbyState.next_round_countdown}s...
                          </div>
                          {isHost && (
                            <button 
                              onClick={handleCancelAutoReturn}
                              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-bold transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      )}

                      {/* Host Controls */}
                      {isHost && !lobbyState.next_round_countdown && (
                        <div className="p-4 bg-gray-50 border-t border-gray-200 shrink-0">
                          <HostControls 
                            onNextRound={handleNextRound} 
                            currentProblemId={currentProblemId}
                            currentLanguage={currentLanguage}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <TypingEngine 
                    code={problem.content[currentLanguage]}
                    language={currentLanguage}
                    onSubmitStats={handleLobbySubmit}
                    onProgress={handleProgress}
                    showResults={false}
                    user={user}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <LobbySidebar 
        history={lobbyState?.history || []} 
        currentRound={lobbyState?.roundNumber || 1} 
        isOpen={lobbyState?.status !== 'racing'}
      />
    </div>
  );
}