"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { API_BASE_URL } from "@/config";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Trophy, Zap, Activity, Calendar, User, Search, Code2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProblem, setSelectedProblem] = useState<any>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("python");

  const { data: stats, isLoading: statsLoading } = useSWR(
    user ? `${API_BASE_URL}/api/users/${user.username}` : null,
    fetcher
  );

  const { data: problems } = useSWR(`${API_BASE_URL}/api/problems`, fetcher);

  const { data: problemStats } = useSWR(
    selectedProblem && user 
      ? `${API_BASE_URL}/api/users/${user.username}/problems/${selectedProblem.id}?language=${selectedLanguage}` 
      : null,
    fetcher
  );

  const filteredProblems = searchQuery 
    ? problems?.filter((p: any) => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a: any, b: any) => a.id.localeCompare(b.id))
        .slice(0, 5) 
    : [];

  if (loading || statsLoading) {
    return (
      <div className="min-h-screen bg-[#DDFFF7] flex items-center justify-center text-teal-600">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  if (!user) {
    router.push("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#DDFFF7] text-black font-sans p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
                <button 
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-bold">Back</span>
        </button>

        {/* Header Card */}
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 shadow-xl border border-white/50 flex items-center gap-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 p-1 shadow-lg">
            <div className="w-full h-full rounded-full bg-white overflow-hidden relative">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-4xl font-bold text-gray-400">
                  {user.username[0].toUpperCase()}
                </div>
              )}
            </div>
          </div>
          

          <div className="space-y-2">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">{user.username}</h1>
            <div className="flex items-center gap-2 text-gray-600 font-medium">
              <User className="w-4 h-4" />
              <span>Speed Coder</span>
            </div>
          </div>
        </div>
                
        {/* Stats Grid */}
        {stats?.status === "unavailable" && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-r-lg mb-6" role="alert">
            <p className="font-bold">Stats Unavailable</p>
            <p>Leaderboards and statistics are currently offline. You can still play, but your stats won't be saved.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Races Completed */}
          <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white/50 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                <Trophy className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Races</span>
            </div>
            <div className="text-4xl font-black text-gray-900">
              {stats?.races_completed || 0}
            </div>
            <div className="text-sm text-gray-500 mt-1">Total matches played</div>
          </div>

          {/* Average WPM */}
          <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white/50 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-teal-100 text-teal-600 rounded-xl group-hover:scale-110 transition-transform">
                <Activity className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Average</span>
            </div>
            <div className="text-4xl font-black text-gray-900">
              {Math.round(stats?.avg_wpm || 0)}
            </div>
            <div className="text-sm text-gray-500 mt-1">Words per minute</div>
          </div>

          {/* Max WPM */}
          <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white/50 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-yellow-100 text-yellow-600 rounded-xl group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Best</span>
            </div>
            <div className="text-4xl font-black text-gray-900">
              {Math.round(stats?.max_wpm || 0)}
            </div>
            <div className="text-sm text-gray-500 mt-1">Peak speed</div>
          </div>
        </div>

        {/* Problem Performance Search */}
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 shadow-xl border border-white/50 space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Check Performance</h3>
              <p className="text-sm text-gray-500">Search for a problem to see your best score</p>
            </div>
          </div>

          <div className="relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text"
                placeholder="Search problem name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!e.target.value) setSelectedProblem(null);
                }}
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 outline-none transition-all font-medium"
              />
            </div>

            {/* Search Results Dropdown */}
            {searchQuery && filteredProblems?.length > 0 && !selectedProblem && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-10">
                {filteredProblems.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProblem(p);
                      setSearchQuery(p.title);
                      if (p.languages && p.languages.length > 0) {
                        setSelectedLanguage(p.languages[0]);
                      }
                    }}
                    className="w-full text-left px-6 py-3 hover:bg-gray-50 flex items-center justify-between group transition-colors"
                  >
                    <span className="font-bold text-gray-700 group-hover:text-teal-600">{p.title}</span>
                    <span className={`text-xs px-2 py-1 rounded font-mono ${p.difficulty === 'Easy' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {p.difficulty}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Problem Stats */}
          {selectedProblem && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-200 pb-4">
                  <div>
                    <h4 className="text-lg font-black text-gray-900">{selectedProblem.title}</h4>
                    <div className="flex gap-2 mt-1">
                      {selectedProblem.languages?.map((lang: string) => (
                        <button
                          key={lang}
                          onClick={() => setSelectedLanguage(lang)}
                          className={`text-xs px-3 py-1 rounded-full font-bold transition-all ${selectedLanguage === lang ? 'bg-black text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                        >
                          {lang.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  {problemStats?.found && (
                    <div className="flex items-center gap-2 bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl">
                      <Trophy className="w-4 h-4" />
                      <span className="font-bold">Rank #{problemStats.rank}</span>
                    </div>
                  )}
                </div>

                {problemStats ? (
                  problemStats.status === "unavailable" ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>Stats service is currently unavailable.</p>
                    </div>
                  ) : problemStats.found ? (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-white rounded-xl shadow-sm">
                        <div className="text-xs text-gray-500 uppercase font-bold mb-1">Speed</div>
                        <div className="text-2xl font-black text-teal-600">{Math.round(problemStats.wpm)} <span className="text-sm text-gray-400 font-medium">WPM</span></div>
                      </div>
                      <div className="text-center p-4 bg-white rounded-xl shadow-sm">
                        <div className="text-xs text-gray-500 uppercase font-bold mb-1">Accuracy</div>
                        <div className="text-2xl font-black text-blue-600">{Math.round(problemStats.accuracy)}<span className="text-sm text-gray-400 font-medium">%</span></div>
                      </div>
                      <div className="text-center p-4 bg-white rounded-xl shadow-sm">
                        <div className="text-xs text-gray-500 uppercase font-bold mb-1">Date</div>
                        <div className="text-sm font-bold text-gray-700 mt-2">
                          {new Date(problemStats.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Code2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No records found for this problem in {selectedLanguage}.</p>
                      <button 
                        onClick={() => router.push(`/play/${selectedProblem.id}`)}
                        className="mt-4 px-6 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition-colors"
                      >
                        Play Now
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>



      </div>
    </div>
  );
}
