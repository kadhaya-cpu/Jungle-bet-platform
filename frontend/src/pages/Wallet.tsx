import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Clock, Eye, RefreshCw } from 'lucide-react';
import { useWalletStore } from '../store/useWalletStore';
import { BalanceCard } from '../components/wallet/BalanceCard';
import { DepositForm } from '../components/wallet/DepositForm';
import { WithdrawForm } from '../components/wallet/WithdrawForm';
import { Loader } from '../components/common/Loader';
import { formatCurrency } from '../utils/formatCurrency';

/**
 * Player Vault & Wallet Page — Real-Time Balance, Deposit, Withdraw & Transparent Ledger Table
 */
export const Wallet: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const {
    transactions,
    preferredCurrency,
    fetchBalance,
    fetchTransactions,
  } = useWalletStore();

  const {
    isFetching: balanceFetching,
    refetch: refetchBalance,
  } = useQuery({
    queryKey: ['walletBalance'],
    queryFn: fetchBalance,
  });

  const {
    isLoading: txnsLoading,
    isFetching: txnsFetching,
    refetch: refetchTxns,
  } = useQuery({
    queryKey: ['walletTransactions'],
    queryFn: fetchTransactions,
  });

  useEffect(() => {
    refetchBalance();
    refetchTxns();
  }, [refetchBalance, refetchTxns]);

  const handleRefreshAll = () => {
    refetchBalance();
    refetchTxns();
  };

  return (
    <div className="space-y-6">
      {/* Live Vault Balance Card */}
      <BalanceCard
        onRefresh={handleRefreshAll}
        isRefreshing={balanceFetching || txnsFetching}
        onSelectTab={(tab) => setActiveTab(tab)}
      />

      {/* Deposit & Withdraw Forms + Transparent Transaction Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#1a1a1a] border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('deposit')}
              className={`py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                activeTab === 'deposit'
                  ? 'bg-[#FFD700] text-[#0f0f0f] shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              Deposit Funds
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('withdraw')}
              className={`py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                activeTab === 'withdraw'
                  ? 'bg-[#FFD700] text-[#0f0f0f] shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              Withdraw Funds
            </button>
          </div>

          {activeTab === 'deposit' ? <DepositForm /> : <WithdrawForm />}
        </div>

        {/* Transaction History Table with Hidden Spread Profit Transparency */}
        <div className="lg:col-span-7 rounded-2xl bg-[#1a1a1a] border border-white/10 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FFD700]" />
              <div>
                <h3 className="text-base font-bold text-white">Transaction History</h3>
                <p className="text-[11px] text-gray-400">
                  Real-time ledger including FX conversion &amp; captured spread profit
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{transactions.length} records</span>
              <button
                type="button"
                onClick={() => refetchTxns()}
                disabled={txnsFetching}
                className="p-1.5 rounded-lg bg-[#141414] border border-white/10 text-gray-400 hover:text-[#FFD700] transition-colors"
                title="Refresh transactions"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${txnsFetching ? 'animate-spin text-[#FFD700]' : ''}`} />
              </button>
            </div>
          </div>

          {txnsLoading && transactions.length === 0 ? (
            <Loader variant="skeleton" rows={4} />
          ) : transactions.length === 0 ? (
            <p className="text-xs text-gray-500 py-10 text-center">
              No transactions recorded yet. Make your first deposit to start wagering!
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Currency</th>
                    <th className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 text-[#FFD700]">
                        <Eye className="w-3 h-3" />
                        Spread Profit
                      </span>
                    </th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {transactions.map((txn) => {
                    const isCredit = txn.type === 'deposit' || txn.type === 'win';
                    const usdVal = Number(txn.amount_usd ?? txn.amount ?? 0);
                    const txnCurrency = txn.currency || preferredCurrency || 'UGX';
                    const spreadVal = Number(txn.spread_profit ?? 0);
                    const formattedDate = txn.created_at
                      ? new Date(txn.created_at).toLocaleString([], {
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now';

                    return (
                      <tr
                        key={txn.id}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 px-3 text-gray-400 whitespace-nowrap">
                          <div className="font-medium text-gray-300">{formattedDate}</div>
                          <div className="text-[10px] text-gray-500 font-mono">#{txn.id}</div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              isCredit
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-[#FFD700] border border-[#FFD700]/30'
                            }`}
                          >
                            {isCredit ? (
                              <ArrowDownLeft className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                            {txn.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div
                            className={`font-black font-mono ${
                              isCredit ? 'text-emerald-400' : 'text-[#FFD700]'
                            }`}
                          >
                            {isCredit ? '+' : '-'}
                            {formatCurrency(usdVal, 'USD')}
                          </div>
                          {txn.local_amount != null && Number(txn.local_amount) > 0 && (
                            <div className="text-[10px] text-gray-400 font-mono">
                              {formatCurrency(txn.local_amount, txnCurrency)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-bold text-white">{txnCurrency}</span>
                          {txn.exchange_rate ? (
                            <div className="text-[10px] text-gray-500 font-mono">
                              @{txn.exchange_rate}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-mono font-semibold text-[#FFD700]">
                            ${spreadVal.toFixed(4)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              txn.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : txn.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-300'
                                : 'bg-red-500/10 text-red-400'
                            }`}
                          >
                            {txn.status || 'completed'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Wallet;
