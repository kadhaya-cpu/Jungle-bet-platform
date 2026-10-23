"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useStore } from "@/lib/store";
import Header from "@/components/Header";
import GameBoard from "@/components/GameBoard";
import LeoChatWidget from "@/components/LeoChatWidget";
import { Zap, Clock, ShieldCheck, Flame, ArrowRight, Play, Sparkles } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isAuthenticated: storeAuthenticated } = useStore();

  const isAuthed = status === "authenticated" || storeAuthenticated;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col selection:bg-teal-500 selection:text-slate-950 font-sans">
      <Header />

      <main className="flex-1 pt-24 sm:pt-28 pb-12">
        {/* ============================================================ */}
        {/* LANDING PAGE HERO SECTION                                    */}
        {/* ============================================================ */}
        <section className="w-full max-w-[1680px] mx-auto px-3 sm:px-6 mb-8">
          <div className="relative rounded-3xl bg-gradient-to-b from-[#1e293b]/95 via-[#1e293b]/80 to-[#0f172a] border border-white/10 p-6 sm:p-12 shadow-2xl shadow-blue-500/10 overflow-hidden">
            {/* AMBIENT BACKGROUND GLOWS */}
            <div className="absolute -top-24 -left-24 w-80 h-80 bg-blue-600/15 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute top-1/2 -right-24 w-80 h-80 bg-teal-500/15 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto">
              {/* LIVE RADAR BADGE */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 mb-5 backdrop-blur-md shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
                </span>
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-slate-300">
                  REAL-TIME COMPUTER VISION TELEMETRY
                </span>
              </div>

              {/* MAIN LOGO ON THE HOME PAGE: LARGE 'RUSH HOUR BET' WITH BLUE-TO-GREEN GRADIENT */}
              <h1 className="font-heading font-black text-4xl sm:text-6xl md:text-7xl tracking-tight uppercase italic leading-none bg-gradient-to-r from-blue-500 via-teal-400 to-[#00e5b9] bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(20,184,166,0.35)] select-none">
                RUSH HOUR BET
              </h1>

              {/* DESCRIPTION SECTION DIRECTLY UNDER THE MAIN LOGO */}
              <p className="mt-4 sm:mt-6 text-lg sm:text-2xl font-bold text-slate-100 tracking-normal max-w-2xl leading-snug">
                Make a call on how many cars can get by in a specific time. Get paid.
              </p>

              <p className="mt-2.5 text-xs sm:text-sm text-slate-400 max-w-xl font-medium leading-relaxed">
                High-frequency optical wagering powered by live European traffic feeds and sub-second YOLOv8 vehicle tracking.
              </p>

              {/* UNREGISTERED USER CALL TO ACTION BUTTONS */}
              {!isAuthed && (
                <div className="flex flex-wrap items-center justify-center gap-3.5 mt-7">
                  <Link
                    href="/signup"
                    className="flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 hover:from-blue-500 hover:via-teal-400 hover:to-emerald-400 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer border-0"
                  >
                    <span>Get Started</span>
                    <ArrowRight size={16} />
                  </Link>

                  <Link
                    href="/login"
                    className="flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm tracking-wide border border-white/15 hover:border-white/25 shadow-sm shadow-blue-500/10 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer"
                  >
                    <span>Log In</span>
                  </Link>
                </div>
              )}

              {/* ====================================================== */}
              {/* LIST BETTING INCIDENTS SECTION                         */}
              {/* ====================================================== */}
              <div className="w-full mt-10 sm:mt-12 pt-7 border-t border-white/10">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-5 text-left">
                  <div className="flex items-center gap-2">
                    <Flame className="text-teal-400 shrink-0" size={18} />
                    <h2 className="text-sm sm:text-base font-heading font-black uppercase tracking-wider text-white">
                      Live Betting Incidents
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-teal-400 font-bold">
                    Predict how many cars cross the green line in X seconds.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-left">
                  {/* INCIDENT 1: 30 SECONDS SPRINT */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#0f172a]/90 border border-white/10 hover:border-teal-400/50 shadow-lg shadow-blue-500/10 hover:shadow-teal-500/15 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group cursor-default">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 font-bold uppercase">
                          Sprint Interval
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-400">Up to 18.0x</span>
                      </div>
                      <h3 className="text-sm font-black text-white group-hover:text-teal-300 transition-colors duration-300">
                        30-Second Dash
                      </h3>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        Predict how many cars cross the green line in 30 seconds.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Window: 30s</span>
                      <span className="text-teal-400 font-bold">Fast Settlement</span>
                    </div>
                  </div>

                  {/* INCIDENT 2: 60 SECONDS RUSH */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#0f172a]/90 border border-teal-500/30 hover:border-teal-400/60 shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group cursor-default">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-teal-500/20 text-teal-300 font-bold uppercase">
                          POPULAR
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-400">3.60x – 36.0x</span>
                      </div>
                      <h3 className="text-sm font-black text-white group-hover:text-teal-300 transition-colors duration-300">
                        60-Second Rush
                      </h3>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        Predict how many cars cross the green line in 60 seconds.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Window: 60s</span>
                      <span className="text-teal-400 font-bold">High Velocity</span>
                    </div>
                  </div>

                  {/* INCIDENT 3: 120 SECONDS TRAFFIC SURGE */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#0f172a]/90 border border-white/10 hover:border-teal-400/50 shadow-lg shadow-blue-500/10 hover:shadow-teal-500/15 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group cursor-default">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 font-bold uppercase">
                          Surge Block
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-400">Up to 36.0x</span>
                      </div>
                      <h3 className="text-sm font-black text-white group-hover:text-teal-300 transition-colors duration-300">
                        120-Second Flow
                      </h3>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        Predict how many cars cross the green line in 120 seconds.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Window: 120s</span>
                      <span className="text-teal-400 font-bold">Volume Flow</span>
                    </div>
                  </div>

                  {/* INCIDENT 4: EXACT HIT JACKPOT */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#0f172a]/90 border border-white/10 hover:border-teal-400/50 shadow-lg shadow-blue-500/10 hover:shadow-teal-500/15 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group cursor-default">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold uppercase">
                          Jackpot Pick
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-400">36.0x MEGA</span>
                      </div>
                      <h3 className="text-sm font-black text-white group-hover:text-teal-300 transition-colors duration-300">
                        Exact Optical Target
                      </h3>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        Predict how many cars cross the green line in X seconds with exact target count.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Exact Target: 7 / 20</span>
                      <span className="text-amber-400 font-bold">Mega Odds</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* LIVE GAME BOARD (EUROPE RADAR & LIVE VIDEO OPTICAL ARENA)    */}
        {/* ============================================================ */}
        <GameBoard />
      </main>

      <LeoChatWidget />
    </div>
  );
}
