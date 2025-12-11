import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";

interface Problem {
  id: string;
  title: string;
  difficulty: string;
  languages: string[];
}

interface ProblemSelectorProps {
  problems: Problem[];
  selectedProblemId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export default function ProblemSelector({ problems, selectedProblemId, onSelect, className = "" }: ProblemSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProblems, setFilteredProblems] = useState<Problem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!problems) return;
    const filtered = problems.filter((p) => 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.id.includes(searchQuery)
    );
    setFilteredProblems(filtered);
  }, [problems, searchQuery]);

  const selectedProblem = problems?.find(p => p.id === selectedProblemId);

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Select Problem</label>
      
      <div className="relative">
        {/* Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-xl hover:border-teal-500 transition-colors text-left"
        >
          <span className={`font-medium ${selectedProblem ? 'text-gray-900' : 'text-gray-400'}`}>
            {selectedProblem ? selectedProblem.title : "Choose a problem..."}
          </span>
          <Search className="w-4 h-4 text-gray-400" />
        </button>

        {/* Dropdown Content */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search problems..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full pl-10 pr-3 py-2 rounded-lg bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>
            
            <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
              {filteredProblems.length > 0 ? (
                filteredProblems.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelect(p.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-teal-50 transition-colors flex justify-between items-center border-b border-gray-50 last:border-0 ${
                      selectedProblemId === p.id ? "bg-teal-50 text-teal-900" : "text-gray-700"
                    }`}
                  >
                    <span className="font-medium truncate pr-4">{p.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded shrink-0 font-bold uppercase ${
                      p.difficulty === 'Easy' ? 'bg-green-100 text-green-700' : 
                      p.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 
                      'bg-red-100 text-red-700'
                    }`}>
                      {p.difficulty}
                    </span>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-gray-400 text-sm italic">
                  No problems found matching "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
