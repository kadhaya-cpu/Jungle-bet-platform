import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowDownLeft, CreditCard, Smartphone, Sparkles, Eye, CheckCircle2 } from 'lucide-react';
import { DepositResponse } from '../../services/wallet';
import { useWalletStore } from '../../store/useWalletStore';
import { useAuthStore } from '../../store/useAuthStore';
import { SUPPORTED_CURRENCIES } from '../../utils/constants';
import { calculateDepositUsdPreview, formatCurrency } from '../../utils/formatCurrency';
import { validateDepositForm } from '../../utils/validateForm';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

const DEPOSIT_CURRENCIES = ['UGX', 'KES', 'TZS', 'USD', 'EUR', 'GBP', 'NGN'];

/**
 * Deposit Form connected to POST /deposit with real-time FX conversion preview
 * and transparent hidden spread profit disclosure.
 */
export const DepositForm: React.FC = () => {
  const queryClient = useQueryClient();
  const { preferredCurrency, deposit } = useWalletStore();
  const { updateUser } = useAuthStore();

  const [currency, setCurrency] = useState<string>(
    DEPOSIT_CURRENCIES.includes(preferredCurrency) ? preferredCurrency : 'UGX'
  );
  const [amountLocal, setAmountLocal] = useState<string>(
    currency === 'UGX' ? '20000' : currency === 'KES' ? '1000' : currency === 'TZS' ? '15000' : '25'
  );
  const [paymentRail, setPaymentRail] = useState<'mobile_money' | 'stripe'>('mobile_money');
  const [error, setError] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<DepositResponse | null>(null);

  const numericAmount = parseFloat(amountLocal) || 0;
  const preview = calculateDepositUsdPreview(numericAmount, currency);
  const currencyConfig = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.UGX;

  const depositMutation = useMutation({
    mutationFn: async () => {
      const validation = validateDepositForm(numericAmount, currency);
      if (!validation.isValid) {
        throw new Error(validation.errors.amount);
      }
      return deposit(numericAmount, currency);
    },
    onSuccess: (res) => {
      setError(null);
      setLastReceipt(res);
      updateUser({ balance_usd: res.balance_usd, preferred_currency: res.currency });
      toast.success(
        `Deposit successful! Credited ${formatCurrency(res.usd_credited, 'USD')} (Spread captured: $${Number(
          res.spread_profit_kept || 0
        ).toFixed(4)} USD).`
      );
      queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
      queryClient.invalidateQueries({ queryKey: ['walletTransactions'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response
          ?.data?.detail ||
        (err as Error)?.message ||
        'Deposit failed. Please check the amount and try again.';
      setError(msg);
      toast.error(msg);
    },
  });

  const handleCurrencyChange = (nextCode: string) => {
    setCurrency(nextCode);
    setError(null);
    setLastReceipt(null);
    if (nextCode === 'UGX') setAmountLocal('20000');
    else if (nextCode === 'KES') setAmountLocal('1000');
    else if (nextCode === 'TZS') setAmountLocal('15000');
    else if (nextCode === 'NGN') setAmountLocal('10000');
    else setAmountLocal('25');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    depositMutation.mutate();
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
            <ArrowDownLeft className="w-4 h-4 text-[#FFD700]" />
            Instant Vault Deposit
          </h3>
          <p className="text-xs text-gray-400">
            Funds convert automatically to USD base balance
          </p>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          Min $2.00 USD
        </span>
      </div>

      {/* Payment Rail Selector */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setPaymentRail('mobile_money')}
          className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
            paymentRail === 'mobile_money'
              ? 'bg-[#FFD700]/15 border-[#FFD700] text-white'
              : 'bg-[#141414] border-white/10 text-gray-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-4 h-4 text-[#FFD700]" />
          <div>
            <div className="text-xs font-bold">M-Pesa / Airtel / MTN</div>
            <div className="text-[10px] text-gray-400">East Africa Mobile Money</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setPaymentRail('stripe')}
          className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
            paymentRail === 'stripe'
              ? 'bg-[#FFD700]/15 border-[#FFD700] text-white'
              : 'bg-[#141414] border-white/10 text-gray-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4 text-[#FFD700]" />
          <div>
            <div className="text-xs font-bold">Stripe Card / Apple Pay</div>
            <div className="text-[10px] text-gray-400">Global Visa &amp; Mastercard</div>
          </div>
        </button>
      </div>

      {/* Currency & Amount Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label
            htmlFor="deposit-currency"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5"
          >
            Currency
          </label>
          <select
            id="deposit-currency"
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="w-full rounded-xl bg-[#141414] border border-white/10 text-white text-sm py-2.5 px-3 focus:outline-none focus:border-[#FFD700]"
          >
            {DEPOSIT_CURRENCIES.map((code) => {
              const c = SUPPORTED_CURRENCIES[code];
              return (
                <option key={code} value={code} className="bg-[#1a1a1a]">
                  {c.code} ({c.symbol})
                </option>
              );
            })}
          </select>
        </div>

        <div className="sm:col-span-2">
          <Input
            label={`Amount Local (${currencyConfig.symbol} ${currency})`}
            type="number"
            step="any"
            min="0"
            value={amountLocal}
            onChange={(e) => {
              setError(null);
              setAmountLocal(e.target.value);
            }}
            error={error || undefined}
          />
        </div>
      </div>

      {/* Live FX Value Reduction & Transparent Spread Preview */}
      <div className="rounded-xl bg-[#121212] border border-white/10 p-4 space-y-2 text-xs">
        <div className="flex items-center justify-between text-gray-400">
          <span>Market Rate vs Custom Rate</span>
          <span className="font-mono text-gray-200">
            {preview.marketRate} / <strong className="text-[#FFD700]">{preview.customRate}</strong> {currency}
          </span>
        </div>
        <div className="flex items-center justify-between text-gray-400">
          <span>Gross Market Value (USD)</span>
          <span className="font-mono text-gray-300">${preview.realUsd.toFixed(4)} USD</span>
        </div>
        <div className="flex items-center justify-between text-amber-300/90">
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-[#FFD700]" />
            Hidden Spread Profit Captured
          </span>
          <span className="font-mono font-bold">
            ${preview.spreadUsd.toFixed(4)} USD
          </span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <span className="font-semibold text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#FFD700]" />
            Net Vault Credit (USD)
          </span>
          <span className="text-base font-black text-[#FFD700]">
            {formatCurrency(preview.creditedUsd, 'USD')}
          </span>
        </div>
      </div>

      {lastReceipt && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Deposit #TXN-{lastReceipt.transaction_id} Confirmed</span>
          </div>
          <div className="text-gray-300">
            Credited <strong className="text-white">${lastReceipt.usd_credited.toFixed(4)} USD</strong> from{' '}
            {lastReceipt.amount_local.toLocaleString()} {lastReceipt.currency} (Spread profit captured:{' '}
            <strong className="text-[#FFD700]">${lastReceipt.spread_profit_kept.toFixed(4)} USD</strong>).
          </div>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        isLoading={depositMutation.isPending}
        leftIcon={<ArrowDownLeft className="w-4 h-4" />}
      >
        Deposit {formatCurrency(numericAmount, currency)}
      </Button>
    </form>
  );
};

export default DepositForm;
