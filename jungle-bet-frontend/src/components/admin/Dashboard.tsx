import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Activity,
  Send,
  Lock,
} from 'lucide-react';
import { sendTelegramAlertTest } from '../../services/betting';
import { formatCurrency } from '../../utils/formatCurrency';
import { Button } from '../common/Button';

export interface AnalyticsDashboardData {
  revenue?: {
    totalVolume: number;
    totalPayouts: number;
    grossGamingRevenue: number;
    houseMarginPercent: number;
    totalBets: number;
    wonCount: number;
    lostCount: number;
    pendingCount: number;
  };
  dailyRevenueSeries?: Array<{
    date: string;
    turnover: number;
    payouts: number;
    ggr: number;
  }>;
}

export interface TreasuryStatusData {
  house_revenue_balance?: number;
  total_liabilities?: number;
  required_safety_float?: number;
  available_profit?: number;
  safety_float_ratio?: number;
  is_compliant?: boolean;
}

export interface DashboardProps {
  analytics?: AnalyticsDashboardData;
  treasury?: TreasuryStatusData;
}

/**
 * Recharts Admin Analytics Dashboard + Treasury Float Monitor + Telegram Daily Report Widget
 */
export const Dashboard: React.FC<DashboardProps> = ({ analytics, treasury }) => {
  const rev = analytics?.revenue;
  const series = analytics?.dailyRevenueSeries || [];

  const telegramMutation = useMutation({
    mutationFn: () => sendTelegramAlertTest('DAILY_SUMMARY'),
    onSuccess: () => {
      toast.success('Telegram Daily Financial Summary dispatched to operator channel!');
    },
    onError: () => {
      toast.error('Failed to dispatch Telegram summary alert.');
    },
  });

  const kpis = [
    {
      label: 'Total Wagering Volume',
      value: formatCurrency(rev?.totalVolume ?? 0, 'USD'),
      sub: `${rev?.totalBets ?? 0} total optical bets`,
      icon: Activity,
      accent: 'text-[#FFD700]',
    },
    {
      label: 'Gross Gaming Revenue (GGR)',
      value: formatCurrency(rev?.grossGamingRevenue ?? 0, 'USD'),
      sub: `${rev?.houseMarginPercent ?? 0}% house margin`,
      icon: TrendingUp,
      accent: 'text-emerald-400',
    },
    {
      label: 'Required 25% Safety Float',
      value: formatCurrency(treasury?.required_safety_float ?? 0, 'USD'),
      sub: `Liabilities: ${formatCurrency(treasury?.total_liabilities ?? 0, 'USD')}`,
      icon: Lock,
      accent: 'text-amber-400',
    },
    {
      label: 'Safe Withdrawable Profit',
      value: formatCurrency(treasury?.available_profit ?? 0, 'USD'),
      sub: `House Vault: ${formatCurrency(treasury?.house_revenue_balance ?? 0, 'USD')}`,
      icon: DollarSign,
      accent: 'text-emerald-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400">{item.label}</span>
                <Icon className={`w-4 h-4 ${item.accent}`} />
              </div>
              <div className="text-2xl font-black text-white">{item.value}</div>
              <div className="text-xs text-gray-500">{item.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Recharts Revenue & Turnover Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">
                Daily Turnover vs. Gross Gaming Revenue
              </h3>
              <p className="text-xs text-gray-400">
                Live telemetry from backend /api/admin/analytics
              </p>
            </div>
            <span className="text-xs font-bold text-[#FFD700] bg-[#FFD700]/10 px-2.5 py-1 rounded-full">
              USD Ledger
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFD700" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="date" stroke="#9CA3AF" fontSize={11} />
                <YAxis stroke="#9CA3AF" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#141414',
                    borderColor: 'rgba(255, 215, 0, 0.3)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="turnover"
                  name="Turnover ($)"
                  stroke="#FFD700"
                  fillOpacity={1}
                  fill="url(#goldGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="ggr"
                  name="Net GGR ($)"
                  stroke="#10B981"
                  fillOpacity={1}
                  fill="url(#emeraldGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bet Outcome Distribution & Telegram Daily Report Widget */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">Bet Resolution Distribution</h3>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Won', count: rev?.wonCount ?? 0 },
                    { name: 'Lost', count: rev?.lostCount ?? 0 },
                    { name: 'Pending', count: rev?.pendingCount ?? 0 },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} />
                  <YAxis stroke="#9CA3AF" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#141414',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                    }}
                  />
                  <Bar dataKey="count" fill="#FFD700" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Telegram Daily Report Widget (Future Compatibility Hook + Live Backend Dispatch) */}
          <div className="rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#121212] border border-[#FFD700]/30 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-[#FFD700]" />
                <h4 className="text-sm font-bold text-white">
                  Telegram Daily Report Widget
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
    </div>
  );
};

export default Dashboard;
