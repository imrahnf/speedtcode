// frontend/src/components/typing/TypingEngine.tsx
"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Highlight, themes } from "prism-react-renderer";

// 1. Define the Interface for the Parent Component (GamePage)
interface TypingEngineProps {
  code: string; // The problem text from FastAPI
  onFinish: (stats: GameStats) => void; // Callback when game ends
}

interface GameStats {
  wpm: number;
  accuracy: number;
  timeMs: number;
}

export default function TypingEngine({ code: RAW_CODE = "", onFinish }: TypingEngineProps) {
  const [userInput, setUserInput] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null); // Track time
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleFocus = () => inputRef.current?.focus();

  // ----------------------------------------------------------------
  // MODEL: PRE-PROCESSING
  // ----------------------------------------------------------------
  const visualToLogicalMap = useMemo(() => {
    const lines = RAW_CODE.split("\n");
    let logicalIndex = 0;
    return lines.map((line) => {
      const isWhitespaceOnly = line.trim().length === 0;
      return isWhitespaceOnly ? -1 : logicalIndex++;
    });
  }, [RAW_CODE]); // Dependency update: Re-calc if prop changes

  const GAME_CODE = useMemo(() => {
    return RAW_CODE.split("\n")
      .filter(line => line.trim().length > 0)
      .map(line => line.trimStart())
      .join("\n");
  }, [RAW_CODE]);

  // ----------------------------------------------------------------
  // Reset game when problem changes
  // ----------------------------------------------------------------
  useEffect(() => {
    setUserInput("");
    setStartTime(null);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }, [RAW_CODE]); 

  // ----------------------------------------------------------------
  // SCROLL LOGIC
  // ----------------------------------------------------------------
  useEffect(() => {
    const container = scrollContainerRef.current;
    const cursor = document.getElementById("active-cursor");

    if (container && cursor) {
      // 1. VERTICAL: Keep using scrollIntoView because it handles "center" perfectly
      // We use inline: "nearest" to let the browser do a baseline horizontal check,
      // but we will override it immediately below.
      cursor.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest", 
      });

      // 2. HORIZONTAL: Manual "Lookahead" Logic
      // We need to calculate if the cursor is too close to the edges.
      const containerRect = container.getBoundingClientRect();
      const cursorRect = cursor.getBoundingClientRect();

      // Where is the cursor relative to the visible window of the container?
      const relativeLeft = cursorRect.left - containerRect.left;
      const containerWidth = containerRect.width;
      
      // CONFIG: How much space (px) do you want between cursor and edge?
      const RIGHT_BUFFER = 150; // Start scrolling when 150px from right
      const LEFT_BUFFER = 100;  // Keep 100px context on the left

      // A. Too close to RIGHT edge? Scroll right.
      if (relativeLeft > containerWidth - RIGHT_BUFFER) {
        // We calculate how much we exceeded the buffer and add that to scrollLeft
        const overflow = relativeLeft - (containerWidth - RIGHT_BUFFER);
        container.scrollLeft += overflow;
      }

      // B. Too close to LEFT edge? Scroll left.
      // This specifically fixes your "Newline" issue. 
      // When you hit enter, 'relativeLeft' drops near 0. This condition catches it 
      // and snaps the view back to the left.
      if (relativeLeft < LEFT_BUFFER) {
        const underflow = LEFT_BUFFER - relativeLeft;
        container.scrollLeft = Math.max(0, container.scrollLeft - underflow);
      }
    }
  }, [userInput]);

  // Reset scroll position when problem changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [RAW_CODE]);

  // ----------------------------------------------------------------
  // INPUT LOGIC
  // ----------------------------------------------------------------
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;

    // A. Start Timer on first keystroke
    if (!startTime && newValue.length === 1) {
      setStartTime(Date.now());
    }

    // 1. ALLOW BACKSPACE
    if (newValue.length < userInput.length) {
      setUserInput(newValue);
      return;
    }

    // 2. STOP OVERFLOW
    if (newValue.length > GAME_CODE.length) return;

    // 3. STRICT GATES (Your Logic)
    const currentCharIndex = userInput.length;
    const expectedChar = GAME_CODE[currentCharIndex];
    const typedChar = newValue.slice(-1);

    if (typedChar === "\n" && expectedChar !== "\n") return; // Premature Enter
    if (expectedChar === "\n" && typedChar !== "\n") return; // Missed Enter

    // 4. UPDATE STATE
    setUserInput(newValue);

    // 5. CHECK WIN CONDITION 
    if (newValue === GAME_CODE) {
      const endTime = Date.now();
      const timeMs = endTime - (startTime || endTime);
      const minutes = timeMs / 60000;
      
      // Standard WPM Formula: (Total Chars / 5) / Minutes
      const wpm = Math.round((GAME_CODE.length / 5) / (minutes || 0.001)); // avoid div/0
      
      // Send stats back to Parent
      onFinish({
        wpm,
        accuracy: 100, // Strict mode = 100% accuracy logic
        timeMs
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") e.preventDefault();
  };

  return (
    <div 
      className="relative w-full max-w-4xl mx-auto bg-[#0a0a0a] rounded-lg shadow-2xl font-mono text-xl leading-relaxed border border-gray-800"
      onClick={handleFocus}
    >
      <textarea
        ref={inputRef}
        value={userInput}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="absolute inset-0 opacity-0 cursor-text z-10 w-full h-full resize-none"
        autoComplete="off"
        spellCheck="false"
      />

      <div 
        ref={scrollContainerRef} 
        className="overflow-auto max-h-[60vh] bg-[#DDFFF7] px-8 py-12 scrollbar-hide"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none"
        }}
      >
        <Highlight theme={themes.vsLight} code={RAW_CODE} language="python">
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
  );
}