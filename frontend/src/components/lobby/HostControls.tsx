import React, { useState } from "react";
import { API_BASE_URL } from "@/config";
import { Play, Settings, RefreshCw, Check } from "lucide-react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface HostControlsProps {
  onNextRound: (settings?: { problemId: string; language: string }) => void;
  currentProblemId: string;
  currentLanguage: string;
  compact?: boolean;
}

export default function HostControls({ onNextRound, currentProblemId, currentLanguage, compact = false }: HostControlsProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState(currentProblemId);
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);

  const { data: problems } = useSWR(`${API_BASE_URL}/api/problems`, fetcher);
  const { data: problemDetails } = useSWR(
    selectedProblem ? `${API_BASE_URL}/api/problems/${selectedProblem}` : null,
    fetcher
  );

  // Reset language to first available when problem changes
  React.useEffect(() => {
    if (problemDetails?.languages && problemDetails.languages.length > 0) {
      const firstLanguage = problemDetails.languages[0];
      // Only reset if the current selected language is not available for this problem
      if (!problemDetails.languages.includes(selectedLanguage)) {
        setSelectedLanguage(firstLanguage);
      }
    }
  }, [selectedProblem, problemDetails]);

  const handlePlayAgain = () => {
    onNextRound();
  };

  const handleApplySettings = () => {
    onNextRound({ problemId: selectedProblem, language: selectedLanguage });
    setShowSettings(false);
  };

  if (showSettings) {
    return (
      <div className={`bg-white p-6 rounded-xl shadow-lg border border-gray-200 space-y-4 animate-in fade-in zoom-in-95 duration-200 ${compact ? 'absolute right-0 top-0 z-50 w-80' : ''}`}>
        <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Lobby Settings
        </h3>
        
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Problem</label>
            <select 
              value={selectedProblem}
              onChange={(e) => setSelectedProblem(e.target.value)}
              className="w-full p-2 rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-900 font-medium"
            >
              {problems?.map((p: any) => (
                <option key={p.id} value={p.id}>{p.title} ({p.difficulty})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Language</label>
            <div className="flex gap-2">
              {problemDetails?.languages.map((lang: string) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${
                    selectedLanguage === lang 
                      ? "bg-black text-white border-black" 
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button 
            onClick={() => setShowSettings(false)}
            className="flex-1 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button 
            onClick={handleApplySettings}
            className="flex-1 py-2 bg-teal-600 text-white text-sm font-bold rounded-lg hover:bg-teal-700 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {compact ? 'Apply' : 'Apply & Next Round'}
          </button>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <button 
        onClick={() => setShowSettings(true)}
        className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
        title="Change Settings"
      >
        <Settings className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="flex gap-3">
      <button 
        onClick={handlePlayAgain}
        className="flex-1 py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg"
      >
        <RefreshCw className="w-4 h-4" />
        Play Again
      </button>
      <button 
        onClick={() => setShowSettings(true)}
        className="px-4 py-3 bg-white text-gray-700 border border-gray-200 font-bold rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm"
      >
        <Settings className="w-4 h-4" />
      </button>
    </div>
  );
}