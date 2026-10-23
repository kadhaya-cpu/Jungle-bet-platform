import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Radio, Video, ArrowUpRight } from 'lucide-react';
import { CameraFeedGame, useBettingStore } from '../../store/useBettingStore';
import { OPTICAL_MARKETS, MarketOption } from '../../utils/constants';
import { OddsDisplay } from './OddsDisplay';
import { Button } from '../common/Button';

export interface GameCardProps {
  game: CameraFeedGame;
  isSelected?: boolean;
  onSelectGame?: (feedId: number) => void;
}

/**
 * Live Optical Traffic Camera Game Card connected to backend /camera-feeds
 */
export const GameCard: React.FC<GameCardProps> = ({
  game,
  isSelected = false,
  onSelectGame,
}) => {
  const {
    selectedMarketKey,
    setSelectedFeedId,
    setSelectedMarketKey,
    setBetSlip,
    betSlip,
  } = useBettingStore();

  const handleMarketSelect = (market: MarketOption) => {
    setSelectedFeedId(game.id);
    setSelectedMarketKey(market.key);
    setBetSlip({
      feedId: game.id,
      feedName: game.name,
      location: game.location,
      market,
      stakeUsd: betSlip?.stakeUsd || 10,
    });
    onSelectGame?.(game.id);
  };

  const handleActivateStream = () => {
    const activeMarket =
      OPTICAL_MARKETS.find((m) => m.key === selectedMarketKey) || OPTICAL_MARKETS[1];
    handleMarketSelect(activeMarket);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl bg-[#1a1a1a] border transition-all duration-200 p-5 flex flex-col justify-between gap-4 ${
        isSelected
          ? 'border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.15)]'
          : 'border-white/10 hover:border-white/25'
      }`}
    >
      {/* Header Info */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              {game.status || 'ACTIVE'}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10">
              {game.country_code}
            </span>
          </div>
          <h3 className="text-base font-bold text-white tracking-tight">{game.name}</h3>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[#FFD700]" />
            {game.location}
          </p>
        </div>

        <Button
          variant={isSelected ? 'primary' : 'secondary'}
          size="sm"
          onClick={handleActivateStream}
          rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
        >
          {isSelected ? 'Streaming' : 'Watch Live'}
        </Button>
      </div>

      {/* Optical Trigger Line Preview Bar */}
      <div className="rounded-xl bg-[#111111] border border-white/5 px-3.5 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-gray-300">
          <Video className="w-4 h-4 text-[#FFD700]" />
          <span>Optical Green Line YOLOv8 Counter</span>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 font-semibold">
          Feed #{game.id}
        </span>
      </div>

      {/* Market Multipliers */}
      <OddsDisplay
        selectedKey={isSelected ? selectedMarketKey : ('' as MarketOption['key'])}
        onSelect={handleMarketSelect}
        compact
      />
    </motion.div>
  );
};

export default GameCard;
