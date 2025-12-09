"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Highlight, themes } from "prism-react-renderer";
import confetti from "canvas-confetti";
import { Timer, Zap, Target, Trophy } from "lucide-react";

interface TypingEngineProps {
  code: string;
  problemId?: string;
  language?: "python" | "javascript" | "cpp" | string;
  onFinish?: (stats: GameStats) => void;
  onSubmitStats?: (payload: GameResultPayload) => Promise<void>;
  maxLinesVisible?: number;
  onMaxLinesChange?: (lines: number) => void;
}

interface GameStats {
  wpm: number;
  accuracy: number;
  timeMs: number;
}

interface GameResultPayload extends GameStats {
  problemId?: string;
  rawLength: number;
  language?: string;
}

// --- ANIMATION CONSTANTS ---
const LINE_HEIGHT_PX = 36; // Height of each line in pixels
const FONT_SIZE_PX = 20;   // roughly text-xl

export default function TypingEngine({ 
  code: RAW_CODE = "", 
  problemId, 
  language, 
  onFinish, 
  onSubmitStats, 
  maxLinesVisible = 10, 
  onMaxLinesChange 
}: TypingEngineProps) {
  
  const [userInput, setUserInput] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [displayLines, setDisplayLines] = useState(maxLinesVisible);
  
  const [currentWpm, setCurrentWpm] = useState(0);
  const [currentAccuracy, setCurrentAccuracy] = useState(100);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [finalStats, setFinalStats] = useState<GameStats | null>(null);
  const [userRank, setUserRank] = useState<number>(1);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleFocus = () => inputRef.current?.focus();

  // 1. LOGICAL MAP: Maps visual lines to logical code lines (skips empty spacer lines)
  const visualToLogicalMap = useMemo(() => {
    const lines = RAW_CODE.split("\n");
    let logicalIndex = 0;
    return lines.map((line) => {
      const isWhitespaceOnly = line.trim().length === 0;
      return isWhitespaceOnly ? -1 : logicalIndex++;
    });
  }, [RAW_CODE]);

  // 2. GAME CODE: The actual string the user needs to type (indentation removed)
  const GAME_CODE = useMemo(() => {
    return RAW_CODE
      .replace(/\r/g, "")
      .split("\n")
      .filter(line => line.trim().length > 0)
      .map(line => line.trimStart())
      .join("\n");
  }, [RAW_CODE]);

  useEffect(() => {
    if (startTime && !isFinished) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [startTime, isFinished]);

  // Reset Logic
  useEffect(() => {
    setUserInput("");
    setStartTime(null);
    setIsFinished(false);
    setElapsedTime(0);
    setCurrentWpm(0);
    setCurrentAccuracy(100);
    setHasSubmitted(false);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [RAW_CODE]); 

  // Auto-Scroll Logic (Horizontal Only - Vertical is handled by Transform)
  useEffect(() => {
    const container = scrollContainerRef.current;
    const cursor = document.getElementById("active-cursor");

    if (container && cursor) {
      const containerRect = container.getBoundingClientRect();
      const cursorRect = cursor.getBoundingClientRect();
      const relativeLeft = cursorRect.left - containerRect.left;
      const containerWidth = containerRect.width;
      
      const RIGHT_BUFFER = 150; 
      const LEFT_BUFFER = 100;  

      if (relativeLeft > containerWidth - RIGHT_BUFFER) {
        container.scrollLeft += (relativeLeft - (containerWidth - RIGHT_BUFFER));
      }
      if (relativeLeft < LEFT_BUFFER) {
        const underflow = LEFT_BUFFER - relativeLeft;
        container.scrollLeft = Math.max(0, container.scrollLeft - underflow);
      }
    }
  }, [userInput]);

  const calculateStats = (input: string, endTime: number | null = null) => {
    const now = endTime || Date.now();
    const durationMs = now - (startTime || now);
    const minutes = durationMs / 60000;
    
    let correctChars = 0;
    for (let i = 0; i < input.length; i++) {
      if (input[i] === GAME_CODE[i]) correctChars++;
    }
    
    const accuracy = input.length > 0 ? Math.round((correctChars / input.length) * 100) : 100;
    const wpm = Math.round((input.length / 5) / (minutes || 0.001));

    return { wpm, accuracy, timeMs: durationMs };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isFinished) return;
    const newValue = e.target.value;

    if (!startTime && newValue.length === 1) setStartTime(Date.now());
    
    // Allow Backspace
    if (newValue.length < userInput.length) {
      setUserInput(newValue);
      return;
    }

    // Stop Overflow
    if (newValue.length > GAME_CODE.length) return;

    // Strict Newline Guard
    const currentCharIndex = userInput.length;
    const expectedChar = GAME_CODE[currentCharIndex];
    const typedChar = newValue.slice(-1);

    if (typedChar === "\n" && expectedChar !== "\n") return; 
    if (expectedChar === "\n" && typedChar !== "\n") return; 

    setUserInput(newValue);

    if (startTime) {
      const liveStats = calculateStats(newValue);
      setCurrentWpm(liveStats.wpm);
      setCurrentAccuracy(liveStats.accuracy);
    }

    // Win Condition
    if (newValue.length === GAME_CODE.length) {
      setIsFinished(true);
      const stats = calculateStats(newValue, Date.now());
      setFinalStats(stats);
      
      const confettiDefaults = { spread: 130, startVelocity: 55, ticks: 220, gravity: 0.7, scalar: 1.5, zIndex: 9999 };
      confetti({ ...confettiDefaults, particleCount: 140, origin: { x: 0.02, y: 0.98 } });
      confetti({ ...confettiDefaults, particleCount: 140, origin: { x: 0.98, y: 0.98 } });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Tab") e.preventDefault(); };
  const handlePaste = (e: React.ClipboardEvent) => { e.preventDefault(); };

  useEffect(() => {
    if (!isFinished || !finalStats || hasSubmitted) return;
    const payload: GameResultPayload = { ...finalStats, problemId, rawLength: RAW_CODE.length, language };
    if (onFinish) onFinish(finalStats);
    const submit = async () => {
      if (onSubmitStats) {
        try {
          const rank = await onSubmitStats(payload);
          if (typeof rank === "number") setUserRank(rank);
        } catch (err) { console.error("Failed to submit stats", err); }
      }
    };
    submit();
    setHasSubmitted(true);
  }, [isFinished, finalStats, hasSubmitted, onFinish, onSubmitStats, problemId, RAW_CODE.length]);

  // --- RENDER PREP ---
  const userNewlineCount = (userInput.match(/\n/g) || []).length;
  
  // Center Calculation: -(ActiveLine * LineHeight) + (ContainerHeight/2 - LineHeight/2)
  const containerHeight = displayLines * LINE_HEIGHT_PX;
  const centerYOffset = (containerHeight / 2) - (LINE_HEIGHT_PX / 2);
  const translateY = -(userNewlineCount * LINE_HEIGHT_PX) + centerYOffset;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">
      
      {/* 📊 LIVE HUD */}
      <div className="flex justify-between items-center bg-white/20 backdrop-blur-md p-4 rounded-lg border border-white/30 text-gray-800 font-mono text-sm shadow-lg">
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-blue-600" />
            <span>{(elapsedTime / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-600" />
            <span>{currentWpm} WPM</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-teal-600" />
            <span>{currentAccuracy}%</span>
          </div>
        </div>
        <div className="opacity-70">
          {userInput.length} / {GAME_CODE.length} chars
        </div>
      </div>

      {/* LINES TOGGLE */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white/20 backdrop-blur-md rounded-lg border border-white/30 text-gray-800 font-mono text-xs shadow-lg">
        <span className="opacity-70 uppercase tracking-wider font-semibold">Lines Visible:</span>
        <div className="flex gap-2">
          {[1, 5, 10, 20, "All"].map((lineCount) => {
            const value = lineCount === "All" ? 999 : (lineCount as number); 
            return (
              <button
                key={lineCount}
                disabled={startTime !== null}
                onClick={() => {
                  setDisplayLines(value);
                  onMaxLinesChange?.(value);
                }}
                className={`px-2 py-1 rounded border transition-all text-xs font-semibold ${
                  startTime !== null
                    ? "bg-gray-300 text-gray-500 border-gray-300 cursor-not-allowed opacity-50"
                    : displayLines === value
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-700 border-gray-300 hover:border-black"
                }`}
              >
                {lineCount}
              </button>
            );
          })}
        </div>
      </div>

      {/* GAME AREA */}
      <div 
        className="relative bg-white/30 backdrop-blur-md rounded-xl shadow-2xl overflow-hidden font-mono border border-white/40"
        style={{ height: displayLines === 999 ? 'auto' : `${containerHeight}px`, transition: 'height 0.3s ease' }}
        onClick={handleFocus}
      >
        <textarea
          ref={inputRef}
          value={userInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          readOnly={isFinished}
          className="absolute inset-0 opacity-0 cursor-text z-10 w-full h-full resize-none disabled:cursor-not-allowed"
          autoComplete="off"
          spellCheck="false"
        />

        <div 
          ref={scrollContainerRef} 
          className="relative w-full h-full overflow-hidden"
          style={{
             maskImage: displayLines !== 999 ? 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)' : 'none',
             WebkitMaskImage: displayLines !== 999 ? 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)' : 'none'
          }}
        >
          <Highlight theme={themes.vsLight} code={RAW_CODE} language={language || "python"}>
            {({ className, style, tokens: allTokens, getLineProps, getTokenProps }) => {
              
              // GLOBAL TRACKER for where we are in the GAME_CODE string
              let logicalCharIndex = 0;

              return (
                <pre 
                    className={className} 
                    style={{ 
                        ...style, 
                        backgroundColor: "transparent", 
                        margin: 0, 
                        minWidth: "fit-content", 
                        fontWeight: 600,
                        fontSize: `${FONT_SIZE_PX}px`,
                        // SLIDING MAGIC
                        transform: displayLines !== 999 ? `translateY(${translateY}px)` : 'none',
                        transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)', 
                        padding: '0 2rem'
                    }}
                >
                  {allTokens.map((line, visualLineIndex) => {
                    const logicalLineIndex = visualLineIndex; 
                    const mapValue = visualToLogicalMap[logicalLineIndex];
                    const isSpacerLine = mapValue === -1;

                    // --- BUG FIX: Calculate Indentation ---
                    const rawLineContent = line.map(t => t.content).join("");
                    const leadingSpaceCount = rawLineContent.length - rawLineContent.trimStart().length;

                    // Spotlight
                    const isLineActive = mapValue === userNewlineCount;
                    
                    if (isSpacerLine) {
                        logicalCharIndex++; // Count the newline in GAME_CODE
                        return (
                            <div 
                                key={visualLineIndex} 
                                {...getLineProps({ line })} 
                                style={{ height: `${LINE_HEIGHT_PX}px`, lineHeight: `${LINE_HEIGHT_PX}px` }}
                                className="opacity-50 select-none flex items-center"
                            >
                            <span>&nbsp;</span>
                            </div>
                        );
                    }

                    const lineStyle = isLineActive 
                      ? "opacity-100 scale-100 blur-none origin-left" 
                      : "opacity-40 blur-[1px] scale-[0.98] origin-left"; 

                    let charCountInLine = 0;
                    
                    const lineContent = line.map((token, key) => {
                      const tokenProps = getTokenProps({ token, key });
                      
                      return token.content.split("").map((char, charKey) => {
                        const currentCharIndexInLine = charCountInLine++;
                        const isIndentation = currentCharIndexInLine < leadingSpaceCount;

                        // --- BUG FIX: Only increment index if valid code ---
                        if (!isIndentation) {
                            logicalCharIndex++;
                        }

                        if (isIndentation) {
                          return (
                            <span key={`${key}-${charKey}`} className="opacity-0 select-none pointer-events-none">
                              {char}
                            </span>
                          );
                        }

                        // Determine render state (Past, Current, Future)
                        const currentGlobalIndex = logicalCharIndex - 1; 
                        const userChar = userInput[currentGlobalIndex];
                        const isCursor = currentGlobalIndex === userInput.length;
                        
                        let displayClass = "";
                        let displayStyle = {};

                        if (userChar !== undefined) {
                          if (userChar === char) {
                            displayClass = "text-green-400";
                            displayStyle = { color: "#4ade80" };
                          } else {
                            displayClass = "text-red-500 bg-red-900/50";
                            displayStyle = { color: "#ef4444", backgroundColor: "rgba(127, 29, 29, 0.5)" };
                          }
                        } else {
                          displayStyle = { ...tokenProps.style };
                        }

                        return (
                          <span 
                            key={`${key}-${charKey}`} 
                            id={isCursor ? "active-cursor" : undefined} 
                            className={`${displayClass} ${isCursor ? "border-l-2 border-yellow-400 animate-pulse" : ""}`}
                            style={displayStyle}
                          >
                            {char}
                          </span>
                        );
                      });
                    });

                    // Newline Handling
                    let newlineElement = null;
                    const newlineIndex = logicalCharIndex;
                    logicalCharIndex++; // Advance for the newline itself

                    if (newlineIndex < GAME_CODE.length) {
                       const userChar = userInput[newlineIndex];
                       const isCursor = newlineIndex === userInput.length;
                       
                       newlineElement = (
                         <span 
                           key="newline" 
                           id={isCursor ? "active-cursor" : undefined}
                           className={isCursor ? "border-l-2 border-yellow-400 animate-pulse" : ""}
                         >
                           {userChar !== undefined && userChar !== "\n" ? (
                             <span className="text-red-500 bg-red-900/50">⏎</span> 
                           ) : (
                             "\u200B"
                           )}
                         </span>
                       );
                    }

                    return (
                      <div 
                        key={visualLineIndex} 
                        {...getLineProps({ line })} 
                        className={`transition-all duration-300 ease-in-out flex items-center ${lineStyle}`}
                        style={{ height: `${LINE_HEIGHT_PX}px`, lineHeight: `${LINE_HEIGHT_PX}px` }}
                      >
                        <span className="inline-block w-8 text-gray-700 select-none text-right mr-4 text-sm">
                          {logicalLineIndex + 1}
                        </span>
                        {lineContent}
                        {newlineElement}
                      </div>
                    );
                  })}
                </pre>
              );
            }}
          </Highlight>
        </div>
      </div>

      {/* RESULTS CARD */}
      {isFinished && finalStats && (
        <div className="bg-white/20 backdrop-blur-md rounded-lg p-6 border border-white/30 shadow-lg animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between gap-8 flex-wrap">
            <div className="flex gap-8 font-mono text-sm font-bold text-gray-800">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-600" />
                <div>
                  <div className="text-xs opacity-70 uppercase tracking-wider font-semibold">WPM</div>
                  <div className="text-2xl font-black">{finalStats.wpm}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-xs opacity-70 uppercase tracking-wider font-semibold">Accuracy</div>
                  <div className="text-2xl font-black">{finalStats.accuracy}%</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-xs opacity-70 uppercase tracking-wider font-semibold">Time</div>
                  <div className="text-2xl font-black">{(finalStats.timeMs / 1000).toFixed(1)}s</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-teal-600" />
                <div>
                  <div className="text-xs opacity-70 uppercase tracking-wider font-semibold">Rank</div>
                  <div className="text-2xl font-black">#{userRank}</div>
                </div>
              </div>
            </div>
            <button 
              onClick={() => {
                setIsFinished(false);
                setFinalStats(null);
                setUserInput("");
                setStartTime(null);
                setElapsedTime(0);
                setCurrentWpm(0);
                setCurrentAccuracy(100);
                setHasSubmitted(false);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="px-6 py-3 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition-all text-sm whitespace-nowrap shadow-lg"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}