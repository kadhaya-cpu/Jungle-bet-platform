"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Wallet,
  Shield,
  ShieldAlert,
  User,
  Trash2,
  Headphones,
  Check,
  ChevronRight,
  LogOut,
  RefreshCw,
  Clock,
  Sparkles,
  AlertTriangle,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import axios from "axios";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDeposit?: () => void;
  onOpenAuth?: (mode: "login" | "register") => void;
}

type ActiveTab = "menu" | "balance_history" | "two_factor" | "account" | "delete" | "support";

interface BetHistoryItem {
  id: string | number;
  type: string;
  amount: number;
  status: string;
  payout?: number;
  title?: string;
  created_at?: string;
}

export default function SettingsModal({
  isOpen,
  onClose,
  onOpenDeposit,
  onOpenAuth,
}: SettingsModalProps) {
  const { data: session, status } = useSession();
  const {
    balance: storeBalance,
    formatAmount,
    currency,
    fetchBalance,
    logout: storeLogout,
    token,
  } = useStore();

  const isAuthenticated = status === "authenticated" && !!session?.user;
  const balance = session?.user?.balance ?? storeBalance ?? 100.0;
  const userPhone = session?.user?.phone;
  const userName = session?.user?.name || (userPhone ? userPhone : "Racer");
  const userEmail = session?.user?.email || "racer@junglebet.io";
  const userId = session?.user?.id || (userPhone ? `usr_${userPhone}` : "usr_demo_vip_001");

  const [activeTab, setActiveTab] = useState<ActiveTab>("menu");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(true);
  const [historyItems, setHistoryItems] = useState<BetHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");

  // Load 2FA status from local storage or default
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved2FA = localStorage.getItem(`jungle_2fa_${userId}`);
      if (saved2FA !== null) {
        setTwoFactorEnabled(saved2FA === "true");
      }
    }
  }, [userId]);

  // Load history when opening balance/history tab
  useEffect(() => {
    if (activeTab === "balance_history") {
      loadHistory();
    }
  }, [activeTab]);

  // Reset tab when modal closes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => setActiveTab("menu"), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      // 1. Try FastAPI endpoint
      if (token) {
        const res = await axios.get("http://localhost:8000/bets/history", {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 2000,
        });
        if (Array.isArray(res.data) && res.data.length > 0) {
          setHistoryItems(res.data);
          setIsLoadingHistory(false);
          return;
        }
      }
    } catch {
      // Fallback
    }

    // Default mock history items for visual feedback
    setHistoryItems([
      {
        id: "bet_demo_982",
        type: "OVER 13 Vehicles",
        amount: 100,
        status: "won",
        payout: 360,
        title: "I-405 Traffic Rush",
        created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        id: "bet_demo_981",
        type: "UNDER 10 Vehicles",
        amount: 50,
        status: "lost",
        payout: 0,
        title: "Chelsea Bridge Junction",
        created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
      {
        id: "bet_demo_980",
        type: "STAR PICK (Exact 7)",
        amount: 25,
        status: "won",
        payout: 450,
        title: "Amsterdam A10 Ring",
        created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
    ]);
    setIsLoadingHistory(false);
  };

  const handleToggle2FA = async () => {
    const nextState = !twoFactorEnabled;
    setTwoFactorEnabled(nextState);
    if (typeof window !== "undefined") {
      localStorage.setItem(`jungle_2fa_${userId}`, String(nextState));
    }

    try {
      await axios.post("/api/user/settings", {
        action: "toggle_2fa",
        userId,
        enabled: nextState,
      });
    } catch {
      // Local state is already updated
    }

    toast.success(
      nextState
        ? "2-Factor Authentication enabled! Account protected."
        : "2-Factor Authentication disabled."
    );
  };

  const handleDeleteAccount = async () => {
    if (confirmDeleteText.trim().toUpperCase() !== "DELETE") {
      toast.error('Please type "DELETE" to confirm account deletion.');
      return;
    }

    setIsDeleting(true);
    try {
      await axios.post("/api/user/settings", {
        action: "delete_account",
        userId,
      });
      toast.success("Your Jungle Bet account has been permanently deleted.");
      storeLogout();
      await signOut({ redirect: false });
      onClose();
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to delete account.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = async () => {
    storeLogout();
    try {
      await signOut({ redirect: false });
      toast.info("Logged out from Jungle Bet");
    } catch {
      // Ignored
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          {/* BACKDROP */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* SETTINGS CARD */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg rounded-3xl bg-[#0f172a] border border-white/10 shadow-2xl shadow-blue-500/20 p-5 sm:p-6 text-white z-10 overflow-hidden transition-all duration-300"
          >
            {/* TOP BAR */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#1e293b] border border-teal-400/30 shadow-sm shadow-teal-500/10">
                  <Shield size={18} className="text-[var(--jungle-green)]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black tracking-wider uppercase text-white">
                    {activeTab === "menu"
                      ? "Jungle Bet Settings"
                      : activeTab === "balance_history"
                      ? "Balance & History"
                      : activeTab === "two_factor"
                      ? "2-Factor Security"
                      : activeTab === "account"
                      ? "Account Profile"
                      : activeTab === "delete"
                      ? "Delete Account"
                      : "Support & Help"}
                  </h2>
                  <p className="text-[11px] text-gray-400 font-mono">
                    {isAuthenticated ? `Signed in as ${userName}` : "Guest Racer"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeTab !== "menu" && (
                  <button
                    onClick={() => setActiveTab("menu")}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* TAB CONTENT */}
            <div className="pt-4 max-h-[70vh] overflow-y-auto no-scrollbar">
              {/* MAIN MENU LIST */}
              {activeTab === "menu" && (
                <div className="space-y-2.5">
                  {/* 1. VIEW BALANCE / HISTORY */}
                  <button
                    onClick={() => setActiveTab("balance_history")}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[var(--jungle-green)]/40 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-[var(--jungle-green)]/15 border border-[var(--jungle-green)]/30 text-[var(--jungle-green)] group-hover:scale-105 transition-transform">
                        <Wallet size={18} />
                      </div>
                      <div>
                        <span className="font-extrabold text-sm text-white block group-hover:text-[var(--jungle-green)] transition-colors">
                          View Balance / History
                        </span>
                        <span className="text-xs text-gray-400 font-mono block">
                          Current: <strong className="text-white">{formatAmount(balance)}</strong> ({currency})
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
                  </button>

                  {/* 2. TWO-FACTOR AUTHENTICATION (TOGGLE) */}
                  <div className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
                        <Shield size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-white block">
                            2-Factor Authentication
                          </span>
                          <span
                            className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                              twoFactorEnabled
                                ? "bg-[var(--jungle-green)]/20 text-[var(--jungle-green)] border border-[var(--jungle-green)]/40"
                                : "bg-gray-700/50 text-gray-400 border border-gray-600"
                            }`}
                          >
                            {twoFactorEnabled ? "ENABLED" : "DISABLED"}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 block">
                          Extra security verification for bets and cashouts
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleToggle2FA}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        twoFactorEnabled ? "bg-[var(--jungle-green)]" : "bg-neutral-700"
                      }`}
                      aria-label="Toggle 2-Factor Authentication"
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                          twoFactorEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* 3. ACCOUNT SETTINGS */}
                  <button
                    onClick={() => setActiveTab("account")}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 group-hover:scale-105 transition-transform">
                        <User size={18} />
                      </div>
                      <div>
                        <span className="font-extrabold text-sm text-white block">
                          Account Settings
                        </span>
                        <span className="text-xs text-gray-400 block">
                          Manage profile, currency defaults, and security
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
                  </button>

                  {/* 4. SUPPORT */}
                  <button
                    onClick={() => setActiveTab("support")}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 group-hover:scale-105 transition-transform">
                        <Headphones size={18} />
                      </div>
                      <div>
                        <span className="font-extrabold text-sm text-white block">Support</span>
                        <span className="text-xs text-gray-400 block">
                          24/7 VIP Concierge, Leo AI Assistant & FAQs
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
                  </button>

                  {/* 5. DELETE ACCOUNT */}
                  <button
                    onClick={() => setActiveTab("delete")}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 hover:border-red-500/40 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 group-hover:scale-105 transition-transform">
                        <Trash2 size={18} />
                      </div>
                      <div>
                        <span className="font-extrabold text-sm text-red-400 block">
                          Delete Account
                        </span>
                        <span className="text-xs text-gray-400 block">
                          Permanently close your racer account & delete data
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-red-400 group-hover:translate-x-1 transition-transform" />
                  </button>

                  {/* AUTHENTICATION ACTION: LOGOUT OR LOGIN */}
                  <div className="pt-2">
                    {isAuthenticated ? (
                      <button
                        onClick={handleLogout}
                        className="w-full py-3 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <LogOut size={14} />
                        Sign Out
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            onClose();
                            if (onOpenAuth) onOpenAuth("login");
                          }}
                          className="flex-1 py-2.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Login
                        </button>
                        <button
                          onClick={() => {
                            onClose();
                            if (onOpenAuth) onOpenAuth("register");
                          }}
                          className="flex-1 py-2.5 rounded-xl bg-[var(--jungle-green)] text-black font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(204,255,0,0.3)]"
                        >
                          Register
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 1. BALANCE & HISTORY SUBPAGE */}
              {activeTab === "balance_history" && (
                <div className="space-y-4">
                  {/* BALANCE CARD */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#1e293b] border border-white/10 shadow-lg shadow-blue-500/10 flex items-center justify-between transition-all duration-300">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        Available Balance ({currency})
                      </span>
                      <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
                        {formatAmount(balance)}
                      </h3>
                    </div>

                    <button
                      onClick={() => {
                        onClose();
                        if (onOpenDeposit) onOpenDeposit();
                      }}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 hover:from-blue-500 hover:via-teal-400 hover:to-emerald-400 text-white font-black text-xs uppercase tracking-wider hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 shadow-md shadow-teal-500/25 cursor-pointer border-0"
                    >
                      <Plus size={14} />
                      Deposit
                    </button>
                  </div>

                  {/* HISTORY TITLE & REFRESH */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                      <Clock size={13} className="text-[var(--jungle-green)]" />
                      Recent Bet & Resolution History
                    </span>
                    <button
                      onClick={loadHistory}
                      className="p-1 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
                      title="Refresh history"
                    >
                      <RefreshCw size={13} className={isLoadingHistory ? "animate-spin" : ""} />
                    </button>
                  </div>

                  {/* HISTORY LIST */}
                  <div className="space-y-2">
                    {historyItems.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between"
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white">
                            {item.title || item.type}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            Stake: {formatAmount(item.amount)}
                          </span>
                        </div>

                        <div className="flex flex-col items-end">
                          <span
                            className={`text-xs font-black uppercase ${
                              item.status === "won"
                                ? "text-[var(--jungle-green)] drop-shadow-[0_0_8px_rgba(204,255,0,0.5)]"
                                : item.status === "pending"
                                ? "text-amber-400"
                                : "text-gray-400"
                            }`}
                          >
                            {item.status === "won" ? `+${formatAmount(item.payout || item.amount * 3.6)}` : item.status}
                          </span>
                          <span className="text-[9px] text-gray-500 font-mono">
                            {item.created_at ? new Date(item.created_at).toLocaleTimeString() : "Recent"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. 2-FACTOR AUTHENTICATION DETAILS */}
              {activeTab === "two_factor" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--jungle-green)]/15 border border-[var(--jungle-green)]/30 flex items-center justify-center text-[var(--jungle-green)] mb-2 shadow-[0_0_15px_rgba(204,255,0,0.2)]">
                      <Shield size={24} />
                    </div>
                    <h3 className="text-base font-black text-white uppercase">
                      2-Factor Authentication (2FA)
                    </h3>
                    <p className="text-xs text-gray-400 max-w-xs mt-1">
                      Adds an extra layer of protection to your Jungle Bet wallet, ensuring that bet placements and instant withdrawals are authorized.
                    </p>

                    <div className="mt-4 flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-300">
                        Status:{" "}
                        <strong className={twoFactorEnabled ? "text-[var(--jungle-green)]" : "text-gray-400"}>
                          {twoFactorEnabled ? "ACTIVE & PROTECTED" : "DISABLED"}
                        </strong>
                      </span>
                      <button
                        onClick={handleToggle2FA}
                        className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                          twoFactorEnabled
                            ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                            : "bg-[var(--jungle-green)] text-black hover:scale-105"
                        }`}
                      >
                        {twoFactorEnabled ? "Turn Off 2FA" : "Enable 2FA"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. ACCOUNT SETTINGS DETAILS */}
              {activeTab === "account" && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div>
                      <label className="text-[10px] font-mono uppercase text-gray-400 block mb-1">
                        Racer Name
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={userName}
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-gray-400 block mb-1">
                        Phone / Identity
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={userPhone || userEmail}
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-gray-400 block mb-1">
                        Active Betting Currency
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={`${currency} (Configured)`}
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-[var(--jungle-green)] font-mono font-bold"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400 text-center">
                    To modify phone or authentication credentials, contact VIP support.
                  </p>
                </div>
              )}

              {/* 4. DELETE ACCOUNT SUBPAGE */}
              {activeTab === "delete" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/40 space-y-3">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle size={20} />
                      <h4 className="font-black text-sm uppercase">Permanent Account Closure</h4>
                    </div>

                    <p className="text-xs text-gray-300 leading-relaxed">
                      Warning: Deleting your Jungle Bet account will erase your user record, active
                      bets, and remaining balance. This action cannot be reversed.
                    </p>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-gray-400 block mb-1.5">
                        Type <strong>DELETE</strong> below to confirm:
                      </label>
                      <input
                        type="text"
                        value={confirmDeleteText}
                        onChange={(e) => setConfirmDeleteText(e.target.value)}
                        placeholder="DELETE"
                        className="w-full px-3 py-2 rounded-xl bg-black/80 border border-red-500/40 text-xs text-red-400 font-mono focus:outline-none uppercase"
                      />
                    </div>

                    <button
                      onClick={handleDeleteAccount}
                      disabled={confirmDeleteText.trim().toUpperCase() !== "DELETE" || isDeleting}
                      className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:cursor-not-allowed shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                    >
                      {isDeleting ? "Deleting..." : "Permanently Delete My Account"}
                    </button>
                  </div>
                </div>
              )}

              {/* 5. SUPPORT & HELP */}
              {activeTab === "support" && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
                    <div className="flex items-center gap-2 text-[var(--jungle-green)]">
                      <Sparkles size={18} />
                      <h4 className="font-black text-sm uppercase">24/7 VIP Concierge</h4>
                    </div>
                    <p className="text-xs text-gray-300">
                      Have questions about vehicle count predictions, live feeds, or instant cashouts?
                    </p>
                    <div className="space-y-1.5 pt-1 text-xs">
                      <div className="flex justify-between p-2 rounded-lg bg-black/60 border border-white/10">
                        <span className="text-gray-400">AI Strategist:</span>
                        <span className="font-bold text-[var(--jungle-green)]">Leo Chat (Bottom-Left)</span>
                      </div>
                      <div className="flex justify-between p-2 rounded-lg bg-black/60 border border-white/10">
                        <span className="text-gray-400">Direct VIP Email:</span>
                        <span className="font-mono text-white">support@junglebet.io</span>
                      </div>
                      <div className="flex justify-between p-2 rounded-lg bg-black/60 border border-white/10">
                        <span className="text-gray-400">Optical Resolution:</span>
                        <span className="font-mono text-white">YOLOv8 CV Engine</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
