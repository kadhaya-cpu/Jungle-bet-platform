import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, BarChart3, Users, Banknote, RefreshCw } from 'lucide-react';
import {
  getAdminAnalytics,
  getAdminPayoutQueue,
  getAdminUsers,
  getTreasuryStatus,
} from '../services/betting';
import { Dashboard } from '../components/admin/Dashboard';
import { UserTable } from '../components/admin/UserTable';
import { PayoutQueue } from '../components/admin/PayoutQueue';
import { Loader } from '../components/common/Loader';

/**
 * Admin Command Center Page — Protected by role === 'admin' route guard
 */
export const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'payouts'>('dashboard');

  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    refetch: refetchAnalytics,
  } = useQuery({
    queryKey: ['adminAnalytics'],
    queryFn: getAdminAnalytics,
  });

  const { data: treasuryData, refetch: refetchTreasury } = useQuery({
    queryKey: ['adminTreasury'],
    queryFn: getTreasuryStatus,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: getAdminUsers,
  });

  const { data: payoutsData, isLoading: payoutsLoading } = useQuery({
    queryKey: ['adminPayouts'],
    queryFn: getAdminPayoutQueue,
  });

  const handleRefreshAll = () => {
    refetchAnalytics();
    refetchTreasury();
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="rounded-2xl bg-[#1a1a1a] border border-[#FFD700]/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#FFD700] text-[#0f0f0f]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">
              Executive Command & Compliance Center
            </h1>
            <p className="text-xs text-gray-400">
              Real-time GGR telemetry, Leo AI fraud enforcement & 25% Safety Float Treasury
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'dashboard'
                ? 'bg-[#FFD700] text-[#0f0f0f]'
                : 'bg-[#141414] text-gray-300 hover:text-white border border-white/10'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Analytics
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'users'
                ? 'bg-[#FFD700] text-[#0f0f0f]'
                : 'bg-[#141414] text-gray-300 hover:text-white border border-white/10'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Users ({usersData?.totalUsers ?? 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payouts')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'payouts'
                ? 'bg-[#FFD700] text-[#0f0f0f]'
                : 'bg-[#141414] text-gray-300 hover:text-white border border-white/10'
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            Payout Queue
          </button>

          <button
            type="button"
            onClick={handleRefreshAll}
            className="p-2 rounded-xl bg-[#141414] border border-white/10 text-gray-300 hover:text-[#FFD700]"
            title="Refresh telemetry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' &&
        (analyticsLoading ? (
          <Loader variant="skeleton" rows={4} />
        ) : (
          <Dashboard analytics={analyticsData} treasury={treasuryData} />
        ))}

      {activeTab === 'users' &&
        (usersLoading ? (
          <Loader variant="skeleton" rows={4} />
        ) : (
          <UserTable users={usersData?.allUsers || []} />
        ))}

      {activeTab === 'payouts' &&
        (payoutsLoading ? (
          <Loader variant="skeleton" rows={4} />
        ) : (
          <PayoutQueue
            payouts={payoutsData || []}
            availableSafeProfit={treasuryData?.available_profit ?? 0}
          />
        ))}
    </div>
  );
};

export default Admin;
