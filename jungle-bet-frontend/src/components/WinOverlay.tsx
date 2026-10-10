"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Sparkles, X, CheckCircle2, ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";

interface WinOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  currency?: string;
  durationSeconds?: number;
  prediction?: number;
  actualCount?: number;
  multiplier?: number;
  autoDismissMs?: number;
}

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  rotate: number;
  duration: number;
  delay: number;
  shape: "rect" | "circle" | "ribbon";
}

export default function WinOverlay({
  isOpen,
  onClose,
  amount,
  currency,
  durationSeconds,
  prediction,
  actualCount,
  multiplier,
  autoDismissMs = 6000,
}: WinOverlayProps) {
  const { formatAmount } = useStore();

  // Generate 45 realistic confetti pieces
  const confetti = useMemo<ConfettiPiece[]>(() => {
    const colors = [
      "#fbbf24", // amber
      "#fef08a", // soft yellow
      "#f59e0b", // deep amber
      "#10b981", // emerald
      "#34d399", // light emerald
      "#ffffff", // pure white
      "#60a5fa", // sky blue
    ];
    const shapes: ("rect" | "circle" | "ribbon")[] = ["rect", "circle", "ribbon"];

    return Array.from({ length: 45 }, (_, i) => ({
      id: i,
      x: (i * 22) % 100 - 50, // horizontal spread
      y: -200 - ((i * 17) % 350),
      size: 8 + (i % 10),
      color: colors[i % colors.length],
      rotate: (i * 73) % 720,
      duration: 2.5 + ((i % 5) * 0.4),
      delay: (i % 8) * 0.08,
      shape: shapes[i % shapes.length],
    }));
  }, []);

  // Auto-dismiss countdown
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [isOpen, autoDismissMs, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-hidden select-none">
          {/* 1. BACKDROP WITH GOLD AMBIENT GLOW */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.18)_0%,transparent_70%)]" />
          </motion.div>

          {/* 2. DYNAMIC CONFETTI PARTICLES */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {confetti.map((c) => (
              <motion.div
                key={c.id}
                initial={{
                  x: `${50 + c.x}vw`,
                  y: "-10vh",
                  rotate: 0,
                  opacity: 1,
                  scale: 0.8,
                }}
                animate={{
                  y: "110vh",
                  x: `${50 + c.x + (c.id % 2 === 0 ? 12 : -12)}vw`,
                  rotate: c.rotate,
                  opacity: [1, 1, 0.9, 0],
                  scale: [0.8, 1.1, 0.9],
                }}
                transition={{
                  duration: c.duration,
                  delay: c.delay,
                  ease: "easeOut",
                  repeat: Infinity,
                  repeatDelay: 0.5,
                }}
                style={{
                  position: "absolute",
                  width: c.shape === "ribbon" ? c.size * 2 : c.size,
                  height: c.shape === "ribbon" ? c.size * 0.4 : c.size,
                  backgroundColor: c.color,
                  borderRadius: c.shape === "circle" ? "50%" : "2px",
                  boxShadow: `0 0 10px ${c.color}aa`,
                }}
              />
            ))}
          </div>

          {/* 3. GOLD-THEMED HERO GRAPHIC CARD */}
          <motion.div
            initial={{ scale: 0.4, y: 60, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: -40, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 260 }}
            className="relative w-full max-w-md rounded-3xl p-8 sm:p-10 border-2 border-amber-400/80 shadow-[0_0_80px_rgba(251,191,36,0.45)] text-center overflow-hidden z-10"
            style={{
              background:
                "radial-gradient(circle at 50% 20%, #2f2105 0%, #161002 60%, #0a0701 100%)",
            }}
          >
            {/* AMBIENT RADIAL LIGHT RAYS */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
              className="absolute -top-32 -left-32 w-96 h-96 bg-[conic-gradient(from_0deg,transparent_0_30deg,rgba(251,191,36,0.15)_45deg,transparent_60deg)] rounded-full pointer-events-none"
            />

            {/* CLOSE BUTTON */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-amber-200/70 hover:text-white transition-all cursor-pointer z-20"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            {/* TROPHY ICON WITH GOLD GLOW */}
            <div className="relative inline-block mb-4">
              <motion.div
                animate={{
                  scale: [1, 1.15, 1],
                  rotate: [0, -4, 4, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2.2,
                  ease: "easeInOut",
                }}
                className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-200 p-0.5 shadow-[0_0_40px_rgba(251,191,36,0.7)] flex items-center justify-center mx-auto"
              >
                <div className="w-full h-full rounded-full bg-[#1b1303] flex items-center justify-center">
                  <Trophy size={48} className="text-yellow-400 drop-shadow-[0_0_20px_rgba(251,191,36,1)]" />
                </div>
              </motion.div>
              <Sparkles
                size={22}
                className="absolute -top-1 -right-1 text-yellow-300 animate-pulse"
              />
            </div>

            {/* LARGE 'WON' TEXT */}
            <motion.h1
              initial={{ scale: 0.8, letterSpacing: "0.05em" }}
              animate={{ scale: 1, letterSpacing: "0.2em" }}
              className="text-6xl sm:text-7xl font-black uppercase tracking-widest leading-none bg-gradient-to-b from-yellow-100 via-amber-300 to-yellow-600 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(251,191,36,0.9)] mb-3"
            >
              WON
            </motion.h1>

            {/* CURRENCY AMOUNT WON WITH '+' SIGN */}
            <div className="my-4 py-3 px-6 rounded-2xl bg-[#140e02]/90 border border-amber-400/40 shadow-inner flex items-baseline justify-center gap-1.5">
              <span className="text-4xl sm:text-5xl font-black font-mono text-[#00e5b9] drop-shadow-[0_0_15px_rgba(0,229,185,0.7)]">
                +
              </span>
              <span className="text-4xl sm:text-5xl font-black font-mono text-white drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]">
                {formatAmount(amount)}
              </span>
            </div>

            {/* PREDICTION SUMMARY BADGE */}
            {(durationSeconds !== undefined || prediction !== undefined) && (
              <div className="flex flex-col gap-1 text-xs font-mono text-amber-200/80 mb-6 bg-white/5 py-2.5 px-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Duration Window:</span>
                  <span className="font-bold text-white">{durationSeconds ?? 10}s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Prediction Target:</span>
                  <span className="font-bold text-amber-300">{prediction ?? 0} Cars</span>
                </div>
                {actualCount !== undefined && (
                  <div className="flex items-center justify-between border-t border-white/5 pt-1 mt-0.5">
                    <span className="text-gray-400">Optical AI Confirmed:</span>
                    <span className="font-bold text-[#00e5b9] flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      {actualCount} Vehicles
                    </span>
                  </div>
                )}
                {multiplier && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Odds Multiplier:</span>
                    <span className="font-bold text-amber-400">{multiplier}x</span>
                  </div>
                )}
              </div>
            )}

            {/* ACTION BUTTON */}
            <button
              onClick={onClose}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 hover:from-yellow-400 hover:to-amber-300 text-black font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 border-0"
            >
              <span>Collect Payout & Continue</span>
              <ArrowRight size={18} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
