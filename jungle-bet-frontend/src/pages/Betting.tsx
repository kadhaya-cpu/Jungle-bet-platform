import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flame, History, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { getGames, getBetResults } from '../services/betting';
import { useBettingStore } from '../store/useBettingStore';
import { VideoPlayer } from '../components/map/VideoPlayer';
import { InteractiveEuropeMap } from '../components/map/InteractiveEuropeMap';
import { OddsDisplay } from '../components/betting/OddsDisplay';
import { GameCard } from '../components/betting/GameCard';
import { BetSlip } from '../components/betting/BetSlip';
import { Loader } from '../components/common/Loader';
import { formatCurrency } from '../utils/formatCurrency';

/**
 * Live Optical Betting Console — Stream, Odds Multipliers, BetSlip & Bet History
 */
export const Betting: React.FC = () => {
  const {
    games,
    selectedFeedId,
    selectedMarketKey,
    history,
    setGames,
    setSelectedFeedId,
    setSelectedMarketKey,
    setHistory,
  } = useBettingStore();

  const { data: fetchedGames, isLoading: gamesLoading } = useQuery({
    queryKey: ['cameraFeeds'],
    queryFn: getGames,
  });

  const { data: fetchedHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['betHistory'],
    queryFn: getBetResults,
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (fetchedGames && fetchedGames.length > 0) {
      setGames(fetchedGames);
    }
  }, [fetchedGames, setGames]);

  useEffect(() => {
    if (fetchedHistory) {
      setHistory(fetchedHistory);
    }
  }, [fetchedHistory, setHistory]);

  const activeFeed =
    games.find((g) => g.id === selectedFeedId) || games[0] || null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left 8 Columns: Live Video Stream, Optical Odds, Map & History */}
      <div className="xl:col-span-8 space-y-6">
        {/* Live Camera Stream with Optical Green Line */}
        <VideoPlayer feed={activeFeed} />

        {/* Optical Prediction Multipliers */}
        <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-[#FFD700]" />
                Select Optical Prediction Market
              </h2>
              <p className="text-xs text-gray-400">
                Choose vehicle count target for {activeFeed?.name || `Feed #${selectedFeedId}`}
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400">30s Round Window</span>
          </div>

          <OddsDisplay
            selectedKey={selectedMarketKey}
            onSelect={(market) => setSelectedMarketKey(market.key)}
          />
        </div>

        {/* Interactive Europe Map for Switching Corridors */}
        <InteractiveEuropeMap
          feeds={games}
          onSelectFeed={(id) => setSelectedFeedId(id)}
        />

        {/* All Camera Feeds Grid */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
            All Registered Camera Feeds
          </h3>
          {gamesLoading ? (
            <Loader variant="skeleton" rows={2} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {games.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  isSelected={g.id === selectedFeedId}
                  onSelectGame={(id) => setSelectedFeedId(id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Live Wager History Table from GET /bets/history */}
        <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-[#FFD700]" />
              Your Optical Wager History
            </h3>
            <span className="text-xs text-gray-400">{history.length} total bets</span>
          </div>

          {historyLoading && history.length === 0 ? (
            <Loader variant="skeleton" rows={3} />
          ) : history.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">
              No wagers placed yet. Select a market above and lock in your first bet!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Bet ID</th>
                    <th className="py-2.5 px-3">Feed</th>
                    <th className="py-2.5 px-3">Market</th>
                    <th className="py-2.5 px-3">Stake</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Placed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {history.map((bet) => (
                    <tr key={bet.id} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-mono text-gray-400">#{bet.id}</td>
                      <td className="py-2.5 px-3 text-white font-semibold">
                        Feed #{bet.criteria?.feed_id || 1}
                      </td>
                      <td className="py-2.5 px-3 text-[#FFD700] font-bold uppercase">
                        {String(bet.criteria?.market_key || bet.type)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-white">
                        {formatCurrency(bet.amount, 'USD')}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right 4 Columns: Sticky BetSlip */}
      <div className="xl:col-span-4">
        <BetSlip />
      </div>
    </div>
  );
};

export default Betting;
