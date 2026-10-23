import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  Banknote,
  Globe2,
  Settings as SettingsIcon,
  RefreshCw,
  Bot,
  Sliders,
  Save,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useAdminStore } from '../store/useAdminStore';
import { Dashboard } from '../components/admin/Dashboard';
import { UserTable } from '../components/admin/UserTable';
import { PayoutQueue } from '../components/admin/PayoutQueue';
import { FxRatesViewer } from '../components/admin/FxRatesViewer';
import { FraudAlerts } from '../components/admin/FraudAlerts';
import { Loader } from '../components/common/Loader';
import { Button } from '../components/common/Button';

export type AdminTabKey = 'dashboard' | 'users' | 'payouts' | 'fx-rates' | 'settings';

/**
 * Admin Dashboard Page (/pages/Admin.tsx)
 * - Protected: Only users with role === 'admin' can access (redirects others to /home)
 * - Layout: Responsive Sidebar navigation (Dashboard, Users, Payouts, FX Rates, Settings)
 *   that collapses to icons on mobile + Main Content Area
 */
export const Admin: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const {
    users,
    payouts,
    fxRates,
    alerts,
    metrics,
    isLoadingMetrics,
    isLoadingUsers,
    isLoadingPayouts,
    isLoadingFxRates,
    fetchMetrics,
    fetchUsers,
    fetchPayouts,
    fetchFxRates,
    fetchAlerts,
  } = useAdminStore();

  const [activeTab, setActiveTab] = useState<AdminTabKey>('dashboard');

  // Admin Settings local state for the Settings tab
  const [maxBetsPerMinute, setMaxBetsPerMinute] = useState<number>(10);
  const [safetyFloatPercent, setSafetyFloatPercent] = useState<number>(25);
  const [highWinAlertUsd, setHighWinAlertUsd] = useState<number>(1000);
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState<string>(
    'https://n8n.junglebet.internal/webhook/fx-rates-sync'
  );
  const [leoAutoBanEnabled, setLeoAutoBanEnabled] = useState<boolean>(true);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      fetchMetrics();
      fetchUsers();
      fetchPayouts();
      fetchFxRates();
      fetchAlerts();
    }
  }, [
    isAuthenticated,
    user?.role,
    fetchMetrics,
    fetchUsers,
    fetchPayouts,
    fetchFxRates,
    fetchAlerts,
  ]);

  // Route guard: Only users with role='admin' can access (redirect others to /home)
  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/home" replace />;
  }

  const unreadAlertsCount = alerts.filter((a) => !a.read).length;

  const sidebarItems: Array<{
    key: AdminTabKey;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: string | number;
  }> = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      key: 'users',
      label: 'Users',
      icon: Users,
      badge: users.length,
    },
    {
      key: 'payouts',
      label: 'Payouts',
      icon: Banknote,
      badge: payouts.length > 0 ? payouts.length : undefined,
    },
    {
      key: 'fx-rates',
      label: 'FX Rates',
      icon: Globe2,
      badge: fxRates.length,
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: SettingsIcon,
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
    },
  ];

  const handleRefreshAll = () => {
    fetchMetrics();
    fetchUsers();
    fetchPayouts();
    fetchFxRates();
    fetchAlerts();
    toast.success('Admin telemetry refreshed!');
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Admin compliance & Leo AI sentinel settings saved!');
  };

  return (
    <div className="space-y-6">
      {/* Top Executive Header Banner */}
      <div className="rounded-2xl bg-[#1a1a1a] border border-[#FFD700]/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#FFD700] text-[#0f0f0f] shadow-[0_0_20px_rgba(255,215,0,0.3)]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">
              Admin Command & Compliance Center
            </h1>
            <p className="text-xs text-gray-400">
              Real-time GGR telemetry, Leo AI fraud enforcement & 25% Reserve Pool Float
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefreshAll}
            leftIcon={<RefreshCw className="w-3.5 h-3.5 text-[#FFD700]" />}
          >
            Sync Telemetry
          </Button>
        </div>
      </div>

      {/* Main Layout: Responsive Sidebar (Collapses to icons on mobile) + Main Content Area */}
      <div className="flex flex-row gap-4 sm:gap-6 items-start">
        {/* Responsive Admin Sidebar Navigation */}
        <aside className="w-14 sm:w-56 shrink-0 rounded-2xl bg-[#1a1a1a] border border-white/10 p-2 sm:p-3 sticky top-20">
          <div className="hidden sm:block px-3 py-2 border-b border-white/10 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500">
              Admin Controls
            </span>
          </div>

          <nav className="space-y-1.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  title={item.label}
                  className={`w-full flex items-center justify-center sm:justify-between px-2.5 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#FFD700] text-[#0f0f0f] shadow-[0_0_16px_rgba(255,215,0,0.25)]'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#0f0f0f]' : 'text-[#FFD700]'
                      }`}
                    />
                    <span className="hidden sm:inline">{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`hidden sm:inline-flex text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-[#0f0f0f]/20 text-[#0f0f0f]'
                          : 'bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Compact Leo AI Status Footer in Admin Sidebar (Desktop) */}
          <div className="hidden sm:block mt-6 pt-4 border-t border-white/10">
            <div className="rounded-xl bg-[#0f0f0f] border border-white/10 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-[#FFD700]" />
                  Leo AI Sentinel
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Monitoring {metrics.activeBets} active optical bets across 8 European feeds.
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {activeTab === 'dashboard' &&
            (isLoadingMetrics ? (
              <Loader variant="skeleton" rows={4} />
            ) : (
              <Dashboard onNavigateTab={setActiveTab} />
            ))}

          {activeTab === 'users' &&
            (isLoadingUsers ? (
              <Loader variant="skeleton" rows={5} />
            ) : (
              <UserTable users={users} />
            ))}

          {activeTab === 'payouts' &&
            (isLoadingPayouts ? (
              <Loader variant="skeleton" rows={4} />
            ) : (
              <PayoutQueue
                payouts={payouts}
                availableSafeProfit={metrics.availableSafeProfit}
              />
            ))}

          {activeTab === 'fx-rates' &&
            (isLoadingFxRates ? (
              <Loader variant="skeleton" rows={4} />
            ) : (
              <FxRatesViewer rates={fxRates} />
            ))}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-6 space-y-5">
                <div className="flex items-center gap-2.5 pb-4 border-b border-white/10">
                  <div className="p-2.5 rounded-xl bg-[#FFD700]/15 border border-[#FFD700]/30 text-[#FFD700]">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Platform Guardrails, Leo AI & n8n Oracle Settings
                    </h3>
                    <p className="text-xs text-gray-400">
                      Configure automated fraud velocity limits, reserve pool safety float, and
                      webhook endpoints
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-300">
                        Rapid Bet Velocity Limit (Bets / Min)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={maxBetsPerMinute}
                        onChange={(e) => setMaxBetsPerMinute(Number(e.target.value))}
                        className="w-full rounded-xl bg-[#0f0f0f] border border-white/10 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#FFD700]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-300">
                        Required Reserve Safety Float (%)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={90}
                        value={safetyFloatPercent}
                        onChange={(e) => setSafetyFloatPercent(Number(e.target.value))}
                        className="w-full rounded-xl bg-[#0f0f0f] border border-white/10 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#FFD700]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-300">
                        High-Win Telegram Alert Threshold (USD)
                      </label>
                      <input
                        type="number"
                        min={50}
                        value={highWinAlertUsd}
                        onChange={(e) => setHighWinAlertUsd(Number(e.target.value))}
                        className="w-full rounded-xl bg-[#0f0f0f] border border-white/10 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#FFD700]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-300">
                      n8n FX Spread Oracle Webhook URL
                    </label>
                    <input
                      type="url"
                      value={n8nWebhookUrl}
                      onChange={(e) => setN8nWebhookUrl(e.target.value)}
                      className="w-full rounded-xl bg-[#0f0f0f] border border-white/10 px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#FFD700]"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0f0f0f] border border-white/10">
                    <div>
                      <div className="text-xs font-bold text-white">
                        Leo AI Automated Bot Suspension
                      </div>
                      <div className="text-[11px] text-gray-400">
                        Automatically flag and freeze accounts exceeding {maxBetsPerMinute} bets/min
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={leoAutoBanEnabled}
                      onChange={(e) => setLeoAutoBanEnabled(e.target.checked)}
                      className="h-4 w-4 accent-[#FFD700] rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      leftIcon={<Save className="w-4 h-4" />}
                    >
                      Save Configuration
                    </Button>
                  </div>
                </form>
              </div>

              <FraudAlerts />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
