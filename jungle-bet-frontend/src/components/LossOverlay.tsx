"use client";

import React, { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Flame, X, RotateCcw, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";

interface LossOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  currency?: string;
  durationSeconds?: number;
  prediction?: number;
  actualCount?: number;
  autoDismissMs?: number;
}

interface EmberPiece {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
}

export default function LossOverlay({
  isOpen,
  onClose,
  amount,
  currency,
  durationSeconds,
  prediction,
  actualCount,
  autoDismissMs = 6000,
}: LossOverlayProps) {
  const { formatAmount } = useStore();

  // Floating red ember particles
  const embers = useMemo<EmberPiece[]>(() => {
    const colors = ["#ef4444", "#dc2626", "#b91c1c", "#f87171", "#7f1d1d"];
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: (i * 27) % 100 - 50,
      size: 4 + (i % 6),
      duration: 3 + ((i % 4) * 0.5),
      delay: (i % 6) * 0.15,
      color: colors[i % colors.length],
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
          {/* 1. BACKDROP WITH CRIMSON AMBIENT GLOW */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.22)_0%,transparent_70%)]" />
          </motion.div>

          {/* 2. FLOATING RED EMBERS PARTICLES */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {embers.map((e) => (
              <motion.div
                key={e.id}
                initial={{
                  x: `${50 + e.x}vw`,
                  y: "105vh",
                  opacity: 0,
                  scale: 0.5,
                }}
                animate={{
                  y: "-10vh",
                  x: `${50 + e.x + (e.id % 2 === 0 ? 8 : -8)}vw`,
                  opacity: [0, 0.8, 0.6, 0],
                  scale: [0.5, 1.2, 0.4],
                }}
                transition={{
                  duration: e.duration,
                  delay: e.delay,
                  ease: "easeOut",
                  repeat: Infinity,
                  repeatDelay: 0.3,
                }}
                style={{
                  position: "absolute",
                  width: e.size,
                  height: e.size,
                  backgroundColor: e.color,
                  borderRadius: "50%",
                  boxShadow: `0 0 12px ${e.color}`,
                }}
              />
            ))}
          </div>

          {/* 3. RED-THEMED GRAPHIC CARD */}
          <motion.div
            initial={{ scale: 0.4, y: 60, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: -40, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 260 }}
            className="relative w-full max-w-md rounded-3xl p-8 sm:p-10 border-2 border-red-500/80 shadow-[0_0_80px_rgba(239,68,68,0.5)] text-center overflow-hidden z-10"
            style={{
              background:
                "radial-gradient(circle at 50% 20%, #300a0a 0%, #150303 60%, #0a0101 100%)",
            }}
          >
            {/* CLOSE BUTTON */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-red-200/70 hover:text-white transition-all cursor-pointer z-20"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            {/* PULSING RED SHIELD / FLAME ICON */}
            <div className="relative inline-block mb-4">
              <motion.div
                animate={{
                  scale: [1, 1.08, 1],
                  x: [-3, 3, -3, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 0.6,
                  ease: "easeInOut",
                }}
                className="w-24 h-24 rounded-full bg-gradient-to-tr from-red-700 via-rose-600 to-red-400 p-0.5 shadow-[0_0_40px_rgba(239,68,68,0.8)] flex items-center justify-center mx-auto"
              >
                <div className="w-full h-full rounded-full bg-[#180404] flex items-center justify-center">
                  <ShieldAlert size={48} className="text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,1)]" />
                </div>
              </motion.div>
              <Flame
                size={22}
                className="absolute -top-1 -right-1 text-red-400 animate-pulse"
              />
            </div>

            {/* LARGE 'LOST' TEXT */}
            <motion.h1
              initial={{ scale: 0.8, letterSpacing: "0.05em" }}
              animate={{ scale: 1, letterSpacing: "0.2em" }}
              className="text-6xl sm:text-7xl font-black uppercase tracking-widest leading-none bg-gradient-to-b from-red-100 via-rose-500 to-red-800 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(239,68,68,0.9)] mb-3"
            >
              LOST
            </motion.h1>

            {/* AMOUNT LOST WITH '-' SIGN */}
            <div className="my-4 py-3 px-6 rounded-2xl bg-[#140404]/90 border border-red-500/40 shadow-inner flex items-baseline justify-center gap-1.5">
              <span className="text-4xl sm:text-5xl font-black font-mono text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.7)]">
                -
              </span>
              <span className="text-4xl sm:text-5xl font-black font-mono text-white drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">
                {formatAmount(amount)}
              </span>
            </div>

            {/* PREDICTION SUMMARY BADGE */}
            {(durationSeconds !== undefined || prediction !== undefined) && (
              <div className="flex flex-col gap-1 text-xs font-mono text-red-200/80 mb-6 bg-white/5 py-2.5 px-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Duration Window:</span>
                  <span className="font-bold text-white">{durationSeconds ?? 10}s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Your Prediction:</span>
                  <span className="font-bold text-red-300">{prediction ?? 0} Cars</span>
                </div>
                {actualCount !== undefined && (
                  <div className="flex items-center justify-between border-t border-white/5 pt-1 mt-0.5">
                    <span className="text-gray-400">Optical AI Confirmed:</span>
                    <span className="font-bold text-gray-200 flex items-center gap-1">
                      <AlertTriangle size={12} className="text-amber-400" />
                      {actualCount} Vehicles
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ACTION BUTTON */}
            <button
              onClick={onClose}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-500 to-red-600 hover:from-red-500 hover:to-rose-400 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 border-0"
            >
              <RotateCcw size={18} />
              <span>Try Again</span>
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
