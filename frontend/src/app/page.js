// frontend/src/app/page.js
"use client";

import React, { useState, useEffect } from "react";
import { Highlight, themes } from "prism-react-renderer";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { FaGithub } from "react-icons/fa";
import { Play, Terminal, Users, Plus, ArrowRight } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const fullText = 'print("Hello, Speed(t)Code!")';

  // Typewriter effect for the title
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index <= fullText.length) {
        setText(fullText.slice(0, index));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#DDFFF7] text-black overflow-hidden relative flex flex-col items-center justify-center">
      
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Main Content */}
      <div className="z-10 flex flex-col items-center space-y-12 w-full max-w-4xl px-4">
        
        {/* Animated Title */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center space-y-6"
        >
          <div className="inline-block p-6 rounded-xl bg-white/30 backdrop-blur-md border border-white/50 shadow-xl transform -rotate-1">
            <Highlight theme={themes.vsLight} code={text} language="python">
              {({ className, style, tokens, getLineProps, getTokenProps }) => (
                <code className={`font-mono text-2xl md:text-4xl lg:text-5xl whitespace-nowrap ${className}`} style={{ ...style, backgroundColor: "transparent" }}>
                  {tokens.map((line, i) => (
                    <React.Fragment key={i}>
                      {line.map((token, tokenIndex) => {
                        const tokenProps = getTokenProps({ token });
                        const { key: _kp, ...restTokenProps } = tokenProps || {};
                        return <span key={tokenIndex} {...restTokenProps} />;
                      })}
                    </React.Fragment>
                  ))}
                  <span className="animate-pulse border-l-2 border-gray-800 ml-1 h-8 inline-block align-middle"></span>
                </code>
              )}
            </Highlight>
          </div>
          <p className="text-gray-700 text-lg md:text-xl max-w-2xl mx-auto mt-4 font-medium">
            Master the art of coding speed. Practice real syntax, compete with friends, and climb the global leaderboard.
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex flex-col gap-6 w-full max-w-md"
        >
          <button 
            onClick={() => router.push("/play")}
            className="group relative w-full flex items-center justify-center gap-3 px-8 py-4 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all transform hover:scale-105 shadow-lg shadow-teal-500/30"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>Play Now</span>
            <div className="absolute inset-0 rounded-xl ring-2 ring-white/20 group-hover:ring-white/40 animate-pulse"></div>
          </button>

          {/* Lobby Controls */}
          <div className="flex gap-4 w-full">
            <button 
              onClick={() => router.push("/lobby/create")}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/80 backdrop-blur-sm text-teal-800 font-bold rounded-xl hover:bg-white transition-all shadow-md border border-teal-100 hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>Create Lobby</span>
            </button>
            
            <div className="flex-1 flex gap-2">
              <input 
                type="text" 
                placeholder="CODE" 
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && joinCode) {
                    router.push(`/lobby/${joinCode}`);
                  }
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white/80 backdrop-blur-sm font-mono text-center uppercase tracking-widest text-sm placeholder:text-gray-400"
                maxLength={6}
              />
              <button 
                onClick={() => joinCode && router.push(`/lobby/${joinCode}`)}
                disabled={!joinCode}
                className="px-4 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Auth Options */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="flex flex-col items-center space-y-4 w-full max-w-xs"
        >
          <div className="flex items-center w-full gap-4">
            <div className="h-px bg-gray-400 flex-1"></div>
            <span className="text-gray-500 text-sm uppercase tracking-wider font-semibold">or sign in</span>
            <div className="h-px bg-gray-400 flex-1"></div>
          </div>

          <div className="flex gap-4 w-full">
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#24292e] text-white border border-transparent rounded-lg hover:bg-[#2f363d] transition-all shadow-sm">
              <FaGithub className="w-5 h-5" />
              <span className="font-medium">Continue with GitHub</span>
            </button>
          </div>
        </motion.div>

      </div>

      {/* Footer Stats */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.8 }}
        className="absolute bottom-8 flex gap-12 text-gray-600 font-mono text-sm font-medium"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          <span>Python • JS • C++</span>
        </div>
        <div>
          <span className="text-green-600">●</span> 1,240 Online
        </div>
      </motion.div>

    </div>
  );
}