"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Highlight, themes } from "prism-react-renderer";
import confetti from "canvas-confetti";
import { Timer, Zap, Target } from "lucide-react"; // Make sure you have lucide-react installed

interface TypingEngineProps {
  code: string; 
  onFinish: (stats: GameStats) => void; 
}

interface GameStats {
  wpm: number;
  accuracy: number;
  timeMs: number;
}

export default function TypingEngine({ code: RAW_CODE = "", onFinish }: TypingEngineProps) {
  const [userInput, setUserInput] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  
  // LIVE STATS STATE
  const [currentWpm, setCurrentWpm] = useState(0);
  const [currentAccuracy, setCurrentAccuracy] = useState(100);
  const [elapsedTime, setElapsedTime] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleFocus = () => inputRef.current?.focus();

  // ----------------------------------------------------------------
  // 🧠 MODEL: PRE-PROCESSING
  // ----------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // ⏱️ LIVE TIMER LOGIC
  // ----------------------------------------------------------------
  useEffect(() => {
    if (startTime && !isFinished) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100); // Update every 100ms
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [startTime, isFinished]);

  // ----------------------------------------------------------------
  // 🧹 STATE HYGIENE
  // ----------------------------------------------------------------
  useEffect(() => {
    setUserInput("");
    setStartTime(null);
    setIsFinished(false);
    setElapsedTime(0);
    setCurrentWpm(0);
    setCurrentAccuracy(100);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [RAW_CODE]); 

  // ----------------------------------------------------------------
  // 🔄 SCROLL LOGIC
  // ----------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // 🧮 STATS CALCULATOR HELPER
  // ----------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // ⌨️ INPUT LOGIC
  // ----------------------------------------------------------------
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

    // 6. CHECK WIN CONDITION (LENGTH CHECK) 🏆
    if (newValue.length === GAME_CODE.length) {
      setIsFinished(true);
      const finalStats = calculateStats(newValue, Date.now());
      
      // 🎉 FIRE CONFETTI
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        zIndex: 9999, 
        colors: ['#4ade80', '#ffffff', '#fbbf24']
      });
      
      // ⏳ WAIT 1 SECOND then call Parent
      setTimeout(() => {
        onFinish(finalStats);
      }, 1000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") e.preventDefault();
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">
      
      {/* 📊 LIVE HUD */}
      <div className="flex justify-between items-center bg-[#1e1e1e] p-4 rounded-lg border border-gray-800 text-gray-300 font-mono text-sm">
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-blue-400" />
            <span>{(elapsedTime / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span>{currentWpm} WPM</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-green-400" />
            <span>{currentAccuracy}%</span>
          </div>
        </div>
        <div className="opacity-50">
          {userInput.length} / {GAME_CODE.length} chars
        </div>
      </div>

      <div 
        className="relative bg-[#0a0a0a] rounded-xl shadow-2xl overflow-hidden font-mono text-xl leading-relaxed border border-gray-800"
        onClick={handleFocus}
      >
        <textarea
          ref={inputRef}
          value={userInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          readOnly={isFinished} // Disable input when done
          className="absolute inset-0 opacity-0 cursor-text z-10 w-full h-full resize-none disabled:cursor-not-allowed"
          autoComplete="off"
          spellCheck="false"
        />

        <div 
          ref={scrollContainerRef} 
          className="relative overflow-auto max-h-[60vh] bg-[#1e1e1e] px-8 py-32 scrollbar-hide"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none"
          }}
        >
          <Highlight theme={themes.vsDark} code={RAW_CODE} language="python">
            {({ className, style, tokens, getLineProps, getTokenProps }) => {
              
              let logicalCharIndex = 0;
              
              return (
                <pre className={className} style={{ ...style, backgroundColor: "transparent", margin: 0, minWidth: "fit-content" }}>
                  {tokens.map((line, visualLineIndex) => {
                    
                    const logicalLineIndex = visualToLogicalMap[visualLineIndex];
                    const isSpacerLine = logicalLineIndex === -1;

                    if (isSpacerLine) {
                      return (
                        <div key={visualLineIndex} {...getLineProps({ line })} className="opacity-50 select-none">
                          <span>&nbsp;</span>
                        </div>
                      );
                    }

                    const rawLineContent = line.map(t => t.content).join("");
                    const leadingSpaceCount = rawLineContent.length - rawLineContent.trimStart().length;

                    // Spotlight Logic
                    const userLogicalLineIndex = userInput.split("\n").length - 1;
                    const isLineActive = logicalLineIndex === userLogicalLineIndex;
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
                          {visualLineIndex + 1}
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
    </div>
  );
}