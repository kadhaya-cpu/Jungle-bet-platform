import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Sparkles, TrendingUp, Clock, ShieldAlert } from 'lucide-react';
import { OPTICAL_MARKETS, MarketOption } from '../../utils/constants';
import { useBettingStore } from '../../store/useBettingStore';

export interface OddsDisplayProps {
  selectedKey?: MarketOption['key'];
  onSelect?: (market: MarketOption) => void;
  compact?: boolean;
  baseOdds?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  timeRemainingSeconds?: number;
}

/**
 * Dynamic Odds Multiplier Display based on risk level, time remaining & optical markets
 */
export const OddsDisplay: React.FC<OddsDisplayProps> = ({
  selectedKey,
  onSelect,
  compact = false,
  baseOdds,
  riskLevel = 'medium',
  timeRemainingSeconds = 120,
}) => {
  const { currentOdds, selectedMarketKey, setSelectedMarketKey, updateOdds } =
    useBettingStore();

  const activeKey = selectedKey ?? selectedMarketKey;
  const [countdown, setCountdown] = useState<number>(timeRemainingSeconds);

  useEffect(() => {
    setCountdown(timeRemainingSeconds);
  }, [timeRemainingSeconds]);

  useEffect(() => {
    if (compact) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : timeRemainingSeconds));
    }, 1000);
    return () => clearInterval(timer);
  }, [compact, timeRemainingSeconds]);

  // Calculate dynamic surge multiplier when time remaining is under 60s or risk is high
  const riskBonus = riskLevel === 'high' ? 0.35 : riskLevel === 'medium' ? 0.15 : 0;
  const urgencyBonus = countdown < 60 ? Number(((60 - countdown) * 0.01).toFixed(2)) : 0;
  const dynamicMultiplier = Number(
    ((baseOdds || currentOdds || 2.5) + riskBonus + urgencyBonus).toFixed(2)
  );

  const handleMarketClick = (market: MarketOption) => {
    setSelectedMarketKey(market.key);
    updateOdds(market.odds);
    onSelect?.(market);
  };

  return (
    <div className="space-y-3">
      {/* Dynamic Risk & Time Remaining Multiplier Banner (shown in full view) */}
      {!compact && (
        <div className="rounded-xl bg-[#121212] border border-[#FFD700]/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFD700]/15 text-[#FFD700] font-extrabold uppercase text-[10px] border border-[#FFD700]/30">
              <ShieldAlert className="w-3 h-3" />
              Risk: {riskLevel.toUpperCase()}
            </span>
            <span className="inline-flex items-center gap-1 text-gray-300 font-mono">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              {Math.floor(countdown / 60)}m {String(countdown % 60).padStart(2, '0')}s left
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Live Dynamic Odds:</span>
            <span className="text-sm font-black text-[#FFD700] font-mono">
              x{dynamicMultiplier.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Market Multiplier Grid */}
      <div
        className={`grid ${
          compact ? 'grid-cols-2 sm:grid-cols-4 gap-2' : 'grid-cols-2 sm:grid-cols-4 gap-2.5'
        }`}
      >
        {OPTICAL_MARKETS.map((market) => {
          const isSelected = market.key === activeKey;
          const isJackpot = market.odds >= 18;
          const displayedOdds = Number((market.odds + (compact ? 0 : urgencyBonus)).toFixed(2));

          return (
            <motion.button
              key={market.key}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleMarketClick(market)}
              className={`relative text-left rounded-xl p-3 transition-all duration-200 border ${
                isSelected
                  ? 'bg-gradient-to-br from-[#FFD700]/20 via-[#1a1a1a] to-[#1a1a1a] border-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.2)]'
                  : 'bg-[#141414] border-white/10 hover:border-[#FFD700]/40'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-white flex items-center gap-1 truncate">
                  {isJackpot ? (
                    <Sparkles className="w-3 h-3 text-[#FFD700] shrink-0" />
                  ) : (
                    <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                  )}
                  <span className="truncate">{market.shortLabel}</span>
                </span>
                {market.badge && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                      isSelected
                        ? 'bg-[#FFD700] text-[#0f0f0f]'
                        : 'bg-white/10 text-[#FFD700]'
                    }`}
                  >
                    {market.badge}
                  </span>
                )}
              </div>

              {!compact && (
                <p className="text-[11px] text-gray-400 mb-2 line-clamp-1">
                  {market.description}
                </p>
              )}

              <div className="flex items-baseline justify-between pt-1 border-t border-white/5">
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5 text-[#FFD700]" />
                  Odds
                </span>
                <span className="text-sm font-black text-[#FFD700]">
                  x{displayedOdds.toFixed(2)}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default OddsDisplay;
