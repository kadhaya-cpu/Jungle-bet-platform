import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  ShieldAlert,
  Banknote,
  AlertCircle,
  CheckCheck,
  ExternalLink,
} from 'lucide-react';
import { FraudAlertItem, useAdminStore } from '../../store/useAdminStore';
import { useAuthStore } from '../../store/useAuthStore';

/**
 * Header Notification Bell with Unread Badge Count & Interactive Dropdown
 * Displays recent alerts (new withdrawal request, fraud flag, system error).
 * Clicking an alert marks it as read.
 */
export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { alerts, markAlertAsRead, markAllAlertsAsRead } = useAdminStore();
  const { user } = useAuthStore();

  const unreadCount = alerts.filter((a) => !a.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getCategoryIcon = (category: FraudAlertItem['category'], severity: FraudAlertItem['severity']) => {
    if (category === 'withdrawal_request') {
      return <Banknote className="w-4 h-4 text-[#FFD700]" />;
    }
    if (category === 'system_error') {
      return <AlertCircle className="w-4 h-4 text-amber-400" />;
    }
    return (
      <ShieldAlert
        className={`w-4 h-4 ${severity === 'high' ? 'text-red-400' : 'text-amber-300'}`}
      />
    );
  };

  const getCategoryBadge = (category: FraudAlertItem['category']) => {
    switch (category) {
      case 'withdrawal_request':
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30">
            WITHDRAWAL
          </span>
        );
      case 'system_error':
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
            SYSTEM
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40">
            FRAUD FLAG
          </span>
        );
    }
  };

  const formatTimeAgo = (iso: string) => {
    const diffMin = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (diffMin < 60) return `${diffMin}m ago`;
    const hrs = Math.floor(diffMin / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open notifications"
        className="relative p-2 rounded-xl bg-[#1a1a1a] border border-white/10 text-gray-300 hover:text-[#FFD700] hover:border-[#FFD700]/40 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FFD700] text-[#0f0f0f] text-[10px] font-black flex items-center justify-center shadow-[0_0_10px_rgba(255,215,0,0.6)]">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#1a1a1a] border border-[#FFD700]/30 shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 bg-[#141414] border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFD700]/15 text-[#FFD700]">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAlertsAsRead}
                className="text-[11px] font-semibold text-[#FFD700] hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
            {alerts.length === 0 ? (
              <div className="py-8 px-4 text-center text-xs text-gray-500">
                No recent alerts or notifications.
              </div>
            ) : (
              alerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => markAlertAsRead(alert.id)}
                  className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 hover:bg-white/[0.04] ${
                    !alert.read ? 'bg-[#FFD700]/[0.04]' : 'opacity-75'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-[#0f0f0f] border border-white/10 shrink-0 mt-0.5">
                    {getCategoryIcon(alert.category, alert.severity)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      {getCategoryBadge(alert.category)}
                      <span className="text-[10px] text-gray-500">
                        {formatTimeAgo(alert.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-xs font-bold truncate ${
                          alert.severity === 'high' ? 'text-red-300' : 'text-white'
                        }`}
                      >
                        {alert.title}
                      </p>
                      {!alert.read && (
                        <span className="w-2 h-2 rounded-full bg-[#FFD700] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                      {alert.description}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {user?.role === 'admin' && (
            <div className="px-4 py-2.5 bg-[#141414] border-t border-white/10 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">Admin Command Center</span>
              <Link
                to="/admin"
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-[#FFD700] hover:underline inline-flex items-center gap-1"
              >
                View All Alerts
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
