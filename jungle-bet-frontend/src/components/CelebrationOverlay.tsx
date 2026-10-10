"use client";

import { useEffect, useState } from "react";
import WinOverlay from "./WinOverlay";
import LossOverlay from "./LossOverlay";

export interface CelebrationDetail {
  type: "win" | "loss";
  amount?: number;
  currency?: string;
  durationSeconds?: number;
  prediction?: number;
  actualCount?: number;
  multiplier?: number;
  title?: string;
}

export default function CelebrationOverlay() {
  const [celebration, setCelebration] = useState<CelebrationDetail | null>(null);

  // Listen for custom events dispatched when bets resolve
  useEffect(() => {
    const handler = (e: CustomEvent<CelebrationDetail>) => {
      if (e.detail) {
        setCelebration(e.detail);
      }
    };

    window.addEventListener("jungle-celebrate", handler as EventListener);
    return () => window.removeEventListener("jungle-celebrate", handler as EventListener);
  }, []);

  if (!celebration) return null;

  if (celebration.type === "win") {
    return (
      <WinOverlay
        isOpen={true}
        onClose={() => setCelebration(null)}
        amount={celebration.amount ?? 0}
        currency={celebration.currency}
        durationSeconds={celebration.durationSeconds}
        prediction={celebration.prediction}
        actualCount={celebration.actualCount}
        multiplier={celebration.multiplier}
      />
    );
  }

  return (
    <LossOverlay
      isOpen={true}
      onClose={() => setCelebration(null)}
      amount={celebration.amount ?? 0}
      currency={celebration.currency}
      durationSeconds={celebration.durationSeconds}
      prediction={celebration.prediction}
      actualCount={celebration.actualCount}
    />
  );
}
