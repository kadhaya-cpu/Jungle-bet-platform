import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Banknote, Check, X, ArrowUpRight, Shield } from 'lucide-react';
import { triggerTreasurySweep, updatePayoutStatus } from '../../services/betting';
import { formatCurrency } from '../../utils/formatCurrency';
import { Button } from '../common/Button';

export interface PayoutQueueItem {
  id: number;
  userId?: number | null;
  username: string;
  type: string;
  amountUsd: number;
  localAmount?: number | null;
  exchangeRate?: number | null;
  status: string;
  description?: string | null;
  createdAt?: string | null;
}

export interface PayoutQueueProps {
  payouts: PayoutQueueItem[];
  availableSafeProfit?: number;
}

/**
 * Admin Payout Queue & Safe Treasury Profit Sweep Controller
 */
export const PayoutQueue: React.FC<PayoutQueueProps> = ({
  payouts = [],
  availableSafeProfit = 0,
}) => {
  const queryClient = useQueryClient();

  const payoutActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'approve' | 'reject' }) =>
      updatePayoutStatus(id, action),
    onSuccess: (res) => {
      toast.success(`Payout #${res.id} marked as ${res.status}`);
      queryClient.invalidateQueries({ queryKey: ['adminPayouts'] });
    },
    onError: () => {
      toast.error('Unable to update payout status.');
    },
  });

  const sweepMutation = useMutation({
    mutationFn: () => triggerTreasurySweep(),
    onSuccess: () => {
      toast.success('Safe operating profit sweep executed!');
      queryClient.invalidateQueries({ queryKey: ['adminTreasury'] });
      queryClient.invalidateQueries({ queryKey: ['adminPayouts'] });
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Sweep blocked by 25% Safety Float compliance rule.';
      toast.error(detail);
    },
  });

  return (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Banknote className="w-5 h-5 text-[#FFD700]" />
          <div>
            <h3 className="text-base font-bold text-white">
              Withdrawal & Treasury Payout Queue
            </h3>
            <p className="text-xs text-gray-400">
              Enforces 25% Required Safety Float floor on all house sweeps
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] uppercase tracking-wider text-gray-400">
              Safe to Sweep Now
            </div>
            <div className="text-sm font-black text-emerald-400">
              {formatCurrency(availableSafeProfit, 'USD')}
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            isLoading={sweepMutation.isPending}
            onClick={() => sweepMutation.mutate()}
            leftIcon={<ArrowUpRight className="w-4 h-4" />}
          >
            Execute Safe Profit Sweep
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 uppercase tracking-wider text-[10px]">
              <th className="py-3 px-3">Txn ID</th>
              <th className="py-3 px-3">Beneficiary</th>
              <th className="py-3 px-3">Type</th>
              <th className="py-3 px-3">USD Amount</th>
              <th className="py-3 px-3">Local Payout</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3 text-right">Queue Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {payouts.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  No withdrawal transactions in queue yet.
                </td>
              </tr>
            ) : (
              payouts.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 px-3 font-mono text-gray-400">#{item.id}</td>
                  <td className="py-3 px-3 font-bold text-white">{item.username}</td>
                  <td className="py-3 px-3 uppercase text-[10px] text-gray-300">
                    {item.type}
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-[#FFD700]">
                    {formatCurrency(item.amountUsd, 'USD')}
                  </td>
                  <td className="py-3 px-3 font-mono text-gray-300">
                    {item.localAmount ? item.localAmount.toLocaleString() : '—'}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        item.status === 'completed'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : item.status === 'rejected'
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right space-x-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        payoutActionMutation.mutate({ id: item.id, action: 'approve' })
                      }
                      leftIcon={<Check className="w-3 h-3 text-emerald-400" />}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        payoutActionMutation.mutate({ id: item.id, action: 'reject' })
                      }
                      leftIcon={<X className="w-3 h-3 text-red-400" />}
                    >
                      Reject
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-gray-500 pt-2 border-t border-white/5">
        <Shield className="w-3.5 h-3.5 text-[#FFD700]" />
        <span>
          Compliance Guardrail Active: Any withdrawal dipping House Revenue below 25% of Player
          Liabilities is automatically blocked and logged.
        </span>
      </div>
    </div>
  );
};

export default PayoutQueue;
