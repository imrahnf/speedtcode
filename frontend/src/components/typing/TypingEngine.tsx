// frontend/src/components/typing/TypingEngine.tsx
"use client";

import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from "react";
import { Highlight, themes } from "prism-react-renderer";
import confetti from "canvas-confetti";
import { Timer, Zap, Target, Trophy, Volume2, VolumeX, Activity, MousePointer2 } from "lucide-react";

// --- PROPS & INTERFACES ---
interface TypingEngineProps {
  code: string;
  problemId?: string;
  language?: "python" | "javascript" | "cpp" | string;
  onFinish?: (stats: GameStats) => void;
  onSubmitStats?: (payload: GameResultPayload) => Promise<void>;
  onProgress?: (stats: GameStats & { progress: number }) => void;
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

interface UserConfig {
  soundEnabled: boolean;
  smoothCursor: boolean;
  hitEffects: boolean;
}

// --- CONSTANTS ---
const LINE_HEIGHT_PX = 36;
const FONT_SIZE_PX = 20;

export default function TypingEngine({ 
  code: RAW_CODE = "", 
  problemId, 
  language, 
  onFinish, 
  onSubmitStats, 
  onProgress,
  maxLinesVisible = 10, 
  onMaxLinesChange 
}: TypingEngineProps) {
  
  // --- CORE STATE ---
  const [userInput, setUserInput] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [displayLines, setDisplayLines] = useState(maxLinesVisible);
  const [config, setConfig] = useState<UserConfig>({
    soundEnabled: true,
    smoothCursor: true,
    hitEffects: true
  });

  // Stats
  const [currentWpm, setCurrentWpm] = useState(0);
  const [currentAccuracy, setCurrentAccuracy] = useState(100);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [finalStats, setFinalStats] = useState<GameStats | null>(null);
  const [userRank, setUserRank] = useState<number>(1);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Refs
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const lastProgressUpdateRef = useRef<number>(0);
  
  // --- AUDIO REF (Singleton) ---
  const audioCtxRef = useRef<AudioContext | null>(null);

  // --- DERIVED MEMOS ---
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

  const handleFocus = () => inputRef.current?.focus();

  // Load config
  useEffect(() => {
    const saved = localStorage.getItem("typingConfig");
    if (saved) setConfig(JSON.parse(saved));
  }, []);

  const toggleConfig = (key: keyof UserConfig) => {
    const newConfig = { ...config, [key]: !config[key] };
    setConfig(newConfig);
    localStorage.setItem("typingConfig", JSON.stringify(newConfig));
  };

  // Timer
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
    if (scrollContainerRef.current) scrollContainerRef.current.scrollLeft = 0;
  }, [RAW_CODE]); 

  // --- SOUND FUNCTION (Uses Persistent Ref) ---
  const playSound = (type: 'thock' | 'error' | 'backspace') => {
    if (!config.soundEnabled) return;

    try {
      // 1. Initialize Context ONLY if it doesn't exist
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          audioCtxRef.current = new AudioContext();
        }
      }

      const ctx = audioCtxRef.current;
      if (!ctx) return;

      // 2. Resume if suspended (browser autoplay policy)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'thock') {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.type = "sine";
      } else if (type === 'error') {
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.type = "sawtooth";
      } else {
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);
        osc.type = "triangle";
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);

    } catch (e) {
      console.error("Audio error", e);
    }
  };


  // --- SMOOTH CURSOR LOGIC ---
  useLayoutEffect(() => {
    if (!config.smoothCursor) return;
    
    const activeChar = document.getElementById("active-cursor-anchor");
    const cursorEl = cursorRef.current;

    if (activeChar && cursorEl) {
      const container = cursorEl.offsetParent as HTMLElement; 
      
      if (container) {
          const charRect = activeChar.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          const relativeTop = charRect.top - containerRect.top;
          const relativeLeft = charRect.left - containerRect.left;
          
          cursorEl.style.transform = `translate(${relativeLeft}px, ${relativeTop}px)`;
          cursorEl.style.height = `${charRect.height}px`;
      }
    }
  }, [userInput, config.smoothCursor, displayLines]);

  // Horizontal Scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    const anchor = document.getElementById("active-cursor-anchor");

    if (container && anchor) {
      const containerRect = container.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const relativeLeft = anchorRect.left - containerRect.left;
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
    
    if (newValue.length < userInput.length) {
      playSound('backspace');
      setUserInput(newValue);
      return;
    }

    if (newValue.length > GAME_CODE.length) return;

    const currentCharIndex = userInput.length;
    const expectedChar = GAME_CODE[currentCharIndex];
    const typedChar = newValue.slice(-1);

    if (typedChar === "\n" && expectedChar !== "\n") return; 
    if (expectedChar === "\n" && typedChar !== "\n") return; 

    // CALL NEW SOUND FUNCTION
    if (typedChar === expectedChar) playSound('thock');
    else playSound('error');

    setUserInput(newValue);

    if (startTime) {
      const liveStats = calculateStats(newValue);
      setCurrentWpm(liveStats.wpm);
      setCurrentAccuracy(liveStats.accuracy);

      if (onProgress && Date.now() - lastProgressUpdateRef.current > 500) {
        const progress = Math.round((newValue.length / GAME_CODE.length) * 100);
        onProgress({ ...liveStats, progress });
        lastProgressUpdateRef.current = Date.now();
      }
    }

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
  const totalCodeLines = visualToLogicalMap.length;
  const isLongFile = displayLines !== 999 && totalCodeLines > displayLines;

  const containerHeight = isLongFile ? displayLines * LINE_HEIGHT_PX : totalCodeLines * LINE_HEIGHT_PX;
  const centerYOffset = (containerHeight / 2) - (LINE_HEIGHT_PX / 2);
  const translateY = isLongFile ? -(userNewlineCount * LINE_HEIGHT_PX) + centerYOffset : 0;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 relative group">
      


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

      {/* CONTROLS TOOLBAR */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/20 backdrop-blur-md rounded-lg border border-white/30 text-gray-800 font-mono text-xs shadow-lg z-20">
        
        {/* LEFT: LINES VISIBLE */}
        <div className="flex items-center gap-3">
          <span className="opacity-70 uppercase tracking-wider font-semibold">View:</span>
          <div className="flex gap-1">
            {[1, 3, 5, 10].map((lineCount) => {
              const value = lineCount as number;
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

        {/* RIGHT: SETTINGS TOGGLES */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => toggleConfig('soundEnabled')}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-all text-xs font-semibold ${config.soundEnabled ? 'bg-black text-white' : 'bg-white text-gray-700 border border-gray-300 hover:border-black'}`}
          >
            {config.soundEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            <span>Sound</span>
          </button>

          <button 
            onClick={() => toggleConfig('smoothCursor')}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-all text-xs font-semibold ${config.smoothCursor ? 'bg-black text-white' : 'bg-white text-gray-700 border border-gray-300 hover:border-black'}`}
          >
            <MousePointer2 className="w-3 h-3" />
            <span>Cursor</span>
          </button>

          <button 
            onClick={() => toggleConfig('hitEffects')}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-all text-xs font-semibold ${config.hitEffects ? 'bg-black text-white' : 'bg-white text-gray-700 border border-gray-300 hover:border-black'}`}
          >
            <Activity className="w-3 h-3" />
            <span>Effects</span>
          </button>
        </div>
      </div>

      {/* GAME AREA */}
      <div 
        className="relative bg-white/30 backdrop-blur-md rounded-xl shadow-2xl overflow-hidden font-mono border border-white/40"
        style={{ height: `${containerHeight}px`, transition: 'height 0.3s ease' }}
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
             maskImage: isLongFile ? 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)' : 'none',
             WebkitMaskImage: isLongFile ? 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)' : 'none'
          }}
        >
          <Highlight theme={themes.vsLight} code={RAW_CODE} language={language || "python"}>
            {({ className, style, tokens: allTokens, getLineProps, getTokenProps }) => {
              
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
                        transform: `translateY(${translateY}px)`,
                        transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)', 
                        padding: '0 2rem',
                        position: 'relative'
                    }}
                >
                  {/* SMOOTH FLOATING CURSOR */}
                  {config.smoothCursor && (
                    <div 
                      ref={cursorRef}
                      className="absolute bg-yellow-400 w-[2px] rounded-full pointer-events-none z-10"
                      style={{ 
                        top: 0, left: 0, 
                        transition: 'transform 0.1s cubic-bezier(0.2, 0, 0.2, 1), height 0.1s ease',
                        boxShadow: '0 0 8px 1px rgba(250, 204, 21, 0.6)'
                      }}
                    />
                  )}

                  {allTokens.map((line, visualLineIndex) => {
                    const logicalLineIndex = visualLineIndex; 
                    const mapValue = visualToLogicalMap[logicalLineIndex];
                    const isSpacerLine = mapValue === -1;
                    const rawLineContent = line.map(t => t.content).join("");
                    const leadingSpaceCount = rawLineContent.length - rawLineContent.trimStart().length;
                    const isLineActive = mapValue === userNewlineCount;
                    
                    if (isSpacerLine) {
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

                        const currentGlobalIndex = logicalCharIndex - 1; 
                        const userChar = userInput[currentGlobalIndex];
                        const isCursor = currentGlobalIndex === userInput.length;
                        
                        let displayClass = "";
                        let displayStyle = {};
                        let isCorrect = false;

                        if (userChar !== undefined) {
                          if (userChar === char) {
                            isCorrect = true;
                            displayClass = "text-green-400";
                            displayStyle = { color: "#4ade80", textShadow: '0 0 5px rgba(74, 222, 128, 0.5)' };
                          } else {
                            displayClass = "text-red-500 bg-red-900/50 rounded-sm";
                            displayStyle = { color: "#ef4444", backgroundColor: "rgba(127, 29, 29, 0.5)" };
                          }
                        } else {
                          displayStyle = { ...tokenProps.style };
                        }

                        if (config.hitEffects && isCorrect && currentGlobalIndex === userInput.length - 1) {
                           displayClass += " animate-pulse-scale";
                        }

                        return (
                          <span 
                            key={`${key}-${charKey}`} 
                            id={isCursor ? "active-cursor-anchor" : undefined} 
                            className={`${displayClass} ${!config.smoothCursor && isCursor ? "border-l-2 border-yellow-400 animate-pulse" : ""}`}
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
                    
                    // Only increment logicalCharIndex for newline if we are NOT at the very end of the code
                    // AND if the next char in GAME_CODE is indeed a newline (which it implicitly is between lines)
                    // However, GAME_CODE is joined by \n.
                    // If we are at the end of a line, we must account for the \n separator.
                    
                    const totalLogicalLines = visualToLogicalMap.filter(i => i !== -1).length;
                    if (mapValue < totalLogicalLines - 1) {
                        logicalCharIndex++;
                        
                        const userChar = userInput[newlineIndex];
                        const isCursor = newlineIndex === userInput.length;
                        
                        newlineElement = (
                            <span 
                            key="newline" 
                            id={isCursor ? "active-cursor-anchor" : undefined}
                            className={`inline-block ${!config.smoothCursor && isCursor ? "border-l-2 border-yellow-400 animate-pulse" : ""}`}
                            style={{ width: '1ch' }} 
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

      {/* RESULTS CARD (Same as before) */}
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
      
      {/* GLOBAL STYLE FOR PUMP EFFECT */}
      <style jsx global>{`
        @keyframes pump {
          0% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.4); filter: brightness(1.3); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        .animate-pulse-scale {
          display: inline-block;
          animation: pump 0.15s ease-out;
        }
      `}</style>
    </div>
  );
}