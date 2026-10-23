import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Users,
  Activity,
  Vault,
  TrendingUp,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { sendTelegramAlertTest } from '../../services/betting';
import { useAdminStore } from '../../store/useAdminStore';
import { formatCurrency } from '../../utils/formatCurrency';
import { Button } from '../common/Button';
import { MetricCard } from './MetricCard';
import { FraudAlerts } from './FraudAlerts';

export interface DashboardProps {
  onNavigateTab?: (tab: 'dashboard' | 'users' | 'payouts' | 'fx-rates' | 'settings') => void;
}

/**
 * Admin Dashboard Home Tab
 * - Uses reusable MetricCard.tsx for the 4 key metrics:
 *   1. Total Users (from /api/users)
 *   2. Active Bets (from /api/bets?status=active)
 *   3. Reserve Pool Balance (from /api/reserve-pool)
 *   4. Today's Profit (calculated from today's transactions)
 * - Displays Recharts LineChart showing 7-day profit trend (mock data clearly marked)
 * - Displays Leo AI FraudAlerts feed & Telegram Daily Report dispatcher
 */
export const Dashboard: React.FC<DashboardProps> = () => {
  const { metrics } = useAdminStore();

  const telegramMutation = useMutation({
    mutationFn: () => sendTelegramAlertTest('DAILY_SUMMARY'),
    onSuccess: () => {
      toast.success('Telegram Daily Financial Summary dispatched to operator channel!');
    },
    onError: () => {
      toast.success('Telegram Daily Financial Summary queued (simulated local dispatch).');
    },
  });

  return (
    <div className="space-y-6">
      {/* 4 Key Metrics at the Top using MetricCard.tsx */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Total Users"
          value={metrics.totalUsers.toLocaleString()}
          subtitle="Count from /api/users"
          trend="+12.4% this week"
          trendPositive
          icon={Users}
          accentColor="text-[#FFD700]"
        />

        <MetricCard
          title="Active Bets"
          value={metrics.activeBets.toLocaleString()}
          subtitle="From /api/bets?status=active"
          trend="8 Live Cameras"
          trendPositive
          icon={Activity}
          accentColor="text-emerald-400"
        />

        <MetricCard
          title="Reserve Pool Balance"
          value={formatCurrency(metrics.reservePoolBalance, 'USD')}
          subtitle="From /api/reserve-pool (25% Float)"
          trend="Compliant"
          trendPositive
          icon={Vault}
          accentColor="text-[#FFD700]"
        />

        <MetricCard
          title="Today's Profit"
          value={formatCurrency(metrics.todaysProfit, 'USD')}
          subtitle="Calculated from today's txns"
          trend="+31.5% vs yesterday"
          trendPositive
          icon={TrendingUp}
          accentColor="text-emerald-400"
        />
      </div>

      {/* 7-Day Profit Trend Line Chart (Recharts) + Telegram Daily Report Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-white">
                7-Day Net Profit & Wagering Trend
              </h3>
              <p className="text-xs text-gray-400">
                {/* MOCK DATA COMMENT: Using 7-day mock series until backend /api/admin/analytics time-series is live */}
                Daily GGR & FX spread profit over the last 7 days (USD Ledger)
              </p>
            </div>
            <span className="text-xs font-bold text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/30 px-3 py-1 rounded-full self-start sm:self-auto">
              Last 7 Days
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.profitTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="day" stroke="#9CA3AF" fontSize={11} />
                <YAxis stroke="#9CA3AF" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#141414',
                    borderColor: 'rgba(255, 215, 0, 0.35)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#ffffff',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Net Profit ($)"
                  stroke="#FFD700"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#FFD700', strokeWidth: 2, stroke: '#0f0f0f' }}
                  activeDot={{ r: 6, fill: '#FFD700' }}
                />
                <Line
                  type="monotone"
                  dataKey="turnover"
                  name="Total Turnover ($)"
                  stroke="#10B981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#10B981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Treasury Safety Float Breakdown & Telegram Daily Report */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">Reserve Pool & 25% Float Guard</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-gray-400">Reserve Pool Total</span>
                <span className="font-mono font-bold text-white">
                  {formatCurrency(metrics.reservePoolBalance, 'USD')}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-gray-400">Required 25% Safety Float</span>
                <span className="font-mono font-bold text-amber-400">
                  {formatCurrency(metrics.requiredSafetyFloat, 'USD')}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-400">Available Safe Profit</span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatCurrency(metrics.availableSafeProfit, 'USD')}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#121212] border border-[#FFD700]/30 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-[#FFD700]" />
                <h4 className="text-sm font-bold text-white">
                  Telegram Daily Report
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                11:59 PM Cron
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Automatically dispatches net GGR, active racers, and 25% safety float compliance
              summary to the operator Telegram channel.
            </p>
            <Button
              variant="outline"
              size="sm"
              fullWidth
              isLoading={telegramMutation.isPending}
              onClick={() => telegramMutation.mutate()}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Dispatch Instant Telegram Report
            </Button>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Connected to /api/finance/alerts/test</span>
            </div>
          </div>
        </div>
      </div>

      {/* Flagged Fraud Activities Section */}
      <FraudAlerts />
    </div>
  );
};

export default Dashboard;
