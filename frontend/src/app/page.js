// frontend/src/app/page.js
"use client";

import React, { useState, useEffect } from "react";
import { Highlight, themes } from "prism-react-renderer";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { FaGithub } from "react-icons/fa";
import { Play, Terminal, Users, Plus, ArrowRight } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import useSWR from "swr";
import { API_BASE_URL } from "@/config";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function LandingPage() {
  const router = useRouter();
  const { login, logout, user } = useAuth();
  const [text, setText] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const fullText = 'print("Speed(t)Code")';

  // Check system status via leaderboard endpoint
  const { data: healthCheck, error: healthError } = useSWR(`${API_BASE_URL}/api/leaderboard/1?language=python`, fetcher);
  
  const getSystemStatus = () => {
    if (healthError) return { 
      text: "System Offline", 
      bg: "bg-red-100/80 border-red-200", 
      textClass: "text-red-700 font-bold",
      dotPing: "bg-red-400",
      dotColor: "bg-red-500"
    };
    if (healthCheck?.status === "unavailable") return { 
      text: "Stats Offline", 
      bg: "bg-yellow-100/80 border-yellow-200", 
      textClass: "text-yellow-700 font-bold",
      dotPing: "bg-yellow-400",
      dotColor: "bg-yellow-500"
    };
    return { 
      text: "Systems Operational", 
      bg: "bg-white/40 border-white/20", 
      textClass: "",
      dotPing: "bg-green-400",
      dotColor: "bg-green-500"
    };
  };

  const status = getSystemStatus();

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
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen overflow-hidden relative flex flex-col items-center justify-center">

      {/* Auth Status */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md p-1.5 pr-4 rounded-full border border-white/50 shadow-sm hover:shadow-md transition-all">
            <button onClick={() => router.push("/profile")} className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 p-[1px] overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.username} className="w-full h-full object-cover rounded-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white text-teal-600 font-bold text-xs rounded-full">
                  {user.username[0].toUpperCase()}
                </div>
              )}
            </button>
            <div className="text-right hidden sm:block">
              <button onClick={() => router.push("/profile")} className="text-sm font-bold text-gray-800 hover:text-teal-700 transition-colors block leading-tight">{user.username}</button>
              <button onClick={logout} className="text-[10px] font-semibold text-red-500 hover:text-red-600 uppercase tracking-wider">Sign Out</button>
            </div>
          </div>
        ) : (
          <button 
            onClick={login}
            className="px-5 py-2.5 bg-black text-white text-sm font-bold rounded-full hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Sign In
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="z-10 flex flex-col items-center space-y-12 w-full max-w-5xl px-4 pt-10">
        
        {/* Animated Title Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center space-y-8"
        >
          {/* Code Window */}
          <div className="inline-block rounded-2xl bg-[#1e1e1e] shadow-2xl transform hover:scale-[1.01] transition-transform duration-500 overflow-hidden border border-white/10 ring-1 ring-black/5">
            {/* Window Controls */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#2d2d2d] border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
              <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
              <div className="ml-4 text-xs text-gray-400 font-mono flex items-center gap-2">
                <Terminal className="w-3 h-3" />
                <span>main.py</span>
              </div>
            </div>
            
            {/* Code Content */}
            <div className="p-8 pt-6 text-left">
              <Highlight theme={themes.vsDark} code={text} language="python">
                {({ className, style, tokens, getLineProps, getTokenProps }) => (
                  <code className={`font-mono text-3xl md:text-5xl lg:text-6xl whitespace-nowrap ${className}`} style={{ ...style, backgroundColor: "transparent" }}>
                    {tokens.map((line, i) => (
                      <React.Fragment key={i}>
                        {line.map((token, tokenIndex) => {
                          const tokenProps = getTokenProps({ token });
                          const { key: _kp, ...restTokenProps } = tokenProps || {};
                          return <span key={tokenIndex} {...restTokenProps} />;
                        })}
                      </React.Fragment>
                    ))}
                    <span className="animate-pulse border-l-4 border-teal-400 ml-1 h-10 md:h-14 inline-block align-middle shadow-[0_0_10px_rgba(45,212,191,0.5)]"></span>
                  </code>
                )}
              </Highlight>
            </div>
          </div>

          {/* Humorous Subtitle */}
          <div className="space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-blue-600">fastest</span> way to prove you can code.
            </h2>
            <p className="text-gray-600 text-lg font-medium italic opacity-80">
              "It's like LeetCode, but for speed. Hence the 't'. <br className="hidden sm:block"/>(We couldn't afford the other domain name.)"
            </p>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex flex-col gap-6 w-full max-w-md"
        >
          <button 
            onClick={() => router.push("/play")}
            className="group relative w-full flex items-center justify-center gap-4 px-8 py-5 bg-black text-white font-bold text-lg rounded-2xl hover:bg-gray-900 transition-all transform hover:-translate-y-1 shadow-xl hover:shadow-2xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <Play className="w-6 h-6 fill-white group-hover:scale-110 transition-transform" />
            <span>Start Typing</span>
          </button>

          {/* Lobby Controls */}
          <div className="flex gap-3 w-full">
            <button 
              onClick={() => router.push("/lobby/create")}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-4 bg-white/80 backdrop-blur-md text-gray-900 font-bold rounded-2xl hover:bg-white transition-all shadow-lg hover:shadow-xl border border-gray-200 hover:scale-[1.02]"
            >
              <Plus className="w-5 h-5" />
              <span>New Lobby</span>
            </button>
            
            <div className="flex-[1.4] relative group">
              <input 
                type="text" 
                placeholder="ENTER CODE" 
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && joinCode) {
                    router.push(`/lobby/${joinCode}`);
                  }
                }}
                className="w-full h-full px-4 py-4 rounded-2xl border-2 border-transparent bg-white backdrop-blur-md focus:bg-white focus:border-teal-500 focus:outline-none font-mono text-center uppercase tracking-[0.2em] text-lg text-black font-bold placeholder:text-gray-400 placeholder:tracking-normal shadow-lg transition-all"
                maxLength={6}
              />
              <button 
                onClick={() => joinCode && router.push(`/lobby/${joinCode}`)}
                disabled={!joinCode}
                className="absolute right-2 top-2 bottom-2 aspect-square bg-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-0 disabled:scale-50 transition-all shadow-md flex items-center justify-center"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Auth Options */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="flex flex-col items-center space-y-4 w-full max-w-xs"
        >
          {!user && (
            <>
              <div className="flex items-center w-full gap-4 opacity-50">
                <div className="h-px bg-gray-300 flex-1"></div>
                <span className="text-gray-400 text-xs uppercase tracking-widest font-bold">or</span>
                <div className="h-px bg-gray-300 flex-1"></div>
              </div>

              <button 
                onClick={login}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5 group"
              >
                <FaGithub className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                <span className="font-medium">Continue with GitHub</span>
              </button>
            </>
          )}
        </motion.div>

      </div>

      {/* Footer Stats - Moved to Bottom Left (avoid overlapping content) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute bottom-6 left-6 flex gap-4 text-gray-500 font-mono text-xs font-semibold tracking-wider uppercase hidden md:flex z-40"
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/40 backdrop-blur-sm border border-white/20 shadow-sm">
          <Terminal className="w-3 h-3" />
          <span>v1.0.0</span>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm border shadow-sm transition-colors ${status.bg}`}>
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status.dotPing}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${status.dotColor}`}></span>
          </span>
          <span className={status.textClass}>
            {status.text}
          </span>
        </div>
      </motion.div>

    </div>
  );
}