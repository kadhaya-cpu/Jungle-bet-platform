"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  ShieldCheck,
  Ban,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Wallet,
  Zap,
  Radio,
  Send,
  Building2,
  Lock,
  ExternalLink,
  ChevronRight,
  Filter,
  CheckCircle2,
  Clock,
  Bell,
  Sparkles,
  Landmark,
} from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import {
  FinancialMetrics,
  TransactionData,
  DailySettlementReport,
  AlertNotificationItem,
  TreasuryStatus,
  TreasurySweepResponse,
} from "@/lib/transaction-service";
import { JungleUser } from "@/lib/auth-user-service";

export default function AdminMobilePage() {
  // 1. Authentication Gate
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("jungle_admin_auth") === "jungleadmin2026";
    }
    return false;
  });
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");

  // 2. Data states
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"feed" | "treasury" | "flagged" | "settlement" | "alerts">("feed");
  const [filterHighValueOnly, setFilterHighValueOnly] = useState(false);

  // Treasury Management state
  const [treasury, setTreasury] = useState<TreasuryStatus>({
    house_balance: 104250.0,
    total_liabilities: 8450.0,
    min_safety_float_percentage: 0.25,
    required_safety_float: 2112.5,
    withdrawable_amount: 102137.5,
    safe_to_withdraw: 102137.5,
    is_sweep_eligible: true,
    operator_bank_account: "Stanbic Bank - IBAN GB29JUNGLE8839210",
  });
  const [isSweeping, setIsSweeping] = useState(false);
  const [showSweepConfirmModal, setShowSweepConfirmModal] = useState(false);

  // Force Sweep 2FA state
  const [showForceSweepModal, setShowForceSweepModal] = useState(false);
  const [forceSweep2FACode, setForceSweep2FACode] = useState("");
  const [forceSweep2FAError, setForceSweep2FAError] = useState("");
  const [isForceSweeping, setIsForceSweeping] = useState(false);

  // Health check: Required Safety Float is low if buffer is depleted or house balance <= float * 1.25
  const isFloatLow = treasury.safe_to_withdraw <= 0 || treasury.house_balance <= treasury.required_safety_float * 1.25;

  // Financial Metrics
  const [metrics, setMetrics] = useState<FinancialMetrics>({
    today_net_profit: 4250.0,
    active_players: 18,
    total_liability: 8450.0,
    house_bankroll: 104250.0,
    today_total_turnover: 12900.0,
    recent_transactions: [],
  });

  // Flagged users
  const [flaggedUsers, setFlaggedUsers] = useState<JungleUser[]>([]);
  const [allUsers, setAllUsers] = useState<JungleUser[]>([]);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // Alerts
  const [alerts, setAlerts] = useState<AlertNotificationItem[]>([]);
  const [isSettling, setIsSettling] = useState(false);
  const [settlementReport, setSettlementReport] = useState<DailySettlementReport | null>(null);

  // 3. Data fetching
  const refreshAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      // a. Financial metrics
      try {
        const mRes = await axios.get<FinancialMetrics>("/api/finance/metrics");
        if (mRes.data) {
          setMetrics(mRes.data);
          if (mRes.data.treasury) {
            setTreasury(mRes.data.treasury);
          }
        }
      } catch (err) {
        console.warn("Using local metrics fallback:", err);
      }

      // b. Treasury status
      try {
        const tRes = await axios.get<TreasuryStatus>("/api/finance/treasury");
        if (tRes.data) {
          setTreasury(tRes.data);
        }
      } catch (err) {
        console.warn("Using local treasury fallback:", err);
      }

      // c. Flagged racers
      try {
        const uRes = await axios.get("/api/admin/flagged", {
          headers: { "x-admin-key": "jungleadmin2026" },
        });
        if (uRes.data) {
          setFlaggedUsers(uRes.data.flaggedUsers || []);
          setAllUsers(uRes.data.allUsers || []);
        }
      } catch (err) {
        console.warn("Could not fetch flagged users:", err);
      }

      // d. Real-time alerts
      try {
        const aRes = await axios.get("/api/finance/alerts");
        if (aRes.data?.alerts) {
          setAlerts(aRes.data.alerts);
        }
      } catch (err) {
        console.warn("Could not fetch alerts:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refreshAllData();
      const interval = setInterval(refreshAllData, 10000); // 10s auto-refresh for live telemetry
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, refreshAllData]);

  // Auth unlock handler
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim() === "jungleadmin2026") {
      if (typeof window !== "undefined") {
        localStorage.setItem("jungle_admin_auth", "jungleadmin2026");
      }
      setIsAuthenticated(true);
      setPasscodeError("");
      toast.success("Mobile Security Gate Unlocked");
    } else {
      setPasscodeError("Invalid admin passcode");
      toast.error("Access Denied");
    }
  };

  // One-Click Ban handler
  const handleBanToggle = async (userId: string, currentBanned: boolean) => {
    setActionInProgressId(userId);
    const action = currentBanned ? "unban" : "ban";
    try {
      const res = await axios.post("/api/admin/ban", {
        userId,
        action,
      });

      if (res.data.success) {
        toast.success(
          action === "ban"
            ? `⚡ BANNED: User ${userId} blocked from placing bets`
            : `User ${userId} unbanned`
        );
        // Optimistic UI update
        setFlaggedUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isBanned: action === "ban" } : u))
        );
        setAllUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isBanned: action === "ban" } : u))
        );
      }
    } catch {
      toast.error(`Failed to ${action} user`);
    } finally {
      setActionInProgressId(null);
    }
  };

  // Manual / Emergency Trigger Sweep handler
  const handleTriggerSweep = async () => {
    setIsSweeping(true);
    try {
      const res = await axios.post<TreasurySweepResponse>("/api/finance/treasury/sweep", {
        isManual: true,
      });
      if (res.data?.success) {
        toast.success(
          res.data.message || `Sweep Complete: Moved $${res.data.swept_amount.toLocaleString()} to Operating Account`
        );
        setShowSweepConfirmModal(false);
        refreshAllData();
      } else {
        toast.info(res.data?.message || "No withdrawable profit available to sweep.");
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg = error.response?.data?.detail || error.message || "Failed to execute sweep";
      toast.error(msg);
    } finally {
      setIsSweeping(false);
    }
  };

  // Manual Force Sweep (protected by 2FA) - re-runs calculation before executing
  const handleOpenForceSweep = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get<TreasuryStatus>("/api/finance/treasury");
      if (res.data) {
        setTreasury(res.data);
      }
    } catch (e) {
      console.warn("Could not recalculate treasury status before force sweep:", e);
    } finally {
      setIsLoading(false);
      setForceSweep2FACode("");
      setForceSweep2FAError("");
      setShowForceSweepModal(true);
    }
  };

  const handleExecuteForceSweep = async () => {
    if (!forceSweep2FACode.trim()) {
      setForceSweep2FAError("2FA Authentication Code is required for emergency sweep.");
      return;
    }
    setIsForceSweeping(true);
    setForceSweep2FAError("");
    try {
      const res = await axios.post<TreasurySweepResponse>("/api/finance/treasury/force-sweep", {
        isManual: true,
        twoFactorCode: forceSweep2FACode.trim(),
      });
      if (res.data?.success) {
        toast.success(
          res.data.message || `Force Sweep Complete: Moved $${res.data.swept_amount.toLocaleString()} to Operating Account`
        );
        setShowForceSweepModal(false);
        refreshAllData();
      } else {
        toast.info(res.data?.message || "No withdrawable profit available to sweep.");
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg = error.response?.data?.detail || error.message || "Failed to execute force sweep";
      setForceSweep2FAError(msg);
      toast.error(msg);
    } finally {
      setIsForceSweeping(false);
    }
  };

  // Trigger Daily Settlement
  const handleRunDailySettlement = async () => {
    setIsSettling(true);
    try {
      const res = await axios.post<DailySettlementReport>("/api/finance/settlement", {
        operatorBankAccount: "Stanbic Bank - IBAN GB29JUNGLE8839210",
      });
      setSettlementReport(res.data);
      toast.success(`Daily Settlement Prepared: $${res.data.net_profit.toLocaleString()} Net Profit`);
      refreshAllData();
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Settlement failed");
    } finally {
      setIsSettling(false);
    }
  };

  // Trigger Test Alert
  const handleTestAlert = async (type: string) => {
    try {
      await axios.post("/api/finance/alerts", {
        alertType: type,
        username: "VIP_Racer_007",
        amount: type === "HIGH_WIN" ? 1500.0 : 5500.0,
      });
      toast.success(`Dispatched ${type} push notification to Telegram`);
      refreshAllData();
    } catch {
      toast.error("Failed to send test alert");
    }
  };

  // Filtered transactions
  const displayedTransactions = useMemo(() => {
    let list = metrics.recent_transactions || [];
    if (filterHighValueOnly) {
      list = list.filter((t) => t.isHighValue || t.amount >= 100);
    }
    return list;
  }, [metrics.recent_transactions, filterHighValueOnly]);

  // Solvency ratio
  const solvencyRatio = useMemo(() => {
    if (metrics.total_liability <= 0) return 999;
    return Math.round((metrics.house_bankroll / metrics.total_liability) * 100);
  }, [metrics.house_bankroll, metrics.total_liability]);

  // ==========================================
  // UNLOCKED VIEW: MOBILE PASSCODE GATE
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen max-w-md mx-auto bg-[#070709] text-white flex flex-col justify-center px-6 py-12 font-sans selection:bg-[var(--jungle-green)] selection:text-black">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-[#00FF88]/20 to-[#00E5FF]/10 border border-[#00FF88]/40 flex items-center justify-center shadow-[0_0_30px_rgba(0,255,136,0.2)]">
            <ShieldAlert className="w-8 h-8 text-[var(--jungle-green)]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            RUSH HOUR BET MOBILE OPS
          </h1>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-mono">
            Financial Core &amp; Incident Monitoring
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="bg-[#111218] border border-gray-800 rounded-xl p-4 focus-within:border-[var(--jungle-green)]/60 transition-colors shadow-inner">
            <label className="block text-[11px] font-mono text-gray-400 uppercase tracking-wider mb-2">
              Operator Passcode
            </label>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-gray-500" />
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode..."
                className="w-full bg-transparent text-white placeholder-gray-600 focus:outline-none text-base font-mono"
                autoFocus
              />
            </div>
          </div>

          {passcodeError && (
            <p className="text-xs text-red-400 font-mono text-center">{passcodeError}</p>
          )}

          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-[var(--jungle-green)] to-[#00CC6A] text-black font-bold rounded-xl text-sm shadow-[0_0_20px_rgba(0,255,136,0.3)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Authenticate Admin Phone
          </button>

          <p className="text-[11px] text-gray-500 text-center font-mono">
            Default test passcode: <code className="text-gray-300">jungleadmin2026</code>
          </p>
        </form>
      </div>
    );
  }

  // ==========================================
  // AUTHENTICATED: MOBILE-FIRST DASHBOARD
  // ==========================================
  return (
    <div className="min-h-screen max-w-md mx-auto bg-[#070709] text-white flex flex-col font-sans pb-28 selection:bg-[var(--jungle-green)] selection:text-black">
      {/* 1. STICKY MOBILE HEADER */}
      <header className="sticky top-0 z-30 bg-[#070709]/95 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--jungle-green)]/15 border border-[var(--jungle-green)]/40 flex items-center justify-center">
            <Radio className="w-4 h-4 text-[var(--jungle-green)] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-tight">RUSH HOUR BET OPS</span>
              <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--jungle-green)]/20 text-[var(--jungle-green)] border border-[var(--jungle-green)]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--jungle-green)] animate-ping" />
                LIVE
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-mono">Financial Core Telemetry</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={refreshAllData}
            disabled={isLoading}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-white active:scale-95 transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[var(--jungle-green)]" : ""}`} />
          </button>
          <Link
            href="/admin/dashboard"
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-white active:scale-95 transition-all"
            title="Desktop Dashboard"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* 2. TOP BANNER: TELEGRAM ALERT HOOK & TARGET */}
      <div className="mx-4 mt-3 bg-gradient-to-r from-blue-950/40 via-purple-950/20 to-black border border-blue-500/20 rounded-xl p-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
          <span className="text-[11px] font-mono text-blue-200">
            Telegram Alerts: <strong className="text-white">Active</strong>
          </span>
        </div>
        <button
          onClick={() => handleTestAlert("HIGH_WIN")}
          className="text-[10px] font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 underline underline-offset-2"
        >
          <Send className="w-2.5 h-2.5" /> Test Alert
        </button>
      </div>

      {/* 3. KEY METRICS GRID (2x2 Mobile-Optimized) */}
      <div className="px-4 mt-3">
        <div className="grid grid-cols-2 gap-2.5">
          {/* METRIC 1: Today's Net Profit */}
          <div className="bg-[#111218] border border-white/10 rounded-2xl p-3.5 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider">Today&apos;s Net Profit</span>
              {metrics.today_net_profit >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-[var(--jungle-green)]" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              )}
            </div>
            <div
              className={`text-xl font-black font-mono tracking-tight ${
                metrics.today_net_profit >= 0 ? "text-[var(--jungle-green)]" : "text-red-400"
              }`}
            >
              {metrics.today_net_profit >= 0 ? "+" : ""}$
              {metrics.today_net_profit.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--jungle-green)]" />
              House Margin active
            </div>
          </div>

          {/* METRIC 2: Active Players */}
          <div className="bg-[#111218] border border-white/10 rounded-2xl p-3.5 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider">Active Players</span>
              <Users className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-xl font-black font-mono tracking-tight text-white">
              {metrics.active_players}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              Wagering today
            </div>
          </div>

          {/* METRIC 3: Total Liability */}
          <div className="bg-[#111218] border border-white/10 rounded-2xl p-3.5 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider">Total Liability</span>
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-black font-mono tracking-tight text-amber-400">
              $
              {metrics.total_liability.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="mt-1 text-[10px] text-gray-400 font-mono truncate">
              Owed to players &amp; stakes
            </div>
          </div>

          {/* METRIC 4: House Bankroll */}
          <div className="bg-[#111218] border border-white/10 rounded-2xl p-3.5 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider">House Bankroll</span>
              <Wallet className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-black font-mono tracking-tight text-purple-300">
              $
              {metrics.house_bankroll.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
              <span>Coverage: {solvencyRatio}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. TREASURY STATUS CARD */}
      <div className="mx-4 mt-3 bg-[#111218] border border-white/10 rounded-2xl p-4 relative overflow-hidden shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-black tracking-wider uppercase text-white">Treasury Status</h2>
              <p className="text-[10px] text-gray-400 font-mono">Safe Withdrawal &amp; Compliance Shield</p>
            </div>
          </div>
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            FLOAT: 25% MIN
          </span>
        </div>

        {/* Treasury Status Metrics List */}
        <div className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-2.5 font-mono text-xs">
          {/* Total Player Liabilities */}
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Total Player Liabilities:</span>
            <span className="text-white font-black text-sm">
              ${treasury.total_liabilities.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Required Safety Float (25%) (Red text if low) */}
          <div className="flex items-center justify-between bg-red-950/20 px-2.5 py-1.5 rounded-lg border border-red-500/20">
            <span className="text-gray-300 font-medium flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isFloatLow ? "bg-red-500 animate-ping" : "bg-red-400"}`} />
              Required Safety Float (25%):
            </span>
            <span className={`font-black text-sm ${isFloatLow ? "text-red-500 font-extrabold animate-pulse" : "text-red-400"}`}>
              ${treasury.required_safety_float.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Safe to Withdraw Now (Green text) */}
          <div className="flex items-center justify-between bg-emerald-950/20 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
            <span className="text-gray-300 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--jungle-green)] animate-pulse" />
              Safe to Withdraw Now:
            </span>
            <span className="font-black text-sm text-[var(--jungle-green)]">
              ${treasury.safe_to_withdraw.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Visual Zone Gauge Bar */}
        <div className="mt-3 space-y-1.5">
          <div className="h-2.5 w-full bg-black/60 rounded-full overflow-hidden flex border border-white/5">
            <div
              style={{
                width: `${Math.min(100, treasury.house_balance > 0 ? (treasury.required_safety_float / treasury.house_balance) * 100 : 25)}%`,
              }}
              className="bg-gradient-to-r from-red-600 to-rose-500 h-full transition-all duration-500"
              title="Red Zone: Required Safety Float"
            />
            <div
              style={{
                width: `${Math.max(0, treasury.house_balance > 0 ? (treasury.safe_to_withdraw / treasury.house_balance) * 100 : 75)}%`,
              }}
              className="bg-gradient-to-r from-emerald-500 to-[var(--jungle-green)] h-full transition-all duration-500"
              title="Green Zone: Safe to Withdraw"
            />
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono">
            <span className="text-red-400">🛡️ Required Safety Float (Locked Floor)</span>
            <span className="text-[var(--jungle-green)]">🟢 Safe to Withdraw (Operating Profit)</span>
          </div>
        </div>

        {/* Manual 'Force Sweep' Action Button (Protected by 2FA) */}
        <div className="mt-3.5 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
          <div className="text-[10px] text-gray-400 font-mono truncate">
            <span className="text-gray-500">Cron 2 AM:</span> <span className="text-gray-300">Daily Automated</span>
          </div>
          <button
            onClick={handleOpenForceSweep}
            disabled={treasury.safe_to_withdraw <= 0 || isForceSweeping || isLoading}
            className={`py-2 px-3.5 rounded-xl font-bold font-mono text-xs transition-all flex items-center gap-1.5 shrink-0 ${
              treasury.safe_to_withdraw > 0
                ? "bg-gradient-to-r from-amber-400 via-[var(--jungle-green)] to-emerald-400 text-black shadow-[0_0_15px_rgba(0,255,136,0.25)] hover:brightness-110 active:scale-95"
                : "bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Force Sweep
          </button>
        </div>
      </div>

      {/* 5. SEGREGATED WALLETS SUMMARY PILL */}
      <div className="mx-4 mt-3 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Ledger Segregation:</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]">
            PLAYER ↔ HOUSE_REVENUE
          </span>
        </div>
        <span className="text-[10px] text-gray-500">Trigger Enforced</span>
      </div>

      {/* 6. TAB SWITCHER */}
      <div className="px-4 mt-4">
        <div className="bg-[#111218] p-1 rounded-xl flex items-center gap-1 border border-white/10 overflow-x-auto">
          <button
            onClick={() => setActiveTab("feed")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 shrink-0 ${
              activeTab === "feed"
                ? "bg-[var(--jungle-green)] text-black shadow-md"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Feed
          </button>
          <button
            onClick={() => setActiveTab("treasury")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 shrink-0 ${
              activeTab === "treasury"
                ? "bg-emerald-500 text-black shadow-md"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            Treasury
          </button>
          <button
            onClick={() => setActiveTab("flagged")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 shrink-0 ${
              activeTab === "flagged"
                ? "bg-red-500 text-white shadow-md"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Flagged ({flaggedUsers.length})
          </button>
          <button
            onClick={() => setActiveTab("settlement")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 shrink-0 ${
              activeTab === "settlement"
                ? "bg-purple-600 text-white shadow-md"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Settle
          </button>
          <button
            onClick={() => setActiveTab("alerts")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 shrink-0 ${
              activeTab === "alerts"
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Alerts
          </button>
        </div>
      </div>

      {/* 6. TAB CONTENT */}
      <div className="px-4 mt-3 flex-1">
        {/* ==========================================
            TAB 1: LIVE FEED OF TRANSACTIONS
           ========================================== */}
        {activeTab === "feed" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-gray-400 font-mono py-1">
              <span>High-Value Transactions</span>
              <button
                onClick={() => setFilterHighValueOnly(!filterHighValueOnly)}
                className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors flex items-center gap-1 ${
                  filterHighValueOnly
                    ? "bg-[var(--jungle-green)]/20 text-[var(--jungle-green)] border-[var(--jungle-green)]/40"
                    : "bg-white/5 text-gray-400 border-white/10"
                }`}
              >
                <Filter className="w-2.5 h-2.5" />
                {filterHighValueOnly ? "Showing >$100" : "All Feeds"}
              </button>
            </div>

            {displayedTransactions.length === 0 ? (
              <div className="bg-[#111218] border border-gray-800 rounded-2xl p-8 text-center text-gray-500 font-mono text-xs">
                No recent transactions found
              </div>
            ) : (
              displayedTransactions.map((tx: TransactionData) => {
                const isWin = tx.type === "win";
                const isDeposit = tx.type === "deposit";
                const isBet = tx.type === "bet";

                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-[#111218] rounded-xl p-3 border transition-all ${
                      tx.isHighValue || tx.amount >= 500
                        ? "border-[var(--jungle-green)]/40 shadow-[0_0_15px_rgba(0,255,136,0.08)]"
                        : "border-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                            isWin
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : isDeposit
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                              : isBet
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                              : "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                          }`}
                        >
                          {tx.type}
                        </span>
                        <span className="text-xs font-bold text-gray-200">
                          {tx.username || `User #${tx.userId}`}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-black font-mono ${
                          isWin ? "text-[var(--jungle-green)]" : "text-white"
                        }`}
                      >
                        {isWin ? "+" : ""}${tx.amount.toLocaleString()}
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                      <span className="truncate max-w-[220px]">
                        {tx.description || `Txn #${tx.id} - ${tx.status}`}
                      </span>
                      <span className="text-gray-500 shrink-0">
                        {tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Live"}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        )}

        {/* ==========================================
            TAB: TREASURY MANAGEMENT & SAFE WITHDRAWAL
           ========================================== */}
        {activeTab === "treasury" && (
          <div className="space-y-3">
            {/* Main Treasury Overview Card */}
            <div className="bg-[#111218] border border-emerald-500/30 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold">Treasury Status</h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  25% Min Float
                </span>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                Protects platform solvency by dynamically reserving a 25% safety float against all active player liabilities before permitting profit withdrawals.
              </p>

              {/* Float & Withdrawable Table */}
              <div className="mt-3.5 p-3 rounded-xl bg-black/40 border border-white/5 space-y-2.5 font-mono text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>Total House Balance:</span>
                  <span className="text-white font-bold">
                    ${treasury.house_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Total Player Liabilities:</span>
                  <span className="text-amber-400 font-bold">
                    ${treasury.total_liabilities.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-red-400 bg-red-950/20 px-2.5 py-1.5 rounded-lg border border-red-500/20">
                  <span className="font-bold flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isFloatLow ? "bg-red-500 animate-ping" : "bg-red-400"}`} />
                    Required Safety Float (25%):
                  </span>
                  <span className={`font-black text-sm ${isFloatLow ? "text-red-500 font-extrabold animate-pulse" : "text-red-400"}`}>
                    ${treasury.required_safety_float.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-[var(--jungle-green)] bg-emerald-950/20 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                  <span className="font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--jungle-green)] animate-pulse" />
                    Safe to Withdraw Now:
                  </span>
                  <span className="font-black text-sm text-[var(--jungle-green)]">
                    ${treasury.safe_to_withdraw.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-gray-400 pt-1 border-t border-white/10">
                  <span>Operating Account:</span>
                  <span className="text-gray-300 truncate max-w-[180px]">{treasury.operator_bank_account}</span>
                </div>
              </div>

              {/* Compliance Guard Notice */}
              <div className="mt-3 p-2.5 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-start gap-2 text-blue-200 text-[11px] font-mono leading-tight">
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Compliance Guard:</strong> Withdrawal attempts that would dip the House Balance below the Required Safety Float (${treasury.required_safety_float.toLocaleString()}) are strictly blocked at the financial core.
                </span>
              </div>

              {/* Force Sweep Button (Protected by 2FA) */}
              <button
                onClick={handleOpenForceSweep}
                disabled={treasury.safe_to_withdraw <= 0 || isForceSweeping || isLoading}
                className={`w-full mt-4 py-3 text-xs font-bold font-mono rounded-xl transition-all flex items-center justify-center gap-2 ${
                  treasury.safe_to_withdraw > 0
                    ? "bg-gradient-to-r from-amber-400 via-[var(--jungle-green)] to-emerald-400 text-black shadow-[0_0_20px_rgba(0,255,136,0.3)] hover:brightness-110 active:scale-[0.98]"
                    : "bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed"
                }`}
              >
                <Lock className="w-4 h-4" />
                ⚡ Force Sweep (2FA Protected)
              </button>
            </div>

            {/* Automated Sweep Job Card */}
            <div className="bg-[#111218] border border-white/10 rounded-2xl p-4 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between text-gray-400">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-purple-400" />
                  Automated Sweep Job (Cron)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Daily @ 2:00 AM UTC
                </span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed font-sans">
                Celery Beat automatically executes daily at 2:00 AM. When Withdrawable Profit &gt; $0, funds are moved from House Revenue to the Operator External Account, logged as <code>OPERATING_PROFIT_WITHDRAWAL</code>, and an instant Telegram notification is dispatched to admin.
              </p>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 3: FLAGGED RACERS & ONE-CLICK BAN
           ========================================== */}
        {activeTab === "flagged" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-400 font-mono py-1">
              <span>Security Anomaly Radar</span>
              <span className="text-[10px] text-red-400">{flaggedUsers.length} Flagged</span>
            </div>

            {flaggedUsers.length === 0 ? (
              <div className="bg-[#111218] border border-gray-800 rounded-2xl p-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-[var(--jungle-green)] mx-auto mb-2 opacity-80" />
                <p className="text-xs font-mono text-gray-300">Clean Session</p>
                <p className="text-[10px] text-gray-500 mt-1">No flagged racers or anomalies detected.</p>
              </div>
            ) : (
              flaggedUsers.map((user: JungleUser) => {
                const isBanned = user.isBanned;
                const isProcessing = actionInProgressId === user.id;

                return (
                  <motion.div
                    key={user.id}
                    layout
                    className={`bg-[#111218] rounded-xl p-3.5 border transition-all ${
                      isBanned
                        ? "border-red-500/40 bg-red-950/10"
                        : "border-amber-500/40 bg-amber-950/10 shadow-[0_0_15px_rgba(245,158,11,0.06)]"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{user.name}</span>
                          {isBanned && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-500/30 text-red-300 border border-red-500/40">
                              BANNED
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                          ID: {user.id} {user.phone && `• ${user.phone}`}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-gray-200">
                          ${user.balance.toLocaleString()}
                        </span>
                        <p className="text-[9px] text-gray-500 font-mono">Wallet</p>
                      </div>
                    </div>

                    <div className="mt-2.5 p-2 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono text-amber-300/90 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span className="truncate">{user.flagReason || "Flagged for anomalous betting activity"}</span>
                    </div>

                    {/* ONE-CLICK BAN ACTION */}
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleBanToggle(user.id, !!isBanned)}
                        disabled={isProcessing}
                        className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 ${
                          isBanned
                            ? "bg-white/10 hover:bg-white/20 text-gray-300 border border-white/15"
                            : "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] active:scale-[0.98]"
                        }`}
                      >
                        {isProcessing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : isBanned ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            Unban Racer
                          </>
                        ) : (
                          <>
                            <Ban className="w-3.5 h-3.5" />
                            ⚡ ONE-CLICK BAN
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        )}

        {/* ==========================================
            TAB 3: DAILY SETTLEMENT (11:59 PM)
           ========================================== */}
        {activeTab === "settlement" && (
          <div className="space-y-3">
            <div className="bg-[#111218] border border-purple-500/30 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-bold">11:59 PM Daily Settlement</h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Scheduled
                </span>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                Calculates net profit, closes the day&apos;s double-entry ledger, and prepares transfer from HOUSE_REVENUE to the operator&apos;s bank account.
              </p>

              <div className="mt-3 p-3 rounded-xl bg-black/40 border border-white/5 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>Operator Bank:</span>
                  <span className="text-white font-bold">Stanbic Bank (GB)</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Account / IBAN:</span>
                  <span className="text-gray-300">GB29JUNGLE8839210</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Calculated Net:</span>
                  <span className="text-[var(--jungle-green)] font-bold">
                    ${metrics.today_net_profit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <button
                onClick={handleRunDailySettlement}
                disabled={isSettling}
                className="w-full mt-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isSettling ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    🚀 Execute Settlement Now
                  </>
                )}
              </button>
            </div>

            {settlementReport && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#111218] border border-[var(--jungle-green)]/40 rounded-xl p-3.5 font-mono text-xs space-y-2"
              >
                <div className="flex items-center gap-1.5 text-[var(--jungle-green)] font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Settlement Prepared Successfully</span>
                </div>
                <div className="text-[11px] text-gray-300 space-y-1">
                  <p>Ref: <code className="text-white">{settlementReport.transfer_reference}</code></p>
                  <p>Net Profit: <strong className="text-[var(--jungle-green)]">${settlementReport.net_profit.toLocaleString()}</strong></p>
                  <p>Status: <span className="text-purple-300">{settlementReport.status}</span></p>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB 4: REAL-TIME ALERTS & TELEGRAM LOG
           ========================================== */}
        {activeTab === "alerts" && (
          <div className="space-y-3">
            <div className="bg-[#111218] border border-white/10 rounded-2xl p-4">
              <h3 className="text-xs font-mono uppercase tracking-wider text-gray-400 mb-2">
                Instant Notification Triggers
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <button
                  onClick={() => handleTestAlert("HIGH_WIN")}
                  className="py-2.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 active:scale-95 transition-all text-left"
                >
                  <div className="text-[10px] text-gray-400">Alert Trigger</div>
                  <div className="font-bold">Win &gt; $1,000</div>
                </button>
                <button
                  onClick={() => handleTestAlert("PROFIT_TARGET")}
                  className="py-2.5 px-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 active:scale-95 transition-all text-left"
                >
                  <div className="text-[10px] text-gray-400">Alert Trigger</div>
                  <div className="font-bold">Target $5,000</div>
                </button>
                <button
                  onClick={() => handleTestAlert("FRAUD_ALERT")}
                  className="py-2.5 px-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 active:scale-95 transition-all text-left"
                >
                  <div className="text-[10px] text-gray-400">Alert Trigger</div>
                  <div className="font-bold">Fraud Shield</div>
                </button>
                <button
                  onClick={() => handleTestAlert("DAILY_SUMMARY")}
                  className="py-2.5 px-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 active:scale-95 transition-all text-left"
                >
                  <div className="text-[10px] text-gray-400">Alert Trigger</div>
                  <div className="font-bold">11:59 PM Summary</div>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-gray-400 font-mono">Recent Telegram Push Log</div>
              {alerts.length === 0 ? (
                <div className="bg-[#111218] border border-gray-800 rounded-xl p-6 text-center text-xs text-gray-500 font-mono">
                  No alerts recorded yet.
                </div>
              ) : (
                alerts.map((al: AlertNotificationItem) => (
                  <div
                    key={al.id}
                    className="bg-[#111218] border border-white/5 rounded-xl p-3 font-mono text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-[11px]">{al.title}</span>
                      <span className="text-[9px] text-gray-500">
                        {al.created_at ? new Date(al.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 line-clamp-2">{al.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 7. FIXED MOBILE BOTTOM BAR */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#070709]/95 backdrop-blur-lg border-t border-white/10 max-w-md mx-auto px-6 py-2.5 flex items-center justify-between text-xs font-mono">
        <Link
          href="/admin/mobile"
          className="flex flex-col items-center gap-1 text-[var(--jungle-green)] font-bold"
        >
          <Radio className="w-5 h-5" />
          <span className="text-[10px]">Mobile</span>
        </Link>
        <Link
          href="/admin/dashboard"
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-white"
        >
          <ShieldAlert className="w-5 h-5" />
          <span className="text-[10px]">Shield</span>
        </Link>
        <Link
          href="/admin/analytics"
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-white"
        >
          <TrendingUp className="w-5 h-5" />
          <span className="text-[10px]">Analytics</span>
        </Link>
        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              localStorage.removeItem("jungle_admin_auth");
            }
            setIsAuthenticated(false);
            toast.info("Logged out of Mobile Ops");
          }}
          className="flex flex-col items-center gap-1 text-gray-500 hover:text-red-400"
        >
          <Lock className="w-5 h-5" />
          <span className="text-[10px]">Lock</span>
        </button>
      </nav>

      {/* 8. CONFIRMATION WARNING MODAL FOR MANUAL SWEEP */}
      <AnimatePresence>
        {showSweepConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111218] border border-amber-500/40 rounded-2xl max-w-sm w-full p-5 text-white shadow-[0_0_40px_rgba(245,158,11,0.2)]"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">Emergency Sweep Warning</h3>
                  <p className="text-[10px] text-amber-400/90 font-mono">Treasury Compliance Guard</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed font-mono space-y-1 mb-4">
                <p className="font-bold text-amber-300">⚠️ Confirmation Required:</p>
                <p className="text-[11px]">
                  You are about to execute an immediate cash sweep from the House Revenue Wallet to the Operator External Account.
                </p>
              </div>

              <div className="bg-black/50 border border-white/10 rounded-xl p-3 space-y-2 font-mono text-xs mb-4">
                <div className="flex justify-between text-gray-400">
                  <span>Total House Balance:</span>
                  <span className="text-white font-bold">
                    ${treasury.house_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-red-400">
                  <span>Required Safety Float (Red Zone):</span>
                  <span className="font-bold">
                    ${treasury.required_safety_float.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-[var(--jungle-green)] border-t border-white/10 pt-1.5">
                  <span className="font-bold">Safe to Withdraw (Green Zone):</span>
                  <span className="font-black text-sm">
                    ${treasury.safe_to_withdraw.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Operating Account:</span>
                  <span className="truncate max-w-[170px] text-gray-400">{treasury.operator_bank_account}</span>
                </div>
              </div>

              <div className="text-[10px] text-gray-400 font-mono mb-5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>House Balance is strictly blocked from dipping below Required Safety Float.</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSweepConfirmModal(false)}
                  disabled={isSweeping}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-mono text-gray-300 hover:bg-white/5 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTriggerSweep}
                  disabled={isSweeping || treasury.safe_to_withdraw <= 0}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-[var(--jungle-green)] text-black font-bold font-mono text-xs shadow-[0_0_20px_rgba(0,255,136,0.3)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  {isSweeping ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      Confirm &amp; Sweep
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* 2FA PROTECTED FORCE SWEEP MODAL */}
        {showForceSweepModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111218] border border-amber-500/50 rounded-2xl max-w-sm w-full p-5 text-white shadow-[0_0_50px_rgba(245,158,11,0.25)]"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">Force Sweep (2FA Protected)</h3>
                  <p className="text-[10px] text-amber-400/90 font-mono">Emergency Liquidity Needs</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/25 border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed font-mono space-y-1 mb-3.5">
                <p className="font-bold text-amber-300">⚡ Re-Calculated Solvency Status:</p>
                <p className="text-[11px] text-gray-300">
                  Treasury figures have been recalculated live before executing this emergency liquidity sweep.
                </p>
              </div>

              {/* Recalculated Treasury Status Card */}
              <div className="bg-black/60 border border-white/10 rounded-xl p-3 space-y-2 font-mono text-xs mb-3.5">
                <div className="flex justify-between text-gray-400">
                  <span>Total Player Liabilities:</span>
                  <span className="text-white font-bold">
                    ${treasury.total_liabilities.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-red-400">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isFloatLow ? "bg-red-500 animate-ping" : "bg-red-400"}`} />
                    Required Safety Float (25%):
                  </span>
                  <span className={`font-bold ${isFloatLow ? "text-red-500 font-extrabold animate-pulse" : "text-red-400"}`}>
                    ${treasury.required_safety_float.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-[var(--jungle-green)] border-t border-white/10 pt-1.5">
                  <span className="font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--jungle-green)] animate-pulse" />
                    Safe to Withdraw Now:
                  </span>
                  <span className="font-black text-sm">
                    ${treasury.safe_to_withdraw.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Operating Account:</span>
                  <span className="truncate max-w-[170px] text-gray-400">{treasury.operator_bank_account}</span>
                </div>
              </div>

              {/* 2FA Input */}
              <div className="mb-4 space-y-1.5">
                <label className="text-[11px] font-mono text-gray-300 font-bold block flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  Enter 2FA Code / Admin Passcode:
                </label>
                <input
                  type="password"
                  value={forceSweep2FACode}
                  onChange={(e) => {
                    setForceSweep2FACode(e.target.value);
                    setForceSweep2FAError("");
                  }}
                  placeholder="e.g. jungleadmin2026"
                  className="w-full bg-black/80 border border-white/20 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400 transition-colors"
                  autoFocus
                />
                {forceSweep2FAError && (
                  <p className="text-[10px] text-red-400 font-mono mt-1">{forceSweep2FAError}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowForceSweepModal(false)}
                  disabled={isForceSweeping}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-mono text-gray-300 hover:bg-white/5 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteForceSweep}
                  disabled={isForceSweeping || treasury.safe_to_withdraw <= 0}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-[var(--jungle-green)] to-emerald-400 text-black font-bold font-mono text-xs shadow-[0_0_20px_rgba(0,255,136,0.3)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  {isForceSweeping ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      Authorize &amp; Force Sweep
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
