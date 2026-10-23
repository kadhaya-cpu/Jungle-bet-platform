import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Ticket, Flame, DollarSign, ShieldCheck, AlertCircle } from 'lucide-react';
import { useBettingStore } from '../../store/useBettingStore';
import { useWalletStore } from '../../store/useWalletStore';
import { useAuthStore } from '../../store/useAuthStore';
import { placeBet } from '../../services/betting';
import { getWalletBalance } from '../../services/wallet';
import { formatCurrency } from '../../utils/formatCurrency';
import { validateBetForm } from '../../utils/validateForm';
import { I18N_TRANSLATIONS, OPTICAL_MARKETS } from '../../utils/constants';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

const QUICK_STAKES = [5, 10, 25, 50, 100];

/**
 * Interactive Wager BetSlip with real-time payout calculation & backend POST /bet/place
 */
export const BetSlip: React.FC = () => {
  const queryClient = useQueryClient();
  const { language, isAuthenticated } = useAuthStore();
  const { balance, preferredCurrency, setBalance } = useWalletStore();
  const {
    betSlip,
    selectedFeedId,
    selectedMarketKey,
    setSelectedMarketKey,
    updateStake,
    addPlacedBet,
  } = useBettingStore();

  const [formError, setFormError] = useState<string | null>(null);
  const t = I18N_TRANSLATIONS[language] || I18N_TRANSLATIONS.en;

  const activeMarket =
    betSlip?.market ||
    OPTICAL_MARKETS.find((m) => m.key === selectedMarketKey) ||
    OPTICAL_MARKETS[1];
  const stakeUsd = betSlip?.stakeUsd ?? 10;
  const potentialPayoutUsd = stakeUsd * activeMarket.odds;

  const placeBetMutation = useMutation({
    mutationFn: async () => {
      const validation = validateBetForm(stakeUsd, balance);
      if (!validation.isValid) {
        throw new Error(validation.errors.stake);
      }

      const feedId = betSlip?.feedId || selectedFeedId || 1;
      return placeBet({
        bet_type: 'count_prediction',
        feed_id: feedId,
        amount: stakeUsd,
        criteria: {
          feed_id: feedId,
          market_key: activeMarket.key,
          target_count: activeMarket.targetCount,
          operator: activeMarket.operator,
          odds: activeMarket.odds,
          duration_seconds: 30,
        },
      });
    },
    onSuccess: async (res) => {
      setFormError(null);
      toast.success(res.message || 'Bet locked in! Watching optical trigger line...');

      addPlacedBet({
        id: res.bet_id,
        type: 'count_prediction',
        amount: stakeUsd,
        status: 'pending',
        created_at: new Date().toISOString(),
        criteria: {
          feed_id: res.feed_id,
          market_key: activeMarket.key,
          target_count: activeMarket.targetCount,
          operator: activeMarket.operator,
          odds: activeMarket.odds,
        },
      });

      // Refresh live balance from backend
      try {
        const freshBalance = await getWalletBalance();
        setBalance(freshBalance.balance_usd, freshBalance.preferred_currency);
      } catch {
        if (typeof res.remaining_balance === 'number') {
          setBalance(res.remaining_balance);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
      queryClient.invalidateQueries({ queryKey: ['betHistory'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response
          ?.data?.detail ||
        (err as Error)?.message ||
        'Unable to place bet. Please verify your balance.';
      setFormError(message);
      toast.error(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!isAuthenticated) {
      toast.error('Please sign in to place a wager.');
      return;
    }
    placeBetMutation.mutate();
  };

  return (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 space-y-5 sticky top-20">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-[#FFD700]" />
          <h3 className="text-base font-extrabold text-white tracking-tight">
            Optical Bet Slip
          </h3>
        </div>
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30">
          {activeMarket.odds.toFixed(2)}x Odds
        </span>
      </div>

      {/* Selected Camera & Market Details */}
      <div className="rounded-xl bg-[#121212] border border-white/10 p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Camera Junction</span>
          <span className="font-mono text-[#FFD700]">
            Feed #{betSlip?.feedId || selectedFeedId}
          </span>
        </div>
        <p className="text-sm font-bold text-white truncate">
          {betSlip?.location || 'Los Angeles - I-405'}
        </p>

        {/* Quick Market Switcher Pills */}
        <div className="grid grid-cols-2 gap-1.5 pt-2">
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
              <span>{m.odds}x</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stake Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Wager Stake (USD)"
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

        {/* Payout Summary */}
        <div className="rounded-xl bg-gradient-to-br from-[#141414] to-[#0f0f0f] border border-white/10 p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between text-gray-400">
            <span>Available Balance</span>
            <span className="font-semibold text-white">
              {formatCurrency(balance, 'USD')}
            </span>
          </div>
          <div className="flex items-center justify-between text-gray-400">
            <span>Target Rule</span>
            <span className="font-semibold text-gray-200">{activeMarket.label}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="font-bold text-white">Potential Payout</span>
            <div className="text-right">
              <div className="text-base font-black text-[#FFD700]">
                {formatCurrency(potentialPayoutUsd, 'USD')}
              </div>
              {preferredCurrency !== 'USD' && (
                <div className="text-[10px] text-gray-400">
                  ≈{' '}
                  {formatCurrency(potentialPayoutUsd, preferredCurrency, {
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
          {t.cta_place_bet} ({formatCurrency(stakeUsd, 'USD')})
        </Button>

        <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1.5 text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          Instant atomic lock & YOLOv8 optical resolution
        </p>
      </form>
    </div>
  );
};

export default BetSlip;
