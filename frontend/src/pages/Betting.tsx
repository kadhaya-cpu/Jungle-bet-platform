import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Flame,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Globe2,
  RefreshCw,
} from 'lucide-react';
import { getGames, getBetResults } from '../services/betting';
import { useBettingStore } from '../store/useBettingStore';
import { VideoPlayer } from '../components/map/VideoPlayer';
import { InteractiveEuropeMap } from '../components/map/InteractiveEuropeMap';
import { OddsDisplay } from '../components/betting/OddsDisplay';
import { GameCard } from '../components/betting/GameCard';
import { BetSlip } from '../components/betting/BetSlip';
import { Loader } from '../components/common/Loader';
import { Modal } from '../components/common/Modal';
import { formatCurrency } from '../utils/formatCurrency';

/**
 * Main Betting Interface Page:
 * - Top Responsive Split Layout:
 *   * Left: Interactive Europe Map (8 European hubs with clickable gold pins)
 *   * Right: Live Video Player + Interactive Bet Slip
 * - Middle: Dynamic Odds Multiplier Display
 * - Bottom: Game Grid (all available European cities / challenges) + Wager History
 * - Modal: Opens when clicking 'Place Bet' on any GameCard
 */
export const Betting: React.FC = () => {
  const {
    selectedCity,
    activeGames,
    selectedFeedId,
    selectedMarketKey,
    placedBets,
    isBetModalOpen,
    setGames,
    selectCity,
    setSelectedFeedId,
    setSelectedMarketKey,
    setHistory,
    updateOdds,
    closeBetModal,
  } = useBettingStore();

  const { data: fetchedGames, isLoading: gamesLoading } = useQuery({
    queryKey: ['activeGames'],
    queryFn: getGames,
  });

  const { data: fetchedHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['betHistory'],
    queryFn: getBetResults,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (fetchedGames && fetchedGames.length > 0) {
      setGames(fetchedGames);
    }
  }, [fetchedGames, setGames]);

  useEffect(() => {
    if (fetchedHistory && fetchedHistory.length > 0) {
      setHistory(fetchedHistory);
    }
  }, [fetchedHistory, setHistory]);

  // Periodically tick dynamic odds
  useEffect(() => {
    const interval = setInterval(() => {
      updateOdds();
    }, 12000);
    return () => clearInterval(interval);
  }, [updateOdds]);

  const activeFeed =
    activeGames.find(
      (g) =>
        g.cityId === selectedCity.id ||
        g.id === selectedFeedId ||
        g.cityName?.toLowerCase() === selectedCity.name.toLowerCase()
    ) ||
    activeGames[0] ||
    null;

  return (
    <div className="space-y-8">
      {/* Page Title & Live Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Globe2 className="w-7 h-7 text-[#FFD700]" />
            <span>European Live Traffic Betting Arena</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Select a city pin on the interactive Europe map to watch its live traffic cam and lock in your odds.
          </p>
        </div>

        <button
          type="button"
          onClick={() => updateOdds()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1a1a1a] hover:bg-white/10 border border-[#FFD700]/30 text-xs font-bold text-[#FFD700] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Live Odds</span>
        </button>
      </div>

      {/* TOP SECTION: Side-by-Side Map (Left) & Video Player + Bet Slip (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column (7 cols on desktop): Interactive Europe Map + Dynamic Odds */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="flex-1">
            <InteractiveEuropeMap
              feeds={activeGames}
              onSelectCity={(city) => selectCity(city)}
              onSelectFeed={(id) => setSelectedFeedId(id)}
            />
          </div>

          {/* Dynamic Optical Prediction Multipliers */}
          <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[#FFD700]" />
                  <span>
                    Dynamic Odds — {selectedCity.flagEmoji} {selectedCity.name}
                  </span>
                </h2>
                <p className="text-xs text-gray-400">
                  Choose a vehicle crossing target for {activeFeed?.location || selectedCity.corridorName}
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                Live Multipliers
              </span>
            </div>

            <OddsDisplay
              selectedKey={selectedMarketKey}
              onSelect={(market) => setSelectedMarketKey(market.key)}
              baseOdds={activeFeed?.odds || 2.5}
              riskLevel={activeFeed?.riskLevel || 'medium'}
              timeRemainingSeconds={activeFeed?.timeRemainingSeconds || 180}
            />
          </div>
        </div>

        {/* Right Column (5 cols on desktop): Live Video Player + Bet Slip */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <VideoPlayer feed={activeFeed} />
          <BetSlip />
        </div>
      </div>

      {/* BOTTOM SECTION: Game Grid (All Available European Cities / Challenges) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-[#FFD700]" />
              <span>All European City Challenges ({activeGames.length})</span>
            </h2>
            <p className="text-xs text-gray-400">
              Click any city card to switch the live stream or click &ldquo;Place Bet&rdquo; to open the quick wager modal
            </p>
          </div>
          <span className="text-xs font-bold text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/30 px-3 py-1 rounded-full">
            Active: {selectedCity.flagEmoji} {selectedCity.name}
          </span>
        </div>

        {gamesLoading ? (
          <Loader variant="skeleton" rows={4} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeGames.map((game) => {
              const isHighlighted =
                game.id === selectedFeedId ||
                game.cityId === selectedCity.id ||
                game.cityName?.toLowerCase() === selectedCity.name.toLowerCase();
              return (
                <GameCard
                  key={game.id}
                  game={game}
                  isSelected={isHighlighted}
                  onSelectGame={(id) => setSelectedFeedId(id)}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Wager History Table */}
      <section className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-[#FFD700]" />
            <span>Placed Bets & Settlement History</span>
          </h3>
          <span className="text-xs text-gray-400">{placedBets.length} total bets</span>
        </div>

        {historyLoading && placedBets.length === 0 ? (
          <Loader variant="skeleton" rows={3} />
        ) : placedBets.length === 0 ? (
          <p className="text-xs text-gray-500 py-6 text-center">
            No wagers placed yet. Select a European city above and place your first bet!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Bet ID</th>
                  <th className="py-2.5 px-3">City / Feed</th>
                  <th className="py-2.5 px-3">Odds</th>
                  <th className="py-2.5 px-3">Stake</th>
                  <th className="py-2.5 px-3">Potential Win</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Placed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {placedBets.map((bet) => {
                  const betOdds = bet.odds || bet.criteria?.odds || 2.5;
                  const winAmount =
                    bet.potentialWin || Number((bet.amount * betOdds).toFixed(2));
                  return (
                    <tr key={bet.id} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-mono text-gray-400">#{bet.id}</td>
                      <td className="py-2.5 px-3 text-white font-semibold">
                        {bet.flagEmoji || '🇪🇺'}{' '}
                        {bet.cityName || `Feed #${bet.criteria?.feed_id || 1}`}
                      </td>
                      <td className="py-2.5 px-3 text-[#FFD700] font-mono font-bold">
                        x{Number(betOdds).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-white">
                        {formatCurrency(bet.amount, 'USD')}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">
                        {formatCurrency(winAmount, 'USD')}
                      </td>
                      <td className="py-2.5 px-3">
                        {bet.status === 'won' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            WON
                          </span>
                        ) : bet.status === 'lost' ? (
                          <span className="inline-flex items-center gap-1 text-red-400 font-bold">
                            <XCircle className="w-3.5 h-3.5" />
                            LOST
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-300 font-bold">
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            PENDING
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-500">
                        {bet.created_at
                          ? new Date(bet.created_at).toLocaleTimeString()
                          : 'Just now'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Place Bet Modal (Opened when clicking 'Place Bet' on any GameCard) */}
      <Modal
        isOpen={isBetModalOpen}
        onClose={closeBetModal}
        title={`Place Bet — ${selectedCity.flagEmoji} ${selectedCity.name}`}
        subtitle={activeFeed?.location || selectedCity.corridorName}
        maxWidthClass="max-w-md"
      >
        <BetSlip onBetSuccess={closeBetModal} hideActiveBetsList />
      </Modal>
    </div>
  );
};

export default Betting;
