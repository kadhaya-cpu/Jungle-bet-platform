import React from 'react';
import { Wallet, RefreshCw, ShieldCheck, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useWalletStore } from '../../store/useWalletStore';
import { SUPPORTED_CURRENCIES } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatCurrency';
import { Button } from '../common/Button';

export interface BalanceCardProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onSelectTab?: (tab: 'deposit' | 'withdraw') => void;
}

/**
 * Segregated Player Vault Balance Card with Multi-Currency Conversion
 */
export const BalanceCard: React.FC<BalanceCardProps> = ({
  onRefresh,
  isRefreshing = false,
  onSelectTab,
}) => {
  const { balance, preferredCurrency, setPreferredCurrency } = useWalletStore();
  const currencyConfig =
    SUPPORTED_CURRENCIES[preferredCurrency] || SUPPORTED_CURRENCIES.UGX;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1f1b0d] via-[#1a1a1a] to-[#121212] border border-[#FFD700]/30 p-6 shadow-2xl">
      <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-[#FFD700]/10 blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FFD700]">
            <Wallet className="w-4 h-4" />
            <span>Segregated Player Vault (USD Base)</span>
          </div>

          <div className="flex items-baseline gap-3">
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {formatCurrency(balance, 'USD')}
            </h2>
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              USD
            </span>
          </div>

          {preferredCurrency !== 'USD' && (
            <p className="text-sm text-gray-300 font-medium">
              Local Equivalent:{' '}
              <span className="text-[#FFD700] font-bold">
                {formatCurrency(balance, preferredCurrency, { convertFromUsd: true })}
              </span>{' '}
              <span className="text-xs text-gray-500">
                (1 USD = {currencyConfig.customRate} {preferredCurrency})
              </span>
            </p>
          )}
        </div>

        {/* Currency Selector & Refresh */}
        <div className="flex flex-col sm:items-end gap-3">
          <div className="flex items-center gap-2">
            <select
              aria-label="Preferred local currency"
              value={preferredCurrency}
              onChange={(e) => setPreferredCurrency(e.target.value)}
              className="rounded-xl bg-[#141414] border border-white/15 px-3 py-2 text-xs font-bold text-[#FFD700] focus:outline-none focus:border-[#FFD700]"
            >
              {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                <option key={c.code} value={c.code} className="bg-[#1a1a1a] text-white">
                  {c.code} — {c.name}
                </option>
              ))}
            </select>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-2 rounded-xl bg-[#141414] border border-white/15 text-gray-300 hover:text-[#FFD700] hover:border-[#FFD700]/50 transition-colors"
                title="Refresh live balance"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#FFD700]' : ''}`} />
              </button>
            )}
          </div>

          {onSelectTab && (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onSelectTab('deposit')}
                leftIcon={<ArrowDownLeft className="w-3.5 h-3.5" />}
              >
                Deposit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onSelectTab('withdraw')}
                leftIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
              >
                Withdraw
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Protected by PostgreSQL Double-Entry Ledger & 25% Safety Float
        </span>
        <span className="text-[#FFD700] font-semibold">Instant Mobile Money & Card Rails</span>
      </div>
    </div>
  );
};

export default BalanceCard;
