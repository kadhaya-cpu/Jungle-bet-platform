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
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleCurrencySelect = (newCurrency: SupportedCurrency) => {
    setCurrency(newCurrency);
    setIsCurrencyDropdownOpen(false);
    toast.success(`Currency switched to ${newCurrency} (${CURRENCY_CONFIGS[newCurrency].symbol})`);
  };

  const currentConfig = CURRENCY_CONFIGS[currency] || CURRENCY_CONFIGS.USD;

  return (
    <>
      <header className="fixed top-0 w-full z-40 border-b border-white/10 px-3 sm:px-6 py-2.5 sm:py-3 flex justify-between items-center h-16 bg-[#0c0c0e]/95 backdrop-blur-md select-none">
        {/* BRAND LOGO: ONE LARGE BOLD NEON-GREEN LOGO WITH PULSING RED "LIVE" */}
        <div
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none"
          onClick={() => router.push("/")}
        >
          <div className="p-1.5 sm:p-2 rounded-xl bg-black/80 border border-[var(--jungle-green)]/40 shadow-[0_0_15px_rgba(204,255,0,0.3)] transition-transform group-hover:scale-105">
            <Zap
              className="text-[var(--jungle-green)] fill-current shrink-0 filter drop-shadow-[0_0_8px_rgba(204,255,0,0.7)]"
              size={22}
            />
          </div>
          <div className="flex flex-col">
            {/* ONE LARGE, BOLD, NEON-GREEN "JUNGLE BET" LOGO */}
            <span className="font-black text-lg sm:text-2xl tracking-tighter uppercase italic leading-none text-[var(--jungle-green)] drop-shadow-[0_0_14px_rgba(204,255,0,0.55)]">
              JUNGLE BET
            </span>
            {/* PULSING RED DOT ANIMATION + "LIVE" IN RED UPPERCASE */}
            <div className="flex items-center gap-1.5 mt-1 leading-none">
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
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-black/60 hover:bg-black/80 border border-white/15 hover:border-[var(--jungle-green)]/50 text-xs text-white transition-all cursor-pointer shadow-sm active:scale-95"
              title="Select Betting Currency"
              aria-label="Currency Selector"
              aria-expanded={isCurrencyDropdownOpen}
            >
              <span className="text-sm sm:text-base leading-none">{currentConfig.flag}</span>
              <span className="font-mono font-bold text-xs text-gray-200">{currentConfig.code}</span>
              <ChevronDown
                size={13}
                className={`text-gray-400 transition-transform duration-200 ${
                  isCurrencyDropdownOpen ? "rotate-180 text-[var(--jungle-green)]" : ""
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
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-48 sm:w-56 rounded-2xl bg-[#121214] border border-white/15 shadow-[0_15px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(204,255,0,0.1)] p-1.5 z-50 backdrop-blur-xl"
                >
                  <div className="px-3 py-1.5 border-b border-white/10 mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400 font-bold">
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
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[var(--jungle-green)]/15 text-[var(--jungle-green)] font-bold border border-[var(--jungle-green)]/30"
                              : "text-gray-300 hover:bg-white/5 hover:text-white"
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
                          {isSelected && <Check size={14} className="text-[var(--jungle-green)]" />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* AUTH & USER SECTION (AVAILABLE BALANCE MOVED TO SETTINGS) */}
          {status === "loading" ? (
            <div className="h-8 w-20 bg-white/5 animate-pulse rounded-full border border-white/10" />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-2">
              {/* Authenticated User Pill */}
              <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded-full border border-white/15 text-xs text-gray-300">
                {userPhone ? (
                  <>
                    <Phone size={12} className="text-[var(--jungle-green)]" />
                    <span className="font-mono text-xs">{userPhone}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={12} className="text-[var(--jungle-green)]" />
                    <span className="max-w-[90px] truncate text-xs font-semibold">{userName}</span>
                  </>
                )}
              </div>

              {/* Quick Deposit Action Button */}
              <button
                onClick={() => setIsDepositOpen(true)}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full border border-[var(--jungle-green)]/40 bg-[var(--jungle-green)]/15 hover:bg-[var(--jungle-green)]/30 text-[var(--jungle-green)] font-bold text-xs transition-all active:scale-95 shadow-[0_0_10px_rgba(204,255,0,0.15)] cursor-pointer"
                title="Deposit funds"
              >
                <Plus size={13} className="shrink-0" />
                <span>Deposit</span>
              </button>
            </div>
          ) : (
            /* NOT AUTHENTICATED: LOGIN & REGISTER TRIGGER AUTH MODAL */
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => openAuth("login")}
                className="flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/35 text-white font-bold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer whitespace-nowrap shadow-sm hover:shadow-[0_0_10px_rgba(255,255,255,0.1)]"
              >
                <LogIn size={13} className="text-gray-300 shrink-0" />
                <span>Login</span>
              </button>

              <button
                onClick={() => openAuth("register")}
                className="flex items-center gap-1 sm:gap-1.5 bg-[var(--jungle-green)] text-black font-extrabold px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-full hover:shadow-[0_0_20px_var(--jungle-green)] hover:scale-105 transition-all active:scale-95 border-none outline-none text-xs sm:text-sm whitespace-nowrap shadow-[0_0_12px_rgba(204,255,0,0.35)] cursor-pointer"
              >
                <UserPlus size={13} className="shrink-0" />
                <span>Register</span>
              </button>
            </div>
          )}

          {/* FAR RIGHT: SETTINGS GEAR ICON BUTTON */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center justify-center p-2 sm:p-2.5 rounded-full bg-black/60 hover:bg-black/90 border border-white/15 hover:border-[var(--jungle-green)] text-gray-300 hover:text-[var(--jungle-green)] transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(204,255,0,0.3)] active:scale-95 group"
            title="Settings (Balance, 2FA, Account, Support)"
            aria-label="Settings"
          >
            <Settings size={17} className="transition-transform duration-300 group-hover:rotate-45" />
          </button>
        </div>
      </header>

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
