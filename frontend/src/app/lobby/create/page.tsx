"use client";

import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "@/config";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import ProblemSelector from "@/components/common/ProblemSelector";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CreateLobbyPage() {
  const router = useRouter();
  const [selectedProblem, setSelectedProblem] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("python");
  const [isCreating, setIsCreating] = useState(false);

  // Fetch available problems
  const { data: problems, isLoading } = useSWR(`${API_BASE_URL}/api/problems`, fetcher);
  
  // Fetch details for selected problem to get languages
  const { data: problemDetails } = useSWR(
    selectedProblem ? `${API_BASE_URL}/api/problems/${selectedProblem}` : null,
    fetcher
  );

  // Set default problem when list loads
  useEffect(() => {
    if (problems && problems.length > 0 && !selectedProblem) {
      setSelectedProblem(problems[0].id);
    }
  }, [problems]);

  // Update selected language when problem details change
  useEffect(() => {
    if (problemDetails?.languages?.length > 0) {
      // If currently selected language is not in the new list, select the first one
      if (!problemDetails.languages.includes(selectedLanguage)) {
        setSelectedLanguage(problemDetails.languages[0]);
      }
    }
  }, [problemDetails, selectedLanguage]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      // Generate a random host ID for now (replace with auth later)
      const hostId = "host_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("userId", hostId);
      // Do not force "Host" username
      // localStorage.setItem("username", "Host");

      const res = await fetch(`${API_BASE_URL}/api/lobbies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostId,
          problemId: selectedProblem,
          language: selectedLanguage
        })
      });
      
      const data = await res.json();
      router.push(`/lobby/${data.lobbyId}`);
    } catch (err) {
      console.error("Failed to create lobby", err);
      setIsCreating(false);
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-teal-500">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#DDFFF7] text-black font-sans relative">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header with Back Button */}
      <div className="relative z-10 p-6 flex items-center justify-between">
        <button 
          onClick={() => router.push("/")} 
          className="p-2 hover:bg-white/30 rounded-lg transition-all text-gray-600 hover:text-black font-semibold flex items-center gap-2"
          title="Back to Home"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <div></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/50">
          
          <div className="mb-8">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
              <Trophy className="w-6 h-6 text-teal-600" />
              Create Lobby
            </h1>
            <p className="text-sm text-gray-600 mt-2">Set up a competitive coding session</p>
          </div>

        <div className="space-y-6">
          {/* Problem Selection */}
          <ProblemSelector 
            problems={problems || []}
            selectedProblemId={selectedProblem}
            onSelect={setSelectedProblem}
          />

          {/* Language Selection */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Select Language</label>
            <select 
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-teal-500 outline-none transition-all"
              disabled={!problemDetails}
            >
              {problemDetails?.languages.map((lang: string) => (
                <option key={lang} value={lang}>
                  {lang.charAt(0).toUpperCase() + lang.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-8 pt-4 border-t border-gray-200">
            <button 
              onClick={() => router.push("/")}
              className="flex-1 py-3 bg-gray-200 text-gray-800 font-bold rounded-xl hover:bg-gray-300 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleCreate}
              disabled={isCreating}
              className="flex-1 py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create & Join"}
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
