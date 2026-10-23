import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowUpRight, DollarSign, Shield, Eye, CheckCircle2 } from 'lucide-react';
import { WithdrawResponse } from '../../services/wallet';
import { useWalletStore } from '../../store/useWalletStore';
import { useAuthStore } from '../../store/useAuthStore';
import { SUPPORTED_CURRENCIES } from '../../utils/constants';
import { calculateWithdrawalLocalPreview, formatCurrency } from '../../utils/formatCurrency';
import { validateWithdrawForm } from '../../utils/validateForm';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

const WITHDRAW_CURRENCIES = ['UGX', 'KES', 'TZS', 'USD', 'EUR', 'GBP', 'NGN'];

/**
 * Withdraw Form connected to POST /withdraw with real-time local payout calculation
 * using custom_rate and transparent hidden spread profit disclosure.
 */
export const WithdrawForm: React.FC = () => {
  const queryClient = useQueryClient();
  const { balance, preferredCurrency, withdraw } = useWalletStore();
  const { updateUser } = useAuthStore();

  const [amountUsd, setAmountUsd] = useState<string>('10');
  const [currency, setCurrency] = useState<string>(
    WITHDRAW_CURRENCIES.includes(preferredCurrency) ? preferredCurrency : 'UGX'
  );
  const [destination, setDestination] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<WithdrawResponse | null>(null);

  const numericUsd = parseFloat(amountUsd) || 0;
  const preview = calculateWithdrawalLocalPreview(numericUsd, currency);
  const spreadDiff = Math.max(0, preview.marketRate - preview.customRate);
  const spreadProfitUsd =
    preview.marketRate > 0 ? numericUsd * (spreadDiff / preview.marketRate) : 0;
  const spreadProfitLocal = spreadDiff * numericUsd;

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const validation = validateWithdrawForm(numericUsd, balance);
      if (!validation.isValid) {
        throw new Error(validation.errors.amount);
      }
      return withdraw(numericUsd, currency);
    },
    onSuccess: (res) => {
      setError(null);
      setLastReceipt(res);
      updateUser({ balance_usd: res.balance_usd });
      toast.success(
        `Withdrawal of ${formatCurrency(res.amount_usd, 'USD')} (${formatCurrency(
          res.payout_local,
          res.currency
        )}) completed!`
      );
      queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
      queryClient.invalidateQueries({ queryKey: ['walletTransactions'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response
          ?.data?.detail ||
        (err as Error)?.message ||
        'Withdrawal failed. Please verify your available balance.';
      setError(msg);
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    withdrawMutation.mutate();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-6 space-y-5"
      noValidate
    >
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-[#FFD700]" />
            Withdraw Winnings
          </h3>
          <p className="text-xs text-gray-400">
            Instant payout from USD vault calculated at custom_rate
          </p>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-[#FFD700] border border-[#FFD700]/30">
          Min $5.00 USD
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <Input
            label="Withdrawal Amount (USD)"
            type="number"
            step="0.5"
            min="5"
            value={amountUsd}
            onChange={(e) => {
              setError(null);
              setAmountUsd(e.target.value);
            }}
            leftIcon={<DollarSign className="w-4 h-4 text-[#FFD700]" />}
            error={error || undefined}
            rightElement={
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setAmountUsd(String(Math.max(0, Number(balance.toFixed(2)))));
                }}
                className="text-[10px] font-extrabold text-[#FFD700] hover:underline px-1.5 py-0.5 rounded bg-[#FFD700]/10"
              >
                MAX
              </button>
            }
          />
        </div>

        <div>
          <label
            htmlFor="withdraw-currency"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5"
          >
            Payout Currency
          </label>
          <select
            id="withdraw-currency"
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              setLastReceipt(null);
            }}
            className="w-full rounded-xl bg-[#141414] border border-white/10 text-white text-sm py-2.5 px-3 focus:outline-none focus:border-[#FFD700]"
          >
            {WITHDRAW_CURRENCIES.map((code) => {
              const c = SUPPORTED_CURRENCIES[code];
              return (
                <option key={code} value={code} className="bg-[#1a1a1a]">
                  {c.code} ({c.symbol})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <Input
        label="Payout Account / Mobile Money Number (Optional)"
        placeholder="+256 700 000000 or IBAN"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
      />

      {/* Payout & Transparent Spread Summary */}
      <div className="rounded-xl bg-[#121212] border border-white/10 p-4 space-y-2 text-xs">
        <div className="flex items-center justify-between text-gray-400">
          <span>Available Vault Balance</span>
          <span className="font-bold text-white">{formatCurrency(balance, 'USD')}</span>
        </div>
        <div className="flex items-center justify-between text-gray-400">
          <span>Custom Payout Rate (custom_rate)</span>
          <span className="font-mono text-gray-200">
            1 USD = <strong className="text-[#FFD700]">{preview.customRate}</strong> {currency}{' '}
            <span className="text-gray-500">(Market: {preview.marketRate})</span>
          </span>
        </div>
        <div className="flex items-center justify-between text-amber-300/90">
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-[#FFD700]" />
            Hidden Spread Profit Captured
          </span>
          <span className="font-mono font-bold">
            ${spreadProfitUsd.toFixed(4)} USD ({formatCurrency(spreadProfitLocal, currency)})
          </span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <span className="font-semibold text-white">Calculated Local Payout</span>
          <span className="text-base font-black text-[#FFD700]">
            {formatCurrency(preview.localPayout, currency)}
          </span>
        </div>
      </div>

      {lastReceipt && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Withdrawal #TXN-{lastReceipt.transaction_id} Dispatched</span>
          </div>
          <div className="text-gray-300">
            Payout: <strong className="text-white">{formatCurrency(lastReceipt.payout_local, lastReceipt.currency)}</strong>{' '}
            @ {lastReceipt.custom_rate} {lastReceipt.currency}/USD (Spread profit captured:{' '}
            <strong className="text-[#FFD700]">${lastReceipt.spread_profit_captured.toFixed(4)} USD</strong>).
          </div>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        isLoading={withdrawMutation.isPending}
        leftIcon={<ArrowUpRight className="w-4 h-4" />}
      >
        Withdraw {formatCurrency(numericUsd, 'USD')}
      </Button>

      <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1.5">
        <Shield className="w-3.5 h-3.5 text-[#FFD700]" />
        Audited by RUSH HOUR BET Treasury Compliance Engine
      </p>
    </form>
  );
};

export default WithdrawForm;
