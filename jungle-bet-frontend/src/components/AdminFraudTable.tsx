"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Download,
  Eye,
  X,
  CheckCircle2,
  DollarSign,
  Zap,
  ArrowUpDown,
  Copy,
  Check,
  SlidersHorizontal,
  TrendingUp,
  AlertOctagon,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { JungleUser } from "@/lib/auth-user-service";

export interface AdminFraudTableProps {
  initialUsers?: JungleUser[];
  flaggedUsers?: JungleUser[];
  totalUsersCount?: number;
  bannedCount?: number;
  isLoading?: boolean;
  onRefresh?: () => Promise<void> | void;
  onBanUser?: (userId: string, userName: string) => Promise<void> | void;
  onUnbanUser?: (userId: string, userName: string) => Promise<void> | void;
  onClearFlag?: (userId: string) => Promise<void> | void;
  onSimulate?: (type: "rapid_bets" | "large_win") => Promise<void> | void;
  showSimulators?: boolean;
  showMetrics?: boolean;
  showExport?: boolean;
  className?: string;
}

type FilterStatus = "all" | "suspicious" | "banned" | "all_users";
type SortOption = "flagged_desc" | "flagged_asc" | "balance_desc" | "balance_asc" | "name_asc";

export default function AdminFraudTable({
  initialUsers,
  flaggedUsers: propFlaggedUsers,
  totalUsersCount: propTotalCount,
  bannedCount: propBannedCount,
  isLoading: propIsLoading,
  onRefresh,
  onBanUser,
  onUnbanUser,
  onClearFlag,
  onSimulate,
  showSimulators = true,
  showMetrics = true,
  showExport = true,
  className = "",
}: AdminFraudTableProps) {
  // Internal state when used standalone
  const [internalAllUsers, setInternalAllUsers] = useState<JungleUser[]>([]);
  const [internalFlaggedUsers, setInternalFlaggedUsers] = useState<JungleUser[]>([]);
  const [internalTotalCount, setInternalTotalCount] = useState(0);
  const [internalBannedCount, setInternalBannedCount] = useState(0);
  const [internalLoading, setInternalLoading] = useState(false);

  // Filtering & Sorting state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [anomalyFilter, setAnomalyFilter] = useState<string>("all");
  const [sortOption, setSortOption] = useState<SortOption>("flagged_desc");

  // Selection & Modal states
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [inspectUser, setInspectUser] = useState<JungleUser | null>(null);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Self-fetch if props not supplied
  const isControlled = propFlaggedUsers !== undefined;

  const fetchInternalData = useCallback(async () => {
    setInternalLoading(true);
    try {
      const res = await axios.get("/api/admin/flagged", {
        headers: { "x-admin-key": "jungleadmin2026" },
      });
      const data = res.data;
      setInternalAllUsers(data.allUsers || []);
      setInternalFlaggedUsers(data.flaggedUsers || []);
      setInternalTotalCount(data.totalUsers || 0);
      setInternalBannedCount(data.bannedCount || 0);
    } catch {
      toast.error("Failed to fetch fraud shield data");
    } finally {
      setInternalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isControlled) {
      let isSubscribed = true;
      axios.get("/api/admin/flagged", {
        headers: { "x-admin-key": "jungleadmin2026" },
      }).then((res) => {
        if (!isSubscribed) return;
        const data = res.data;
        setInternalAllUsers(data.allUsers || []);
        setInternalFlaggedUsers(data.flaggedUsers || []);
        setInternalTotalCount(data.totalUsers || 0);
        setInternalBannedCount(data.bannedCount || 0);
      }).catch(() => {
        if (isSubscribed) toast.error("Failed to fetch fraud shield data");
      });
      return () => {
        isSubscribed = false;
      };
    }
  }, [isControlled]);

  const allUsers = useMemo(
    () => (isControlled ? initialUsers || [] : internalAllUsers),
    [isControlled, initialUsers, internalAllUsers]
  );
  const flaggedUsers = useMemo(
    () => (isControlled ? propFlaggedUsers || [] : internalFlaggedUsers),
    [isControlled, propFlaggedUsers, internalFlaggedUsers]
  );
  const totalCount = isControlled ? propTotalCount || 0 : internalTotalCount;
  const bannedCount = isControlled ? propBannedCount || 0 : internalBannedCount;
  const isLoading = isControlled ? !!propIsLoading : internalLoading;

  // Handlers for ban, unban, clear flag
  const handleBan = async (user: JungleUser) => {
    setActionInProgressId(user.id);
    try {
      if (onBanUser) {
        await onBanUser(user.id, user.name);
      } else {
        const res = await axios.post("/api/admin/ban", { userId: user.id, action: "ban" });
        if (res.data.success) {
          toast.error(`ACCOUNT BANNED: ${user.name} barred from betting.`);
          fetchInternalData();
        }
      }
    } catch {
      toast.error(`Failed to ban ${user.name}`);
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleUnban = async (user: JungleUser) => {
    setActionInProgressId(user.id);
    try {
      if (onUnbanUser) {
        await onUnbanUser(user.id, user.name);
      } else {
        const res = await axios.post("/api/admin/ban", { userId: user.id, action: "unban" });
        if (res.data.success) {
          toast.success(`ACCOUNT RESTORED: ${user.name} unbanned.`);
          fetchInternalData();
        }
      }
    } catch {
      toast.error(`Failed to unban ${user.name}`);
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleClearFlag = async (user: JungleUser) => {
    setActionInProgressId(user.id);
    try {
      if (onClearFlag) {
        await onClearFlag(user.id);
      } else {
        const res = await axios.post("/api/admin/ban", { userId: user.id, action: "unflag" });
        if (res.data.success) {
          toast.info(`Flag cleared for ${user.name}.`);
          fetchInternalData();
        }
      }
    } catch {
      toast.error("Failed to dismiss flag");
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleRefresh = async () => {
    if (onRefresh) {
      await onRefresh();
    } else {
      await fetchInternalData();
    }
    toast.success("Security metrics refreshed");
  };

  const handleSimulateAction = async (type: "rapid_bets" | "large_win") => {
    try {
      if (onSimulate) {
        await onSimulate(type);
      } else {
        const targetUserId = allUsers[0]?.id || "usr_demo_vip_001";
        const res = await axios.post("/api/admin/simulate", {
          type,
          userId: targetUserId,
        });
        if (res.data.success) {
          toast.warning(res.data.message);
          fetchInternalData();
        }
      }
    } catch {
      toast.error("Simulation failed");
    }
  };

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.info("Copied to clipboard");
  };

  // Base list depending on status filter
  const baseList = useMemo(() => {
    if (statusFilter === "all_users") return allUsers;
    if (statusFilter === "banned") return flaggedUsers.filter((u) => u.isBanned);
    if (statusFilter === "suspicious") return flaggedUsers.filter((u) => u.isFlagged && !u.isBanned);
    return flaggedUsers;
  }, [statusFilter, flaggedUsers, allUsers]);

  // Filtered & Sorted list
  const filteredUsers = useMemo(() => {
    let list = [...baseList];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((u) => {
        const name = (u.name || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const phone = (u.phone || "").toLowerCase();
        const id = (u.id || "").toLowerCase();
        const reason = (u.flagReason || "").toLowerCase();
        return (
          name.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          id.includes(q) ||
          reason.includes(q)
        );
      });
    }

    // Anomaly filter
    if (anomalyFilter !== "all") {
      if (anomalyFilter === "rapid_bets") {
        list = list.filter((u) => (u.flagReason || "").toLowerCase().includes("bets"));
      } else if (anomalyFilter === "large_win") {
        list = list.filter((u) => (u.flagReason || "").toLowerCase().includes("win"));
      } else if (anomalyFilter === "manual") {
        list = list.filter((u) => (u.flagReason || "").toLowerCase().includes("manual"));
      }
    }

    // Sorting
    list.sort((a, b) => {
      if (sortOption === "balance_desc") return (b.balance || 0) - (a.balance || 0);
      if (sortOption === "balance_asc") return (a.balance || 0) - (b.balance || 0);
      if (sortOption === "name_asc") return (a.name || "").localeCompare(b.name || "");
      if (sortOption === "flagged_asc") {
        const tA = a.flaggedAt ? new Date(a.flaggedAt).getTime() : 0;
        const tB = b.flaggedAt ? new Date(b.flaggedAt).getTime() : 0;
        return tA - tB;
      }
      // default: flagged_desc
      const tA = a.flaggedAt ? new Date(a.flaggedAt).getTime() : 0;
      const tB = b.flaggedAt ? new Date(b.flaggedAt).getTime() : 0;
      return tB - tA;
    });

    return list;
  }, [baseList, searchQuery, anomalyFilter, sortOption]);

  // Bulk actions
  const toggleSelectAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  const toggleSelectUser = (id: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedUserIds(next);
  };

  const handleBulkBan = async () => {
    if (selectedUserIds.size === 0) return;
    const count = selectedUserIds.size;
    for (const id of Array.from(selectedUserIds)) {
      const u = allUsers.find((x) => x.id === id);
      if (u && !u.isBanned) {
        await handleBan(u);
      }
    }
    setSelectedUserIds(new Set());
    toast.error(`Bulk action complete: Processed ${count} accounts.`);
  };

  const handleBulkDismiss = async () => {
    if (selectedUserIds.size === 0) return;
    for (const id of Array.from(selectedUserIds)) {
      const u = allUsers.find((x) => x.id === id);
      if (u) {
        await handleClearFlag(u);
      }
    }
    setSelectedUserIds(new Set());
    toast.info("Bulk dismissal complete.");
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ["ID", "Name", "Phone", "Email", "Balance", "Status", "FlagReason", "FlaggedAt"];
    const rows = filteredUsers.map((u) => [
      u.id,
      `"${u.name}"`,
      `"${u.phone || ""}"`,
      `"${u.email || ""}"`,
      (u.balance || 0).toFixed(2),
      u.isBanned ? "BANNED" : u.isFlagged ? "SUSPICIOUS" : "CLEAN",
      `"${(u.flagReason || "").replace(/"/g, '""')}"`,
      u.flaggedAt || "",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `jungle_bet_fraud_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Fraud audit CSV downloaded successfully");
  };

  // Calculate total balance at risk
  const totalBalanceAtRisk = useMemo(() => {
    return flaggedUsers.reduce((sum, u) => sum + (u.balance || 0), 0);
  }, [flaggedUsers]);

  return (
    <div className={`w-full space-y-6 ${className}`}>
      {/* ------------------------------------------------------------- */}
      {/* METRIC OVERVIEW CARDS                                         */}
      {/* ------------------------------------------------------------- */}
      {showMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[#121215] border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1.5">
              <UserCheck size={13} className="text-blue-400" /> Monitored Accounts
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-1.5">
              {totalCount}
            </div>
            <span className="text-[10px] text-gray-500 font-mono">Active in DB registry</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#121215] border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/20 transition-colors" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 flex items-center gap-1.5">
              <AlertTriangle size={13} /> Flagged Suspicious
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400 mt-1.5">
              {flaggedUsers.length}
            </div>
            <span className="text-[10px] text-amber-500/80 font-mono">Pending investigation</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#121215] border border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-red-500/20 transition-colors" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-red-400 flex items-center gap-1.5">
              <Ban size={13} /> Banned Accounts
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-red-400 mt-1.5">
              {bannedCount}
            </div>
            <span className="text-[10px] text-red-400/80 font-mono">Wagering revoked</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#121215] border border-[var(--jungle-green)]/30 shadow-[0_0_20px_rgba(204,255,0,0.08)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--jungle-green)]/10 rounded-full blur-xl pointer-events-none group-hover:bg-[var(--jungle-green)]/15 transition-colors" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--jungle-green)] flex items-center gap-1.5">
              <DollarSign size={13} /> Value At Risk
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-1.5">
              ${totalBalanceAtRisk.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-[var(--jungle-green)]/80 font-mono">Flagged balances sum</span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SIMULATOR ACTION BAR                                          */}
      {/* ------------------------------------------------------------- */}
      {showSimulators && (
        <div className="p-4 rounded-2xl bg-black/60 border border-[var(--jungle-green)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_25px_rgba(204,255,0,0.1)]">
          <div>
            <span className="text-xs font-black uppercase text-[var(--jungle-green)] flex items-center gap-1.5">
              <Zap size={14} /> Automated Fraud Logic Hook Simulator
            </span>
            <p className="text-[11px] text-gray-400">
              Instantly test backend triggers: &gt;5 bets/min anomaly or &gt;$1,000 instant payout anomaly.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleSimulateAction("rapid_bets")}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <TrendingUp size={13} />
              <span>Test &gt;5 Bets/Min Flag</span>
            </button>
            <button
              onClick={() => handleSimulateAction("large_win")}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--jungle-green)]/15 hover:bg-[var(--jungle-green)]/25 border border-[var(--jungle-green)]/40 text-[var(--jungle-green)] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <DollarSign size={13} />
              <span>Test &gt;$1000 Win Flag</span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MAIN FRAUD TABLE CONTAINER                                    */}
      {/* ------------------------------------------------------------- */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#121215] border border-white/15 shadow-2xl space-y-5">
        {/* TOP TOOLBAR: TITLE & ACTIONS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400">
                <ShieldAlert size={18} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                  Suspicious Accounts & Risk Audit
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
                    {filteredUsers.length} RESULTS
                  </span>
                </h2>
                <p className="text-xs text-gray-400">
                  Real-time algorithmic risk monitor, tripwire anomalies, and rapid bet protection
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            {showExport && (
              <button
                onClick={handleExportCSV}
                disabled={filteredUsers.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Download CSV Audit"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            )}

            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-bold transition-all cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* SEARCH & FILTER CONTROLS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* SEARCH BAR */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user, phone, email, reason..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-black/70 border border-white/15 focus:border-[var(--jungle-green)] text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* STATUS FILTER */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-white/15 focus:border-[var(--jungle-green)] text-xs text-white focus:outline-none transition-colors appearance-none cursor-pointer"
            >
              <option value="all">Status: All Flagged ({flaggedUsers.length})</option>
              <option value="suspicious">Status: Suspicious Only ({flaggedUsers.filter((u) => !u.isBanned).length})</option>
              <option value="banned">Status: Banned Only ({flaggedUsers.filter((u) => u.isBanned).length})</option>
              <option value="all_users">Status: All System Users ({allUsers.length})</option>
            </select>
            <Filter size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* ANOMALY TYPE FILTER */}
          <div className="relative">
            <select
              value={anomalyFilter}
              onChange={(e) => setAnomalyFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-white/15 focus:border-[var(--jungle-green)] text-xs text-white focus:outline-none transition-colors appearance-none cursor-pointer"
            >
              <option value="all">Anomaly: All Triggers</option>
              <option value="rapid_bets">Frequency (&gt;5 Bets/min)</option>
              <option value="large_win">High Instant Win (&gt;$1k)</option>
              <option value="manual">Manual Audit Review</option>
            </select>
            <SlidersHorizontal size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* SORT ORDER */}
          <div className="relative">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-white/15 focus:border-[var(--jungle-green)] text-xs text-white focus:outline-none transition-colors appearance-none cursor-pointer"
            >
              <option value="flagged_desc">Sort: Newest Flagged</option>
              <option value="flagged_asc">Sort: Oldest Flagged</option>
              <option value="balance_desc">Sort: Highest Balance</option>
              <option value="balance_asc">Sort: Lowest Balance</option>
              <option value="name_asc">Sort: Name (A to Z)</option>
            </select>
            <ArrowUpDown size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* BULK ACTION BAR */}
        {selectedUserIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">
                {selectedUserIds.size} {selectedUserIds.size === 1 ? "account" : "accounts"} selected
              </span>
              <button
                onClick={() => setSelectedUserIds(new Set())}
                className="text-gray-400 hover:text-white underline text-[11px]"
              >
                Clear selection
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkBan}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-extrabold uppercase text-[10px] tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-md"
              >
                <Ban size={11} />
                <span>Bulk Ban</span>
              </button>
              <button
                onClick={handleBulkDismiss}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 text-[10px] font-bold transition-all cursor-pointer"
              >
                Bulk Dismiss
              </button>
            </div>
          </motion.div>
        )}

        {/* DATA TABLE */}
        {filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[var(--jungle-green)]/10 border border-[var(--jungle-green)]/30 flex items-center justify-center text-[var(--jungle-green)] shadow-[0_0_20px_rgba(204,255,0,0.1)]">
              <ShieldCheck size={32} />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">No Flagged Accounts Match Filter</p>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                {searchQuery || statusFilter !== "all" || anomalyFilter !== "all"
                  ? "Try clearing filters or search query to view all tracked users."
                  : "All accounts are in good standing. Use the simulator bar above to test real-time triggers."}
              </p>
            </div>
            {(searchQuery || statusFilter !== "all" || anomalyFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setAnomalyFilter("all");
                }}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-gray-300 font-bold transition-colors cursor-pointer mt-1"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/30">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-black/50 text-gray-400 font-mono uppercase tracking-wider text-[10px]">
                  <th className="py-3 pl-3 w-8">
                    <input
                      type="checkbox"
                      checked={
                        filteredUsers.length > 0 &&
                        selectedUserIds.size === filteredUsers.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded bg-black border-white/20 accent-[var(--jungle-green)] cursor-pointer"
                      title="Select all"
                    />
                  </th>
                  <th className="py-3 px-3">User Profile</th>
                  <th className="py-3 px-3">Balance</th>
                  <th className="py-3 px-3">Flag Trigger Reason</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Risk Status</th>
                  <th className="py-3 pr-3 text-right">Shield Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {filteredUsers.map((u) => {
                  const isBanned = !!u.isBanned;
                  const isSelected = selectedUserIds.has(u.id);
                  const isProcessing = actionInProgressId === u.id;

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-white/[0.03] transition-colors ${
                        isSelected ? "bg-red-500/5" : ""
                      }`}
                    >
                      {/* CHECKBOX */}
                      <td className="py-3.5 pl-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectUser(u.id)}
                          className="rounded bg-black border-white/20 accent-[var(--jungle-green)] cursor-pointer"
                        />
                      </td>

                      {/* USER PROFILE */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center font-bold text-xs uppercase text-white shrink-0">
                            {u.name.slice(0, 2)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-extrabold text-white text-xs flex items-center gap-1.5">
                              {u.name}
                              {u.role === "admin" && (
                                <span className="text-[9px] font-mono px-1 rounded bg-[var(--jungle-green)]/20 text-[var(--jungle-green)] font-bold">
                                  ADMIN
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-1 font-mono text-[10px] text-gray-400">
                              <span>{u.phone || u.email || u.id}</span>
                              <button
                                onClick={() => handleCopy(u.phone || u.email || u.id, u.id)}
                                className="text-gray-500 hover:text-white transition-colors"
                                title="Copy identifier"
                              >
                                {copiedId === u.id ? <Check size={10} className="text-[var(--jungle-green)]" /> : <Copy size={10} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* BALANCE */}
                      <td className="py-3.5 px-3 font-mono font-bold">
                        <span className={u.balance > 1000 ? "text-[var(--jungle-green)]" : "text-white"}>
                          ${(u.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* FLAG TRIGGER REASON */}
                      <td className="py-3.5 px-3 max-w-xs">
                        <div className="flex items-start gap-1.5">
                          <AlertOctagon size={13} className="text-amber-400 shrink-0 mt-0.5" />
                          <span className="text-amber-300 font-medium text-[11px] leading-tight">
                            {u.flagReason || "Manual security audit review"}
                          </span>
                        </div>
                      </td>

                      {/* FLAGGED AT */}
                      <td className="py-3.5 px-3 font-mono text-[10px] text-gray-400 whitespace-nowrap">
                        {u.flaggedAt ? (
                          <div className="flex flex-col">
                            <span>{new Date(u.flaggedAt).toLocaleDateString()}</span>
                            <span className="text-gray-500">
                              {new Date(u.flaggedAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500">Historical</span>
                        )}
                      </td>

                      {/* STATUS BADGE */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {isBanned ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 text-[9px] font-mono font-black uppercase shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                            <Ban size={10} /> BANNED
                          </span>
                        ) : u.isFlagged ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[9px] font-mono font-black uppercase shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                            <AlertTriangle size={10} /> SUSPICIOUS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-mono font-black uppercase">
                            <CheckCircle2 size={10} /> CLEAN
                          </span>
                        )}
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3.5 pr-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* INSPECT DETAILS BUTTON */}
                          <button
                            onClick={() => setInspectUser(u)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
                            title="Inspect Fraud Audit"
                          >
                            <Eye size={13} />
                          </button>

                          {/* BAN / UNBAN BUTTON */}
                          {isBanned ? (
                            <button
                              onClick={() => handleUnban(u)}
                              disabled={isProcessing}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 disabled:opacity-50"
                            >
                              <UserCheck size={12} />
                              <span>Unban</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBan(u)}
                              disabled={isProcessing}
                              className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <Ban size={12} />
                              <span>BAN USER</span>
                            </button>
                          )}

                          {/* DISMISS FLAG BUTTON */}
                          {u.isFlagged && (
                            <button
                              onClick={() => handleClearFlag(u)}
                              disabled={isProcessing}
                              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs transition-colors cursor-pointer disabled:opacity-50"
                              title="Dismiss flag & whitelist"
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* USER AUDIT INSPECTOR MODAL                                    */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {inspectUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-lg rounded-3xl bg-[#121215] border border-white/20 shadow-2xl p-6 overflow-hidden space-y-5"
            >
              {/* MODAL HEADER */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                    <ShieldAlert size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase text-white tracking-wider">
                      Fraud Dossier Audit
                    </h3>
                    <span className="font-mono text-xs text-gray-400">
                      ID: {inspectUser.id}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setInspectUser(null)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* DOSSIER BODY */}
              <div className="space-y-4 text-xs">
                {/* USER PROFILE INFO */}
                <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-gray-500 block">Name</span>
                    <span className="font-bold text-white text-sm">{inspectUser.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-gray-500 block">Wallet Balance</span>
                    <span className="font-bold font-mono text-[var(--jungle-green)] text-sm">
                      ${(inspectUser.balance || 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-gray-500 block">Contact Phone</span>
                    <span className="font-mono text-gray-300">{inspectUser.phone || "None registered"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-gray-500 block">Contact Email</span>
                    <span className="font-mono text-gray-300">{inspectUser.email || "None registered"}</span>
                  </div>
                </div>

                {/* ANOMALY REPORT */}
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                  <span className="text-[10px] font-black uppercase font-mono text-amber-400 flex items-center gap-1">
                    <AlertTriangle size={12} /> Algorithmic Trigger Detail
                  </span>
                  <p className="text-amber-200 font-medium leading-relaxed">
                    {inspectUser.flagReason || "Account flagged during automated optical wagering monitoring."}
                  </p>
                  {inspectUser.flaggedAt && (
                    <span className="text-[10px] font-mono text-amber-400/80 block mt-1">
                      Triggered at: {new Date(inspectUser.flaggedAt).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* STATUS & ACTIONS */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Current Status:</span>
                    {inspectUser.isBanned ? (
                      <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 font-mono font-bold text-[10px]">
                        BANNED
                      </span>
                    ) : inspectUser.isFlagged ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 font-mono font-bold text-[10px]">
                        SUSPICIOUS
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[10px]">
                        CLEAN
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {inspectUser.isBanned ? (
                      <button
                        onClick={async () => {
                          await handleUnban(inspectUser);
                          setInspectUser((prev) => (prev ? { ...prev, isBanned: false } : null));
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 font-bold transition-all cursor-pointer"
                      >
                        Restore & Unban
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          await handleBan(inspectUser);
                          setInspectUser((prev) => (prev ? { ...prev, isBanned: true } : null));
                        }}
                        className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-lg"
                      >
                        Ban User Now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
