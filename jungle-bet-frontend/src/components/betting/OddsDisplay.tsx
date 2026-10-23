import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Sparkles, TrendingUp } from 'lucide-react';
import { OPTICAL_MARKETS, MarketOption } from '../../utils/constants';

export interface OddsDisplayProps {
  selectedKey: MarketOption['key'];
  onSelect: (market: MarketOption) => void;
  compact?: boolean;
}

/**
 * Interactive Optical Market Odds Selector (2.25x, 3.60x, 18.0x, 36.0x)
 */
export const OddsDisplay: React.FC<OddsDisplayProps> = ({
  selectedKey,
  onSelect,
  compact = false,
}) => {
  return (
    <div
      className={`grid ${
        compact ? 'grid-cols-2 sm:grid-cols-4 gap-2' : 'grid-cols-1 sm:grid-cols-2 gap-3'
      }`}
    >
      {OPTICAL_MARKETS.map((market) => {
        const isSelected = market.key === selectedKey;
        const isJackpot = market.odds >= 18;

        return (
          <motion.button
            key={market.key}
            type="button"
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => onSelect(market)}
            className={`relative text-left rounded-2xl p-3.5 transition-all duration-200 border ${
              isSelected
                ? 'bg-gradient-to-br from-[#FFD700]/20 via-[#1a1a1a] to-[#1a1a1a] border-[#FFD700] shadow-[0_0_25px_rgba(255,215,0,0.2)]'
                : 'bg-[#1a1a1a] border-white/10 hover:border-[#FFD700]/40'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-1.5">
                {isJackpot ? (
                  <Sparkles className="w-3.5 h-3.5 text-[#FFD700]" />
                ) : (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                )}
                {compact ? market.shortLabel : market.label}
              </span>
              {market.badge && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
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
              <p className="text-xs text-gray-400 mb-3 line-clamp-2">{market.description}</p>
            )}

            <div className="flex items-baseline justify-between pt-1 border-t border-white/5">
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-[#FFD700]" />
                Multiplier
              </span>
              <span className="text-lg font-black text-[#FFD700]">
                {market.odds.toFixed(2)}x
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};

export default OddsDisplay;
