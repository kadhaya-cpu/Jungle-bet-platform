"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  X,
  Smartphone,
  CreditCard,
  Building2,
  Zap,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Copy,
  Lock,
  ArrowRight,
  FlaskConical,
  RefreshCw,
} from "lucide-react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import {
  PaymentProviderId,
  SupportedCountry,
  SupportedCurrency,
  BetData,
  convertUSDToCurrency,
  detectUserCountry,
  suggestPaymentMethod,
} from "@/lib/payments";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  betData?: BetData;
  amount?: number;
  mode?: "bet" | "deposit";
  onPaymentSuccess?: (result: {
    paymentId: string;
    betId?: string;
    amount: number;
    provider: string;
  }) => void;
}

type TabType = "mobile_money" | "mpesa" | "card" | "paystack" | "bank_transfer";

export default function PaymentModal({
  isOpen,
  onClose,
  betData,
  amount: initialAmount = 100,
  mode = "bet",
  onPaymentSuccess,
}: PaymentModalProps) {
  const { data: session } = useSession();

  // Country & Suggestion Detection
  const [userCountry, setUserCountry] = useState<SupportedCountry>(() => {
    return session?.user?.phone ? detectUserCountry({ phone: session.user.phone }) : detectUserCountry();
  });
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const initialCountry = session?.user?.phone ? detectUserCountry({ phone: session.user.phone }) : detectUserCountry();
    if (initialCountry === "KE") return "mpesa";
    if (initialCountry === "NG") return "paystack";
    if (["US", "GB", "EU"].includes(initialCountry)) return "card";
    return "mobile_money";
  });

  // Payment Form States
  const [amount, setAmount] = useState<number>(betData?.amount || initialAmount);
  const [phone, setPhone] = useState<string>(session?.user?.phone || "");
  const [email, setEmail] = useState<string>(session?.user?.email || "");
  const [cardNumber, setCardNumber] = useState<string>("");
  const [cardExpiry, setCardExpiry] = useState<string>("");
  const [cardCvc, setCardCvc] = useState<string>("");
  const [cardName, setCardName] = useState<string>(session?.user?.name || "");

  // Uganda Provider Choice
  const [ugandaProvider, setUgandaProvider] = useState<"mtn_momo_uganda" | "airtel_uganda">("mtn_momo_uganda");
  // West Africa Provider Choice
  const [africaProvider, setAfricaProvider] = useState<"paystack" | "flutterwave">("paystack");

  // Flow State
  const [step, setStep] = useState<"input" | "processing" | "waiting_stk" | "success" | "failed">("input");
  const [countdown, setCountdown] = useState<number>(30);
  const [activePaymentId, setActivePaymentId] = useState<string>("");
  const [activeBetId, setActiveBetId] = useState<string>("");
  const [instructionsText, setInstructionsText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Testing & Mock Mode Controls
  const [isTestMode, setIsTestMode] = useState<boolean>(true);
  const [mockScenario, setMockScenario] = useState<"success" | "failure">("success");

  // Detect Country when session resolves
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (session?.user?.phone) {
        const country = detectUserCountry({ phone: session.user.phone });
        setUserCountry(country);
        const suggested = suggestPaymentMethod(country);
        if (suggested.method === "mpesa") setActiveTab("mpesa");
        else if (suggested.method === "paystack") setActiveTab("paystack");
        else if (suggested.method === "card") setActiveTab("card");
        else setActiveTab("mobile_money");
        setPhone(session.user.phone);
      }
      if (session?.user?.email) setEmail(session.user.email);
      if (session?.user?.name) setCardName(session.user.name);
    }, 0);
    return () => clearTimeout(timer);
  }, [session?.user?.phone, session?.user?.email, session?.user?.name, isOpen]);

  // Sync amount with prop
  useEffect(() => {
    const nextAmt = betData?.amount || initialAmount;
    const timer = setTimeout(() => {
      setAmount(nextAmt);
    }, 0);
    return () => clearTimeout(timer);
  }, [betData?.amount, initialAmount]);

  // Determine current provider id based on tab
  const getSelectedProviderId = useCallback((): PaymentProviderId => {
    if (activeTab === "mobile_money") return ugandaProvider;
    if (activeTab === "mpesa") return "mpesa_kenya";
    if (activeTab === "card") return "stripe";
    if (activeTab === "paystack") return africaProvider;
    if (activeTab === "bank_transfer") return "bank_transfer";
    return "mock_provider";
  }, [activeTab, ugandaProvider, africaProvider]);

  // Trigger Mock Webhook Callback
  const handleTriggerMockWebhook = useCallback(async (paymentId: string, scenario: "success" | "failure") => {
    try {
      const providerId = getSelectedProviderId();
      const res = await fetch(`/api/payment/webhook?provider=${providerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isMock: true,
          scenario,
          paymentId,
          amount,
          currency: activeTab === "mobile_money" ? "UGX" : activeTab === "mpesa" ? "KES" : "USD",
          Body: {
            stkCallback: {
              ResultCode: scenario === "success" ? 0 : 1032,
              ResultDesc: scenario === "success" ? "The service request is processed successfully." : "Request cancelled by user.",
              CheckoutRequestID: paymentId,
              CallbackMetadata: {
                Item: [
                  { Name: "MpesaReceiptNumber", Value: "QWE998877" },
                  { Name: "Amount", Value: amount },
                ],
              },
            },
          },
          status: scenario === "success" ? "successful" : "failed",
          event: "charge.success",
          type: scenario === "success" ? "payment_intent.succeeded" : "payment_intent.payment_failed",
        }),
      });

      const webhookData = await res.json();

      if (scenario === "success" && webhookData.received) {
        setStep("success");
        toast.success(
          mode === "bet"
            ? "Wager Activated! Ready for Live Race Analysis!"
            : "Deposit Successful! Credits added to your wallet."
        );
        if (onPaymentSuccess) {
          onPaymentSuccess({
            paymentId,
            betId: activeBetId || webhookData.betId,
            amount,
            provider: providerId,
          });
        }
      } else {
        setErrorMessage(
          scenario === "failure"
            ? "Payment declined or cancelled by subscriber."
            : "Webhook processing error."
        );
        setStep("failed");
        toast.error("Payment failed. Please retry.");
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message);
      setStep("failed");
    }
  }, [getSelectedProviderId, activeTab, amount, mode, activeBetId, onPaymentSuccess]);

  // STK Push Countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "waiting_stk" && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (step === "waiting_stk" && countdown === 0) {
      if (isTestMode) {
        const timerOut = setTimeout(() => {
          handleTriggerMockWebhook(activePaymentId, mockScenario);
        }, 50);
        return () => {
          clearInterval(timer);
          clearTimeout(timerOut);
        };
      }
    }
    return () => clearInterval(timer);
  }, [step, countdown, isTestMode, mockScenario, activePaymentId, handleTriggerMockWebhook]);

  if (!isOpen) return null;

  // Real-time conversion calculations
  const ugxConverted = convertUSDToCurrency(amount, "UGX");
  const kesConverted = convertUSDToCurrency(amount, "KES");
  const ngnConverted = convertUSDToCurrency(amount, "NGN");

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard!`);
  };

  // Initiate Payment
  const handleInitiatePayment = async () => {
    const providerId = getSelectedProviderId();
    let currentCurrency: SupportedCurrency = "USD";
    if (activeTab === "mobile_money") currentCurrency = "UGX";
    else if (activeTab === "mpesa") currentCurrency = "KES";
    else if (activeTab === "paystack") currentCurrency = "NGN";

    // Basic validation
    if (activeTab === "mobile_money" || activeTab === "mpesa") {
      if (!phone || phone.length < 9) {
        toast.error("Please enter a valid phone number.");
        return;
      }
    }

    setStep("processing");
    setErrorMessage("");

    try {
      const response = await fetch("/api/payment/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency: currentCurrency,
          provider: providerId,
          country: userCountry,
          phoneNumber: phone,
          customerEmail: email || "customer@junglebet.io",
          customerName: cardName || session?.user?.name || "Racer",
          betData: mode === "bet" ? betData : undefined,
          isMock: isTestMode,
          mockScenario,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to initiate payment gateway.");
      }

      setActivePaymentId(data.paymentId);
      if (data.betId) setActiveBetId(data.betId);
      setInstructionsText(data.instructions || "");

      if (data.stkPushSent || activeTab === "mobile_money" || activeTab === "mpesa") {
        setStep("waiting_stk");
        setCountdown(15);
        toast.success(
          activeTab === "mpesa"
            ? "M-Pesa STK Push Sent! Check your phone."
            : "Mobile Money USSD Prompt Sent! Check your phone."
        );

        // In test mode, trigger automated mock webhook after 4 seconds
        if (isTestMode) {
          setTimeout(() => {
            handleTriggerMockWebhook(data.paymentId, mockScenario);
          }, 4000);
        }
      } else if (data.checkoutUrl && activeTab !== "card") {
        toast.success("Redirecting to secure payment checkout...");
        // In dev test mode, complete immediately
        if (isTestMode) {
          setTimeout(() => {
            handleTriggerMockWebhook(data.paymentId, mockScenario);
          }, 2000);
        } else {
          window.open(data.checkoutUrl, "_blank");
        }
      } else {
        // Card or Bank Transfer
        if (isTestMode) {
          setTimeout(() => {
            handleTriggerMockWebhook(data.paymentId, mockScenario);
          }, 2000);
        } else {
          toast.success("Payment initiated! Processing...");
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message);
      setStep("failed");
      toast.error(error.message);
    }
  };

  const handleReset = () => {
    setStep("input");
    setErrorMessage("");
    setCountdown(30);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        className="w-full max-w-xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl shadow-blue-500/20 overflow-hidden flex flex-col max-h-[92vh] transition-all duration-300"
      >
        {/* HEADER BAR */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#1e293b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--jungle-green)]/10 border border-[var(--jungle-green)]/40 flex items-center justify-center">
              <Zap className="text-[var(--jungle-green)]" size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white uppercase italic flex items-center gap-2">
                Jungle<span className="text-[var(--jungle-green)] not-italic">Pay</span>
                <span className="text-[10px] font-mono not-italic px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300">
                  MULTI-GATEWAY
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                {mode === "bet" ? "Instant Bet Settlement" : "Instant Wallet Deposit"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* BET / AMOUNT SUMMARY BAR */}
        <div className="px-6 py-3 bg-gradient-to-r from-black/80 to-[#18181e] border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                {mode === "bet" ? (betData?.title ? `Market: ${betData.title}` : "Bet Wager") : "Deposit Amount"}
              </span>
              <span className="text-xl font-black text-white font-mono flex items-center gap-1">
                ${amount.toFixed(2)}
                <span className="text-xs text-[var(--jungle-green)] font-normal">vCoins</span>
              </span>
            </div>
          </div>

          {/* Dev Test Mode Switch */}
          <div className="flex items-center gap-2 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            <FlaskConical size={14} className={isTestMode ? "text-[var(--jungle-green)]" : "text-gray-400"} />
            <span className="text-[11px] font-semibold text-gray-300">Test Mode</span>
            <button
              onClick={() => setIsTestMode(!isTestMode)}
              className={`w-7 h-4 rounded-full transition-colors relative p-0.5 ${
                isTestMode ? "bg-[var(--jungle-green)]" : "bg-white/20"
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full bg-black transition-transform ${
                  isTestMode ? "translate-x-3" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* MOCK SCENARIO SELECTOR (When Test Mode is Active) */}
        {isTestMode && step === "input" && (
          <div className="px-6 py-2 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center justify-between text-xs">
            <span className="text-yellow-400 font-medium flex items-center gap-1.5">
              <FlaskConical size={13} /> Simulation Outcome:
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setMockScenario("success")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  mockScenario === "success"
                    ? "bg-[var(--jungle-green)] text-black"
                    : "bg-white/5 text-gray-400 hover:text-white"
                }`}
              >
                Pass (Success)
              </button>
              <button
                onClick={() => setMockScenario("failure")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  mockScenario === "failure"
                    ? "bg-red-500 text-white"
                    : "bg-white/5 text-gray-400 hover:text-white"
                }`}
              >
                Fail (Decline)
              </button>
            </div>
          </div>
        )}

        {/* TAB NAVIGATION */}
        {step === "input" && (
          <div className="grid grid-cols-5 p-2 gap-1.5 bg-[#0a0a0c] border-b border-white/5">
            {/* 1. Mobile Money (Uganda) */}
            <button
              onClick={() => setActiveTab("mobile_money")}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all ${
                activeTab === "mobile_money"
                  ? "bg-[var(--jungle-green)]/15 border border-[var(--jungle-green)] text-white shadow-[0_0_12px_rgba(204,255,0,0.2)]"
                  : "bg-white/5 border border-transparent text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <span className="text-base leading-none mb-1">🇺🇬</span>
              <span className="text-[10px] font-bold leading-tight">MoMo</span>
              <span className="text-[8px] text-[var(--jungle-green)] font-mono">Uganda</span>
            </button>

            {/* 2. M-Pesa (Kenya) */}
            <button
              onClick={() => setActiveTab("mpesa")}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all ${
                activeTab === "mpesa"
                  ? "bg-green-500/20 border border-green-400 text-white shadow-[0_0_12px_rgba(34,197,94,0.2)]"
                  : "bg-white/5 border border-transparent text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <span className="text-base leading-none mb-1">🇰🇪</span>
              <span className="text-[10px] font-bold leading-tight">M-Pesa</span>
              <span className="text-[8px] text-green-400 font-mono">Kenya</span>
            </button>

            {/* 3. Card (Stripe) */}
            <button
              onClick={() => setActiveTab("card")}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all ${
                activeTab === "card"
                  ? "bg-blue-500/20 border border-blue-400 text-white shadow-[0_0_12px_rgba(59,130,246,0.2)]"
                  : "bg-white/5 border border-transparent text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <CreditCard size={15} className="mb-1 text-blue-400" />
              <span className="text-[10px] font-bold leading-tight">Cards</span>
              <span className="text-[8px] text-blue-400 font-mono">Global</span>
            </button>

            {/* 4. Paystack / Africa */}
            <button
              onClick={() => setActiveTab("paystack")}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all ${
                activeTab === "paystack"
                  ? "bg-emerald-500/20 border border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                  : "bg-white/5 border border-transparent text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <span className="text-base leading-none mb-1">🇳🇬</span>
              <span className="text-[10px] font-bold leading-tight">Paystack</span>
              <span className="text-[8px] text-emerald-400 font-mono">Nigeria</span>
            </button>

            {/* 5. Bank Transfer */}
            <button
              onClick={() => setActiveTab("bank_transfer")}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all ${
                activeTab === "bank_transfer"
                  ? "bg-purple-500/20 border border-purple-400 text-white shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                  : "bg-white/5 border border-transparent text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <Building2 size={15} className="mb-1 text-purple-400" />
              <span className="text-[10px] font-bold leading-tight">Wire</span>
              <span className="text-[8px] text-purple-400 font-mono">Transfer</span>
            </button>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* STEP 1: INPUTS PER TAB */}
          {step === "input" && (
            <div className="space-y-5">
              {/* TAB 1: UGANDA MOBILE MONEY */}
              {activeTab === "mobile_money" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🇺🇬</span>
                      <div>
                        <p className="text-xs font-bold text-white">Uganda Mobile Money</p>
                        <p className="text-[11px] text-gray-400">Instant USSD PIN Prompt</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400">Total in UGX</span>
                      <p className="text-sm font-mono font-bold text-[var(--jungle-green)]">
                        {ugxConverted.formatted}
                      </p>
                    </div>
                  </div>

                  {/* Provider toggle */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUgandaProvider("mtn_momo_uganda")}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                        ugandaProvider === "mtn_momo_uganda"
                          ? "bg-yellow-500/20 border-yellow-400 text-yellow-300"
                          : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      <span className="text-xs font-bold">MTN MoMo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUgandaProvider("airtel_uganda")}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                        ugandaProvider === "airtel_uganda"
                          ? "bg-red-500/20 border-red-400 text-red-300"
                          : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <span className="text-xs font-bold">Airtel Money</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                      Phone Number (Uganda)
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        placeholder="+256 770 000 000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-black/60 border border-white/15 rounded-xl px-4 py-3.5 text-white font-mono text-sm placeholder:text-gray-600 focus:outline-none focus:border-[var(--jungle-green)] transition-all"
                      />
                      <Smartphone
                        size={18}
                        className="absolute right-3.5 top-3.5 text-gray-500"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Include +256 or 07... (Example: +256 772 123456)
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: KENYA M-PESA */}
              {activeTab === "mpesa" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🇰🇪</span>
                      <div>
                        <p className="text-xs font-bold text-white">Safaricom Daraja M-Pesa</p>
                        <p className="text-[11px] text-gray-400">Lipa na M-Pesa STK Push</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400">Total in KES</span>
                      <p className="text-sm font-mono font-bold text-green-400">
                        {kesConverted.formatted}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                      M-Pesa Safaricom Phone
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        placeholder="+254 700 000 000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-black/60 border border-white/15 rounded-xl px-4 py-3.5 text-white font-mono text-sm placeholder:text-gray-600 focus:outline-none focus:border-green-400 transition-all"
                      />
                      <Smartphone
                        size={18}
                        className="absolute right-3.5 top-3.5 text-green-500"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Enter your Safaricom line (e.g. 254712345678 or 0712345678)
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: GLOBAL CARD (STRIPE & PAYPAL) */}
              {activeTab === "card" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="text-blue-400" size={20} />
                      <div>
                        <p className="text-xs font-bold text-white">Stripe 256-Bit Secure Card</p>
                        <p className="text-[11px] text-gray-400">Visa, Mastercard, Amex, Apple Pay</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400">Total Charged</span>
                      <p className="text-sm font-mono font-bold text-blue-400">${amount.toFixed(2)} USD</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-400 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
                        Card Number
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="4242 •••• •••• 4242"
                          maxLength={19}
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-blue-400 transition-all"
                        />
                        <CreditCard size={16} className="absolute right-3.5 top-3 text-gray-500" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
                          Expiry Date
                        </label>
                        <input
                          type="text"
                          placeholder="MM/YY"
                          maxLength={5}
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-blue-400 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
                          CVC / CVV
                        </label>
                        <div className="relative">
                          <input
                            type="password"
                            placeholder="•••"
                            maxLength={4}
                            value={cardCvc}
                            onChange={(e) => setCardCvc(e.target.value)}
                            className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-blue-400 transition-all"
                          />
                          <Lock size={14} className="absolute right-3 top-3 text-gray-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: NIGERIA / PAYSTACK & FLUTTERWAVE */}
              {activeTab === "paystack" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🇳🇬</span>
                      <div>
                        <p className="text-xs font-bold text-white">Paystack & Flutterwave</p>
                        <p className="text-[11px] text-gray-400">Nigeria Cards, USSD & Bank Accounts</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400">Total in NGN</span>
                      <p className="text-sm font-mono font-bold text-emerald-400">
                        {ngnConverted.formatted}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAfricaProvider("paystack")}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                        africaProvider === "paystack"
                          ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                          : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                      }`}
                    >
                      <span className="text-xs font-bold">Paystack (NG)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAfricaProvider("flutterwave")}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                        africaProvider === "flutterwave"
                          ? "bg-orange-500/20 border-orange-400 text-orange-300"
                          : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                      }`}
                    >
                      <span className="text-xs font-bold">Flutterwave</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="racer@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* TAB 5: BANK TRANSFER */}
              {activeTab === "bank_transfer" && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs">
                    <p className="font-bold text-purple-300 flex items-center gap-1.5 mb-1">
                      <Building2 size={14} /> Direct Bank Wire Settlement
                    </p>
                    <p className="text-gray-300 text-[11px]">
                      Transfer exact funds using your unique reference. Account balances will update automatically once verified.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-black/60 border border-white/15 space-y-2.5 text-xs font-mono">
                    <div className="flex justify-between items-center py-1 border-b border-white/10">
                      <span className="text-gray-400">Bank:</span>
                      <span className="font-bold text-white">Stanbic Bank / Equity Bank</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/10">
                      <span className="text-gray-400">Account No:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">9030018829401</span>
                        <button
                          onClick={() => copyToClipboard("9030018829401", "Account Number")}
                          className="text-gray-400 hover:text-[var(--jungle-green)]"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/10">
                      <span className="text-gray-400">Account Name:</span>
                      <span className="font-bold text-white">RUSH HOUR BET Interactive Ltd</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-400">Payment Reference:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--jungle-green)]">
                          JB-TRF-{amount.toFixed(0)}-{session?.user?.id?.slice(-4) || "8821"}
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              `JB-TRF-${amount.toFixed(0)}-${session?.user?.id?.slice(-4) || "8821"}`,
                              "Reference Code"
                            )
                          }
                          className="text-gray-400 hover:text-[var(--jungle-green)]"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTION BUTTON */}
              <div className="pt-2">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleInitiatePayment}
                  className="w-full py-4 px-6 rounded-xl font-black text-sm md:text-base tracking-wider uppercase text-white bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 hover:from-blue-500 hover:via-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer border-0"
                >
                  {activeTab === "mobile_money" && (
                    <>
                      Send MoMo Prompt <ArrowRight size={18} />
                    </>
                  )}
                  {activeTab === "mpesa" && (
                    <>
                      Trigger M-Pesa STK Push <ArrowRight size={18} />
                    </>
                  )}
                  {activeTab === "card" && (
                    <>
                      Pay ${amount.toFixed(2)} with Card <Lock size={16} />
                    </>
                  )}
                  {activeTab === "paystack" && (
                    <>
                      Proceed with Paystack <ArrowRight size={18} />
                    </>
                  )}
                  {activeTab === "bank_transfer" && (
                    <>
                      Confirm & Verify Transfer <CheckCircle2 size={18} />
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          )}

          {/* STEP 2: PROCESSING / WAITING STK PUSH */}
          {(step === "processing" || step === "waiting_stk") && (
            <div className="py-8 flex flex-col items-center text-center space-y-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-[var(--jungle-green)]/30 border-t-[var(--jungle-green)] animate-spin flex items-center justify-center" />
                <Smartphone
                  size={28}
                  className="absolute inset-0 m-auto text-[var(--jungle-green)] animate-pulse"
                />
              </div>

              <div className="space-y-1.5 max-w-sm">
                <h3 className="text-xl font-bold text-white">
                  {step === "waiting_stk" ? "Check Your Phone Screen" : "Processing Transaction..."}
                </h3>
                <p className="text-xs text-gray-400">
                  {instructionsText ||
                    "An instant authorization request was dispatched to your mobile device. Enter your PIN to approve."}
                </p>
              </div>

              {step === "waiting_stk" && (
                <div className="flex flex-col items-center gap-1 bg-black/40 px-4 py-2 rounded-xl border border-white/10">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">
                    Time Remaining
                  </span>
                  <span className="text-2xl font-black font-mono text-[var(--jungle-green)]">
                    {countdown}s
                  </span>
                </div>
              )}

              {isTestMode && (
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs space-y-2 w-full max-w-md">
                  <span className="text-gray-400 block text-[11px]">
                    🧪 Fast-forward simulated webhook callback:
                  </span>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => handleTriggerMockWebhook(activePaymentId, "success")}
                      className="px-3 py-1.5 rounded-lg bg-[var(--jungle-green)] text-black font-bold text-xs"
                    >
                      Simulate User Approved PIN
                    </button>
                    <button
                      onClick={() => handleTriggerMockWebhook(activePaymentId, "failure")}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-xs"
                    >
                      Simulate Decline
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: SUCCESS STATE */}
          {step === "success" && (
            <div className="py-6 flex flex-col items-center text-center space-y-5">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-20 h-20 rounded-full bg-[var(--jungle-green)]/20 border-2 border-[var(--jungle-green)] flex items-center justify-center shadow-[0_0_40px_rgba(204,255,0,0.4)]"
              >
                <CheckCircle2 size={44} className="text-[var(--jungle-green)]" />
              </motion.div>

              <div className="space-y-1">
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">
                  Payment <span className="text-[var(--jungle-green)]">Confirmed!</span>
                </h3>
                <p className="text-xs text-gray-300">
                  {mode === "bet"
                    ? "Your wager is locked in. Traffic AI analysis is now live!"
                    : "Credits added to your RUSH HOUR BET balance."}
                </p>
              </div>

              <div className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-xs font-mono space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-gray-400">Payment ID:</span>
                  <span className="text-white font-bold">{activePaymentId}</span>
                </div>
                {activeBetId && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Bet ID:</span>
                    <span className="text-[var(--jungle-green)] font-bold">{activeBetId}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount:</span>
                  <span className="text-white font-bold">${amount.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-emerald-400 font-bold">SETTLED & ACTIVE</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-4 rounded-xl font-black text-sm tracking-wider uppercase text-black bg-[var(--jungle-green)] shadow-[0_0_20px_rgba(204,255,0,0.4)] hover:scale-105 active:scale-95 transition-all"
              >
                {mode === "bet" ? "View Live Race Feed" : "Return to Game"}
              </button>
            </div>
          )}

          {/* STEP 4: FAILED STATE */}
          {step === "failed" && (
            <div className="py-6 flex flex-col items-center text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                <AlertCircle size={44} className="text-red-500" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">Payment Unsuccessful</h3>
                <p className="text-xs text-red-300 max-w-sm">
                  {errorMessage || "The transaction was cancelled or declined by your provider."}
                </p>
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={handleReset}
                  className="flex-1 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={15} /> Try Again
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider text-gray-400 hover:text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER BADGES */}
        <div className="px-6 py-2.5 bg-black/60 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <Lock size={11} className="text-[var(--jungle-green)]" /> Bank-grade 256-bit SSL
          </span>
          <span>Uganda • Kenya • Nigeria • Global</span>
        </div>
      </motion.div>
    </div>
  );
}
