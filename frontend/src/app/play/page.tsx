"use client";

import React, { useState, useCallback } from "react";
import { API_BASE_URL } from "@/config";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Trophy, Code2, Play, RefreshCw } from "lucide-react";
import TypingEngine from "@/components/typing/TypingEngine";
import { useAuth } from "@/context/AuthContext";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PlayPage() {
  const router = useRouter();
  const { user, login, logout } = useAuth();
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("python");
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameKey, setGameKey] = useState(0); // To force reset game
  const [searchQuery, setSearchQuery] = useState("");

  const { data: problems, isLoading } = useSWR(`${API_BASE_URL}/api/problems`, fetcher);
  
  const { data: problemDetails } = useSWR(
    selectedProblemId ? `${API_BASE_URL}/api/problems/${selectedProblemId}` : null,
    fetcher
  );

  const { data: leaderboardData } = useSWR(
    selectedProblemId ? `${API_BASE_URL}/api/leaderboard/${selectedProblemId}?language=${selectedLanguage}` : null,
    fetcher,
    { 
      revalidateOnFocus: false,
      keepPreviousData: true 
    }
  );

  // Auto-select first problem
  React.useEffect(() => {
    if (problems && problems.length > 0 && !selectedProblemId) {
      setSelectedProblemId(problems[0].id);
    }
  }, [problems]);

  const filteredProblems = problems?.filter((p: any) => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.id.includes(searchQuery)
  ).sort((a: any, b: any) => a.id.localeCompare(b.id)) || [];

  // Auto-select language
  React.useEffect(() => {
    if (problemDetails?.languages?.length > 0) {
      if (!problemDetails.languages.includes(selectedLanguage)) {
        setSelectedLanguage(problemDetails.languages[0]);
      }
    }
  }, [problemDetails, selectedLanguage]);

  // Reset playing state when problem changes
  React.useEffect(() => {
    setIsPlaying(false);
  }, [selectedProblemId, selectedLanguage]);

  const handleSubmitStats = useCallback(async (payload: any) => {
    if (!user) return;

    const token = await user.getToken();
    const payloadWithLanguage = {
      ...payload,
      language: payload.language || selectedLanguage,
    };
    try {
      const res = await fetch(`${API_BASE_URL}/api/results`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payloadWithLanguage),
      });
      const data = await res.json();
      return data.rank;
    } catch (err) {
      console.error("Failed to submit results", err);
    }
  }, [selectedLanguage, user]);

  const handleRestart = () => {
    setGameKey(prev => prev + 1);
  };

  if (isLoading) return (
    <div className="min-h-screen bg-[#DDFFF7] flex items-center justify-center text-teal-600">
      <Loader2 className="w-10 h-10 animate-spin" />
    </div>
  );

  return (
    <div className="h-screen bg-[#DDFFF7] text-black font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md p-4 border-b border-white/50 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Code2 className="w-6 h-6 text-teal-600" />
            Play
          </h1>
        </div>

        {/* Auth Status */}
        <div className="flex items-center gap-4">
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
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Problem List */}
        <div className="w-80 bg-white/50 border-r border-white/50 overflow-hidden flex flex-col shrink-0">
          <div className="p-4 pb-2">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Problems</h2>
            <input 
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white/80 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 pt-0 flex flex-col gap-2">
            {filteredProblems.map((p: any) => (
            <button
              key={p.id}
              onClick={() => setSelectedProblemId(p.id)}
              className={`text-left p-4 rounded-xl transition-all border shrink-0 ${
                selectedProblemId === p.id 
                  ? 'bg-white border-teal-500 shadow-md ring-1 ring-teal-500' 
                  : 'bg-white/40 border-transparent hover:bg-white/80 hover:shadow-sm'
              }`}
            >
              <div className="font-bold text-gray-900 truncate">{p.title}</div>
              <div className="flex justify-between items-center mt-2">
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  p.difficulty === 'Easy' ? 'bg-green-100 text-green-700' : 
                  p.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 
                  'bg-red-100 text-red-700'
                }`}>
                  {p.id}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-500 font-mono truncate">
                {p.languages.map((l: string) => l.charAt(0).toUpperCase() + l.slice(1)).join(", ")}
              </div>
            </button>
          ))}
          {filteredProblems.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-8">
              No problems found
            </div>
          )}
          </div>
        </div>

        {/* Center: Details & Play */}
        <div className="flex-1 p-8 overflow-y-auto flex flex-col items-center relative">
          {problemDetails ? (
            <div className="w-full max-w-4xl space-y-8">
              {/* Title & Language Selector */}
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-black text-gray-900">{problemDetails.title}</h2>
                {!isPlaying && (
                  <div className="flex justify-center gap-2">
                    {problemDetails.languages.map((lang: string) => (
                      <button
                        key={lang}
                        onClick={() => setSelectedLanguage(lang)}
                        className={`px-4 py-2 rounded-lg font-mono text-sm font-bold uppercase transition-all ${
                          selectedLanguage === lang 
                            ? 'bg-black text-white shadow-lg scale-105' 
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isPlaying ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex justify-between items-center mb-4">
                    <button 
                      onClick={() => setIsPlaying(false)}
                      className="text-sm font-bold text-gray-500 hover:text-black flex items-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Details
                    </button>
                    <button 
                      onClick={handleRestart}
                      className="text-sm font-bold text-teal-600 hover:text-teal-800 flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Restart
                    </button>
                  </div>
                  
                  <TypingEngine 
                    key={gameKey}
                    code={problemDetails.content[selectedLanguage]}
                    problemId={selectedProblemId!}
                    language={selectedLanguage}
                    onSubmitStats={handleSubmitStats}
                    user={user}
                    onLoginRequest={login}
                  />
                </div>
              ) : (
                <div className="bg-white/60 p-8 rounded-3xl shadow-xl border border-white/50 backdrop-blur-sm flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300">
                  <div className="text-center space-y-2">
                    <p className="text-gray-600">Ready to test your speed?</p>
                    <div className="text-sm text-gray-500">
                      Language: <span className="font-bold uppercase text-teal-600">{selectedLanguage}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsPlaying(true)}
                    className="px-12 py-4 bg-teal-600 text-white text-xl font-bold rounded-2xl hover:bg-teal-700 transition-all shadow-lg hover:scale-105 flex items-center gap-3"
                  >
                    <Play className="w-6 h-6 fill-white" />
                    Start
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              Select a problem to view details
            </div>
          )}
        </div>

        {/* Right Sidebar: Leaderboard (Mock) */}
        <div className="w-80 bg-white/50 border-l border-white/50 overflow-y-auto p-4 shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Leaderboard</h2>
          </div>
          
          {selectedProblemId ? (
            <div className="space-y-3">
              <div className="text-xs text-center text-gray-400 mb-4">
                Top scores for <span className="font-bold text-gray-600">{problemDetails?.title}</span> ({selectedLanguage})
              </div>
              
              {/* Real Entries */}
              {leaderboardData?.entries?.length > 0 ? (
                leaderboardData.entries.map((entry: any) => (
                  <div key={entry.rank} className="bg-white p-3 rounded-xl shadow-sm flex items-center gap-3">
                    <div className={`w-6 h-6 flex items-center justify-center font-bold text-sm ${
                      entry.rank === 1 ? 'text-yellow-500' : entry.rank === 2 ? 'text-gray-400' : entry.rank === 3 ? 'text-orange-400' : 'text-gray-300'
                    }`}>
                      #{entry.rank}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-gray-900">{entry.username}</div>
                      <div className="text-xs text-gray-500">Acc: {entry.accuracy?.toFixed(1)}%</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-teal-700">{entry.wpm?.toFixed(0)} WPM</div>
                      <div className="text-[10px] text-gray-400">Score: {entry.score?.toFixed(0)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 text-sm py-8">
                  No scores yet. <br/>Be the first to conquer this problem!
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-400 text-sm mt-10">
              Select a problem to view leaderboard
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
