import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Ban,
  Trash2,
} from 'lucide-react';
import { FraudAlertItem, useAdminStore } from '../../store/useAdminStore';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

export interface FraudAlertsProps {
  alerts?: FraudAlertItem[];
  compact?: boolean;
}

/**
 * Fraud Alerts & Flagged Activity Feed Component
 *
 * // ============================================================================
 * // LEO AI INTEGRATION PLACEHOLDER:
 * // Connect WebSocket stream `ws://localhost:8000/api/fraud/stream` or poll
 * // `GET /api/fraud/alerts` powered by the Leo AI Anomaly & Collusion Engine.
 * // Currently populated with mock flagged activities in `useAdminStore.ts`.
 * // ============================================================================
 */
export const FraudAlerts: React.FC<FraudAlertsProps> = ({
  alerts: propAlerts,
  compact = false,
}) => {
  const {
    alerts: storeAlerts,
    markAlertAsRead,
    dismissAlert,
    banUser,
    users,
  } = useAdminStore();

  const alerts = propAlerts ?? storeAlerts;
  const [confirmBanUser, setConfirmBanUser] = useState<{
    userId: string;
    username: string;
  } | null>(null);

  const highRiskCount = alerts.filter((a) => a.severity === 'high').length;

  const formatRelativeTime = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.max(1, Math.floor(diffMs / 60000));
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">
                Leo AI Fraud & Velocity Alerts
              </h3>
              {highRiskCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                  {highRiskCount} High Risk
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Real-time behavioral flags, rapid bet velocity & multi-account IP telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#FFD700] bg-[#0f0f0f] px-3 py-1.5 rounded-xl border border-[#FFD700]/30">
          <Bot className="w-4 h-4 text-[#FFD700]" />
          <span className="font-semibold">Leo AI Sentinel v2.4 Active</span>
        </div>
      </div>

      {/* Flagged Activities List */}
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-xs">
            No active fraud alerts or flagged behavioral anomalies.
          </div>
        ) : (
          (compact ? alerts.slice(0, 4) : alerts).map((alert) => {
            const isHighRisk = alert.severity === 'high';
            const isMediumRisk = alert.severity === 'medium';
            const linkedUser = alert.userId
              ? users.find((u) => u.id === alert.userId)
              : undefined;

            return (
              <div
                key={alert.id}
                onClick={() => !alert.read && markAlertAsRead(alert.id)}
                className={`rounded-xl p-4 border transition-all cursor-pointer ${
                  isHighRisk
                    ? 'bg-red-950/35 border-red-500/50 hover:border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.12)]'
                    : isMediumRisk
                    ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-400/60'
                    : 'bg-[#141414] border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        isHighRisk
                          ? 'bg-red-500/20 text-red-400'
                          : isMediumRisk
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-white/10 text-gray-300'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            isHighRisk
                              ? 'bg-red-500 text-white'
                              : isMediumRisk
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-gray-700 text-gray-300'
                          }`}
                        >
                          {alert.severity.toUpperCase()} RISK
                        </span>
                        <h4
                          className={`text-sm font-bold ${
                            isHighRisk ? 'text-red-200' : 'text-white'
                          }`}
                        >
                          {alert.title}
                        </h4>
                        {!alert.read && (
                          <span className="w-2 h-2 rounded-full bg-[#FFD700]" title="Unread" />
                        )}
                      </div>

                      <p
                        className={`text-xs leading-relaxed ${
                          isHighRisk ? 'text-red-100/90' : 'text-gray-300'
                        }`}
                      >
                        {alert.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(alert.timestamp)}
                        </span>
                        {alert.metadata?.betsPerMinute && (
                          <span className="font-mono text-red-300 font-semibold">
                            Velocity: {alert.metadata.betsPerMinute} bets/min
                          </span>
                        )}
                        {alert.metadata?.ipAddress && (
                          <span className="font-mono text-gray-400">
                            IP: {alert.metadata.ipAddress}
                          </span>
                        )}
                        {alert.metadata?.confidenceScore && (
                          <span className="font-mono text-[#FFD700]">
                            Leo AI Confidence: {alert.metadata.confidenceScore}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div
                    className="flex items-center gap-2 shrink-0 self-end sm:self-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {alert.userId && alert.username && !linkedUser?.isBanned && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() =>
                          setConfirmBanUser({
                            userId: alert.userId!,
                            username: alert.username!,
                          })
                        }
                        leftIcon={<Ban className="w-3.5 h-3.5" />}
                      >
                        Ban User
                      </Button>
                    )}
                    {linkedUser?.isBanned && (
                      <span className="text-[11px] font-bold text-red-400 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30">
                        User Banned
                      </span>
                    )}
                    {!alert.read && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => markAlertAsRead(alert.id)}
                        leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      >
                        Acknowledge
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => dismissAlert(alert.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                      title="Dismiss alert"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirm Ban Modal from Fraud Alert */}
      <Modal
        isOpen={Boolean(confirmBanUser)}
        onClose={() => setConfirmBanUser(null)}
        title="Confirm Account Suspension"
        subtitle="Immediate Leo AI fraud enforcement action"
      >
        {confirmBanUser && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              Are you sure you want to ban{' '}
              <span className="font-bold text-[#FFD700]">{confirmBanUser.username}</span> (
              <span className="font-mono text-xs">{confirmBanUser.userId}</span>) due to
              high-risk activity? This will freeze their wagering and pending withdrawals.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmBanUser(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  banUser(confirmBanUser.userId);
                  setConfirmBanUser(null);
                }}
              >
                Confirm Ban
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FraudAlerts;
