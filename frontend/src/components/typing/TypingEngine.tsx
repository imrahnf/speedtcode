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

export default function TypingEngine({ code: RAW_CODE = "", problemId, language, onFinish, onSubmitStats, maxLinesVisible = 10, onMaxLinesChange }: TypingEngineProps) {
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

  const visualToLogicalMap = useMemo(() => {
    const lines = RAW_CODE.split("\n");
    let logicalIndex = 0;
    return lines.map((line) => {
      const isWhitespaceOnly = line.trim().length === 0;
      return isWhitespaceOnly ? -1 : logicalIndex++;
    });
  }, [RAW_CODE]);

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
      scrollContainerRef.current.scrollTop = 0;
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [RAW_CODE]); 

  useEffect(() => {
    const container = scrollContainerRef.current;
    const cursor = document.getElementById("active-cursor");

    if (container && cursor) {
      cursor.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

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
    
    // Accuracy Logic: correct chars / total typed chars
    let correctChars = 0;
    for (let i = 0; i < input.length; i++) {
      if (input[i] === GAME_CODE[i]) correctChars++;
    }
    
    const accuracy = input.length > 0 ? Math.round((correctChars / input.length) * 100) : 100;
    // WPM: (Total Chars / 5) / Minutes
    const wpm = Math.round((input.length / 5) / (minutes || 0.001));

    return { wpm, accuracy, timeMs: durationMs };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // 0. STOP IF FINISHED
    if (isFinished) return;

    const newValue = e.target.value;

    // A. Start Timer
    if (!startTime && newValue.length === 1) {
      setStartTime(Date.now());
    }

    // 1. ALLOW BACKSPACE
    if (newValue.length < userInput.length) {
      setUserInput(newValue);
      return;
    }

    // 2. STOP OVERFLOW (Win Condition Check happens after update)
    if (newValue.length > GAME_CODE.length) return;

    // 3. STRICT GATES (Newline Guard)
    // We still force Enter keys to keep visual alignment, but allow typos elsewhere
    const currentCharIndex = userInput.length;
    const expectedChar = GAME_CODE[currentCharIndex];
    const typedChar = newValue.slice(-1);

    if (typedChar === "\n" && expectedChar !== "\n") return; // Premature Enter
    if (expectedChar === "\n" && typedChar !== "\n") return; // Missed Enter

    // 4. UPDATE STATE
    setUserInput(newValue);

    // 5. UPDATE LIVE STATS
    if (startTime) {
      const liveStats = calculateStats(newValue);
      setCurrentWpm(liveStats.wpm);
      setCurrentAccuracy(liveStats.accuracy);
    }

    // 6. CHECK WIN CONDITION (LENGTH CHECK) 
    if (newValue.length === GAME_CODE.length) {
      setIsFinished(true);
      const stats = calculateStats(newValue, Date.now());
      setFinalStats(stats);
      
      //  CONFETTI (softer, balanced burst)
      const confettiDefaults = {
        spread: 130,
        startVelocity: 55,
        ticks: 220,
        gravity: 0.7,
        scalar: 1.5, // slightly larger/thicker pieces
        zIndex: 9999,
      };

      confetti({
        ...confettiDefaults,
        particleCount: 140,
        origin: { x: 0.02, y: 0.98 }, // bottom-left edge
      });

      confetti({
        ...confettiDefaults,
        particleCount: 140,
        origin: { x: 0.98, y: 0.98 }, // bottom-right edge
      });

    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") e.preventDefault();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
  };

  useEffect(() => {
    if (!isFinished || !finalStats || hasSubmitted) return;

    const payload: GameResultPayload = {
      ...finalStats,
      problemId,
      rawLength: RAW_CODE.length,
      language,
    };

    // Notify parent immediately for UI state
    if (onFinish) onFinish(finalStats);

    // Optional backend submission (parent can add auth token)
    const submit = async () => {
      if (onSubmitStats) {
        try {
          const rank = await onSubmitStats(payload);
          if (typeof rank === "number") {
            setUserRank(rank);
          }
        } catch (err) {
          console.error("Failed to submit stats", err);
        }
      }
    };

    submit();
    setHasSubmitted(true);
  }, [isFinished, finalStats, hasSubmitted, onFinish, onSubmitStats, problemId, RAW_CODE.length]);

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
          <Highlight theme={themes.vsLight} code={RAW_CODE} language={language || "python"}>
            {({ tokens: allTokens }) => (
              <>
                {[1, 5, 10, 20, "All"].map((lineCount) => {
                  const value = lineCount === "All" ? allTokens.length : (lineCount as number);
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
              </>
            )}
          </Highlight>
        </div>
      </div>

      <div 
        className="relative bg-white/30 backdrop-blur-md rounded-xl shadow-2xl overflow-hidden font-mono text-xl leading-relaxed border border-white/40"
        onClick={handleFocus}
      >
        <textarea
          ref={inputRef}
          value={userInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          readOnly={isFinished} // Disable input when done
          className="absolute inset-0 opacity-0 cursor-text z-10 w-full h-full resize-none disabled:cursor-not-allowed"
          autoComplete="off"
          spellCheck="false"
        />

        <div 
          ref={scrollContainerRef} 
          className="relative overflow-auto max-h-[60vh] bg-white/20 px-8 py-12 scrollbar-hide font-semibold"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none"
          }}
        >
          <Highlight theme={themes.vsLight} code={RAW_CODE} language={language || "python"}>
            {({ className, style, tokens: allTokens, getLineProps, getTokenProps }) => {
              // Calculate which logical line the cursor is on
              const userNewlineCount = (userInput.match(/\n/g) || []).length;
              const cursorLogicalLine = userNewlineCount;
              
              // Calculate visible range: ensure cursor line is visible
              const startLine = Math.max(0, cursorLogicalLine - Math.floor(displayLines / 2));
              const endLine = Math.min(allTokens.length, startLine + displayLines);
              const adjustedStartLine = Math.max(0, endLine - displayLines);
              
              const visibleTokens = allTokens.slice(adjustedStartLine, endLine);
              const visualLineOffset = adjustedStartLine;
              
              let logicalCharIndex = 0;
              
              // Skip characters from lines before the visible range
              for (let i = 0; i < adjustedStartLine; i++) {
                const lineTokens = allTokens[i];
                
                // 1. Calculate the indentation depth for this specific line
                const rawLineContent = lineTokens.map(t => t.content).join("");
                const leadingSpaceCount = rawLineContent.length - rawLineContent.trimStart().length;

                let charCountInLine = 0;

                // 2. Iterate tokens and only count NON-indentation chars
                for (const token of lineTokens) {
                  for (let c = 0; c < token.content.length; c++) {
                    const currentCharIndexInLine = charCountInLine++;
                    // Only increment the logical index if this is NOT indentation
                    if (currentCharIndexInLine >= leadingSpaceCount) {
                      logicalCharIndex++;
                    }
                  }
                }
                // 3. Count the newline
                logicalCharIndex++; 
              }
              
              return (
                <pre className={className} style={{ ...style, backgroundColor: "transparent", margin: 0, minWidth: "fit-content", fontWeight: 600 }}>
                  {visibleTokens.map((line, visualLineIndex) => {
                    const logicalLineIndex = visualLineOffset + visualLineIndex;
                    const mapValue = visualToLogicalMap[logicalLineIndex];
                    const isSpacerLine = mapValue === -1;

                    if (isSpacerLine) {
                      return (
                        <div key={visualLineIndex} {...getLineProps({ line })} className="opacity-50 select-none">
                          <span>&nbsp;</span>
                        </div>
                      );
                    }

                    const rawLineContent = line.map(t => t.content).join("");
                    const leadingSpaceCount = rawLineContent.length - rawLineContent.trimStart().length;

                    // Spotlight Logic: Count actual newlines in user input to determine which logical line they're on
                    const userNewlineCount = (userInput.match(/\n/g) || []).length;
                    const isLineActive = mapValue === userNewlineCount;
                    const lineStyle = isLineActive 
                      ? "opacity-100 scale-100 blur-none" 
                      : "opacity-40 blur-[1px] scale-[0.99]"; 

                    let charCountInLine = 0;
                    
                    const lineContent = line.map((token, key) => {
                      const tokenProps = getTokenProps({ token, key });
                      
                      return token.content.split("").map((char, charKey) => {
                        const currentCharIndexInLine = charCountInLine++;
                        const isIndentation = currentCharIndexInLine < leadingSpaceCount;

                        if (isIndentation) {
                          return (
                            <span key={`${key}-${charKey}`} className="opacity-0 select-none pointer-events-none">
                              {char}
                            </span>
                          );
                        }

                        const currentGlobalIndex = logicalCharIndex++;
                        const userChar = userInput[currentGlobalIndex];
                        const isCursor = currentGlobalIndex === userInput.length;
                        
                        let displayClass = "";
                        let displayStyle = {};

                        if (userChar !== undefined) {
                          if (userChar === char) {
                            displayClass = "text-green-400";
                            displayStyle = { color: "#4ade80" };
                          } else {
                            // Red for error
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
                    const isLastLogicalLine = logicalCharIndex >= GAME_CODE.length;

                    if (!isLastLogicalLine) {
                       const newlineIndex = logicalCharIndex++;
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
                        className={`transition-all duration-300 ease-in-out ${lineStyle}`}
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

      {/* RESULTS CARD (INLINE) */}
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
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTop = 0;
                  scrollContainerRef.current.scrollLeft = 0;
                }
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