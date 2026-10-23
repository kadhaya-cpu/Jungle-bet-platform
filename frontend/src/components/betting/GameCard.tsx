import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Radio, Clock, Ticket, Eye } from 'lucide-react';
import { CameraFeedGame, useBettingStore } from '../../store/useBettingStore';
import { OPTICAL_MARKETS, MarketOption } from '../../utils/constants';
import { getCityById, EUROPE_CITIES } from '../../utils/cityData';
import { OddsDisplay } from './OddsDisplay';
import { Button } from '../common/Button';

export interface GameCardProps {
  game: CameraFeedGame;
  isSelected?: boolean;
  onSelectGame?: (feedId: number) => void;
  onOpenBetModal?: (game: CameraFeedGame) => void;
}

/**
 * European City Betting Challenge GameCard
 * Displays thumbnail image, city name, country flag icon, current odds (e.g., x2.5),
 * live timer countdown, and 'Place Bet' button that opens the Bet Modal.
 */
export const GameCard: React.FC<GameCardProps> = ({
  game,
  isSelected = false,
  onSelectGame,
  onOpenBetModal,
}) => {
  const {
    selectedMarketKey,
    selectCity,
    setSelectedFeedId,
    setSelectedMarketKey,
    setBetSlip,
    openBetModal,
    betSlip,
  } = useBettingStore();

  const cityMeta =
    (game.cityId && getCityById(game.cityId)) ||
    (game.cityName && getCityById(game.cityName)) ||
    EUROPE_CITIES.find((c) => c.feedId === game.id) ||
    EUROPE_CITIES[0];

  const cityName = game.cityName || cityMeta.name;
  const flagEmoji = game.flagEmoji || cityMeta.flagEmoji;
  const countryName = game.country || cityMeta.country;
  const currentOdds = game.odds || 2.5;
  const thumbnailUrl = game.thumbnailUrl || cityMeta.thumbnailUrl;

  const [secondsLeft, setSecondsLeft] = useState<number>(
    game.timeRemainingSeconds || 180
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 1 ? prev - 1 : game.timeRemainingSeconds || 180));
    }, 1000);
    return () => clearInterval(interval);
  }, [game.timeRemainingSeconds]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const syncSelection = (marketOverride?: MarketOption) => {
    const activeMarket =
      marketOverride ||
      OPTICAL_MARKETS.find((m) => m.key === selectedMarketKey) ||
      OPTICAL_MARKETS[1];

    selectCity(cityMeta);
    setSelectedFeedId(game.id);
    if (marketOverride) {
      setSelectedMarketKey(marketOverride.key);
    }
    setBetSlip({
      feedId: game.id,
      feedName: game.name,
      location: game.location,
      cityName,
      flagEmoji,
      odds: marketOverride ? marketOverride.odds : currentOdds,
      market: activeMarket,
      stakeUsd: betSlip?.stakeUsd || 10,
    });
    onSelectGame?.(game.id);
  };

  const handlePlaceBetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    syncSelection();
    openBetModal(game);
    onOpenBetModal?.(game);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      onClick={() => syncSelection()}
      className={`group cursor-pointer rounded-2xl bg-[#1a1a1a] border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
        isSelected
          ? 'border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.2)] ring-1 ring-[#FFD700]/50'
          : 'border-white/10 hover:border-[#FFD700]/40'
      }`}
    >
      {/* Thumbnail Banner with Overlays */}
      <div className="relative h-40 w-full bg-[#111111] overflow-hidden">
        <img
          src={thumbnailUrl}
          alt={`${cityName} traffic challenge`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-85"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-black/30 to-black/30" />

        {/* Top Left: Flag + Country + Status */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-[#0f0f0f]/85 backdrop-blur-md text-white border border-white/15">
            <span>{flagEmoji}</span>
            <span>{cityName}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 backdrop-blur-md">
            <Radio className="w-2.5 h-2.5 animate-pulse" />
            {game.status === 'COMING_SOON' ? 'SOON' : 'LIVE'}
          </span>
        </div>

        {/* Top Right: Current Odds Pill (e.g., x2.5) */}
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center px-3 py-1 rounded-xl text-sm font-black bg-[#FFD700] text-[#0f0f0f] shadow-[0_0_15px_rgba(255,215,0,0.4)]">
            x{currentOdds.toFixed(1)}
          </span>
        </div>

        {/* Bottom Overlay: Timed Challenge Countdown */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0f0f0f]/80 backdrop-blur-md text-amber-300 font-mono text-[11px] border border-amber-500/30">
            <Clock className="w-3 h-3 text-[#FFD700]" />
            {formatTimer(secondsLeft)}
          </span>
          <span className="text-[11px] font-semibold text-gray-300 bg-[#0f0f0f]/75 px-2 py-0.5 rounded-lg">
            {countryName}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-extrabold text-white tracking-tight truncate">
              {flagEmoji} {cityName} Challenge
            </h3>
            <span className="text-xs font-mono font-bold text-[#FFD700]">
              Odds x{currentOdds.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-gray-400 flex items-center gap-1 truncate">
            <MapPin className="w-3.5 h-3.5 text-[#FFD700] shrink-0" />
            <span className="truncate">{game.location}</span>
          </p>
        </div>

        {/* Quick Market Multipliers */}
        <OddsDisplay
          selectedKey={isSelected ? selectedMarketKey : ('' as MarketOption['key'])}
          onSelect={(market) => syncSelection(market)}
          compact
        />

        {/* Action Buttons: Watch Stream + 'Place Bet' -> Opens Modal */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            type="button"
            variant={isSelected ? 'secondary' : 'outline'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              syncSelection();
            }}
            leftIcon={<Eye className="w-3.5 h-3.5" />}
          >
            {isSelected ? 'Streaming' : 'Watch Feed'}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handlePlaceBetClick}
            leftIcon={<Ticket className="w-3.5 h-3.5" />}
          >
            Place Bet
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default GameCard;
