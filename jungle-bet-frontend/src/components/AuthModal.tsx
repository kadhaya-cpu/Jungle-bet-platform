"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import Link from "next/link";
import {
  X,
  Phone,
  Lock,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { useStore } from "@/lib/store";
import CountryCodeSelector from "./CountryCodeSelector";
import { DEFAULT_COUNTRY_CODE } from "@/lib/country-codes";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = "login",
}: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [prevInitialMode, setPrevInitialMode] = useState<"login" | "register">(initialMode);

  if (prevInitialMode !== initialMode) {
    setPrevInitialMode(initialMode);
    setMode(initialMode);
  }

  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { detectGeoCurrency, fetchBalance } = useStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleQuickDemo = (demoPhone: string, demoPass: string) => {
    if (demoPhone.startsWith("+256")) {
      setCountryCode("+256");
      setPhoneNumber(demoPhone.replace("+256", ""));
    } else if (demoPhone.startsWith("+254")) {
      setCountryCode("+254");
      setPhoneNumber(demoPhone.replace("+254", ""));
    } else if (demoPhone.startsWith("+1")) {
      setCountryCode("+1");
      setPhoneNumber(demoPhone.replace("+1", ""));
    } else {
      setPhoneNumber(demoPhone);
    }
    setPassword(demoPass);
    toast.info(`Filled demo credentials for ${demoPhone}`);
  };

  const getFullPhoneNumber = () => {
    const raw = phoneNumber.trim().replace(/^0+/, "");
    if (raw.startsWith("+")) return raw;
    return `${countryCode}${raw}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fullPhone = getFullPhoneNumber();
    if (!phoneNumber.trim()) {
      toast.error("Please enter your phone number");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      if (mode === "register") {
        const registerRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: fullPhone,
            identifier: fullPhone,
            password,
            name: name.trim() || undefined,
          }),
        });

        const regData = await registerRes.json();
        if (!registerRes.ok) {
          throw new Error(regData.error || "Failed to create account");
        }

        toast.success("Account created! Logging you in...");

        const signInRes = await signIn("credentials", {
          phone: fullPhone,
          identifier: fullPhone,
          password,
          redirect: false,
        });

        if (signInRes?.error) {
          throw new Error("Account created, but sign in failed. Please sign in manually.");
        }

        await detectGeoCurrency(fullPhone);
        await fetchBalance();
        toast.success("Welcome to RUSH HOUR BET!");
        onClose();
      } else {
        const result = await signIn("credentials", {
          phone: fullPhone,
          identifier: fullPhone,
          password,
          redirect: false,
        });

        if (result?.error) {
          toast.error("Invalid credentials. Please verify your phone number or create an account.");
        } else {
          await detectGeoCurrency(fullPhone);
          await fetchBalance();
          toast.success("Welcome back to RUSH HOUR BET!");
          onClose();
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication error occurred";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md rounded-3xl bg-white text-gray-900 border-0 p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.6)] overflow-hidden my-auto"
      >
        {/* Soft Ambient Blur */}
        <div className="absolute -top-16 -left-16 w-44 h-44 bg-blue-500/10 rounded-full blur-[70px] pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-44 h-44 bg-teal-500/10 rounded-full blur-[70px] pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close authentication modal"
          className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition-all z-20 cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Modal Brand Header */}
        <div className="flex flex-col items-center text-center mb-5 select-none">
          {/* LARGE STYLISH TEXT LOGO WITH BLUE-TO-GREEN GRADIENT SCALE */}
          <span className="font-black text-3xl tracking-tight uppercase italic leading-none bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 bg-clip-text text-transparent drop-shadow-sm">
            RUSH HOUR BET
          </span>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
            </span>
            <span className="text-[10px] font-black tracking-widest uppercase text-red-500 font-mono">
              LIVE OPTICAL TELEMETRY
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight mt-2.5">
            {mode === "login" ? "Log In to Your Account" : "Get Started with RUSH HOUR BET"}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            {mode === "login"
              ? "Access live multi-city video telemetry and optical wagers."
              : "Predict live vehicle crossings across major transit arteries."}
          </p>
        </div>

        {/* Mode Toggle Tabs (Sign In / Get Started) */}
        <div className="relative flex p-1 bg-gray-100 rounded-2xl mb-4 border-0">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`relative flex-1 py-2 text-xs font-bold rounded-xl transition-all z-10 cursor-pointer ${
              mode === "login" ? "text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {mode === "login" && (
              <motion.div
                layoutId="authModalTabPill"
                className="absolute inset-0 bg-[#0f172a] rounded-xl shadow-md"
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
              />
            )}
            <span className="relative z-10 uppercase tracking-wider font-extrabold">Log In</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("register")}
            className={`relative flex-1 py-2 text-xs font-bold rounded-xl transition-all z-10 cursor-pointer ${
              mode === "register" ? "text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {mode === "register" && (
              <motion.div
                layoutId="authModalTabPill"
                className="absolute inset-0 bg-[#0f172a] rounded-xl shadow-md"
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
              />
            )}
            <span className="relative z-10 uppercase tracking-wider font-extrabold">Get Started</span>
          </button>
        </div>

        {/* PHONE-NUMBER ONLY FORM */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Nickname for Register */}
          {mode === "register" && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                Racer Nickname (Optional)
              </label>
              <div className="relative flex items-center bg-[#0f172a] rounded-2xl p-1 shadow-inner border-0">
                <div className="pl-3 pr-2 text-gray-400">
                  <User size={15} />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ApexDriver_99"
                  className="w-full bg-transparent border-0 px-1 py-2 text-xs sm:text-sm text-white placeholder-gray-400 focus:outline-none font-medium"
                />
              </div>
            </div>
          )}

          {/* Phone Number with Country Code Dropdown */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
              Phone Number
            </label>
            <div className="flex items-center gap-2 bg-[#0f172a] rounded-2xl p-1 shadow-inner border-0 focus-within:ring-2 focus-within:ring-teal-400">
              <CountryCodeSelector value={countryCode} onChange={setCountryCode} />
              <div className="relative flex-1">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  placeholder="772 123 456"
                  className="w-full bg-transparent border-0 px-2 py-2 text-xs sm:text-sm text-white placeholder-gray-400 focus:outline-none font-mono tracking-wide"
                />
              </div>
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                Password
              </label>
              {mode === "login" && (
                <Link
                  href="/forgot-password"
                  onClick={onClose}
                  className="text-[11px] font-bold text-teal-600 hover:underline"
                >
                  Forgot Password?
                </Link>
              )}
            </div>
            <div className="relative flex items-center bg-[#0f172a] rounded-2xl p-1 shadow-inner border-0 focus-within:ring-2 focus-within:ring-teal-400">
              <div className="pl-3 pr-2 text-gray-400">
                <Lock size={15} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full bg-transparent border-0 px-1 py-2 text-xs sm:text-sm text-white placeholder-gray-400 focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="pr-3 pl-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Confirm Password for Register */}
          {mode === "register" && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative flex items-center bg-[#0f172a] rounded-2xl p-1 shadow-inner border-0 focus-within:ring-2 focus-within:ring-teal-400">
                <div className="pl-3 pr-2 text-gray-400">
                  <KeyRound size={15} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full bg-transparent border-0 px-1 py-2 text-xs sm:text-sm text-white placeholder-gray-400 focus:outline-none font-mono"
                />
              </div>
            </div>
          )}

          {/* Submit button: Renamed to 'Get Started' for register */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-2 bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 hover:from-blue-500 hover:via-teal-400 hover:to-emerald-400 text-white font-extrabold rounded-2xl shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 select-none cursor-pointer tracking-wider uppercase text-xs sm:text-sm border-0"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{mode === "login" ? "Log In" : "Get Started"}</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        {/* 1-Click Demo Racers */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono uppercase text-gray-500 tracking-wider flex items-center gap-1 font-bold">
              <ShieldCheck size={12} className="text-teal-600" />
              1-Click Demo Racers:
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo("+256700000001", "password123")}
              className="px-2 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-left text-xs transition-all flex flex-col border-0 cursor-pointer"
            >
              <span className="font-mono text-[11px] text-teal-700 font-bold">🇺🇬 +256700000001</span>
              <span className="text-[10px] text-gray-500 font-medium">Uganda Racer</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo("+1234567890", "password123")}
              className="px-2 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-left text-xs transition-all flex flex-col border-0 cursor-pointer"
            >
              <span className="font-mono text-[11px] text-teal-700 font-bold">🇺🇸 +1234567890</span>
              <span className="text-[10px] text-gray-500 font-medium">VIP Racer ($500)</span>
            </button>
          </div>
        </div>

        {/* Bottom Switch Mode Link */}
        <div className="mt-3.5 text-center">
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-xs text-gray-600 hover:text-gray-900 transition-colors select-none font-medium cursor-pointer"
          >
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <span className="text-teal-600 font-bold underline">
                  Get Started
                </span>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <span className="text-teal-600 font-bold underline">
                  Log In
                </span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
