"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Highlight, themes } from "prism-react-renderer";

const RAW_CODE = 
`prevMap = {}

  for i, n in enumerate(nums):
      diff = target - n
      if diff in prevMap:
          return [prevMap[diff], i]
      prevMap[n] = i`;

export default function TypingEngine() {
  const [userInput, setUserInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleFocus = () => inputRef.current?.focus();

  // 1. Identify Spacer Lines (Empty Visual Lines)
  const visualToLogicalMap = useMemo(() => {
    const lines = RAW_CODE.split("\n");
    let logicalIndex = 0;
    return lines.map((line) => {
      const isWhitespaceOnly = line.trim().length === 0;
      return isWhitespaceOnly ? -1 : logicalIndex++;
    });
  }, []);

  // 2. Create GAME_CODE (Sanitized)
  const GAME_CODE = useMemo(() => {
    return RAW_CODE.split("\n")
      .filter(line => line.trim().length > 0)
      .map(line => line.trimStart())
      .join("\n");
  }, []);

  // 3. Scroll Logic
  useEffect(() => {
    const cursorElement = document.getElementById("active-cursor");
    if (cursorElement && scrollContainerRef.current) {
      cursorElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }
  }, [userInput]);

 // ----------------------------------------------------------------
  // ⌨INPUT LOGIC (Strict Enter Gate + Newline Guard)
  // ----------------------------------------------------------------
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;

    // 1. ALLOW BACKSPACE (Always allow deleting)
    if (newValue.length < userInput.length) {
      setUserInput(newValue);
      return;
    }

    // 2. STOP OVERFLOW
    if (newValue.length > GAME_CODE.length) return;

    // 3. ANALYZE INPUT
    const currentCharIndex = userInput.length;
    const expectedChar = GAME_CODE[currentCharIndex];
    const typedChar = newValue.slice(-1); // The character user just typed

    // BUG FIX: THE STRICT ENTER GATE
    // If user hit Enter, but the game DOES NOT expect Enter... BLOCK IT.
    if (typedChar === "\n" && expectedChar !== "\n") {
      return; 
    }

    // 4. NEWLINE GUARD (The Reverse Logic)
    // If the game EXPECTS Enter, but user typed something else... BLOCK IT.
    if (expectedChar === "\n" && typedChar !== "\n") {
      return;
    }

    // 5. Standard Typing (Valid character OR Valid Enter)
    setUserInput(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") e.preventDefault();
  };

  return (
    <div 
      className="relative w-full max-w-3xl mx-auto p-8 bg-[#0a0a0a] rounded-xl shadow-2xl overflow-hidden font-mono text-xl leading-relaxed border border-gray-800"
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
        className="overflow-auto max-h-[50vh] pb-32 pt-32 no-scrollbar"
      >
        <Highlight theme={themes.vsDark} code={RAW_CODE} language="python">
          {({ className, style, tokens, getLineProps, getTokenProps }) => {
            
            let logicalCharIndex = 0;
            
            return (
              <pre className={className} style={{ ...style, margin: 0, background: "transparent", minWidth: "fit-content" }}>
                {tokens.map((line, visualLineIndex) => {
                  
                  const logicalLineIndex = visualToLogicalMap[visualLineIndex];
                  const isSpacerLine = logicalLineIndex === -1;

                  // 🟢 FIX FOR SPACER LINES:
                  // Render a safe empty character to ensure height is preserved
                  if (isSpacerLine) {
                    return (
                      <div key={visualLineIndex} {...getLineProps({ line })} className="opacity-50 select-none">
                        <span>&nbsp;</span>
                      </div>
                    );
                  }

                  // Line Metadata
                  const rawLineContent = line.map(t => t.content).join("");
                  const leadingSpaceCount = rawLineContent.length - rawLineContent.trimStart().length;

                  // Spotlight Logic
                  const userLogicalLineIndex = userInput.split("\n").length - 1;
                  const isLineActive = logicalLineIndex === userLogicalLineIndex;
                  const lineStyle = isLineActive 
                    ? "opacity-100 scale-100 blur-none" 
                    : "opacity-40 blur-[1px] scale-[0.99]"; 

                  // Render Tokens
                  let charCountInLine = 0;
                  
                  const lineContent = line.map((token, key) => {
                    const tokenProps = getTokenProps({ token, key });
                    
                    return token.content.split("").map((char, charKey) => {
                      const currentCharIndexInLine = charCountInLine++;
                      const isIndentation = currentCharIndexInLine < leadingSpaceCount;

                      // A. Indentation (Skipped logic)
                      if (isIndentation) {
                        return (
                          <span key={`${key}-${charKey}`} className="opacity-0 select-none pointer-events-none">
                            {char}
                          </span>
                        );
                      }

                      // B. Content (Logic Active)
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

                  // 🟢 FIX FOR NEWLINE RENDER:
                  // We explicitly handle the cursor for the newline position.
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
                         {/* Logic: If they typed a wrong char at the end, show red return. Otherwise invisible. */}
                         {userChar !== undefined && userChar !== "\n" ? (
                           <span className="text-red-500 bg-red-900/50">⏎</span> 
                         ) : (
                           "\u200B" // Zero-width space (safe for layout)
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