// frontend/src/app/play/[id]/page.tsx
"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { useParams, useRouter } from "next/navigation"; // 
import TypingEngine from "@/components/typing/TypingEngine";
import { Loader2, ArrowLeft, RefreshCw, Trophy } from "lucide-react";

// Fetcher
const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Problem not found");
  return res.json();
});

export default function DynamicGamePage() {
  // If URL is /play/55, then problemId = "55"
  const params = useParams();
  const problemId = params.id as string; 
  const router = useRouter();

  // SWR key changes automatically when problemId changes
  const { data: problem, error, isLoading } = useSWR(
    `http://localhost:8000/api/problems/${problemId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const [gameState, setGameState] = useState<"playing" | "finished">("playing");
  const [stats, setStats] = useState<any>(null);

  // Loading State
  // While SWR is fetching data, show spinner
  if (isLoading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-green-500">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );

  if (error || !problem) return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-red-500 font-mono">
      <h2 className="text-xl">Problem #{problemId} Not Found</h2>
      <button onClick={() => router.push("/")} className="mt-4 underline hover:text-white">
        Go Home
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#DDFFF7] text-black font-sans overflow-hidden relative">
      
      {/* Background Gradients (Matching Landing Page) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 p-6 flex items-center justify-between">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="font-bold text-lg">{problem.title}</h1>
        <div className="w-16"></div>
      </div>

      {/* Game Area */}
      <div className="relative z-10 flex flex-col items-center pt-12">
        {gameState === "playing" ? (
          <div className="w-full max-w-4xl">
            {/*THE ENGINE: We feed it the data we just fetched */}
            <TypingEngine 
              code={problem.content} 
              onFinish={(results) => {
                setStats(results);
                setGameState("finished");
              }} 
            />
          </div>
        ) : (
          /* Results (Simple version) */
          <div className="text-center space-y-6 animate-in zoom-in">
            <Trophy className="w-16 h-16 text-yellow-400 mx-auto" />
            <h2 className="text-6xl font-black">{stats.wpm} WPM</h2>
            <button 
              onClick={() => window.location.reload()} 
              className="px-8 py-3 bg-white text-black font-bold rounded hover:bg-gray-200 flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" /> Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}