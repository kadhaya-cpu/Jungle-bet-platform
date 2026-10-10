"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  TrendingUp,
  Clock,
  History,
  CheckCircle2,
  AlertCircle,
  Flame,
  Award,
  DollarSign,
  Car,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Lock,
  Sliders,
  Hash,
  Sparkles,
  LogIn,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { EuropeanCity } from "@/lib/european-cities";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export interface OpticalMarket {
  id: string;
  type: string;
  title: string;
  target: number;
  prediction?: number;
  durationSeconds?: number;
  operator: "over" | "under" | "exact";
  odds: string;
  multiplier: number;
  badge?: string;
  description: string;
}

export const PRESET_MARKETS: OpticalMarket[] = [
  {
    id: "over_13",
    type: "count_prediction",
    title: "OVER 13",
    target: 13,
    prediction: 13,
    durationSeconds: 10,
    operator: "over",
    odds: "3.60x",
    multiplier: 3.6,
    badge: "HOT",
    description: "Pays if 14+ vehicles cross the Green Line this round",
  },
  {
    id: "under_10",
    type: "count_prediction",
    title: "UNDER 10",
    target: 10,
    prediction: 10,
    durationSeconds: 10,
    operator: "under",
    odds: "2.25x",
    multiplier: 2.25,
    description: "Pays if fewer than 10 vehicles cross the Green Line",
  },
  {
    id: "star_pick",
    type: "count_prediction",
    title: "STAR PICK",
    target: 7,
    prediction: 7,
    durationSeconds: 7,
    operator: "exact",
    odds: "18.0x",
    multiplier: 18.0,
    badge: "18x JACKPOT",
    description: "Precision jackpot: exactly 7 vehicles cross",
  },
  {
    id: "exact_20",
    type: "count_prediction",
    title: "EXACT 20",
    target: 20,
    prediction: 20,
    durationSeconds: 15,
    operator: "exact",
    odds: "36.0x",
    multiplier: 36.0,
    badge: "MEGA 36x",
    description: "Mega precision jackpot: exactly 20 vehicles cross",
  },
];

export interface RecentBetItem {
  id: string;
  city: string;
  cityFlag: string;
  marketTitle: string;
  stake: number;
  odds: string;
  potentialPayout: number;
  status: "pending" | "won" | "lost";
  createdAt: string;
  currentCount?: number;
}

interface StickyBettingPanelProps {
  selectedCity: EuropeanCity;
  currentCarCount: number;
  onPlaceBet: (market: OpticalMarket, stake: number) => void;
  recentBets: RecentBetItem[];
  isSubmitting?: boolean;
}

/**
 * Calculates fair dynamic odds based on:
 * - Chosen duration (between 7s and 15s)
 * - Chosen car prediction count
 */
export function calculateDynamicOdds(duration: number, prediction: number): number {
  const dur = Math.max(7, Math.min(15, duration));
  const pred = Math.max(0, prediction);

  let mult: number;
  if (pred === 0) {
    mult = 1.8 + (16 - dur) * 0.25;
  } else if (pred === 1) {
    mult = 2.4 + (16 - dur) * 0.18;
  } else if (pred === 2) {
    mult = 3.0 + (16 - dur) * 0.16;
  } else if (pred === 3) {
    mult = 3.5 + (16 - dur) * 0.15;
  } else if (pred >= 4 && pred <= 6) {
    mult = 4.2 + (pred - 3) * 0.8 + (15 - dur) * 0.2;
  } else {
    mult = 7.0 + (pred - 6) * 1.5 + (15 - dur) * 0.3;
  }

  return Math.max(1.8, Math.min(36.0, Number(mult.toFixed(2))));
}

export default function StickyBettingPanel({
  selectedCity,
  currentCarCount,
  onPlaceBet,
  recentBets,
  isSubmitting = false,
}: StickyBettingPanelProps) {
  const router = useRouter();
  const { balance, isAuthenticated, formatAmount, currency } = useStore();

  // TWO CORE PARAMETERS:
  // a. Duration: between 7s and 15s
  const [durationSeconds, setDurationSeconds] = useState<number>(10);
  // b. Prediction: how many cars predicted to pass
  const [predictedCount, setPredictedCount] = useState<number>(3);

  // Stake and Navigation
  const [stakeAmount, setStakeAmount] = useState<number>(50);
  const [activeTab, setActiveTab] = useState<"slip" | "history">("slip");

  const STAKE_PRESETS = [10, 25, 50, 100, 250, 500];
  const DURATION_PRESETS = [7, 8, 10, 12, 15];
  const PREDICTION_PRESETS = [0, 1, 2, 3, 5, 7, 10];

  // Dynamic multiplier and potential payout
  const dynamicMultiplier = useMemo(() => {
    return calculateDynamicOdds(durationSeconds, predictedCount);
  }, [durationSeconds, predictedCount]);

  const potentialPayout = stakeAmount * dynamicMultiplier;

  const handleStakePreset = (val: number) => {
    setStakeAmount(val);
  };

  const handleMaxStake = () => {
    const maxVal = Math.min(Math.floor(balance), 1000);
    setStakeAmount(maxVal > 0 ? maxVal : 100);
  };

  const handlePresetMarketClick = (preset: OpticalMarket) => {
    if (preset.durationSeconds) setDurationSeconds(preset.durationSeconds);
    if (preset.prediction !== undefined) setPredictedCount(preset.prediction);
    else if (preset.target !== undefined) setPredictedCount(preset.target);
  };

  const handleLoginClick = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("open-auth-modal", { detail: { mode: "login" } })
      );
    }
    router.push("/login");
  };

  const handleSubmitBet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error("Please log in first to place a bet!");
      handleLoginClick();
      return;
    }
    if (stakeAmount <= 0) {
      toast.error("Please enter a valid stake amount!");
      return;
    }

    const market: OpticalMarket = {
      id: `pred_${durationSeconds}s_${predictedCount}cars`,
      type: "count_prediction",
      title: `${predictedCount} Cars in ${durationSeconds}s`,
      target: predictedCount,
      prediction: predictedCount,
      durationSeconds: durationSeconds,
      operator: "exact",
      odds: `${dynamicMultiplier.toFixed(2)}x`,
      multiplier: dynamicMultiplier,
      description: `Pays if exactly ${predictedCount} vehicles cross the Green Line in ${durationSeconds}s`,
    };

    onPlaceBet(market, stakeAmount);
  };

  return (
    <div className="sticky top-20 w-full rounded-2xl bg-[#1e293b]/95 border border-white/10 shadow-2xl shadow-blue-500/10 backdrop-blur-xl overflow-hidden flex flex-col z-30 select-none transition-all duration-300">
      {/* TOP HEADER */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0f172a] border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30">
            <Zap size={16} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-wider text-white">
              BETTING PANEL
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {selectedCity.flag} {selectedCity.city} Live Feed
            </span>
          </div>
        </div>

        {/* TABS: SLIP / HISTORY */}
        <div className="flex items-center p-1 rounded-xl bg-[#0f172a] border border-white/10 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab("slip")}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all duration-300 cursor-pointer ${
              activeTab === "slip"
                ? "bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 text-white shadow-md shadow-teal-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Slip
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold transition-all duration-300 cursor-pointer ${
              activeTab === "history"
                ? "bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 text-white shadow-md shadow-teal-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>History</span>
            {recentBets.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-slate-800 text-[9px] flex items-center justify-center font-mono text-white">
                {recentBets.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "slip" ? (
          <motion.div
            key="slip-tab"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="p-4 sm:p-5 flex flex-col gap-4 relative"
          >
            {/* LIVE OPTICAL COUNT BANNER */}
            <div className="p-3 rounded-xl bg-[#0f172a] border border-white/10 flex items-center justify-between text-xs shadow-sm shadow-blue-500/10">
              <div className="flex items-center gap-2">
                <Car size={15} className="text-teal-400" />
                <span className="text-slate-400 font-mono text-[11px]">OPTICAL COUNT:</span>
                <span className="font-mono font-black text-white text-sm">{currentCarCount}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-teal-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                <span>ACTIVE STREAM</span>
              </div>
            </div>

            {/* USER EXPERIENCE GATING: LOCKED STATE IF NOT LOGGED IN */}
            {!isAuthenticated && (
              <div className="p-5 rounded-2xl bg-gradient-to-b from-[#1a1309] to-[#0d0903] border border-amber-500/30 shadow-lg shadow-amber-500/10 flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Lock size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">
                    RACER AUTHENTICATION REQUIRED
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    Sign in to select your duration window (7s–15s), cars prediction, and place live bets.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoginClick}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 hover:from-blue-500 hover:via-teal-400 hover:to-emerald-400 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-teal-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogIn size={14} />
                  <span>Log In to Play</span>
                </button>
              </div>
            )}

            {/* ======================================================== */}
            {/* PARAMETER 1: DURATION WINDOW (7s to 15s SLIDER / DROPDOWN) */}
            {/* ======================================================== */}
            <div className={`transition-opacity duration-300 ${!isAuthenticated ? "opacity-40 pointer-events-none" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Clock size={13} className="text-teal-400" />
                  <span>1. Duration Window</span>
                </label>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/30">
                  {durationSeconds} Seconds
                </span>
              </div>

              {/* Slider & Dropdown Flex Container */}
              <div className="p-3.5 rounded-xl bg-[#0f172a] border border-white/10 shadow-sm shadow-blue-500/10 flex flex-col gap-2.5">
                {/* Range Slider */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-400 font-bold">7s</span>
                  <input
                    type="range"
                    min="7"
                    max="15"
                    step="1"
                    value={durationSeconds}
                    disabled={!isAuthenticated}
                    onChange={(e) => setDurationSeconds(Number(e.target.value))}
                    className="w-full h-2 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                  <span className="text-[10px] font-mono text-slate-400 font-bold">15s</span>
                </div>

                {/* Dropdown Alternative for Duration */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                  <span className="text-[10px] font-mono text-slate-400">Choose Preset / Dropdown:</span>
                  <select
                    value={durationSeconds}
                    disabled={!isAuthenticated}
                    onChange={(e) => setDurationSeconds(Number(e.target.value))}
                    className="bg-[#1e293b] border border-white/15 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-white focus:outline-none focus:border-teal-400 transition-colors duration-300 cursor-pointer"
                  >
                    {[7, 8, 9, 10, 11, 12, 13, 14, 15].map((sec) => (
                      <option key={sec} value={sec}>
                        {sec} Seconds Window (T=0 to T={sec}s)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick Duration Chips */}
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {DURATION_PRESETS.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      disabled={!isAuthenticated}
                      onClick={() => setDurationSeconds(sec)}
                      className={`py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all duration-300 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 ${
                        durationSeconds === sec
                          ? "bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 text-white shadow-md shadow-teal-500/20"
                          : "bg-[#1e293b] text-slate-300 hover:text-white hover:bg-[#334155]"
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* PARAMETER 2: PREDICTION INPUT (HOW MANY CARS WILL PASS)   */}
            {/* ======================================================== */}
            <div className={`transition-opacity duration-300 ${!isAuthenticated ? "opacity-40 pointer-events-none" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Car size={13} className="text-teal-400" />
                  <span>2. Vehicle Prediction</span>
                </label>
                <span className="text-[10px] font-mono text-slate-400">
                  Target = Exact Match
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0f172a] border border-white/10 shadow-sm shadow-blue-500/10 flex flex-col gap-2.5">
                {/* Stepper + Input */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!isAuthenticated || predictedCount <= 0}
                    onClick={() => setPredictedCount((prev) => Math.max(0, prev - 1))}
                    className="w-10 h-10 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-white font-black text-lg flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-40 shadow-sm"
                  >
                    -
                  </button>

                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={predictedCount}
                      disabled={!isAuthenticated}
                      onChange={(e) =>
                        setPredictedCount(Math.max(0, Math.min(30, Number(e.target.value) || 0)))
                      }
                      className="w-full bg-[#1e293b] border border-white/10 rounded-xl py-2 text-center text-lg font-mono font-black text-white focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all duration-300 shadow-inner"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] font-mono text-slate-400 pointer-events-none">
                      Cars
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={!isAuthenticated || predictedCount >= 30}
                    onClick={() => setPredictedCount((prev) => Math.min(30, prev + 1))}
                    className="w-10 h-10 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-white font-black text-lg flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-40 shadow-sm"
                  >
                    +
                  </button>
                </div>

                {/* Quick Prediction Pills */}
                <div className="grid grid-cols-7 gap-1">
                  {PREDICTION_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={!isAuthenticated}
                      onClick={() => setPredictedCount(p)}
                      className={`py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all duration-300 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 ${
                        predictedCount === p
                          ? "bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 text-white shadow-md shadow-teal-500/20"
                          : "bg-[#1e293b] text-slate-300 hover:text-white hover:bg-[#334155]"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* QUICK PRESET TEMPLATES */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                  Quick Market Presets
                </span>
                <span className="text-[9px] font-mono text-slate-500">Auto-fills 2 Params</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_MARKETS.map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => handlePresetMarketClick(pm)}
                    className="p-2.5 rounded-xl bg-[#0f172a] hover:bg-[#141d2e] border border-white/5 hover:border-teal-400/30 text-left transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 shadow-sm cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-white">{pm.title}</span>
                      <span className="text-[9px] font-mono text-teal-400 font-bold">
                        {pm.odds}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ======================================================== */}
            {/* 3. STAKE INPUT & QUICK PRESETS                           */}
            {/* ======================================================== */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300">
                  Stake Amount ({currency})
                </label>
                <span className="text-[10px] font-mono text-teal-400 font-semibold">
                  Balance: {formatAmount(balance)}
                </span>
              </div>

              {/* Stake Amount Input */}
              <div className="relative mb-2">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-teal-400 font-mono font-black text-base">
                  $
                </div>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={stakeAmount}
                  disabled={!isAuthenticated}
                  onChange={(e) => setStakeAmount(Math.max(1, Number(e.target.value) || 0))}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-xl pl-9 pr-14 py-2.5 text-base text-white font-mono font-black focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all duration-300 shadow-inner disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={!isAuthenticated}
                  onClick={handleMaxStake}
                  className="absolute inset-y-1 right-1 px-2.5 rounded-lg bg-[#1e293b] hover:bg-[#334155] text-[10px] font-mono font-bold text-teal-300 transition-all duration-300 cursor-pointer disabled:opacity-40"
                >
                  MAX
                </button>
              </div>

              {/* Stake Presets */}
              <div className="grid grid-cols-6 gap-1.5">
                {STAKE_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={!isAuthenticated}
                    onClick={() => handleStakePreset(p)}
                    className={`py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all duration-300 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 shadow-sm ${
                      stakeAmount === p
                        ? "bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 text-white shadow-md shadow-teal-500/20"
                        : "bg-[#0f172a] hover:bg-[#1e293b] text-slate-300 border border-white/5"
                    }`}
                  >
                    +${p}
                  </button>
                ))}
              </div>
            </div>

            {/* ======================================================== */}
            {/* 4. DYNAMIC MULTIPLIER & POTENTIAL PAYOUT CALCULATION      */}
            {/* ======================================================== */}
            <div className="p-3.5 rounded-xl bg-[#0f172a] border border-white/10 shadow-sm shadow-blue-500/10 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Rule:</span>
                <span className="text-white font-bold">
                  Exact {predictedCount} cars in {durationSeconds}s
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Calculated Odds:</span>
                <span className="text-teal-400 font-black">{dynamicMultiplier.toFixed(2)}x</span>
              </div>
              <div className="h-[1px] bg-white/10 my-0.5" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Potential Payout:
                </span>
                <span className="text-base font-black font-mono text-teal-300 drop-shadow-[0_0_8px_rgba(20,184,166,0.4)]">
                  {formatAmount(potentialPayout)}
                </span>
              </div>
            </div>

            {/* ======================================================== */}
            {/* 5. PROMINENT 'PLACE BET' BUTTON (GRADIENT BLUE-TO-GREEN)  */}
            {/* ======================================================== */}
            <button
              type="button"
              onClick={handleSubmitBet}
              disabled={isSubmitting}
              className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:-translate-y-0.5 active:translate-y-0 border-0 ${
                !isAuthenticated
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 shadow-amber-500/10"
                  : "bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 hover:from-blue-500 hover:via-teal-400 hover:to-emerald-400 text-white shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/35"
              } disabled:opacity-50`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Confirming Wager...</span>
                </>
              ) : !isAuthenticated ? (
                <>
                  <Lock size={16} />
                  <span>Log In to Place Bet</span>
                </>
              ) : (
                <>
                  <span>
                    Place Bet ({formatAmount(stakeAmount)}) [{durationSeconds}s / {predictedCount} cars]
                  </span>
                  <ChevronRight size={18} className="stroke-[3]" />
                </>
              )}
            </button>
          </motion.div>
        ) : (
          /* RECENT BET HISTORY TAB */
          <motion.div
            key="history-tab"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="p-4 flex flex-col gap-2.5 max-h-[460px] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-mono uppercase text-gray-400 font-bold">
                Recent Wagers
              </span>
              <span className="text-[10px] font-mono text-gray-500">Live Auto-Sync</span>
            </div>

            {recentBets.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-[#090d16] border border-white/5 flex flex-col items-center justify-center gap-2">
                <History size={28} className="text-gray-500" />
                <span className="text-xs text-gray-400 font-medium">No wagers placed yet</span>
                <button
                  type="button"
                  onClick={() => setActiveTab("slip")}
                  className="mt-1 px-3 py-1 rounded-lg bg-[#00e5b9]/15 text-[#00e5b9] text-xs font-bold hover:bg-[#00e5b9]/25 transition-all"
                >
                  Configure Prediction
                </button>
              </div>
            ) : (
              recentBets.map((bet) => (
                <div
                  key={bet.id}
                  className="p-3 rounded-xl bg-[#090d16] border border-white/10 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <span>{bet.cityFlag}</span>
                      <span>{bet.city}</span>
                      <span className="text-[#00e5b9] font-mono">[{bet.marketTitle}]</span>
                    </div>

                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                        bet.status === "won"
                          ? "bg-[#00e5b9]/20 text-[#00e5b9] border border-[#00e5b9]/40"
                          : bet.status === "lost"
                          ? "bg-red-500/20 text-red-400 border border-red-500/40"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse"
                      }`}
                    >
                      {bet.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
                    <span>
                      Stake: <span className="text-white font-bold">{formatAmount(bet.stake)}</span>{" "}
                      @ {bet.odds}
                    </span>
                    <span className="text-[#00e5b9] font-bold">
                      {bet.status === "won"
                        ? `+${formatAmount(bet.potentialPayout)}`
                        : `Win: ${formatAmount(bet.potentialPayout)}`}
                    </span>
                  </div>

                  <div className="text-[9px] font-mono text-gray-500 flex items-center justify-between border-t border-white/5 pt-1 mt-0.5">
                    <span>Ref: {bet.id.slice(-8)}</span>
                    <span>{bet.createdAt}</span>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
