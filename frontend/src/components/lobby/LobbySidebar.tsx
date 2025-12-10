import React from "react";
import { Trophy, Clock, Hash } from "lucide-react";

interface MatchResult {
  username: string;
  rank: number;
  wpm: number;
  accuracy: number;
  timeMs: number;
}

interface MatchHistoryItem {
  round: number;
  problemId: string;
  language: string;
  results: MatchResult[];
  timestamp: string;
}

interface LobbySidebarProps {
  history: MatchHistoryItem[];
  currentRound: number;
  isOpen?: boolean;
}

export default function LobbySidebar({ history, currentRound, isOpen = true }: LobbySidebarProps) {
  return (
    <div className={`w-80 bg-white/80 backdrop-blur-md border-l border-white/50 h-screen overflow-y-auto p-4 flex flex-col gap-4 fixed right-0 top-0 z-40 shadow-xl transition-transform duration-500 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex items-center gap-2 pb-4 border-b border-gray-200">
        <Hash className="w-5 h-5 text-teal-600" />
        <h2 className="font-bold text-lg text-gray-900">Match History</h2>
      </div>

      <div className="flex-1 space-y-4">
        {history.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8 italic">
            No matches played yet.
            <br />
            Round {currentRound} in progress.
          </div>
        ) : (
          [...history].reverse().map((match) => (
            <div key={match.round} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Round {match.round}</span>
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{match.language}</span>
              </div>
              
              <div className="space-y-2">
                {match.results.slice(0, 3).map((result, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold w-4 ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : 'text-orange-400'}`}>
                        #{result.rank}
                      </span>
                      <span className="font-medium truncate max-w-[100px]">{result.username}</span>
                    </div>
                    <div className="font-mono text-xs text-gray-500">
                      {result.wpm} WPM
                    </div>
                  </div>
                ))}
                {match.results.length > 3 && (
                  <div className="text-xs text-center text-gray-400 pt-1">
                    + {match.results.length - 3} more
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}