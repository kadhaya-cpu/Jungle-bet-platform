import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Ticket,
  Flame,
  DollarSign,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  History,
} from 'lucide-react';
import { useBettingStore } from '../../store/useBettingStore';
import { useWalletStore } from '../../store/useWalletStore';
import { getWalletBalance } from '../../services/wallet';
import { formatCurrency } from '../../utils/formatCurrency';
import { OPTICAL_MARKETS } from '../../utils/constants';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

const QUICK_STAKES = [5, 10, 25, 50, 100];

export interface BetSlipProps {
  onBetSuccess?: () => void;
  hideActiveBetsList?: boolean;
}

/**
 * Interactive Wager BetSlip:
 * - Displays selected game, city flag & current odds
 * - Input field for bet amount + quick stake buttons
 * - Calculates Potential Win = amount * odds
 * - 'Confirm Bet' button -> calls POST /api/bet (with fallback)
 * - Displays 'Bet Placed Successfully' toast notification
 * - Shows active & recent bets list with status (pending / won / lost)
 */
export const BetSlip: React.FC<BetSlipProps> = ({
  onBetSuccess,
  hideActiveBetsList = false,
}) => {
  const queryClient = useQueryClient();
  const { balance, preferredCurrency, setBalance } = useWalletStore();
  const {
    selectedCity,
    betSlip,
    selectedFeedId,
    selectedMarketKey,
    currentOdds,
    placedBets,
    setSelectedMarketKey,
    updateStake,
    placeBet: submitStoreBet,
  } = useBettingStore();

  const [formError, setFormError] = useState<string | null>(null);

  const activeMarket =
    betSlip?.market ||
    OPTICAL_MARKETS.find((m) => m.key === selectedMarketKey) ||
    OPTICAL_MARKETS[1];

  const effectiveOdds = betSlip?.odds || currentOdds || activeMarket.odds || 2.5;
  const stakeUsd = betSlip?.stakeUsd ?? 10;
  const potentialWinUsd = Number((stakeUsd * effectiveOdds).toFixed(2));

  const placeBetMutation = useMutation({
    mutationFn: async () => {
      if (!stakeUsd || stakeUsd < 1) {
        throw new Error('Minimum bet amount is $1.00 USD.');
      }
      if (balance > 0 && stakeUsd > balance) {
        throw new Error('Bet amount exceeds your available wallet balance.');
      }

      const gameId = betSlip?.feedId || selectedFeedId || selectedCity.feedId || 1;
      return submitStoreBet(gameId, stakeUsd, effectiveOdds);
    },
    onSuccess: async () => {
      setFormError(null);
      toast.success('Bet Placed Successfully! Watching live optical feed...');

      // Refresh live balance from backend if authenticated, otherwise deduct locally
      try {
        const freshBalance = await getWalletBalance();
        setBalance(freshBalance.balance_usd, freshBalance.preferred_currency);
      } catch {
        if (balance >= stakeUsd) {
          setBalance(Number((balance - stakeUsd).toFixed(2)));
        }
      }

      queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
      queryClient.invalidateQueries({ queryKey: ['betHistory'] });
      onBetSuccess?.();
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response
          ?.data?.detail ||
        (err as Error)?.message ||
        'Unable to place bet. Please verify your amount.';
      setFormError(message);
      toast.error(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    placeBetMutation.mutate();
  };

  return (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-[#FFD700]" />
          <h3 className="text-base font-extrabold text-white tracking-tight">Bet Slip</h3>
        </div>
        <span className="text-xs font-black px-2.5 py-1 rounded-full bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/40">
          x{effectiveOdds.toFixed(2)} Odds
        </span>
      </div>

      {/* Selected Game & City Summary */}
      <div className="rounded-xl bg-[#121212] border border-white/10 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="flex items-center gap-1.5 font-semibold text-white">
            <span>{betSlip?.flagEmoji || selectedCity.flagEmoji}</span>
            <span>{betSlip?.cityName || selectedCity.name}</span>
          </span>
          <span className="font-mono text-[#FFD700]">
            Game #{betSlip?.feedId || selectedFeedId}
          </span>
        </div>
        <p className="text-xs font-bold text-gray-200 truncate">
          {betSlip?.location || `${selectedCity.name} - ${selectedCity.corridorName}`}
        </p>

        {/* Quick Market Switcher Pills */}
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {OPTICAL_MARKETS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setSelectedMarketKey(m.key)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                activeMarket.key === m.key
                  ? 'bg-[#FFD700] text-[#0f0f0f]'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              <span>{m.shortLabel}</span>
              <span>x{m.odds}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bet Amount Input Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Bet Amount (USD)"
          type="number"
          step="0.5"
          min="1"
          value={stakeUsd}
          onChange={(e) => {
            setFormError(null);
            updateStake(parseFloat(e.target.value) || 0);
          }}
          leftIcon={<DollarSign className="w-4 h-4 text-[#FFD700]" />}
          error={formError || undefined}
        />

        {/* Quick Stake Presets */}
        <div className="grid grid-cols-5 gap-1.5">
          {QUICK_STAKES.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setFormError(null);
                updateStake(preset);
              }}
              className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                stakeUsd === preset
                  ? 'bg-[#FFD700]/20 border-[#FFD700] text-[#FFD700]'
                  : 'bg-[#141414] border-white/10 text-gray-300 hover:border-white/30'
              }`}
            >
              ${preset}
            </button>
          ))}
        </div>

        {/* Potential Win Calculation Summary (amount * odds) */}
        <div className="rounded-xl bg-gradient-to-br from-[#141414] to-[#0f0f0f] border border-white/10 p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between text-gray-400">
            <span>Bet Amount</span>
            <span className="font-semibold text-white">
              {formatCurrency(stakeUsd, 'USD')}
            </span>
          </div>
          <div className="flex items-center justify-between text-gray-400">
            <span>Multiplier Odds</span>
            <span className="font-mono font-bold text-[#FFD700]">
              x{effectiveOdds.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="font-bold text-white">Potential Win</span>
            <div className="text-right">
              <div className="text-base font-black text-[#FFD700]">
                {formatCurrency(potentialWinUsd, 'USD')}
              </div>
              {preferredCurrency !== 'USD' && (
                <div className="text-[10px] text-gray-400">
                  ≈{' '}
                  {formatCurrency(potentialWinUsd, preferredCurrency, {
                    convertFromUsd: true,
                    useCustomRate: true,
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {formError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 flex items-center gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={placeBetMutation.isPending}
          leftIcon={<Flame className="w-4 h-4" />}
        >
          Confirm Bet ({formatCurrency(stakeUsd, 'USD')})
        </Button>

        <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1.5 text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          Connected to POST /api/bet with atomic settlement
        </p>
      </form>

      {/* Active & Recent Bets List with Status (pending / won / lost) */}
      {!hideActiveBetsList && (
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-[#FFD700]" />
              Active & Recent Bets
            </h4>
            <span className="text-[11px] font-bold text-[#FFD700]">
              {placedBets.length} total
            </span>
          </div>

          {placedBets.length === 0 ? (
            <p className="text-xs text-gray-500 py-3 text-center">
              No active bets yet. Select a city and confirm your wager!
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {placedBets.slice(0, 6).map((bet) => {
                const betOdds = bet.odds || bet.criteria?.odds || 2.5;
                const winAmount =
                  bet.potentialWin || Number((bet.amount * betOdds).toFixed(2));
                return (
                  <div
                    key={bet.id}
                    className="rounded-xl bg-[#121212] border border-white/5 px-3 py-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate flex items-center gap-1.5">
                        <span>{bet.flagEmoji || '🇪🇺'}</span>
                        <span>
                          {bet.cityName || `Feed #${bet.criteria?.feed_id || 1}`}
                        </span>
                        <span className="text-[10px] font-mono text-[#FFD700]">
                          x{Number(betOdds).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono">
                        Stake: {formatCurrency(bet.amount, 'USD')} → Win:{' '}
                        <span className="text-gray-200">
                          {formatCurrency(winAmount, 'USD')}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {bet.status === 'won' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          WON
                        </span>
                      ) : bet.status === 'lost' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/15 text-red-400 border border-red-500/30">
                          <XCircle className="w-3 h-3" />
                          LOST
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          <Clock className="w-3 h-3 animate-spin" />
                          PENDING
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BetSlip;
