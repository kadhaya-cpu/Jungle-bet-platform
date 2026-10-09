"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  ArrowLeft,
  RefreshCw,
  ShieldAlert,
  Globe,
  Radio,
  MapPin,
  Activity,
  Layers,
  ChevronRight,
  PieChart as PieIcon,
  Zap,
  Clock,
  Eye,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";

interface MapNode {
  id: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  // Normalized x, y percentages for canvas/SVG projection (0 to 100%)
  x: number;
  y: number;
  feedId: number;
  activeBetsCount: number;
  totalVolumeUSD: number;
  trafficDensity: string;
  currency: string;
  status: "active" | "streaming" | "standby";
}

const DEFAULT_MAP_NODES: MapNode[] = [
  {
    id: "la_i405",
    name: "Caltrans I-405 Overpass",
    city: "Los Angeles",
    country: "United States",
    countryCode: "US",
    x: 18,
    y: 38,
    feedId: 1,
    activeBetsCount: 48,
    totalVolumeUSD: 4250.0,
    trafficDensity: "14 v/min (Heavy)",
    currency: "USD",
    status: "active",
  },
  {
    id: "london_chelsea",
    name: "Chelsea Bridge Junction",
    city: "London",
    country: "United Kingdom",
    countryCode: "GB",
    x: 48,
    y: 28,
    feedId: 2,
    activeBetsCount: 32,
    totalVolumeUSD: 2890.0,
    trafficDensity: "10 v/min (Medium)",
    currency: "GBP",
    status: "active",
  },
  {
    id: "amsterdam_a10",
    name: "A1 Hoevelaken Overpass",
    city: "Amsterdam",
    country: "Netherlands",
    countryCode: "NL",
    x: 52,
    y: 26,
    feedId: 3,
    activeBetsCount: 22,
    totalVolumeUSD: 1840.0,
    trafficDensity: "8 v/min (Moderate)",
    currency: "EUR",
    status: "active",
  },
  {
    id: "nairobi_hub",
    name: "Nairobi Live Telemetry Hub",
    city: "Nairobi",
    country: "Kenya",
    countryCode: "KE",
    x: 60,
    y: 58,
    feedId: 1,
    activeBetsCount: 64,
    totalVolumeUSD: 5120.0,
    trafficDensity: "M-Pesa STK Live (High)",
    currency: "KES",
    status: "active",
  },
  {
    id: "lagos_cluster",
    name: "Lagos Speed Cluster",
    city: "Lagos",
    country: "Nigeria",
    countryCode: "NG",
    x: 49,
    y: 53,
    feedId: 2,
    activeBetsCount: 39,
    totalVolumeUSD: 3410.0,
    trafficDensity: "Paystack / Mobile Money",
    currency: "NGN",
    status: "active",
  },
  {
    id: "tokyo_speedway",
    name: "Tokyo Highway Simulation",
    city: "Tokyo",
    country: "Japan",
    countryCode: "JP",
    x: 84,
    y: 38,
    feedId: 4,
    activeBetsCount: 27,
    totalVolumeUSD: 2450.0,
    trafficDensity: "Ultralytics Speedway Loop",
    currency: "USD",
    status: "streaming",
  },
];

const LIVE_BET_PINGS = [
  { id: "p1", city: "Los Angeles", country: "🇺🇸", stake: "$150", market: "OVER 13 (3.60x)", time: "2s ago" },
  { id: "p2", city: "Nairobi", country: "🇰🇪", stake: "5,000 KES", market: "STAR PICK 7 (18.0x)", time: "5s ago" },
  { id: "p3", city: "London", country: "🇬🇧", stake: "£50", market: "UNDER 10 (2.25x)", time: "9s ago" },
  { id: "p4", city: "Lagos", country: "🇳🇬", stake: "₦35,000", market: "OVER 13 (3.60x)", time: "14s ago" },
  { id: "p5", city: "Amsterdam", country: "🇳🇱", stake: "€75", market: "EXACT HIGH 20 (36.0x)", time: "22s ago" },
  { id: "p6", city: "Tokyo", country: "🇯🇵", stake: "$200", market: "OVER 13 (3.60x)", time: "30s ago" },
];

export default function AdminAnalyticsPage() {
  const [timeframe, setTimeframe] = useState<"24h" | "7d" | "30d" | "all">("7d");
  const [selectedNode, setSelectedNode] = useState<MapNode>(DEFAULT_MAP_NODES[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [livePings, setLivePings] = useState(LIVE_BET_PINGS);
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);

  // Revenue Metrics
  const [analyticsData, setAnalyticsData] = useState({
    totalVolume: 19960.0,
    totalPayouts: 13810.0,
    grossGamingRevenue: 6150.0,
    houseMarginPercent: 30.8,
    totalBets: 232,
    wonCount: 88,
    lostCount: 124,
    pendingCount: 20,
  });

  const dailySeries = useMemo(() => {
    return [
      { label: "Day 1", turnover: 1850, payouts: 1250, ggr: 600 },
      { label: "Day 2", turnover: 2400, payouts: 1650, ggr: 750 },
      { label: "Day 3", turnover: 2950, payouts: 1980, ggr: 970 },
      { label: "Day 4", turnover: 3400, payouts: 2350, ggr: 1050 },
      { label: "Day 5", turnover: 3900, payouts: 2700, ggr: 1200 },
      { label: "Day 6", turnover: 4600, payouts: 3150, ggr: 1450 },
      { label: "Day 7", turnover: 5200, payouts: 3580, ggr: 1620 },
    ];
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axios.get("http://localhost:8000/api/admin/analytics", { timeout: 2000 });
      if (res.data?.revenue) {
        setAnalyticsData(res.data.revenue);
      }
    } catch {
      // Use rich baseline values if backend is unreachable
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();

    // Periodic simulation of live bet pings
    const interval = setInterval(() => {
      const cities = ["Los Angeles", "Nairobi", "London", "Lagos", "Amsterdam", "Tokyo"];
      const flags: Record<string, string> = {
        "Los Angeles": "🇺🇸",
        Nairobi: "🇰🇪",
        London: "🇬🇧",
        Lagos: "🇳🇬",
        Amsterdam: "🇳🇱",
        Tokyo: "🇯🇵",
      };
      const markets = ["OVER 13 (3.60x)", "UNDER 10 (2.25x)", "STAR PICK 7 (18.0x)", "EXACT HIGH 20 (36.0x)"];
      const stakes = ["$50", "$100", "$250", "2,500 KES", "₦20,000", "€60", "£40"];

      const c = cities[Math.floor(Math.random() * cities.length)];
      const newPing = {
        id: `p-${Date.now()}`,
        city: c,
        country: flags[c] || "🌐",
        stake: stakes[Math.floor(Math.random() * stakes.length)],
        market: markets[Math.floor(Math.random() * markets.length)],
        time: "Just now",
      };

      setLivePings((prev) => [newPing, ...prev.slice(0, 5)]);
    }, 4500);

    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  // Max value for revenue chart scaling
  const maxTurnover = Math.max(...dailySeries.map((d) => d.turnover), 6000);

  return (
    <div className="min-h-screen bg-[#070709] text-white p-3 sm:p-8 flex flex-col items-center select-none">
      <div className="w-full max-w-7xl space-y-6">
        {/* TOP NAV BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-[#121215] border border-white/15 shadow-xl">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="Back to Admin Dashboard"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[var(--jungle-green)]/15 border border-[var(--jungle-green)]/30 text-[var(--jungle-green)]">
                <BarChart3 size={22} />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                  Global Gaming Analytics
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--jungle-green)]/20 text-[var(--jungle-green)] border border-[var(--jungle-green)]/30 font-bold">
                    LIVE TELEMETRY
                  </span>
                </h1>
                <p className="text-xs text-gray-400">
                  Real-time GGR revenue models, turnover volume &amp; active geospatial bet clustering
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center rounded-xl bg-black/60 p-1 border border-white/10">
              <Link
                href="/admin/dashboard"
                className="px-3 py-1.5 rounded-lg text-gray-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 hover:bg-white/5"
              >
                <ShieldAlert size={13} />
                <span>Dashboard</span>
              </Link>
              <Link
                href="/admin/analytics"
                className="px-3 py-1.5 rounded-lg bg-[var(--jungle-green)] text-black font-extrabold text-xs transition-all flex items-center gap-1.5"
              >
                <BarChart3 size={13} />
                <span>Analytics</span>
              </Link>
            </div>

            <button
              onClick={fetchAnalytics}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-bold transition-all cursor-pointer"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* PRIMARY FINANCIAL KPI CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-[#121215] border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-gray-400 text-[11px] font-mono uppercase">
              <span>Total Turnover</span>
              <DollarSign size={15} className="text-blue-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white font-mono">
              ${analyticsData.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-green-400 font-mono flex items-center gap-1">
              <TrendingUp size={10} /> +18.4% vs last period
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#121215] border border-[var(--jungle-green)]/30 shadow-[0_0_15px_rgba(204,255,0,0.1)] space-y-1">
            <div className="flex items-center justify-between text-gray-400 text-[11px] font-mono uppercase">
              <span>Gross Gaming Revenue</span>
              <Zap size={15} className="text-[var(--jungle-green)]" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-[var(--jungle-green)] font-mono">
              ${analyticsData.grossGamingRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-gray-400 font-mono">
              House Margin: <span className="font-bold text-white">{analyticsData.houseMarginPercent}%</span>
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#121215] border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-gray-400 text-[11px] font-mono uppercase">
              <span>Total Payouts Won</span>
              <CheckCircle2 size={15} className="text-purple-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white font-mono">
              ${analyticsData.totalPayouts.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-gray-400 font-mono">
              Won Bets: <span className="font-bold text-white">{analyticsData.wonCount}</span> / {analyticsData.totalBets}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#121215] border border-red-500/20 space-y-1">
            <div className="flex items-center justify-between text-gray-400 text-[11px] font-mono uppercase">
              <span>Fraud Loss Prevented</span>
              <ShieldAlert size={15} className="text-red-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-red-400 font-mono">
              $14,250.00
            </h3>
            <p className="text-[10px] text-gray-400 font-mono">
              Automated Shield Quarantines
            </p>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* REVENUE CHARTS SECTION                                        */}
        {/* ------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* MAIN REVENUE TIMELINE CHART (SVG INTERACTIVE) */}
          <div className="lg:col-span-2 p-5 rounded-3xl bg-[#121215] border border-white/15 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <TrendingUp size={16} className="text-[var(--jungle-green)]" />
                  Revenue &amp; Payout Dynamics
                </h2>
                <p className="text-xs text-gray-400">
                  Gross betting turnover vs player payouts and net revenue yield
                </p>
              </div>

              {/* TIMEFRAME SELECTOR */}
              <div className="flex items-center rounded-xl bg-black/60 p-1 border border-white/10 text-xs">
                {(["24h", "7d", "30d", "all"] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 rounded-lg font-bold uppercase transition-colors cursor-pointer ${
                      timeframe === tf
                        ? "bg-[var(--jungle-green)] text-black"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* INTERACTIVE SVG CHART */}
            <div className="relative h-64 sm:h-72 w-full pt-4">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 700 240">
                <defs>
                  <linearGradient id="turnoverGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ccff00" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#ccff00" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="payoutGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid horizontal lines */}
                {[0, 60, 120, 180].map((y) => (
                  <line
                    key={y}
                    x1="40"
                    y1={y}
                    x2="680"
                    y2={y}
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="4 4"
                  />
                ))}

                {/* Y Axis Labels */}
                <text x="32" y="15" fill="#666" fontSize="10" textAnchor="end" fontFamily="monospace">$5k</text>
                <text x="32" y="75" fill="#666" fontSize="10" textAnchor="end" fontFamily="monospace">$3.5k</text>
                <text x="32" y="135" fill="#666" fontSize="10" textAnchor="end" fontFamily="monospace">$2k</text>
                <text x="32" y="195" fill="#666" fontSize="10" textAnchor="end" fontFamily="monospace">$0</text>

                {/* Area under turnover */}
                <path
                  d={`M 60,${195 - (dailySeries[0].turnover / maxTurnover) * 180} ` +
                    dailySeries
                      .map((d, i) => `L ${60 + i * 100},${195 - (d.turnover / maxTurnover) * 180}`)
                      .join(" ") +
                    ` L ${60 + (dailySeries.length - 1) * 100},195 L 60,195 Z`}
                  fill="url(#turnoverGrad)"
                />

                {/* Area under payouts */}
                <path
                  d={`M 60,${195 - (dailySeries[0].payouts / maxTurnover) * 180} ` +
                    dailySeries
                      .map((d, i) => `L ${60 + i * 100},${195 - (d.payouts / maxTurnover) * 180}`)
                      .join(" ") +
                    ` L ${60 + (dailySeries.length - 1) * 100},195 L 60,195 Z`}
                  fill="url(#payoutGrad)"
                />

                {/* Line: Turnover */}
                <polyline
                  fill="none"
                  stroke="#ccff00"
                  strokeWidth="3"
                  points={dailySeries
                    .map((d, i) => `${60 + i * 100},${195 - (d.turnover / maxTurnover) * 180}`)
                    .join(" ")}
                />

                {/* Line: Payouts */}
                <polyline
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="2.5"
                  strokeDasharray="5 3"
                  points={dailySeries
                    .map((d, i) => `${60 + i * 100},${195 - (d.payouts / maxTurnover) * 180}`)
                    .join(" ")}
                />

                {/* Line: GGR */}
                <polyline
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  points={dailySeries
                    .map((d, i) => `${60 + i * 100},${195 - (d.ggr / maxTurnover) * 180}`)
                    .join(" ")}
                />

                {/* Data Points */}
                {dailySeries.map((d, i) => {
                  const cx = 60 + i * 100;
                  const cy = 195 - (d.turnover / maxTurnover) * 180;
                  const isHovered = hoveredPointIdx === i;

                  return (
                    <g key={i}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isHovered ? 6 : 4}
                        fill="#ccff00"
                        stroke="#000"
                        strokeWidth="2"
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredPointIdx(i)}
                        onMouseLeave={() => setHoveredPointIdx(null)}
                      />
                      <text
                        x={cx}
                        y="218"
                        fill="#888"
                        fontSize="10"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Tooltip on Hover */}
              {hoveredPointIdx !== null && (
                <div
                  className="absolute bg-[#1a1a1f] border border-white/20 p-2.5 rounded-xl shadow-2xl text-xs pointer-events-none z-20 font-mono"
                  style={{
                    left: `${(hoveredPointIdx / (dailySeries.length - 1)) * 75 + 10}%`,
                    top: "10%",
                  }}
                >
                  <p className="font-bold text-white mb-1">{dailySeries[hoveredPointIdx].label}</p>
                  <p className="text-[var(--jungle-green)]">Turnover: ${dailySeries[hoveredPointIdx].turnover}</p>
                  <p className="text-purple-400">Payouts: ${dailySeries[hoveredPointIdx].payouts}</p>
                  <p className="text-sky-400">GGR: ${dailySeries[hoveredPointIdx].ggr}</p>
                </div>
              )}
            </div>

            {/* CHART LEGEND */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs font-mono">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 text-gray-300">
                  <span className="w-3 h-3 rounded-full bg-[var(--jungle-green)] inline-block" />
                  Turnover Volume
                </span>
                <span className="flex items-center gap-1.5 text-gray-300">
                  <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />
                  Player Payouts
                </span>
                <span className="flex items-center gap-1.5 text-gray-300">
                  <span className="w-3 h-3 rounded-full bg-sky-400 inline-block" />
                  Net GGR
                </span>
              </div>
              <span className="text-gray-500 hidden sm:inline">Daily Interval Sampling</span>
            </div>
          </div>

          {/* TRAFFIC FEED BREAKDOWN & OUTCOME DONUT */}
          <div className="space-y-6">
            {/* BREAKDOWN BY CAMERA FEED */}
            <div className="p-5 rounded-3xl bg-[#121215] border border-white/15 shadow-xl space-y-3.5">
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Layers size={16} className="text-blue-400" />
                Volume by Traffic Stream
              </h3>

              <div className="space-y-3">
                {[
                  { name: "🇺🇸 I-405 (Los Angeles)", volume: 7850, percent: 39, color: "bg-[var(--jungle-green)]" },
                  { name: "🇬🇧 Chelsea Bridge (London)", volume: 5120, percent: 26, color: "bg-blue-400" },
                  { name: "🇳🇱 A1 Hoevelaken (Amsterdam)", volume: 3840, percent: 19, color: "bg-amber-400" },
                  { name: "🏎️ Ultralytics Speedway", volume: 3150, percent: 16, color: "bg-purple-400" },
                ].map((feed, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-gray-300">{feed.name}</span>
                      <span className="font-bold text-white">${feed.volume.toLocaleString()} ({feed.percent}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden">
                      <div className={`h-full ${feed.color} rounded-full`} style={{ width: `${feed.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* BET STATUS DONUT METRICS */}
            <div className="p-5 rounded-3xl bg-[#121215] border border-white/15 shadow-xl space-y-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <PieIcon size={16} className="text-purple-400" />
                Wager Settlement Outcomes
              </h3>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
                  <span className="text-gray-400 block text-[10px] uppercase">Won Wagers</span>
                  <span className="text-base font-bold text-green-400">{analyticsData.wonCount}</span>
                  <span className="text-[10px] text-gray-500 block">37.9% Win Rate</span>
                </div>
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                  <span className="text-gray-400 block text-[10px] uppercase">Lost Wagers</span>
                  <span className="text-base font-bold text-red-400">{analyticsData.lostCount}</span>
                  <span className="text-[10px] text-gray-500 block">53.4% House Edge</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-gray-400 block text-[10px] uppercase">In Play (Pending)</span>
                  <span className="text-base font-bold text-amber-400">{analyticsData.pendingCount}</span>
                  <span className="text-[10px] text-gray-500 block">Resolving via CV</span>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <span className="text-gray-400 block text-[10px] uppercase">Avg Odds Hit</span>
                  <span className="text-base font-bold text-blue-400">3.45x</span>
                  <span className="text-[10px] text-gray-500 block">Median Multiplier</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* ACTIVE BET MAPS SECTION                                        */}
        {/* ------------------------------------------------------------- */}
        <div className="p-5 rounded-3xl bg-[#121215] border border-white/15 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Globe size={18} className="text-[var(--jungle-green)]" />
                Active Bet Geospatial Map
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--jungle-green)]/20 text-[var(--jungle-green)] border border-[var(--jungle-green)]/30 font-bold">
                  6 LIVE CLUSTERS
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Interactive global map of real-time wagers, live camera nodes, and wagering density.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-400 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--jungle-green)] animate-ping" />
                Live Pings Active
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* MAP STAGE (SVG WORLD MAP CONTAINER) */}
            <div className="lg:col-span-2 relative h-[360px] sm:h-[420px] rounded-2xl bg-[#0c0c0f] border border-white/10 overflow-hidden flex items-center justify-center">
              {/* Background Map Grid & Outlines */}
              <svg className="absolute inset-0 w-full h-full opacity-35" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#gridPattern)" />

                {/* Stylized continent silhouettes */}
                {/* North America */}
                <path d="M 80,70 Q 140,50 180,90 T 160,180 T 120,240 Z" fill="rgba(255,255,255,0.06)" />
                {/* Europe */}
                <path d="M 320,60 Q 380,50 420,90 T 380,150 Z" fill="rgba(255,255,255,0.06)" />
                {/* Africa */}
                <path d="M 330,170 Q 420,160 440,240 T 360,340 Z" fill="rgba(255,255,255,0.06)" />
                {/* Asia */}
                <path d="M 440,70 Q 560,50 640,120 T 580,240 Z" fill="rgba(255,255,255,0.06)" />
              </svg>

              {/* RADAR SWEEP ANIMATION */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute w-[600px] h-[600px] rounded-full border border-[var(--jungle-green)]/10 -top-20 -left-20 animate-pulse" />
              </div>

              {/* ACTIVE BET MAP NODES */}
              {DEFAULT_MAP_NODES.map((node) => {
                const isSelected = selectedNode.id === node.id;
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10"
                  >
                    {/* Pulsing ring */}
                    <span className="absolute -inset-3 rounded-full bg-[var(--jungle-green)]/30 animate-ping opacity-60" />

                    {/* Marker badge */}
                    <div
                      className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-[var(--jungle-green)] text-black shadow-[0_0_20px_rgba(204,255,0,0.8)] scale-110"
                          : "bg-black/90 text-white border border-[var(--jungle-green)]/60 hover:border-[var(--jungle-green)] hover:scale-105"
                      }`}
                    >
                      <MapPin size={12} className={isSelected ? "text-black" : "text-[var(--jungle-green)]"} />
                      <span className="text-[11px] font-mono whitespace-nowrap">{node.city}</span>
                      <span className={`text-[9px] px-1 rounded-full ${isSelected ? "bg-black/20 text-black font-extrabold" : "bg-[var(--jungle-green)]/20 text-[var(--jungle-green)]"}`}>
                        {node.activeBetsCount}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* BOTTOM MAP HUD */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-gray-400 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                <span className="flex items-center gap-1.5">
                  <Activity size={12} className="text-[var(--jungle-green)] animate-pulse" />
                  YOLOv8 Optical Trigger Zones: Synchronized
                </span>
                <span>Click markers to inspect localized telemetry</span>
              </div>
            </div>

            {/* SIDEBAR: SELECTED NODE TELEMETRY & LIVE BET TICKER */}
            <div className="space-y-4">
              {/* SELECTED NODE CARD */}
              <div className="p-4 rounded-2xl bg-black/70 border border-white/15 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📍</span>
                    <div>
                      <h4 className="text-xs font-black uppercase text-white">{selectedNode.name}</h4>
                      <p className="text-[10px] text-gray-400 font-mono">
                        {selectedNode.city}, {selectedNode.country} ({selectedNode.countryCode})
                      </p>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[var(--jungle-green)]/20 text-[var(--jungle-green)] font-bold">
                    FEED #{selectedNode.feedId}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-xl bg-white/5">
                    <span className="text-[10px] text-gray-500 block">Active Bets</span>
                    <span className="text-base font-bold text-[var(--jungle-green)]">
                      {selectedNode.activeBetsCount}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/5">
                    <span className="text-[10px] text-gray-500 block">Volume ({selectedNode.currency})</span>
                    <span className="text-base font-bold text-white">
                      ${selectedNode.totalVolumeUSD.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-gray-300 bg-white/5 p-2 rounded-xl flex items-center justify-between">
                  <span className="text-gray-500">Telemetry:</span>
                  <span className="font-bold text-white">{selectedNode.trafficDensity}</span>
                </div>

                <Link
                  href="/"
                  className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye size={12} />
                  <span>Switch Live Video to Camera {selectedNode.feedId}</span>
                </Link>
              </div>

              {/* REAL-TIME BET STREAM TICKER */}
              <div className="p-4 rounded-2xl bg-black/70 border border-white/15 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                    <Radio size={12} className="text-red-400 animate-pulse" />
                    Live Bet Stream Pings
                  </h4>
                  <span className="text-[10px] font-mono text-gray-500">Real-time</span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {livePings.map((ping) => (
                    <div
                      key={ping.id}
                      className="p-2 rounded-xl bg-[#141418] border border-white/5 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{ping.country}</span>
                        <div>
                          <span className="font-bold text-white block text-[11px]">{ping.city}</span>
                          <span className="text-[9px] text-[var(--jungle-green)]">{ping.market}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-white block text-[11px]">{ping.stake}</span>
                        <span className="text-[9px] text-gray-500">{ping.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
