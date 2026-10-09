"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  WifiOff,
  Radio,
  Activity,
  Zap,
  Car,
  ChevronRight,
  ShieldAlert,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useSession } from "next-auth/react";
import axios from "axios";
import CelebrationOverlay from "./CelebrationOverlay";
import PaymentModal from "./PaymentModal";
import {
  CameraFeed,
  VERIFIED_WORKING_FEEDS,
  filterOnlyVerifiedFeeds,
} from "./LiveFeedPreview";
import VideoPlayer from "./VideoPlayer";
import toast from "react-hot-toast";
import { useWebSocketCount } from "@/hooks/useWebSocketCount";

const STAKE_PRESETS = [50, 100, 200, 500, 1000];

export default function GameBoard() {
  const { data: session } = useSession();
  const { balance, isAuthenticated, token, fetchBalance, formatAmount, currency } = useStore();

  const userId =
    session?.user?.id ||
    (session?.user?.phone ? `usr_${session.user.phone}` : "usr_demo_vip_001");

  // Selected Live Camera Feed (Filtered ONLY to the 3 verified streams)
  const [availableFeeds, setAvailableFeeds] = useState<CameraFeed[]>(VERIFIED_WORKING_FEEDS);
  const [selectedFeed, setSelectedFeed] = useState<CameraFeed>(VERIFIED_WORKING_FEEDS[0]);
  const [isConnected, setIsConnected] = useState(true);

  // -------------------------------------------------------------------------
  // 1. REAL-TIME YOLO VEHICLE COUNTER OVER WEBSOCKET (/ws/count/{feed_id})
  // -------------------------------------------------------------------------
  const {
    count: carCount,
    setCount: setCarCount,
    isConnected: isWsCountConnected,
    isLineTriggered,
    lastCrossingX,
    floatingPings,
    triggerCrossing: triggerCarCrossing,
  } = useWebSocketCount(selectedFeed.id, {
    initialCount: 14,
  });

  // Selected Stake (in base USD)
  const [selectedStake, setSelectedStake] = useState(100);

  const [selectedMarket, setSelectedMarket] = useState<{
    type: string;
    target: number;
    operator: string;
    title: string;
    odds: string;
    description: string;
  }>({
    type: "count_prediction",
    target: 13,
    operator: "over",
    title: "OVER 13",
    odds: "3.60x",
    description: "Pays if 14+ cars cross the Green Line this round",
  });

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // -------------------------------------------------------------------------
  // FALLBACK SIMULATION: Active only when WebSocket is disconnected
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isWsCountConnected) return;

    let timer: NodeJS.Timeout;

    const scheduleNextCrossing = () => {
      const delay = Math.floor(Math.random() * 1200) + 1600;
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
  // 2. POLL BET RESOLUTION & EVALUATE LARGE WINS (> $1000 FRAUD HOOK)
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
            const winAmount =
              latestBet.status === "won"
                ? parseFloat(latestBet.resolution_data?.payout || 0)
                : 0;

            window.dispatchEvent(
              new CustomEvent("jungle-celebrate", {
                detail: {
                  type: latestBet.status === "won" ? "win" : "loss",
                  amount: latestBet.status === "won" ? winAmount : latestBet.amount,
                },
              })
            );

            // FRAUD HOOK: Check if user won >$1000 instantly
            if (winAmount > 1000) {
              axios.post("/api/fraud/check", {
                action: "win",
                amount: winAmount,
                userId,
                betId: latestBet.id,
              }).catch(() => {});
            }

            fetchBalance();
          }
        }
      } catch {
        // Polling failed silently
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isAuthenticated, token, fetchBalance, userId]);

  // -------------------------------------------------------------------------
  // 3. FETCH VERIFIED LIVE CAMERA FEEDS
  // -------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    const loadFeeds = async () => {
      try {
        const res = await axios.get("http://localhost:8000/camera-feeds", { timeout: 3000 });
        if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
          const verified = filterOnlyVerifiedFeeds(res.data);
          setAvailableFeeds(verified);

          setSelectedFeed((prev) => {
            const found = verified.find((f: CameraFeed) => f.id === prev.id);
            return found || verified[0];
          });
        }
      } catch {
        // Retain default verified streams
      }
    };

    loadFeeds();
    return () => {
      isMounted = false;
    };
  }, []);

  const handlePlaceBet = async () => {
    if (!isAuthenticated) {
      toast.error("Please log in first to place a bet!");
      return;
    }

    // Call backend fraud detection logic hook to monitor bet placement frequency
    try {
      await axios.post("/api/fraud/check", {
        action: "bet",
        amount: selectedStake,
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
    window.dispatchEvent(
      new CustomEvent("jungle-celebrate", {
        detail: {
          type: "win",
          amount: details.amount,
          title: "Bet Confirmed & Active",
        },
      })
    );
  };

  const getCountryFlag = (code: string) => {
    switch (code?.toUpperCase()) {
      case "US":
        return "🇺🇸";
      case "UK":
      case "GB":
        return "🇬🇧";
      case "NL":
        return "🇳🇱";
      default:
        return "🌐";
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 flex flex-col gap-6 select-none">
      {/* CELEBRATION OVERLAY */}
      <CelebrationOverlay />

      {/* MULTI-COUNTRY PAYMENT MODAL */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        betData={{
          betType: selectedMarket.type,
          criteria: {
            target_count: selectedMarket.target,
            operator: selectedMarket.operator,
            feed_id: selectedFeed.id,
          },
          amount: selectedStake,
          title: selectedMarket.title,
          odds: selectedMarket.odds,
        }}
        amount={selectedStake}
        mode="bet"
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* ------------------------------------------------------------- */}
      {/* 1. TOP STREAM SWITCHER BAR (NO SIDEBAR - CENTER STAGE)         */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 shadow-xl">
        {/* STREAM SELECTOR TABS */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400 font-bold shrink-0 hidden md:inline">
            LIVE CAMS:
          </span>
          {availableFeeds.map((feed) => {
            const isSelected = feed.id === selectedFeed.id;
            return (
              <button
                key={feed.id}
                onClick={() => setSelectedFeed(feed)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? "bg-[var(--jungle-green)] text-black shadow-[0_0_20px_rgba(204,255,0,0.4)] scale-102"
                    : "bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10"
                }`}
              >
                <span>{getCountryFlag(feed.country_code)}</span>
                <span>{feed.location}</span>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-live-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* TELEMETRY STATUS BADGES */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-black/70 border border-white/15 flex items-center gap-2 text-xs font-mono text-gray-300">
            <Radio size={13} className="text-[var(--jungle-green)] animate-pulse" />
            <span className="font-bold text-white">60FPS RTSP</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--jungle-green)]" />
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-[var(--jungle-green)]/15 border border-[var(--jungle-green)]/30 flex items-center gap-1.5 text-xs font-mono text-[var(--jungle-green)] font-bold">
            <Activity size={13} className={isWsCountConnected ? "animate-pulse" : ""} />
            <span>{isWsCountConnected ? "YOLOv8 LIVE WS" : "YOLOv8 DETECT"}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isWsCountConnected
                  ? "bg-[var(--jungle-green)] animate-ping"
                  : "bg-yellow-500"
              }`}
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. MAIN CENTER VIDEO STAGE WITH THE BRIGHT GREEN LINE         */}
      {/* ------------------------------------------------------------- */}
      <div className="relative w-full aspect-video min-h-[380px] max-h-[640px] rounded-3xl bg-black border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* HTML5 VIDEO PLAYER WITH SMOOTH TRANSITION */}
        <div className="absolute inset-0">
          <VideoPlayer
            feed={selectedFeed}
            className="w-full h-full object-cover"
            onStatusChange={(status) => {
              setIsConnected(status !== "error");
            }}
          />
        </div>

        {/* AMBIENT STREAM VIGNETTE */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none" />

        {/* TOP HUD BAR: ROAD NAME & TELEMETRY */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-30">
          {/* LEFT: LOCATION INFO */}
          <div className="flex flex-col gap-1 p-2 sm:p-2.5 rounded-2xl bg-black/75 backdrop-blur-md border border-white/15 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-base">{getCountryFlag(selectedFeed.country_code)}</span>
              <span className="font-black text-xs sm:text-sm uppercase tracking-wider text-white">
                {selectedFeed.location}
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--jungle-green)]/20 text-[var(--jungle-green)] font-bold">
                {selectedFeed.country_code}
              </span>
            </div>
            <span className="text-[11px] text-gray-400 font-medium truncate max-w-xs pl-1">
              {selectedFeed.name}
            </span>
          </div>

          {/* RIGHT: THE PROMINENT GREEN LINE COUNTER BOX & LIVE SYNC STATUS */}
          <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
            <motion.div
              key={carCount}
              initial={{ scale: 0.9, opacity: 0.8 }}
              animate={{ scale: [1, 1.06, 1], opacity: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl bg-black/85 backdrop-blur-xl border-2 border-[var(--jungle-green)] shadow-[0_0_30px_rgba(204,255,0,0.4)] flex items-center gap-3.5"
            >
              <div className="p-2 rounded-xl bg-[var(--jungle-green)]/15 border border-[var(--jungle-green)]/40 text-[var(--jungle-green)]">
                <Car size={20} className="animate-pulse" />
              </div>

              <div className="flex flex-col text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isWsCountConnected ? "bg-[var(--jungle-green)] animate-ping" : "bg-amber-400"}`} />
                  <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-[var(--jungle-green)] font-black">
                    {isWsCountConnected ? "WS LIVE SYNC" : "OFFLINE FALLBACK"}
                  </span>
                </div>
                <span className="text-[9px] text-gray-400 font-mono">OPTICAL COUNT</span>
              </div>

              <div className="text-3xl sm:text-4xl font-black text-white font-mono tabular-nums leading-none drop-shadow-[0_0_15px_rgba(204,255,0,0.7)] pl-1">
                {carCount}
              </div>
            </motion.div>

            {/* LIVE MARKET CONDITION TRACKER PILL */}
            <div className="px-3 py-1 rounded-xl bg-black/80 backdrop-blur-md border border-white/15 text-[10px] font-mono flex items-center gap-2 shadow-md">
              <span className="text-gray-400 uppercase font-bold">{selectedMarket.title}:</span>
              {selectedMarket.operator === "over" && (
                <span className={carCount > selectedMarket.target ? "text-[var(--jungle-green)] font-black" : "text-gray-300 font-bold"}>
                  {carCount > selectedMarket.target
                    ? `TARGET MET (${carCount}/${selectedMarket.target + 1}+)`
                    : `Live: ${carCount}/${selectedMarket.target + 1} (${selectedMarket.target + 1 - carCount} left)`}
                </span>
              )}
              {selectedMarket.operator === "under" && (
                <span className={carCount < selectedMarket.target ? "text-blue-400 font-black" : "text-red-400 font-bold"}>
                  {carCount < selectedMarket.target
                    ? `SAFE (${carCount} < ${selectedMarket.target})`
                    : `BUST (${carCount} >= ${selectedMarket.target})`}
                </span>
              )}
              {selectedMarket.operator === "exact" && (
                <span className={carCount === selectedMarket.target ? "text-purple-400 font-black" : "text-gray-300 font-bold"}>
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

        {/* ------------------------------------------------------------- */}
        {/* THE GREEN LINE: BRIGHT HORIZONTAL LINE ACROSS ROAD            */}
        {/* ------------------------------------------------------------- */}
        <div className="absolute top-[65%] left-0 right-0 z-20 pointer-events-none">
          {/* GLOW BACKGROUND HALO */}
          <div
            className={`absolute -top-3 left-0 right-0 h-8 transition-opacity duration-300 ${
              isLineTriggered
                ? "bg-[var(--jungle-green)]/35 blur-md"
                : "bg-[var(--jungle-green)]/15 blur-sm"
            }`}
          />

          {/* THE PHYSICAL NEON GREEN LINE */}
          <motion.div
            animate={
              isLineTriggered
                ? {
                    scaleY: 1.8,
                    filter: "brightness(1.8)",
                    boxShadow: "0 0 35px #ccff00, 0 0 60px rgba(204, 255, 0, 0.9)",
                  }
                : {
                    scaleY: 1,
                    filter: "brightness(1.1)",
                    boxShadow: "0 0 20px #ccff00, 0 0 35px rgba(204, 255, 0, 0.6)",
                  }
            }
            transition={{ duration: 0.15 }}
            className="w-full h-1.5 sm:h-2 bg-[var(--jungle-green)] relative overflow-hidden"
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
              className="absolute -top-3 w-8 h-8 -translate-x-1/2 rounded-full bg-white border-2 border-[var(--jungle-green)] shadow-[0_0_25px_#ccff00]"
            />
          )}

          {/* FLOATING "+1" VEHICLE CROSSING INDICATORS */}
          <AnimatePresence>
            {floatingPings.map((ping) => (
              <motion.div
                key={ping.id}
                initial={{ opacity: 1, y: 0, scale: 0.8 }}
                animate={{ opacity: 0, y: -45, scale: 1.3 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                style={{ left: `${ping.x}%` }}
                className="absolute -top-6 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/90 border border-[var(--jungle-green)] text-[var(--jungle-green)] font-mono font-black text-xs shadow-[0_0_15px_rgba(204,255,0,0.6)] flex items-center gap-1"
              >
                <span>+1</span>
                <Car size={11} />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* GREEN LINE HUD TAG */}
          <div className="absolute -top-7 left-4 px-2.5 py-0.5 rounded-md bg-black/80 border border-[var(--jungle-green)]/40 text-[9px] font-mono text-[var(--jungle-green)] font-extrabold uppercase tracking-widest shadow-md flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--jungle-green)] animate-ping" />
            OPTICAL TRIGGER ZONE
          </div>
        </div>

        {/* BOTTOM HUD TAG: YOLOv8 ACTIVE DETECTIONS */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2 pointer-events-none z-30">
          <div className="px-3 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 text-[11px] font-mono text-gray-300 flex items-center gap-2">
            <span className="text-[var(--jungle-green)] font-bold">YOLOv8</span>
            <span>Target Road Velocity: 64 mph</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400">Flow: Dense</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. RESTORED PROMINENT ODDS & BETTING SECTION                  */}
      {/* ------------------------------------------------------------- */}
      <div className="p-5 sm:p-6 rounded-3xl bg-black/60 backdrop-blur-xl border border-white/15 shadow-2xl flex flex-col gap-5">
        {/* ODDS SECTION HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="text-[var(--jungle-green)]" size={20} />
              Optical Prediction Markets & Live Odds
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Select an optical market based on vehicles crossing the Green Line
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-gray-400">Round Status:</span>
            <span className="px-2.5 py-1 rounded-full bg-[var(--jungle-green)]/15 border border-[var(--jungle-green)]/30 text-[var(--jungle-green)] font-bold uppercase tracking-wider">
              ACCEPTING WAGERS
            </span>
          </div>
        </div>

        {/* MARKET CARDS GRID (PROMINENT ODDS DISPLAY) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MarketCard
            title="UNDER 10"
            subtitle="Fewer than 10 Cars"
            odds="2.25x"
            color="blue"
            liveBadge={carCount < 10 ? `Holding (${carCount} < 10)` : `Bust (${carCount})`}
            isSelected={selectedMarket.operator === "under" && selectedMarket.target === 10}
            onClick={() => {
              setSelectedMarket({
                type: "count_prediction",
                target: 10,
                operator: "under",
                title: "UNDER 10",
                odds: "2.25x",
                description: "Pays if fewer than 10 vehicles cross the Green Line",
              });
            }}
          />

          <MarketCard
            title="OVER 13"
            subtitle="14+ Vehicles Rush"
            odds="3.60x"
            color="lime"
            highlight
            liveBadge={carCount > 13 ? `Target Met (${carCount})` : `Live: ${carCount}/14`}
            isSelected={selectedMarket.operator === "over" && selectedMarket.target === 13}
            onClick={() => {
              setSelectedMarket({
                type: "count_prediction",
                target: 13,
                operator: "over",
                title: "OVER 13",
                odds: "3.60x",
                description: "Pays if 14 or more vehicles cross the Green Line",
              });
            }}
          />

          <MarketCard
            title="STAR PICK"
            subtitle="Exact 7 Vehicles"
            odds="18.0x"
            color="purple"
            liveBadge={carCount === 7 ? `Jackpot Hit! (7)` : carCount < 7 ? `Target: 7 (${carCount}/7)` : `Passed (${carCount})`}
            isSelected={selectedMarket.operator === "exact" && selectedMarket.target === 7}
            onClick={() => {
              setSelectedMarket({
                type: "count_prediction",
                target: 7,
                operator: "exact",
                title: "STAR PICK",
                odds: "18.0x",
                description: "Jackpot tier: Exactly 7 vehicles cross the line",
              });
            }}
          />

          <MarketCard
            title="EXACT HIGH"
            subtitle="Exact 20 Vehicles"
            odds="36.0x"
            color="red"
            liveBadge={carCount === 20 ? `Jackpot Hit! (20)` : carCount < 20 ? `Target: 20 (${carCount}/20)` : `Passed (${carCount})`}
            isSelected={selectedMarket.operator === "exact" && selectedMarket.target === 20}
            onClick={() => {
              setSelectedMarket({
                type: "count_prediction",
                target: 20,
                operator: "exact",
                title: "EXACT HIGH",
                odds: "36.0x",
                description: "Mega jackpot: Exactly 20 vehicles cross the line",
              });
            }}
          />
        </div>

        {/* STAKE SELECTION & CTA ACTION */}
        <div className="pt-2 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-white/10">
          {/* STAKE PRESETS */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-extrabold text-gray-300">Select Stake</span>
              <span className="text-xs font-mono text-[var(--jungle-green)] font-bold">
                Wager: {formatAmount(selectedStake)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {STAKE_PRESETS.map((preset) => {
                const isSelected = selectedStake === preset;
                return (
                  <button
                    key={preset}
                    onClick={() => setSelectedStake(preset)}
                    className={`px-3 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[var(--jungle-green)] text-black border-[var(--jungle-green)] shadow-[0_0_15px_rgba(204,255,0,0.35)] scale-105"
                        : "bg-white/5 border-white/15 text-gray-300 hover:border-white/35 hover:bg-white/10"
                    }`}
                  >
                    {formatAmount(preset)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* BIG PLACE BET CTA BUTTON */}
          <div className="flex-1 max-w-md">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePlaceBet}
              className="w-full py-4 px-6 rounded-2xl font-black text-base sm:text-lg tracking-wider uppercase text-black bg-[var(--jungle-green)] shadow-[0_0_30px_rgba(204,255,0,0.4)] hover:shadow-[0_0_45px_rgba(204,255,0,0.7)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                PLACE BET • {selectedMarket.title} ({selectedMarket.odds})
              </span>
              <ChevronRight size={20} />
            </motion.button>
            <p className="text-center text-[11px] text-gray-400 mt-1.5 font-medium">
              {selectedMarket.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// SUB-COMPONENT: PROMINENT MARKET CARD
// -------------------------------------------------------------
interface MarketCardProps {
  title: string;
  subtitle: string;
  odds: string;
  color: "blue" | "lime" | "purple" | "red";
  onClick: () => void;
  highlight?: boolean;
  isSelected?: boolean;
  liveBadge?: string;
}

function MarketCard({
  title,
  subtitle,
  odds,
  color,
  onClick,
  highlight,
  isSelected,
  liveBadge,
}: MarketCardProps) {
  const bgMap = {
    blue: "bg-blue-950/40 border-blue-500/30",
    lime: "bg-[#182a06] border-[var(--jungle-green)]/50",
    purple: "bg-purple-950/40 border-purple-500/30",
    red: "bg-red-950/40 border-red-500/30",
  };

  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`p-4 sm:p-5 rounded-2xl border flex flex-col justify-between text-left relative overflow-hidden transition-all cursor-pointer min-h-[110px] ${
        bgMap[color]
      } ${
        isSelected
          ? "ring-2 ring-[var(--jungle-green)] shadow-[0_0_25px_rgba(204,255,0,0.4)] scale-102"
          : highlight
          ? "shadow-[0_0_20px_rgba(204,255,0,0.2)] ring-1 ring-[var(--jungle-green)]/40 hover:border-[var(--jungle-green)]"
          : "hover:border-white/35"
      }`}
    >
      {highlight && (
        <div className="absolute top-0 right-0 bg-[var(--jungle-green)] text-black text-[9px] font-black px-2 py-0.5 rounded-bl-xl flex items-center gap-1 shadow-md">
          <Flame size={10} />
          HOT
        </div>
      )}
      {isSelected && !highlight && (
        <div className="absolute top-0 right-0 bg-[var(--jungle-green)] text-black text-[9px] font-black px-2 py-0.5 rounded-bl-xl">
          SELECTED
        </div>
      )}

      <div>
        <span className="text-[10px] sm:text-xs uppercase font-extrabold text-gray-300 block">
          {title}
        </span>
        <span className="text-[10px] text-gray-400 block mt-0.5">{subtitle}</span>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span
          className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
            color === "lime" || isSelected ? "text-[var(--jungle-green)]" : "text-white"
          }`}
        >
          {odds}
        </span>
        {isSelected && <CheckCircle2 size={16} className="text-[var(--jungle-green)]" />}
      </div>

      {liveBadge && (
        <div className="mt-2 text-[9px] font-mono px-2 py-0.5 rounded-md bg-black/60 border border-white/10 flex items-center justify-between">
          <span className="text-gray-400">Live Status:</span>
          <span className="font-bold text-[var(--jungle-green)]">{liveBadge}</span>
        </div>
      )}
    </motion.button>
  );
}
