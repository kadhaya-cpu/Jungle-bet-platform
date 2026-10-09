"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import {
  X,
  Zap,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  KeyRound,
} from "lucide-react";
import { useStore } from "@/lib/store";

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

  // Adjust state during render when prop changes (React recommended pattern)
  if (prevInitialMode !== initialMode) {
    setPrevInitialMode(initialMode);
    setMode(initialMode);
  }

  const [showCredentialsForm, setShowCredentialsForm] = useState<boolean>(true);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);

  const { detectGeoCurrency, fetchBalance } = useStore();

  // Handle ESC key press
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

  const handleSocialSignIn = async (provider: "google" | "apple") => {
    setSocialLoading(provider);
    try {
      await signIn(provider, { callbackUrl: window.location.pathname || "/" });
    } catch {
      toast.error(`Failed to initiate ${provider} sign-in`);
      setSocialLoading(null);
    }
  };

  const handleQuickDemo = (demoPhone: string, demoPass: string) => {
    setPhone(demoPhone);
    setPassword(demoPass);
    setShowCredentialsForm(true);
    toast.info(`Filled demo credentials for ${demoPhone}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone.trim()) {
      toast.error("Please enter your phone number or email");
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
        // Register user via API
        const registerRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, password, name }),
        });

        const regData = await registerRes.json();
        if (!registerRes.ok) {
          throw new Error(regData.error || "Failed to create account");
        }

        toast.success("Account created! Logging you into Jungle Bet...");

        // Auto sign-in
        const signInRes = await signIn("credentials", {
          phone,
          password,
          redirect: false,
        });

        if (signInRes?.error) {
          throw new Error("Account created, but sign in failed. Please sign in manually.");
        }

        await detectGeoCurrency(phone);
        await fetchBalance();
        toast.success("Welcome Racer! $100 Starting bonus loaded.");
        onClose();
      } else {
        // Sign in via NextAuth credentials
        const result = await signIn("credentials", {
          phone,
          password,
          redirect: false,
        });

        if (result?.error) {
          toast.error("Invalid credentials. Please verify or register an account.");
        } else {
          await detectGeoCurrency(phone);
          await fetchBalance();
          toast.success("Welcome back to Jungle Bet!");
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
        className="relative w-full max-w-md rounded-3xl bg-[#121214] border border-white/10 p-5 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(204,255,0,0.12)] overflow-hidden my-auto"
      >
        {/* Glow Effects */}
        <div className="absolute -top-16 -left-16 w-44 h-44 bg-[var(--jungle-green)]/15 rounded-full blur-[70px] pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-44 h-44 bg-purple-600/15 rounded-full blur-[70px] pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close authentication modal"
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all z-20 cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Modal Brand Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="flex items-center gap-2 select-none">
            <div className="p-2 rounded-xl bg-black/70 border border-[var(--jungle-green)]/40 shadow-[0_0_15px_rgba(204,255,0,0.3)]">
              <Zap className="text-[var(--jungle-green)] fill-current" size={24} />
            </div>
            <div className="text-left">
              <div className="font-black text-2xl tracking-tighter uppercase italic text-[var(--jungle-green)] leading-none drop-shadow-[0_0_12px_rgba(204,255,0,0.4)]">
                JUNGLE BET
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600 animate-live-pulse" />
                </span>
                <span className="text-[9px] font-black tracking-widest uppercase text-red-500">
                  LIVE
                </span>
              </div>
            </div>
          </div>

          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight mt-3">
            {mode === "login" ? "Enter the Racing Garage" : "Claim Your Spot in the Garage"}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {mode === "login"
              ? "Access live multi-camera odds & track multipliers."
              : "Sign up today and get an instant $100 starting bonus."}
          </p>
        </div>

        {/* Mode Toggle Tabs (Sign In / Register) */}
        <div className="relative flex p-1 bg-black/60 rounded-xl border border-white/10 mb-4">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`relative flex-1 py-1.5 sm:py-2 text-xs font-bold rounded-lg transition-all z-10 ${
              mode === "login" ? "text-black" : "text-gray-400 hover:text-white"
            }`}
          >
            {mode === "login" && (
              <motion.div
                layoutId="authModalTabPill"
                className="absolute inset-0 bg-[var(--jungle-green)] rounded-lg shadow-[0_0_15px_rgba(204,255,0,0.4)]"
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
              />
            )}
            <span className="relative z-10 uppercase tracking-wider">Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("register")}
            className={`relative flex-1 py-1.5 sm:py-2 text-xs font-bold rounded-lg transition-all z-10 ${
              mode === "register" ? "text-black" : "text-gray-400 hover:text-white"
            }`}
          >
            {mode === "register" && (
              <motion.div
                layoutId="authModalTabPill"
                className="absolute inset-0 bg-[var(--jungle-green)] rounded-lg shadow-[0_0_15px_rgba(204,255,0,0.4)]"
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
              />
            )}
            <span className="relative z-10 uppercase tracking-wider">Register</span>
          </button>
        </div>

        {/* DISTINCT AUTH OPTIONS: GOOGLE, APPLE, AND PHONE/EMAIL */}
        <div className="space-y-2.5 mb-4">
          {/* OPTION 1: CONTINUE WITH GOOGLE */}
          <button
            type="button"
            onClick={() => handleSocialSignIn("google")}
            disabled={!!socialLoading || loading}
            className="w-full h-11 flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-bold rounded-xl px-4 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-md shadow-black/40 disabled:opacity-50 select-none cursor-pointer"
          >
            {socialLoading === "google" ? (
              <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span className="text-xs sm:text-sm font-semibold tracking-wide">Continue with Google</span>
          </button>

          {/* OPTION 2: CONTINUE WITH APPLE */}
          <button
            type="button"
            onClick={() => handleSocialSignIn("apple")}
            disabled={!!socialLoading || loading}
            className="w-full h-11 flex items-center justify-center gap-3 bg-black hover:bg-[#1c1c20] text-white font-bold rounded-xl px-4 border border-white/20 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-md shadow-black/50 disabled:opacity-50 select-none cursor-pointer"
          >
            {socialLoading === "apple" ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 170 170">
                <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.7-7.91-12.03-14.49-6.03-9.22-10.74-19.8-14.13-31.74-3.39-11.94-5.09-23.34-5.09-34.19 0-14.28 3.51-26.01 10.53-35.18 7.02-9.17 15.86-13.86 26.52-14.07 4.93 0 10.3 1.25 16.12 3.76 5.82 2.51 9.4 3.82 10.74 3.92 1.9-.22 5.66-1.63 11.29-4.23 5.63-2.6 10.79-3.79 15.48-3.57 11.63.54 20.89 4.88 27.78 13.02-10.22 6.2-15.22 14.77-15 25.7.22 8.48 3.37 15.54 9.45 21.19 6.08 5.65 13.48 9.02 22.19 10.11-2.17 6.41-4.78 13-7.83 19.76zm-27.17-111.4c0 7.06-2.58 13.7-7.74 19.92-5.98 7.06-13.48 11.19-22.5 12.39-.33-1.63-.49-3.26-.49-4.89 0-6.85 2.72-13.59 8.15-20.22 2.82-3.48 6.3-6.41 10.43-8.8 4.13-2.39 8.16-3.74 12.09-4.05.06 1.85.06 3.73.06 5.65z" />
              </svg>
            )}
            <span className="text-xs sm:text-sm font-semibold tracking-wide">Continue with Apple</span>
          </button>

          {/* OPTION 3: DISTINCT BUTTON FOR LOGIN WITH PHONE / EMAIL */}
          <button
            type="button"
            onClick={() => setShowCredentialsForm(!showCredentialsForm)}
            className="w-full h-11 flex items-center justify-center gap-2.5 bg-white/5 hover:bg-white/10 text-gray-200 font-bold rounded-xl px-4 border border-white/10 transition-all hover:border-[var(--jungle-green)]/40 active:scale-[0.99] select-none cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-[var(--jungle-green)]">
              <Phone size={15} />
              <Mail size={15} />
            </div>
            <span className="text-xs sm:text-sm font-semibold tracking-wide">
              {mode === "login" ? "Login with Phone / Email" : "Register with Phone / Email"}
            </span>
          </button>
        </div>

        {/* ELEGANT DIVIDER */}
        <div className="relative flex items-center justify-center my-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <span className="relative px-3 bg-[#121214] text-[9px] font-mono tracking-widest text-gray-500 uppercase">
            DIRECT CREDENTIALS
          </span>
        </div>

        {/* PHONE / EMAIL CREDENTIALS FORM */}
        <AnimatePresence>
          {showCredentialsForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSubmit}
              className="space-y-3"
            >
              {/* Nickname for Register */}
              {mode === "register" && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">
                    Racer Nickname
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <User size={14} />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="ApexPredator_99"
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--jungle-green)] focus:ring-1 focus:ring-[var(--jungle-green)] transition-all font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Phone / Email input */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">
                  Phone Number or Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Phone size={14} />
                  </div>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="+1 (555) 000-0000 or user@example.com"
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--jungle-green)] focus:ring-1 focus:ring-[var(--jungle-green)] transition-all font-mono tracking-wide"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock size={14} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--jungle-green)] focus:ring-1 focus:ring-[var(--jungle-green)] transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password for Register */}
              {mode === "register" && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <KeyRound size={14} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--jungle-green)] focus:ring-1 focus:ring-[var(--jungle-green)] transition-all font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Bonus badge */}
              {mode === "register" && (
                <div className="p-2.5 bg-[var(--jungle-green)]/10 border border-[var(--jungle-green)]/30 rounded-xl flex items-center gap-2">
                  <Sparkles className="text-[var(--jungle-green)] shrink-0" size={15} />
                  <div className="text-[11px] text-white">
                    <span className="font-bold text-[var(--jungle-green)]">+$100.00 Starting Bonus</span>{" "}
                    instantly credited upon account registration.
                  </div>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading || !!socialLoading}
                className="w-full h-11 bg-gradient-to-r from-[var(--jungle-green)] via-[#bbf200] to-emerald-400 text-black font-extrabold rounded-xl hover:shadow-[0_0_20px_rgba(204,255,0,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 select-none cursor-pointer tracking-wider uppercase text-xs sm:text-sm shadow-[0_0_15px_rgba(204,255,0,0.2)] mt-1"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{mode === "login" ? "Enter Garage & Place Bets" : "Create Account & Claim $100"}</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* 1-Click Demo Accounts */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-mono uppercase text-gray-400 tracking-wider flex items-center gap-1">
              <ShieldCheck size={11} className="text-[var(--jungle-green)]" />
              1-Click Demo Racers:
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo("+1234567890", "password123")}
              className="px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[var(--jungle-green)]/40 rounded-lg text-left text-xs text-gray-300 hover:text-white transition-all flex flex-col"
            >
              <span className="font-mono text-[10px] text-[var(--jungle-green)] font-bold">+1234567890</span>
              <span className="text-[9px] text-gray-400">VIP Racer ($500)</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo("+254700000000", "password123")}
              className="px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[var(--jungle-green)]/40 rounded-lg text-left text-xs text-gray-300 hover:text-white transition-all flex flex-col"
            >
              <span className="font-mono text-[10px] text-[var(--jungle-green)] font-bold">+254700000000</span>
              <span className="text-[9px] text-gray-400">Speedster ($250)</span>
            </button>
          </div>
        </div>

        {/* Bottom Switch Mode Link */}
        <div className="mt-3.5 text-center">
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-[11px] text-gray-400 hover:text-[var(--jungle-green)] transition-colors select-none"
          >
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <span className="text-[var(--jungle-green)] font-bold underline decoration-dotted">
                  Register now
                </span>
              </>
            ) : (
              <>
                Already registered?{" "}
                <span className="text-[var(--jungle-green)] font-bold underline decoration-dotted">
                  Sign In
                </span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
