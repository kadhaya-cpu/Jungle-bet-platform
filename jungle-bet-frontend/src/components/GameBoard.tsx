"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Radio,
  Activity,
  Zap,
  Car,
  ChevronRight,
  ShieldAlert,
  Flame,
  CheckCircle2,
  MapPin,
  Compass,
  Maximize2,
  Tv,
  Layers,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useSession } from "next-auth/react";
import axios from "axios";
import CelebrationOverlay from "./CelebrationOverlay";
import WinOverlay from "./WinOverlay";
import LossOverlay from "./LossOverlay";
import PaymentModal from "./PaymentModal";
import VideoPlayer from "./VideoPlayer";
import InteractiveEuropeMap from "./InteractiveEuropeMap";
import StickyBettingPanel, {
  OpticalMarket,
  PRESET_MARKETS,
  RecentBetItem,
} from "./StickyBettingPanel";
import {
  EUROPEAN_CITIES,
  EuropeanCity,
  cityToCameraFeed,
} from "@/lib/european-cities";
import toast from "react-hot-toast";
import { useWebSocketCount } from "@/hooks/useWebSocketCount";

export default function GameBoard() {
  const { data: session } = useSession();
  const {
    balance,
    isAuthenticated,
    token,
    fetchBalance,
    formatAmount,
    currency,
    selectedCity: storeSelectedCity,
    setSelectedCity: setStoreSelectedCity,
  } = useStore();

  const userId =
    session?.user?.id ||
    (session?.user?.phone ? `usr_${session.user.phone}` : "usr_demo_vip_001");

  // -------------------------------------------------------------------------
  // 1. ACTIVE EUROPEAN CITY & MAP LOGIC (SYNCED WITH GLOBAL STORE)
  // -------------------------------------------------------------------------
  const selectedCity: EuropeanCity = storeSelectedCity || EUROPEAN_CITIES[0];
  const setSelectedCity = setStoreSelectedCity;
  const [viewMode, setViewMode] = useState<"stacked" | "radar_focus">("stacked");

  const currentCameraFeed = cityToCameraFeed(selectedCity);

  // -------------------------------------------------------------------------
  // 2. REAL-TIME YOLO VEHICLE COUNTER OVER WEBSOCKET (/ws/count/{feed_id})
  // -------------------------------------------------------------------------
  const {
    count: carCount,
    setCount: setCarCount,
    isConnected: isWsCountConnected,
    isLineTriggered,
    lastCrossingX,
    floatingPings,
    triggerCrossing: triggerCarCrossing,
  } = useWebSocketCount(selectedCity.id, {
    initialCount: selectedCity.opticalSettings.defaultInitialCount,
  });

  // -------------------------------------------------------------------------
  // 3. FALLBACK VEHICLE SIMULATION (when WS is connecting/offline)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isWsCountConnected) return;

    let timer: NodeJS.Timeout;

    const scheduleNextCrossing = () => {
      const delay = Math.floor(Math.random() * 1400) + 1800;
      timer = setTimeout(() => {
        triggerCarCrossing();
        setCarCount((prev) => prev + 1);
        scheduleNextCrossing();
      }, delay);
    };

    scheduleNextCrossing();
    return () => clearTimeout(timer);
  }, [isWsCountConnected, triggerCarCrossing, setCarCount]);

  // -------------------------------------------------------------------------
  // 4. BETTING STATE & RECENT BETS HISTORY
  // -------------------------------------------------------------------------
  const [selectedMarket, setSelectedMarket] = useState<OpticalMarket>(PRESET_MARKETS[0]);
  const [selectedStake, setSelectedStake] = useState<number>(50);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSubmittingBet, setIsSubmittingBet] = useState(false);

  // High-Quality Win & Loss Overlays state
  const [winOverlay, setWinOverlay] = useState<{
    isOpen: boolean;
    amount: number;
    durationSeconds?: number;
    prediction?: number;
    actualCount?: number;
    multiplier?: number;
  }>({ isOpen: false, amount: 0 });

  const [lossOverlay, setLossOverlay] = useState<{
    isOpen: boolean;
    amount: number;
    durationSeconds?: number;
    prediction?: number;
    actualCount?: number;
  }>({ isOpen: false, amount: 0 });

  const processedBetKeysRef = useRef<Set<string>>(new Set());

  const [recentBets, setRecentBets] = useState<RecentBetItem[]>([
    {
      id: "bet_sample_01",
      city: "London",
      cityFlag: "🇬🇧",
      marketTitle: "3 Cars in 10s",
      stake: 50,
      odds: "3.50x",
      potentialPayout: 175,
      status: "won",
      createdAt: "12m ago",
    },
    {
      id: "bet_sample_02",
      city: "Amsterdam",
      cityFlag: "🇳🇱",
      marketTitle: "2 Cars in 7s",
      stake: 100,
      odds: "4.20x",
      potentialPayout: 420,
      status: "won",
      createdAt: "24m ago",
    },
  ]);

  // -------------------------------------------------------------------------
  // 5. POLL BET RESOLUTION & TRIGGER OVERLAYS WITH INSTANT BALANCE UPDATE
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get("http://localhost:8000/bets/history", {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 2000,
        });

        const history = res.data.history || [];
        if (history.length > 0) {
          const latestBet = history[0];

          if (latestBet.status !== "pending") {
            const betKey = `${latestBet.id}_${latestBet.status}`;
            if (!processedBetKeysRef.current.has(betKey)) {
              processedBetKeysRef.current.add(betKey);

              const duration =
                latestBet.criteria?.duration_seconds ??
                latestBet.criteria?.duration ??
                10;
              const prediction =
                latestBet.criteria?.predicted_count ??
                latestBet.criteria?.target_count ??
                latestBet.criteria?.prediction ??
                0;
              const actualCount =
                latestBet.resolution_data?.window_count ??
                latestBet.resolution_data?.detected_count;
              const multiplier =
                latestBet.criteria?.multiplier ?? 3.5;

              if (latestBet.status === "won") {
                const winAmount = parseFloat(
                  latestBet.resolution_data?.payout ||
                  (latestBet.amount * multiplier)
                );

                // REQUIREMENT: Ensure wallet balance updates instantly upon showing the overlay
                useStore.setState((s) => ({ balance: s.balance + winAmount }));
                fetchBalance();

                // REQUIREMENT: Trigger WinOverlay immediately after AI confirms result
                setWinOverlay({
                  isOpen: true,
                  amount: winAmount,
                  durationSeconds: duration,
                  prediction: prediction,
                  actualCount: actualCount,
                  multiplier: multiplier,
                });

                window.dispatchEvent(
                  new CustomEvent("jungle-celebrate", {
                    detail: {
                      type: "win",
                      amount: winAmount,
                      durationSeconds: duration,
                      prediction: prediction,
                      actualCount: actualCount,
                      multiplier: multiplier,
                    },
                  })
                );

                // FRAUD HOOK: Check if user won >$1000 instantly
                if (winAmount > 1000) {
                  axios
                    .post("/api/fraud/check", {
                      action: "win",
                      amount: winAmount,
                      userId,
                      betId: latestBet.id,
                    })
                    .catch(() => {});
                }
              } else if (latestBet.status === "lost") {
                const lostAmount = parseFloat(latestBet.amount);

                // REQUIREMENT: Ensure wallet balance updates instantly upon showing the overlay
                fetchBalance();

                // REQUIREMENT: Trigger LossOverlay immediately after AI confirms result
                setLossOverlay({
                  isOpen: true,
                  amount: lostAmount,
                  durationSeconds: duration,
                  prediction: prediction,
                  actualCount: actualCount,
                });

                window.dispatchEvent(
                  new CustomEvent("jungle-celebrate", {
                    detail: {
                      type: "loss",
                      amount: lostAmount,
                      durationSeconds: duration,
                      prediction: prediction,
                      actualCount: actualCount,
                    },
                  })
                );
              }

              // Sync status in recent bets list
              setRecentBets((prev) =>
                prev.map((b) =>
                  b.id === latestBet.id || b.id === `bet_${latestBet.id}`
                    ? {
                        ...b,
                        status: latestBet.status,
                        potentialPayout:
                          latestBet.status === "won"
                            ? parseFloat(latestBet.resolution_data?.payout || b.potentialPayout)
                            : b.potentialPayout,
                      }
                    : b
                )
              );
            }
          }
        }
      } catch {
        // Polling failed silently
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isAuthenticated, token, fetchBalance, userId]);

  // Listener to trigger result overlays manually (for testing & simulations)
  useEffect(() => {
    const handleTriggerOverlay = (e: CustomEvent) => {
      const detail = e.detail || {};
      if (detail.type === "win") {
        const winAmt = detail.amount ?? 175;
        useStore.setState((s) => ({ balance: s.balance + winAmt }));
        fetchBalance();
        setWinOverlay({
          isOpen: true,
          amount: winAmt,
          durationSeconds: detail.durationSeconds ?? 10,
          prediction: detail.prediction ?? 3,
          actualCount: detail.actualCount ?? 3,
          multiplier: detail.multiplier ?? 3.5,
        });
      } else if (detail.type === "loss") {
        const lostAmt = detail.amount ?? 50;
        fetchBalance();
        setLossOverlay({
          isOpen: true,
          amount: lostAmt,
          durationSeconds: detail.durationSeconds ?? 10,
          prediction: detail.prediction ?? 3,
          actualCount: detail.actualCount ?? 1,
        });
      }
    };

    window.addEventListener("trigger-result-overlay", handleTriggerOverlay as EventListener);
    return () => window.removeEventListener("trigger-result-overlay", handleTriggerOverlay as EventListener);
  }, [fetchBalance]);

  // -------------------------------------------------------------------------
  // 6. BET PLACEMENT HANDLERS
  // -------------------------------------------------------------------------
  const handlePlaceBetRequest = async (market: OpticalMarket, stake: number) => {
    if (!isAuthenticated) {
      toast.error("Please log in first to place a bet!");
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("open-auth-modal", { detail: { mode: "login" } })
        );
      }
      return;
    }

    setSelectedMarket(market);
    setSelectedStake(stake);

    // Call fraud detection hook to monitor bet placement frequency
    try {
      await axios.post("/api/fraud/check", {
        action: "bet",
        amount: stake,
        userId,
      });
    } catch {
      // Handled silently
    }

    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = async (details: {
    paymentId: string;
    betId?: string;
    amount: number;
    provider: string;
  }) => {
    toast.success(`Bet Placed & Confirmed! Ref: ${details.paymentId}`);
    fetchBalance();

    const newBet: RecentBetItem = {
      id: details.betId || `bet_${Date.now()}`,
      city: selectedCity.city,
      cityFlag: selectedCity.flag,
      marketTitle: selectedMarket.title,
      stake: details.amount,
      odds: selectedMarket.odds,
      potentialPayout: details.amount * selectedMarket.multiplier,
      status: "pending",
      createdAt: "Just now",
      currentCount: carCount,
    };

    setRecentBets((prev) => [newBet, ...prev]);
  };

  return (
    <div className="w-full max-w-[1680px] mx-auto px-3 sm:px-6 py-4 flex flex-col gap-5 select-none">
      {/* RESULT OVERLAYS: WIN & LOSS */}
      <WinOverlay
        isOpen={winOverlay.isOpen}
        onClose={() => setWinOverlay((prev) => ({ ...prev, isOpen: false }))}
        amount={winOverlay.amount}
        durationSeconds={winOverlay.durationSeconds}
        prediction={winOverlay.prediction}
        actualCount={winOverlay.actualCount}
        multiplier={winOverlay.multiplier}
      />
      <LossOverlay
        isOpen={lossOverlay.isOpen}
        onClose={() => setLossOverlay((prev) => ({ ...prev, isOpen: false }))}
        amount={lossOverlay.amount}
        durationSeconds={lossOverlay.durationSeconds}
        prediction={lossOverlay.prediction}
        actualCount={lossOverlay.actualCount}
      />

      {/* MULTI-CURRENCY PAYMENT MODAL */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        betData={{
          betType: selectedMarket.type,
          criteria: {
            target_count: selectedMarket.target,
            predicted_count: selectedMarket.prediction ?? selectedMarket.target,
            prediction: selectedMarket.prediction ?? selectedMarket.target,
            duration_seconds: selectedMarket.durationSeconds ?? 10,
            duration: selectedMarket.durationSeconds ?? 10,
            operator: selectedMarket.operator,
            feed_id: selectedCity.id,
            multiplier: selectedMarket.multiplier,
          },
          amount: selectedStake,
          title: `${selectedCity.city}: ${selectedMarket.title}`,
          odds: selectedMarket.odds,
        }}
        amount={selectedStake}
        mode="bet"
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* ------------------------------------------------------------- */}
      {/* TOP MMG DASHBOARD STATUS BAR                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-[#1e293b]/95 border border-white/10 shadow-xl shadow-blue-500/10 transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 shadow-sm">
            <Compass size={20} className="animate-spin-slow" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base">{selectedCity.flag}</span>
              <span className="text-sm font-black text-white tracking-wide uppercase">
                {selectedCity.city} • {selectedCity.junction}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30">
                {selectedCity.countryCode}
              </span>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Speed: {selectedCity.opticalSettings.averageSpeedKmh} km/h • Density:{" "}
              {selectedCity.opticalSettings.trafficDensity}
            </span>
          </div>
        </div>

        {/* TELEMETRY BADGES & OVERLAY SIMULATION CONTROLS */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Quick Result Overlay Test Buttons */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0f172a] border border-white/10 shadow-inner">
            <button
              type="button"
              onClick={() =>
                setWinOverlay({
                  isOpen: true,
                  amount: 175.0,
                  durationSeconds: selectedMarket.durationSeconds || 10,
                  prediction: selectedMarket.prediction ?? selectedMarket.target ?? 3,
                  actualCount: selectedMarket.prediction ?? selectedMarket.target ?? 3,
                  multiplier: selectedMarket.multiplier || 3.5,
                })
              }
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-1"
            >
              <Sparkles size={11} />
              <span>Test Win Overlay</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setLossOverlay({
                  isOpen: true,
                  amount: selectedStake || 50.0,
                  durationSeconds: selectedMarket.durationSeconds || 10,
                  prediction: selectedMarket.prediction ?? selectedMarket.target ?? 3,
                  actualCount: 1,
                })
              }
              className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-[10px] font-mono font-bold transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-1"
            >
              <ShieldAlert size={11} />
              <span>Test Loss Overlay</span>
            </button>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-[#0f172a] border border-white/10 flex items-center gap-2 text-xs font-mono text-slate-300 shadow-sm shadow-blue-500/10">
            <Radio size={13} className="text-teal-400 animate-pulse" />
            <span className="font-bold text-white">YOUTUBE LIVE 60FPS</span>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center gap-1.5 text-xs font-mono text-teal-300 font-bold shadow-sm shadow-teal-500/10">
            <Activity size={13} className={isWsCountConnected ? "animate-pulse" : ""} />
            <span>{isWsCountConnected ? "YOLOv8 WS SYNC" : "YOLOv8 DETECT"}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isWsCountConnected ? "bg-teal-400 animate-ping" : "bg-amber-400"
              }`}
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MAIN SPLIT LAYOUT: LEFT 70% | RIGHT 30%                       */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* =========================================================== */}
        {/* LEFT SIDE (70% WIDTH): EUROPE MAP + LIVE CAMERA FEED        */}
        {/* =========================================================== */}
        <div className="w-full lg:w-[68%] xl:w-[70%] flex flex-col gap-6">
          {/* 1. INTERACTIVE SVG EUROPE MAP (REACT-SIMPLE-MAPS & D3-GEO) */}
          <InteractiveEuropeMap
            selectedCity={selectedCity}
            onSelectCity={(city) => {
              setSelectedCity(city);
            }}
          />

          {/* 2. LIVE TRAFFIC CAMERA FEED FOR SELECTED CITY (WITH GREEN LINE) */}
          <div className="relative w-full aspect-video min-h-[380px] max-h-[640px] rounded-3xl bg-[#0f172a] border border-white/15 shadow-2xl shadow-blue-500/15 overflow-hidden transition-all duration-300">
            <VideoPlayer
              feed={currentCameraFeed}
              className="w-full h-full object-cover"
            >

            {/* AMBIENT STREAM VIGNETTE */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/60 pointer-events-none" />

            {/* TOP HUD BAR: CITY INFO & REAL-TIME GREEN LINE OPTICAL COUNTER */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-30">
              {/* LEFT: CITY & JUNCTION BADGE */}
              <div className="flex flex-col gap-1 p-2 sm:p-2.5 rounded-2xl bg-[#0f172a]/90 backdrop-blur-md border border-white/15 shadow-lg shadow-blue-500/10">
                <div className="flex items-center gap-2">
                  <span className="text-base">{selectedCity.flag}</span>
                  <span className="font-black text-xs sm:text-sm uppercase tracking-wider text-white">
                    {selectedCity.city}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-lg bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30">
                    {selectedCity.countryCode}
                  </span>
                </div>
                <span className="text-[11px] text-slate-300 font-medium truncate max-w-xs pl-1">
                  {selectedCity.junction}
                </span>
              </div>

              {/* RIGHT: GREEN LINE VEHICLE COUNTER BOX */}
              <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
                <motion.div
                  key={carCount}
                  initial={{ scale: 0.9, opacity: 0.8 }}
                  animate={{ scale: [1, 1.06, 1], opacity: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl bg-[#0f172a]/95 backdrop-blur-xl border-2 border-teal-400 shadow-xl shadow-teal-500/20 flex items-center gap-3.5 transition-all duration-300"
                >
                  <div className="p-2 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300">
                    <Car size={20} className="animate-pulse" />
                  </div>

                  <div className="flex flex-col text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isWsCountConnected ? "bg-teal-400 animate-ping" : "bg-amber-400"
                        }`}
                      />
                      <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-teal-300 font-black">
                        {isWsCountConnected ? "WS LIVE SYNC" : "OFFLINE FALLBACK"}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">OPTICAL COUNT</span>
                  </div>

                  <div className="text-3xl sm:text-4xl font-black text-white font-mono tabular-nums leading-none drop-shadow-[0_0_15px_rgba(20,184,166,0.5)] pl-1">
                    {carCount}
                  </div>
                </motion.div>

                {/* LIVE MARKET CONDITION TRACKER PILL */}
                <div className="px-3 py-1.5 rounded-xl bg-[#0f172a]/90 backdrop-blur-md border border-white/15 text-[10px] font-mono flex items-center gap-2 shadow-md shadow-blue-500/10">
                  <span className="text-gray-400 uppercase font-bold">{selectedMarket.title}:</span>
                  {selectedMarket.operator === "over" && (
                    <span
                      className={
                        carCount > selectedMarket.target
                          ? "text-[#00e5b9] font-black"
                          : "text-gray-300 font-bold"
                      }
                    >
                      {carCount > selectedMarket.target
                        ? `TARGET MET (${carCount}/${selectedMarket.target + 1}+)`
                        : `Live: ${carCount}/${selectedMarket.target + 1} (${
                            selectedMarket.target + 1 - carCount
                          } left)`}
                    </span>
                  )}
                  {selectedMarket.operator === "under" && (
                    <span
                      className={
                        carCount < selectedMarket.target
                          ? "text-[#00e5b9] font-black"
                          : "text-red-400 font-bold"
                      }
                    >
                      {carCount < selectedMarket.target
                        ? `SAFE (${carCount} < ${selectedMarket.target})`
                        : `BUST (${carCount} >= ${selectedMarket.target})`}
                    </span>
                  )}
                  {selectedMarket.operator === "exact" && (
                    <span
                      className={
                        carCount === selectedMarket.target
                          ? "text-purple-400 font-black"
                          : "text-gray-300 font-bold"
                      }
                    >
                      {carCount === selectedMarket.target
                        ? `JACKPOT HIT! (${selectedMarket.target})`
                        : carCount < selectedMarket.target
                        ? `Target: ${selectedMarket.target} (${selectedMarket.target - carCount} left)`
                        : `Passed (${carCount})`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* --------------------------------------------------------- */}
            {/* THE OPTICAL GREEN LINE ACROSS ROAD                        */}
            {/* --------------------------------------------------------- */}
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{ top: `${selectedCity.opticalSettings.greenLineYPercent}%` }}
            >
              {/* GLOW HALO */}
              <div
                className={`absolute -top-3 left-0 right-0 h-8 transition-opacity duration-300 ${
                  isLineTriggered
                    ? "bg-[#00e5b9]/35 blur-md"
                    : "bg-[#00e5b9]/15 blur-sm"
                }`}
              />

              {/* THE PHYSICAL NEON GREEN LINE */}
              <motion.div
                animate={
                  isLineTriggered
                    ? {
                        scaleY: 1.8,
                        filter: "brightness(1.8)",
                        boxShadow: "0 0 35px #00e5b9, 0 0 60px rgba(0, 229, 185, 0.9)",
                      }
                    : {
                        scaleY: 1,
                        filter: "brightness(1.1)",
                        boxShadow: "0 0 20px #00e5b9, 0 0 35px rgba(0, 229, 185, 0.6)",
                      }
                }
                transition={{ duration: 0.15 }}
                className="w-full h-1.5 sm:h-2 bg-[#00e5b9] relative overflow-hidden"
              >
                {/* LASER SCAN SWEEP ANIMATION */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-laser-sweep opacity-80" />
              </motion.div>

              {/* VEHICLE DETECTION CROSSING FLASH / RIPPLE */}
              {isLineTriggered && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 1 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  style={{ left: `${lastCrossingX}%` }}
                  className="absolute -top-4 w-9 h-9 -ml-4.5 rounded-full border-2 border-white bg-[#00e5b9]/50 shadow-[0_0_20px_#00e5b9]"
                />
              )}

              {/* FLOATING +1 PINGS AT DETECTED CROSSING COORDINATE */}
              {floatingPings.map((ping) => (
                <motion.div
                  key={ping.id}
                  initial={{ opacity: 1, y: 0, scale: 0.8 }}
                  animate={{ opacity: 0, y: -45, scale: 1.4 }}
                  transition={{ duration: 0.85, ease: "easeOut" }}
                  style={{ left: `${ping.x}%` }}
                  className="absolute -top-7 -ml-3 pointer-events-none font-mono font-black text-sm text-[#00e5b9] drop-shadow-[0_0_10px_#00e5b9]"
                >
                  +1
                </motion.div>
              ))}
            </div>

            {/* BOTTOM HUD STRIP */}
            <div className="absolute bottom-3 left-4 right-14 flex items-center justify-between pointer-events-none z-30">
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 text-[10px] font-mono text-gray-300 flex items-center gap-1.5">
                  <MapPin size={11} className="text-[#00e5b9]" />
                  <span>{selectedCity.junction}</span>
                </div>
              </div>

              <div className="px-2 py-0.5 rounded bg-black/75 backdrop-blur-md text-[9px] font-mono text-gray-400">
                LAT: {selectedCity.geo.lat.toFixed(4)} | LNG: {selectedCity.geo.lng.toFixed(4)}
              </div>
            </div>
            </VideoPlayer>
          </div>
        </div>

        {/* =========================================================== */}
        {/* RIGHT SIDE (30% WIDTH): STICKY BETTING PANEL                */}
        {/* =========================================================== */}
        <div className="w-full lg:w-[32%] xl:w-[30%]">
          <StickyBettingPanel
            selectedCity={selectedCity}
            currentCarCount={carCount}
            onPlaceBet={handlePlaceBetRequest}
            recentBets={recentBets}
            isSubmitting={isSubmittingBet}
          />
        </div>
      </div>
    </div>
  );
}
