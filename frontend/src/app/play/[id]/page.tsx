// frontend/src/app/play/[id]/page.tsx
"use client";

import React, { useState, useCallback, useEffect } from "react";
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
  const [selectedLanguage, setSelectedLanguage] = useState<string>("python");
  const [maxLinesVisible, setMaxLinesVisible] = useState<number>(10);

  // SWR key changes automatically when problemId changes
  const { data: problem, error, isLoading } = useSWR(
    `http://localhost:8000/api/problems/${problemId}`,
    fetcher,
    { 
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false
    }
  );

  useEffect(() => {
    if (problem?.languages?.length) {
      setSelectedLanguage(problem.languages[0]);
    }
  }, [problem]);

  useEffect(() => {
    const stored = localStorage.getItem("maxLinesVisible");
    if (stored) setMaxLinesVisible(parseInt(stored, 10));
  }, []);

  const handleMaxLinesChange = (lines: number) => {
    setMaxLinesVisible(lines);
    localStorage.setItem("maxLinesVisible", lines.toString());
  };

  const handleSubmitStats = useCallback(async (payload: any) => {
    // TODO: inject auth token when available
    // const token = await getAccessToken();
    const payloadWithLanguage = {
      ...payload,
      language: payload.language || selectedLanguage,
    };
    try {
      const res = await fetch("http://localhost:8000/api/results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payloadWithLanguage),
      });
      console.log("Submitted stats", { status: res.status, ok: res.ok });
      const data = await res.json();
      return data.rank;
    } catch (err) {
      console.error("Failed to submit results", err);
    }
  }, [selectedLanguage]);

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
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-bold text-lg">{problem.title}</h1>
          <div className="flex gap-2">
            {(problem.languages || [selectedLanguage]).map((lang: string) => {
              const labelMap: Record<string, string> = {
                python: "Python",
                javascript: "JavaScript",
                cpp: "C++",
              };
              return (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-3 py-1 rounded-full text-sm border transition-all ${selectedLanguage === lang ? "bg-black text-white border-black" : "bg-white text-gray-700 border-gray-300 hover:border-black"}`}
                >
                  {labelMap[lang] || lang}
                </button>
              );
            })}
          </div>
        </div>
        <div className="w-16"></div>
      </div>

      {/* Game Area */}
      <div className="relative z-10 flex flex-col items-center pt-12 pb-12">
        <div className="w-full max-w-4xl">
          {/*THE ENGINE: We feed it the data we just fetched */}
          <TypingEngine 
            code={typeof problem.content === "object" ? problem.content[selectedLanguage] : problem.content}
            problemId={problem.id}
            language={selectedLanguage}
            maxLinesVisible={maxLinesVisible}
            onMaxLinesChange={handleMaxLinesChange}
            onFinish={() => {}}
            onSubmitStats={handleSubmitStats}
          />
        </div>
      </div>
    </div>
  );
}