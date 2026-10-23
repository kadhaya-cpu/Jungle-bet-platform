import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendPositive?: boolean;
  icon: LucideIcon;
  accentColor?: string;
  endpointHint?: string;
}

/**
 * Reusable Admin Metric Card Component
 * Displays key operational statistics with gold/dark styling (#1a1a1a card, #FFD700 accent).
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendPositive = true,
  icon: Icon,
  accentColor = 'text-[#FFD700]',
  endpointHint,
}) => {
  return (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 hover:border-[#FFD700]/40 p-5 transition-all duration-200 shadow-lg group">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {title}
          </span>
          <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {value}
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0f0f0f] border border-white/10 group-hover:border-[#FFD700]/30 transition-colors">
          <Icon className={`w-5 h-5 ${accentColor}`} />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2 text-xs">
        {subtitle ? (
          <span className="text-gray-400 truncate">{subtitle}</span>
        ) : (
          <span className="text-gray-500 font-mono text-[11px]">{endpointHint || 'Live Telemetry'}</span>
        )}

        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 font-bold px-2 py-0.5 rounded-full text-[11px] shrink-0 ${
              trendPositive
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/15 text-red-400 border border-red-500/30'
            }`}
          >
            {trendPositive ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {trend}
          </span>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
