"use client";

import React, { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Lock, Eye, EyeOff, ArrowRight, ShieldCheck, KeyRound, Smartphone, CheckCircle2 } from "lucide-react";
import CountryCodeSelector from "@/components/CountryCodeSelector";
import { DEFAULT_COUNTRY_CODE } from "@/lib/country-codes";

function ForgotPasswordForm() {
  const router = useRouter();

  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [step, setStep] = useState<"phone" | "verify">("phone");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [simulatedDevCode, setSimulatedDevCode] = useState<string | null>(null);

  const getFullPhoneNumber = () => {
    const raw = phoneNumber.trim().replace(/^0+/, "");
    if (raw.startsWith("+")) return raw;
    return `${countryCode}${raw}`;
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();

    const fullPhone = getFullPhoneNumber();
    if (!phoneNumber.trim()) {
      toast.error("Please enter your phone number");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          phone: fullPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch verification code");
      }

      toast.success(`Verification code sent to ${fullPhone}`);
      if (data.devCode) {
        setSimulatedDevCode(data.devCode);
        setVerificationCode(data.devCode);
      }
      setStep("verify");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error sending code";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const fullPhone = getFullPhoneNumber();

    if (!verificationCode.trim()) {
      toast.error("Please enter the verification code");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: fullPhone,
          code: verificationCode.trim(),
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      toast.success("Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset password";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* SOFT AMBIENT GLOW BACKDROP */}
      <div className="absolute -top-10 -left-10 w-60 h-60 bg-blue-500/15 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-60 h-60 bg-teal-400/15 rounded-full blur-[90px] pointer-events-none" />

      {/* CENTERED WHITE/LIGHT MMG CARD - BORDERLESS, SMOOTH, MODERN */}
      <div className="relative rounded-3xl bg-white shadow-[0_25px_70px_rgba(0,0,0,0.55)] p-7 sm:p-9 border-0 select-none">
        {/* LARGE 'JUNGLE BET' LOGO AT TOP OF CARD WITH BLUE-TO-GREEN GRADIENT */}
        <div className="flex flex-col items-center text-center mb-6">
          <Link href="/" className="inline-block group mb-2">
            <span className="font-black text-3xl sm:text-4xl tracking-tight uppercase italic leading-none bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 bg-clip-text text-transparent drop-shadow-sm group-hover:scale-105 transition-transform inline-block">
              JUNGLE BET
            </span>
          </Link>
          <div className="flex items-center gap-1.5 mt-0.5 mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
            </span>
            <span className="text-[10px] font-black tracking-widest text-red-500 uppercase font-mono">
              SECURITY RECOVERY
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            Reset Your Password
          </h1>
          <p className="text-xs text-gray-500 mt-1 max-w-xs font-medium">
            {step === "phone"
              ? "Enter your registered phone number to receive a verification code."
              : "Enter the verification code and your new password."}
          </p>
        </div>

        {/* STEP 1: PHONE NUMBER INPUT */}
        {step === "phone" ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Phone Number
              </label>
              <div className="flex items-center gap-2 bg-[#0f172a] rounded-2xl p-1.5 shadow-inner border-0 transition-all focus-within:ring-2 focus-within:ring-teal-400">
                <CountryCodeSelector value={countryCode} onChange={setCountryCode} />
                <div className="relative flex-1">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    placeholder="772 123 456"
                    className="w-full bg-transparent border-0 px-2.5 py-2 text-sm text-white placeholder-gray-400 focus:outline-none font-mono tracking-wide"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-3 bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 hover:from-blue-500 hover:via-teal-400 hover:to-emerald-400 text-white font-extrabold rounded-2xl shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer tracking-wider uppercase text-sm border-0"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight size={17} className="stroke-[2.5]" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* STEP 2: PHONE CODE VERIFICATION & NEW PASSWORD */
          <form onSubmit={handleResetPassword} className="space-y-3.5">
            {simulatedDevCode && (
              <div className="p-2.5 rounded-xl bg-teal-50 text-teal-800 text-xs flex items-center gap-2 font-mono">
                <CheckCircle2 size={15} className="text-teal-600 shrink-0" />
                <span>Simulated SMS Code: <strong>{simulatedDevCode}</strong></span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                6-Digit Verification Code
              </label>
              <div className="relative flex items-center bg-[#0f172a] rounded-2xl p-1.5 shadow-inner border-0 transition-all focus-within:ring-2 focus-within:ring-teal-400">
                <div className="pl-3 pr-2 text-gray-400">
                  <Smartphone size={16} />
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                  placeholder="123456"
                  className="w-full bg-transparent border-0 px-1 py-2 text-sm text-white placeholder-gray-400 focus:outline-none font-mono tracking-widest text-center text-lg font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                New Password
              </label>
              <div className="relative flex items-center bg-[#0f172a] rounded-2xl p-1.5 shadow-inner border-0 transition-all focus-within:ring-2 focus-within:ring-teal-400">
                <div className="pl-3 pr-2 text-gray-400">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full bg-transparent border-0 px-1 py-2 text-sm text-white placeholder-gray-400 focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="pr-3 pl-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative flex items-center bg-[#0f172a] rounded-2xl p-1.5 shadow-inner border-0 transition-all focus-within:ring-2 focus-within:ring-teal-400">
                <div className="pl-3 pr-2 text-gray-400">
                  <KeyRound size={16} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full bg-transparent border-0 px-1 py-2 text-sm text-white placeholder-gray-400 focus:outline-none font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-3 bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 hover:from-blue-500 hover:via-teal-400 hover:to-emerald-400 text-white font-extrabold rounded-2xl shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer tracking-wider uppercase text-sm border-0"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Verify & Reset Password</span>
                  <ArrowRight size={17} className="stroke-[2.5]" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setStep("phone")}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-800 transition-colors pt-1 cursor-pointer"
            >
              ← Change phone number
            </button>
          </form>
        )}

        {/* BOTTOM LINK BACK TO LOGIN */}
        <div className="mt-5 text-center">
          <p className="text-xs text-gray-600 font-medium">
            Remember your password?{" "}
            <Link
              href="/login"
              className="text-teal-600 font-black hover:underline underline-offset-4 decoration-2"
            >
              Back to Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] px-4 py-10 relative overflow-hidden font-sans">
      {/* CLEAN BACKGROUND WITH SUBTLE GRID */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none" />

      <Suspense
        fallback={
          <div className="h-96 w-full max-w-md bg-white rounded-3xl animate-pulse flex items-center justify-center shadow-2xl">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
