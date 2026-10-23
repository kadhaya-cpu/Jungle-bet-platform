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
  Search,
  Filter,
  ArrowLeft,
  Lock,
  Zap,
  TrendingUp,
  BarChart3,
  Users,
  AlertOctagon,
  Eye,
  Check,
  Copy,
  Radio,
  Clock,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { JungleUser } from "@/lib/auth-user-service";

interface FraudAlertData {
  id: string | number;
  userId: string;
  username: string;
  alertType: string;
  reason: string;
  amount?: number;
  recentBetsCount?: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | string;
  timestamp: string;
}

export default function AdminDashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("jungle_admin_auth") === "jungleadmin2026";
    }
    return false;
  });
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<JungleUser[]>([]);
  const [flaggedUsers, setFlaggedUsers] = useState<JungleUser[]>([]);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [bannedCount, setBannedCount] = useState(0);

  // Fraud alerts stream
  const [alerts, setAlerts] = useState<FraudAlertData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "flagged" | "banned" | "clean">("all");
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [inspectUser, setInspectUser] = useState<JungleUser | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch admin users data
  const fetchAdminData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch users from Next.js / FastAPI
      const res = await axios.get("/api/admin/flagged", {
        headers: { "x-admin-key": "jungleadmin2026" },
      });
      const data = res.data;
      setAllUsers(data.allUsers || []);
      setFlaggedUsers(data.flaggedUsers || []);
      setTotalUsersCount(data.totalUsers || data.allUsers?.length || 0);
      setBannedCount(data.bannedCount || 0);

      // 2. Fetch fraud alerts
      try {
        const alertRes = await axios.get("/api/fraud/alerts");
        if (alertRes.data?.alerts) {
          setAlerts(alertRes.data.alerts);
        }
      } catch {
        // Fallback: build alert cards from flagged users
        if (data.flaggedUsers && data.flaggedUsers.length > 0) {
          const fallbackAlerts: FraudAlertData[] = data.flaggedUsers.map((u: JungleUser, idx: number) => ({
            id: `alert-fallback-${idx}`,
            userId: u.id,
            username: u.name,
            alertType: u.flagReason?.includes("win") ? "large_win" : "rapid_bets",
            reason: u.flagReason || "Flagged for anomalous activity",
            amount: u.balance,
            severity: u.flagReason?.includes("win") ? "CRITICAL" : "HIGH",
            timestamp: u.flaggedAt || new Date().toISOString(),
          }));
          setAlerts(fallbackAlerts);
        }
      }
    } catch {
      toast.error("Failed to load admin fraud shield data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Connect to real-time fraud alerts stream (SSE)
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchAdminData();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/fraud/stream");
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "fraud_alert" && payload.alert) {
            setAlerts((prev) => {
              const incoming = payload.alert;
              const exists = prev.some((a) => String(a.id) === String(incoming.id));
              if (exists) return prev;
              toast.warning(`🚨 Fraud Alert: ${incoming.reason || "Suspicious betting anomaly detected"}`);
              return [incoming, ...prev];
            });
            fetchAdminData();
          }
        } catch {
          // ignore non-json
        }
      };
    } catch {
      // EventSource not supported or unavailable
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [isAuthenticated, fetchAdminData]);

  // Auth unlock
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim() === "jungleadmin2026" || passcode.trim() === "admin") {
      setIsAuthenticated(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("jungle_admin_auth", "jungleadmin2026");
      }
      toast.success("Welcome, Security Admin!");
      setPasscodeError("");
    } else {
      setPasscodeError("Invalid passcode. Default: jungleadmin2026");
    }
  };

  const handleAdminLogout = () => {
    setIsAuthenticated(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("jungle_admin_auth");
    }
    toast.info("Logged out from Admin Dashboard");
  };

  // Ban action button handler
  const handleBanUser = async (userId: string, userName: string) => {
    setActionInProgressId(userId);
    try {
      const res = await axios.post("/api/admin/ban", {
        userId,
        action: "ban",
      });
      if (res.data.success) {
        toast.error(`ACCOUNT BANNED: ${userName} has been barred from placing bets.`);
        fetchAdminData();
      }
    } catch {
      toast.error("Failed to ban user");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Unban action button handler
  const handleUnbanUser = async (userId: string, userName: string) => {
    setActionInProgressId(userId);
    try {
      const res = await axios.post("/api/admin/ban", {
        userId,
        action: "unban",
      });
      if (res.data.success) {
        toast.success(`ACCOUNT RESTORED: ${userName} unbanned.`);
        fetchAdminData();
      }
    } catch {
      toast.error("Failed to unban user");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Dismiss flag
  const handleClearFlag = async (userId: string) => {
    setActionInProgressId(userId);
    try {
      const res = await axios.post("/api/admin/ban", {
        userId,
        action: "unflag",
      });
      if (res.data.success) {
        toast.info("Fraud flag dismissed.");
        fetchAdminData();
      }
    } catch {
      toast.error("Failed to clear flag");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Trigger test simulator
  const handleSimulate = async (type: "rapid_bets" | "large_win") => {
    try {
      const targetUserId = allUsers[0]?.id || "usr_demo_vip_001";
      const res = await axios.post("/api/admin/simulate", {
        type,
        userId: targetUserId,
      });
      if (res.data.success) {
        toast.warning(res.data.message);
        fetchAdminData();
      }
    } catch {
      toast.error("Simulation failed");
    }
  };

  const copyUserId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("User ID copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return allUsers.filter((u) => {
      // Status filter
      if (statusFilter === "flagged" && !u.isFlagged) return false;
      if (statusFilter === "banned" && !u.isBanned) return false;
      if (statusFilter === "clean" && (u.isFlagged || u.isBanned)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesId = u.id.toLowerCase().includes(q);
        const matchesPhone = u.phone?.toLowerCase().includes(q) || false;
        const matchesEmail = u.email?.toLowerCase().includes(q) || false;
        const matchesReason = u.flagReason?.toLowerCase().includes(q) || false;
        return matchesName || matchesId || matchesPhone || matchesEmail || matchesReason;
      }
      return true;
    });
  }, [allUsers, statusFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#070709] text-white p-3 sm:p-8 flex flex-col items-center select-none">
      {/* ------------------------------------------------------------- */}
      {/* ACCESS GATE: ADMIN PASSCODE MODAL                             */}
      {/* ------------------------------------------------------------- */}
      {!isAuthenticated ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md my-auto p-6 sm:p-8 rounded-3xl bg-[#121215] border border-red-500/30 shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(239,68,68,0.15)] flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 mb-4 shadow-[0_0_20px_rgba(239,68,68,0.25)]">
            <Lock size={32} />
          </div>

          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white">
            Admin Fraud Shield
          </h1>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            Restricted control center for real-time fraud monitoring, high-frequency anomalies, and account actions.
          </p>

          <form onSubmit={handleAdminLogin} className="w-full mt-6 space-y-4">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-gray-400 block mb-1.5 text-left">
                Security Passcode
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter admin passcode..."
                className="w-full px-4 py-3 rounded-xl bg-black/80 border border-white/15 focus:border-[var(--jungle-green)] text-sm text-white font-mono focus:outline-none transition-colors"
              />
              {passcodeError && (
                <p className="text-xs text-red-400 text-left mt-1.5 font-medium">
                  {passcodeError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-[var(--jungle-green)] hover:bg-[#b8e600] text-black font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_20px_rgba(204,255,0,0.3)] active:scale-95"
            >
              Unlock Control Center
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-white/10 w-full flex items-center justify-between text-xs text-gray-500">
            <span>Passcode: jungleadmin2026</span>
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              Return Home
            </Link>
          </div>
        </motion.div>
      ) : (
        /* ------------------------------------------------------------- */
        /* AUTHENTICATED: FULL ADMIN DASHBOARD                           */
        /* ------------------------------------------------------------- */
        <div className="w-full max-w-7xl space-y-6">
          {/* TOP NAV BAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-[#121215] border border-white/15 shadow-xl">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                title="Back to Game"
              >
                <ArrowLeft size={18} />
              </Link>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400">
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                    RUSH HOUR BET Fraud Shield
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--jungle-green)]/20 text-[var(--jungle-green)] border border-[var(--jungle-green)]/30 font-bold">
                      ACTIVE
                    </span>
                  </h1>
                  <p className="text-xs text-gray-400">
                    Real-time monitoring: &gt;10 bets/min rate anomaly &amp; &gt;$1,000 instant payout flag
                  </p>
                </div>
              </div>
            </div>

            {/* NAV LINKS & ACTIONS */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex items-center rounded-xl bg-black/60 p-1 border border-white/10">
                <Link
                  href="/admin/dashboard"
                  className="px-3 py-1.5 rounded-lg bg-[var(--jungle-green)] text-black font-extrabold text-xs transition-all flex items-center gap-1.5"
                >
                  <ShieldAlert size={13} />
                  <span>Dashboard</span>
                </Link>
                <Link
                  href="/admin/analytics"
                  className="px-3 py-1.5 rounded-lg text-gray-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 hover:bg-white/5"
                >
                  <BarChart3 size={13} />
                  <span>Analytics</span>
                </Link>
                <Link
                  href="/admin/mobile"
                  className="px-3 py-1.5 rounded-lg text-[var(--jungle-green)] hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 hover:bg-white/5 border border-[var(--jungle-green)]/30 bg-[var(--jungle-green)]/10"
                >
                  <Radio size={13} />
                  <span>Mobile Ops</span>
                </Link>
              </div>

              <button
                onClick={fetchAdminData}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-bold transition-all cursor-pointer"
              >
                <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
                <span>Refresh</span>
              </button>

              <button
                onClick={handleAdminLogout}
                className="px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-bold transition-all cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* TOP METRICS SUMMARY */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-[#121215] border border-white/10 flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
                <Users size={20} />
              </div>
              <div>
                <p className="text-[11px] font-mono text-gray-400 uppercase">Total Racers</p>
                <h3 className="text-xl sm:text-2xl font-black text-white">{totalUsersCount}</h3>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#121215] border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)] flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-[11px] font-mono text-gray-400 uppercase">Flagged Accounts</p>
                <h3 className="text-xl sm:text-2xl font-black text-amber-400">{flaggedUsers.length}</h3>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#121215] border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)] flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30">
                <Ban size={20} />
              </div>
              <div>
                <p className="text-[11px] font-mono text-gray-400 uppercase">Banned Accounts</p>
                <h3 className="text-xl sm:text-2xl font-black text-red-400">{bannedCount}</h3>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#121215] border border-[var(--jungle-green)]/30 shadow-[0_0_15px_rgba(204,255,0,0.1)] flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[var(--jungle-green)]/15 text-[var(--jungle-green)] border border-[var(--jungle-green)]/30">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-[11px] font-mono text-gray-400 uppercase">Active Shield</p>
                <h3 className="text-sm font-black text-[var(--jungle-green)] uppercase">100% Armed</h3>
              </div>
            </div>
          </div>

          {/* SIMULATOR BAR */}
          <div className="p-4 rounded-2xl bg-[#121215] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-[var(--jungle-green)]" />
              <span className="text-xs font-bold text-gray-300">Fraud Engine Logic Hook Simulator:</span>
              <span className="text-[11px] text-gray-500 hidden sm:inline">
                Test thresholds and verify real-time alert broadcasts.
              </span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => handleSimulate("rapid_bets")}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Clock size={12} />
                <span>Simulate Rapid Bets (&gt;10/min)</span>
              </button>
              <button
                onClick={() => handleSimulate("large_win")}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <TrendingUp size={12} />
                <span>Simulate Large Win (&gt;$1,000)</span>
              </button>
            </div>
          </div>

          {/* REAL-TIME FRAUD ALERTS PANEL */}
          <div className="p-5 rounded-3xl bg-[#121215] border border-red-500/30 shadow-[0_10px_30px_rgba(0,0,0,0.5)] space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  Live Fraud Alerts Stream
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
                    {alerts.length} ALERTS
                  </span>
                </h2>
              </div>
              <span className="text-[11px] font-mono text-gray-400">
                Connected to /fraud-detector-api/stream
              </span>
            </div>

            {alerts.length === 0 ? (
              <div className="p-8 rounded-2xl bg-black/40 border border-white/5 text-center flex flex-col items-center justify-center">
                <ShieldCheck size={36} className="text-gray-600 mb-2" />
                <p className="text-xs text-gray-400 font-bold">No active fraud flags detected</p>
                <p className="text-[11px] text-gray-600 mt-0.5">
                  The automated shield is monitoring all wagers in real time.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
                {alerts.map((alert) => (
                  <div
                    key={String(alert.id)}
                    className="p-3.5 rounded-2xl bg-black/60 border border-red-500/30 hover:border-red-500/60 transition-all flex flex-col justify-between space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
                          <AlertOctagon size={15} />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            @{alert.username || alert.userId}
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/30 text-red-300 font-mono">
                              {alert.severity || "HIGH"}
                            </span>
                          </span>
                          <span className="text-[10px] font-mono text-gray-400">
                            ID: {String(alert.userId).slice(0, 16)}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-gray-500 whitespace-nowrap">
                        {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : "Just now"}
                      </span>
                    </div>

                    <div className="text-xs text-gray-300 font-mono bg-[#161619] p-2.5 rounded-xl border border-white/5">
                      {alert.reason}
                    </div>

                    {/* BAN ACTION BUTTON DIRECTLY ON ALERT */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
                      <span className="text-[10px] text-gray-500 font-mono uppercase">
                        Action Required
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleBanUser(alert.userId, alert.username)}
                          disabled={actionInProgressId === alert.userId}
                          className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/40 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Ban size={11} />
                          <span>Ban User</span>
                        </button>
                        <button
                          onClick={() => handleClearFlag(alert.userId)}
                          disabled={actionInProgressId === alert.userId}
                          className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 text-[11px] font-medium transition-all cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* USER LIST WITH BAN ACTION BUTTONS */}
          <div className="p-5 rounded-3xl bg-[#121215] border border-white/15 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <Users size={18} className="text-[var(--jungle-green)]" />
                  Registered Racers Dossier
                </h2>
                <p className="text-xs text-gray-400">
                  Inspect user profiles, audit betting frequency, and execute immediate security bans.
                </p>
              </div>

              {/* SEARCH & FILTER CONTROLS */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search racers, phone, ID..."
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-black/70 border border-white/15 focus:border-[var(--jungle-green)] text-xs text-white placeholder-gray-500 font-mono focus:outline-none w-44 sm:w-56"
                  />
                </div>

                <div className="flex items-center rounded-xl bg-black/60 p-1 border border-white/10 text-xs">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      statusFilter === "all" ? "bg-white/15 text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    All ({allUsers.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("flagged")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      statusFilter === "flagged" ? "bg-amber-500/20 text-amber-300" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Flagged ({flaggedUsers.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("banned")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      statusFilter === "banned" ? "bg-red-500/20 text-red-300" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Banned ({bannedCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter("clean")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      statusFilter === "clean" ? "bg-[var(--jungle-green)]/20 text-[var(--jungle-green)]" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Clean
                  </button>
                </div>
              </div>
            </div>

            {/* USERS TABLE */}
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/80 text-[10px] font-mono uppercase tracking-wider text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="p-3">Racer Identity</th>
                    <th className="p-3">Balance</th>
                    <th className="p-3">Fraud Status</th>
                    <th className="p-3">Anomaly Audit Reason</th>
                    <th className="p-3 text-right">Ban Action Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-[#0e0e11]">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500 font-mono">
                        No racers found matching the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                        {/* USER IDENTITY */}
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-sm font-bold text-gray-300 shrink-0">
                              {user.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-white">
                                <span>{user.name}</span>
                                {user.role === "admin" && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold">
                                    ADMIN
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] font-mono text-gray-400">
                                <span>{user.phone || user.email || user.id}</span>
                                <button
                                  onClick={() => copyUserId(user.id)}
                                  className="text-gray-500 hover:text-gray-300"
                                  title="Copy ID"
                                >
                                  {copiedId === user.id ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* BALANCE */}
                        <td className="p-3 font-mono font-bold text-white">
                          ${Number(user.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        {/* STATUS BADGE */}
                        <td className="p-3">
                          {user.isBanned ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-black uppercase">
                              <Ban size={10} />
                              BANNED
                            </span>
                          ) : user.isFlagged ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase animate-pulse">
                              <AlertTriangle size={10} />
                              SUSPICIOUS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--jungle-green)]/15 text-[var(--jungle-green)] border border-[var(--jungle-green)]/30 text-[10px] font-bold uppercase">
                              <ShieldCheck size={10} />
                              CLEAN
                            </span>
                          )}
                        </td>

                        {/* AUDIT REASON */}
                        <td className="p-3 font-mono text-[11px] text-gray-300 max-w-xs truncate">
                          {user.flagReason || <span className="text-gray-600">—</span>}
                        </td>

                        {/* BAN ACTION BUTTON */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {user.isBanned ? (
                              <button
                                onClick={() => handleUnbanUser(user.id, user.name)}
                                disabled={actionInProgressId === user.id}
                                className="px-3 py-1.5 rounded-xl bg-[var(--jungle-green)]/20 hover:bg-[var(--jungle-green)]/30 border border-[var(--jungle-green)]/40 text-[var(--jungle-green)] font-extrabold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <UserCheck size={12} />
                                <span>Unban User</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleBanUser(user.id, user.name)}
                                disabled={actionInProgressId === user.id}
                                className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 font-extrabold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-[0_0_10px_rgba(239,68,68,0.15)] active:scale-95"
                              >
                                <Ban size={12} />
                                <span>Ban User</span>
                              </button>
                            )}

                            {user.isFlagged && (
                              <button
                                onClick={() => handleClearFlag(user.id)}
                                disabled={actionInProgressId === user.id}
                                title="Dismiss Flag"
                                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                              >
                                <Check size={13} />
                              </button>
                            )}

                            <button
                              onClick={() => setInspectUser(user)}
                              title="Inspect Details"
                              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                            >
                              <Eye size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT DOSSIER MODAL */}
      <AnimatePresence>
        {inspectUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-md p-6 rounded-3xl bg-[#121215] border border-white/20 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-black uppercase text-white flex items-center gap-2">
                  <ShieldAlert size={16} className="text-red-400" />
                  Racer Security Dossier
                </h3>
                <button
                  onClick={() => setInspectUser(null)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2.5 text-xs font-mono">
                <div>
                  <span className="text-gray-500 block">User Name:</span>
                  <span className="text-white font-bold text-sm">{inspectUser.name}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">User ID:</span>
                  <span className="text-gray-300">{inspectUser.id}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Phone / Contact:</span>
                  <span className="text-gray-300">{inspectUser.phone || inspectUser.email || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Wallet Balance:</span>
                  <span className="text-[var(--jungle-green)] font-bold">
                    ${Number(inspectUser.balance || 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Security Status:</span>
                  <span className={inspectUser.isBanned ? "text-red-400 font-bold" : inspectUser.isFlagged ? "text-amber-400 font-bold" : "text-green-400 font-bold"}>
                    {inspectUser.isBanned ? "BANNED FROM BETTING" : inspectUser.isFlagged ? "SUSPICIOUS / UNDER AUDIT" : "CLEAN"}
                  </span>
                </div>
                {inspectUser.flagReason && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                    <span className="text-red-400 block font-bold mb-1">Audit Flag Trigger:</span>
                    <span className="text-gray-200">{inspectUser.flagReason}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/10">
                {inspectUser.isBanned ? (
                  <button
                    onClick={() => {
                      handleUnbanUser(inspectUser.id, inspectUser.name);
                      setInspectUser(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-[var(--jungle-green)] text-black font-extrabold text-xs"
                  >
                    Unban Account
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleBanUser(inspectUser.id, inspectUser.name);
                      setInspectUser(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs"
                  >
                    Execute Ban
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
