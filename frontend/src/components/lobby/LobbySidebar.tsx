import React, { useState } from "react";
import { Trophy, Clock, Hash, ChevronDown, ChevronUp } from "lucide-react";

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
  problemTitle?: string;
  language: string;
  results: MatchResult[];
  timestamp: string;
}

interface LobbySidebarProps {
  history: MatchHistoryItem[];
  currentRound: number;
  isOpen?: boolean;
}

const MatchHistoryCard = ({ match }: { match: MatchHistoryItem }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const PREVIEW_LIMIT = 5;
  
  // Ensure results are sorted by rank before slicing
  const sortedResults = [...match.results].sort((a, b) => a.rank - b.rank);
  const hasMore = sortedResults.length > PREVIEW_LIMIT;
  const displayedResults = isExpanded ? sortedResults : sortedResults.slice(0, PREVIEW_LIMIT);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 transition-all duration-300">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Round {match.round}</span>
        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{match.language}</span>
      </div>
      <div className="text-xs font-bold text-gray-800 mb-3">
          {match.problemTitle || `Problem ${match.problemId}`}
      </div>
      
      <div className="space-y-2">
        {displayedResults.map((result, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className={`font-bold w-4 ${result.rank === 1 ? 'text-yellow-500' : result.rank === 2 ? 'text-gray-400' : result.rank === 3 ? 'text-orange-400' : 'text-gray-300'}`}>
                #{result.rank}
              </span>
              <span className="font-medium truncate max-w-[100px]" title={result.username}>{result.username}</span>
            </div>
            <div className="font-mono text-xs text-gray-500">
              {result.wpm} WPM
            </div>
          </div>
        ))}
        {hasMore && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full mt-2 py-1 text-xs font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded flex items-center justify-center gap-1 transition-colors"
          >
            {isExpanded ? (
              <>Show Less <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>+ {match.results.length - PREVIEW_LIMIT} more <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

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
            <MatchHistoryCard key={match.round} match={match} />
          ))
        )}
      </div>
    </div>
  );
}