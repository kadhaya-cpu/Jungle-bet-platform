"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  LogOut,
  Wallet,
  LogIn,
  UserPlus,
  Phone,
  ShieldCheck,
  Plus,
  ChevronDown,
  Check,
  Settings,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useStore, CURRENCY_CONFIGS, SupportedCurrency } from "@/lib/store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import PaymentModal from "./PaymentModal";
import AuthModal from "./AuthModal";
import SettingsModal from "./SettingsModal";

export default function Header() {
  const { data: session, status } = useSession();
  const {
    balance: storeBalance,
    logout: storeLogout,
    fetchBalance,
    currency,
    setCurrency,
    detectGeoCurrency,
    formatAmount,
  } = useStore();

  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">("login");
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const currencyDropdownRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const isAuthenticated = status === "authenticated" && !!session?.user;
  const balance = session?.user?.balance ?? storeBalance ?? 100.0;
  const userPhone = session?.user?.phone;
  const userName = session?.user?.name || (userPhone ? userPhone : "Racer");

  // Automatically detect and set currency on login based on phone / geo location
  useEffect(() => {
    if (isAuthenticated) {
      detectGeoCurrency(session?.user?.phone || undefined);
    }
  }, [isAuthenticated, session?.user?.phone, detectGeoCurrency]);

  // Global listener to prompt auth flow
  useEffect(() => {
    const handleOpenAuth = (e: CustomEvent) => {
      const mode = e.detail?.mode || "login";
      if (mode === "login") {
        router.push("/login");
      } else {
        router.push("/signup");
      }
    };
    window.addEventListener("open-auth-modal", handleOpenAuth as EventListener);
    return () => window.removeEventListener("open-auth-modal", handleOpenAuth as EventListener);
  }, [router]);

  // Close currency dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        currencyDropdownRef.current &&
        !currencyDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCurrencyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    storeLogout();
    try {
      await signOut({ redirect: false });
      toast.info("Logged out from Jungle Bet");
    } catch {
      // Fallback
    }
  };

  const openAuth = (mode: "login" | "register") => {
    if (mode === "login") {
      router.push("/login");
    } else {
      router.push("/signup");
    }
  };

  const handleCurrencySelect = (newCurrency: SupportedCurrency) => {
    setCurrency(newCurrency);
    setIsCurrencyDropdownOpen(false);
    toast.success(`Currency switched to ${newCurrency} (${CURRENCY_CONFIGS[newCurrency].symbol})`);
  };

  const currentConfig = CURRENCY_CONFIGS[currency] || CURRENCY_CONFIGS.USD;
  const PROMO_TICKER_TEXT = ' PROMO: 100% deposit bonus on deposits of  and above! Claim now ->';
  const DISPLAY_PROMO = "🔥 PROMO: 100% deposit bonus on deposits of  and above! Claim now ->";

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 flex flex-col select-none">
        {/* TOP-LEVEL SCROLLING MARQUEE / TICKER BAR ACROSS ENTIRE WIDTH */}
        <div
          onClick={() => setIsDepositOpen(true)}
          className="w-full bg-[#0a1120] border-b border-white/10 overflow-hidden py-1.5 px-3 cursor-pointer group shadow-sm shadow-blue-500/10 transition-colors duration-300 hover:bg-[#0f172a]"
          title="Click to claim deposit bonus"
        >
          <div className="animate-jungle-marquee flex items-center gap-12 whitespace-nowrap text-xs font-black tracking-wide text-teal-400">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <span key={i} className="flex items-center gap-3 hover:text-emerald-300 transition-colors duration-300">
                <span>{DISPLAY_PROMO}</span>
                <span className="text-white/30">✦</span>
              </span>
            ))}
          </div>
        </div>

        {/* MAIN HEADER NAVBAR */}
        <header className="w-full border-b border-white/10 px-3 sm:px-6 py-2.5 sm:py-3 flex justify-between items-center h-16 bg-[#0f172a]/95 backdrop-blur-xl shadow-lg shadow-blue-500/10 select-none transition-all duration-300">
          {/* BRAND LOGO: LARGE STYLISH TEXT LOGO WITH BLUE-TO-GREEN GRADIENT SCALE */}
          <div
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none transition-all duration-300 hover:-translate-y-0.5"
            onClick={() => router.push("/")}
          >
            <div className="flex items-center gap-2">
              <span className="font-heading font-black text-2xl sm:text-3xl tracking-tight uppercase italic leading-none bg-gradient-to-r from-blue-500 via-teal-400 to-[#00e5b9] bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(20,184,166,0.35)] transition-transform duration-300 group-hover:scale-105">
                JUNGLE BET
              </span>
              {/* PULSING RED DOT ANIMATION + "LIVE" IN RED UPPERCASE */}
              <div className="flex items-center gap-1.5 ml-1 leading-none">
                <span className="relative flex h-2 sm:h-2.5 w-2 sm:w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-full w-full bg-red-600 animate-live-pulse" />
                </span>
                <span className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]">
                  LIVE
                </span>
              </div>
            </div>
          </div>

        {/* RIGHT SIDE ACTIONS: CURRENCY TOGGLE, BALANCE, AUTH */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* MANUAL CURRENCY TOGGLE DROPDOWN NEXT TO THE BALANCE */}
          <div className="relative" ref={currencyDropdownRef}>
            <button
              onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1e293b]/80 hover:bg-[#1e293b] border border-white/10 hover:border-teal-400/40 text-xs text-slate-100 transition-all duration-300 cursor-pointer shadow-sm shadow-blue-500/10 hover:-translate-y-0.5 active:translate-y-0"
              title="Select Betting Currency"
              aria-label="Currency Selector"
              aria-expanded={isCurrencyDropdownOpen}
            >
              <span className="text-sm sm:text-base leading-none">{currentConfig.flag}</span>
              <span className="font-mono font-bold text-xs text-gray-200">{currentConfig.code}</span>
              <ChevronDown
                size={13}
                className={`text-gray-400 transition-transform duration-300 ${
                  isCurrencyDropdownOpen ? "rotate-180 text-teal-400" : ""
                }`}
              />
            </button>

            {/* CURRENCY DROPDOWN MENU */}
            <AnimatePresence>
              {isCurrencyDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2 w-48 sm:w-56 rounded-2xl bg-[#0f172a] border border-white/10 shadow-xl shadow-blue-500/20 p-1.5 z-50 backdrop-blur-xl"
                >
                  <div className="px-3 py-1.5 border-b border-white/10 mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                      Select Currency
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {(Object.keys(CURRENCY_CONFIGS) as SupportedCurrency[]).map((curCode) => {
                      const item = CURRENCY_CONFIGS[curCode];
                      const isSelected = item.code === currency;

                      return (
                        <button
                          key={curCode}
                          onClick={() => handleCurrencySelect(curCode)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-all duration-300 cursor-pointer ${
                            isSelected
                              ? "bg-teal-500/15 text-teal-300 font-bold border border-teal-500/30"
                              : "text-slate-300 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-base leading-none">{item.flag}</span>
                            <div className="flex flex-col">
                              <span className="font-mono font-bold leading-tight">{item.code}</span>
                              <span className="text-[10px] text-gray-400 leading-tight">
                                {item.name} ({item.symbol})
                              </span>
                            </div>
                          </div>
                          {isSelected && <Check size={14} className="text-teal-400" />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* AUTH & USER SECTION */}
          {status === "loading" ? (
            <div className="h-8 w-20 bg-white/5 animate-pulse rounded-xl border border-white/10" />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-2">
              {/* Authenticated User Pill */}
              <div className="flex items-center gap-1.5 bg-[#1e293b]/80 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-slate-200 shadow-sm shadow-blue-500/10">
                {userPhone ? (
                  <>
                    <Phone size={12} className="text-teal-400" />
                    <span className="font-mono text-xs text-slate-100">{userPhone}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={12} className="text-teal-400" />
                    <span className="max-w-[90px] truncate text-xs font-semibold text-slate-100">{userName}</span>
                  </>
                )}
              </div>

              {/* Quick Deposit Action Button */}
              <button
                onClick={() => setIsDepositOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-teal-400/40 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 hover:from-teal-500 hover:to-emerald-500 text-teal-300 hover:text-white font-bold text-xs transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 shadow-sm shadow-teal-500/10 hover:shadow-teal-500/25 cursor-pointer"
                title="Deposit funds"
              >
                <Plus size={13} className="shrink-0" />
                <span>Deposit</span>
              </button>
            </div>
          ) : (
            /* NOT AUTHENTICATED: LOGIN & REGISTER TRIGGER AUTH MODAL */
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuth("login")}
                className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/25 text-white font-bold text-xs sm:text-sm transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer whitespace-nowrap shadow-sm shadow-blue-500/10"
              >
                <LogIn size={13} className="text-slate-300 shrink-0" />
                <span>Login</span>
              </button>

              <button
                onClick={() => openAuth("register")}
                className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 hover:from-blue-500 hover:via-teal-400 hover:to-emerald-400 text-white font-black px-4 py-1.5 sm:px-5 sm:py-2 rounded-xl hover:shadow-lg hover:shadow-teal-500/25 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 border-none outline-none text-xs sm:text-sm whitespace-nowrap shadow-md shadow-teal-500/20 cursor-pointer"
              >
                <UserPlus size={13} className="shrink-0 text-white" />
                <span>Get Started</span>
              </button>
            </div>
          )}

          {/* FAR RIGHT: SETTINGS GEAR ICON BUTTON */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center justify-center p-2.5 rounded-xl bg-[#1e293b]/80 hover:bg-[#1e293b] border border-white/10 hover:border-teal-400/40 text-slate-300 hover:text-teal-300 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-sm shadow-blue-500/10 hover:shadow-teal-500/20 group"
            title="Settings (Balance, 2FA, Account, Support)"
            aria-label="Settings"
          >
            <Settings size={17} className="transition-transform duration-300 group-hover:rotate-45" />
          </button>
        </div>
      </header>
    </div>

      {/* AUTH MODAL WITH GOOGLE, APPLE, AND PHONE/EMAIL OPTIONS */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />

      {/* WALLET DEPOSIT MODAL */}
      <PaymentModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        mode="deposit"
        amount={100}
        onPaymentSuccess={() => {
          fetchBalance();
          toast.success("Wallet deposit confirmed!");
        }}
      />

      {/* SETTINGS MODAL */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenDeposit={() => setIsDepositOpen(true)}
        onOpenAuth={openAuth}
      />
    </>
  );
}
