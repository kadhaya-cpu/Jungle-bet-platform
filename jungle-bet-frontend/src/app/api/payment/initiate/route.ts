import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getPaymentProvider,
  detectUserCountry,
  PaymentProviderId,
  SupportedCurrency,
  SupportedCountry,
  BetData,
} from "@/lib/payments";
import { paymentDb } from "@/lib/payment-db";
import { fraudDetector } from "@/lib/fraud-detector";
import { authUserService } from "@/lib/auth-user-service";

export async function POST(req: NextRequest) {
  try {
    let session = null;
    try {
      session = await auth();
    } catch {
      // Safe fallback when executed outside standard Next request store
    }
    const body = await req.json();

    const {
      amount,
      currency,
      provider = "mtn_momo_uganda",
      country,
      phoneNumber,
      customerEmail,
      customerName,
      betData,
      isMock = false,
      mockScenario = "success",
    } = body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid payment amount. Amount must be greater than 0." },
        { status: 400 }
      );
    }

    // Determine user ID
    const userId =
      session?.user?.id ||
      body.userId ||
      (session?.user?.phone ? `usr_${session.user.phone}` : "usr_guest_demo");

    // Detect user country
    const detectedCountry: SupportedCountry =
      country ||
      detectUserCountry({
        phone: phoneNumber || session?.user?.phone || undefined,
        headers: req.headers,
      });

    // Default target currency
    const targetCurrency: SupportedCurrency =
      currency ||
      (detectedCountry === "UG"
        ? "UGX"
        : detectedCountry === "KE"
        ? "KES"
        : detectedCountry === "NG"
        ? "NGN"
        : "USD");

    // Check if user account is banned
    const userProfile = authUserService.findUserById(userId);
    if (userProfile?.isBanned) {
      return NextResponse.json(
        { error: "This account has been banned by Jungle Bet Security & Fraud Prevention." },
        { status: 403 }
      );
    }

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let betId: string | undefined = undefined;

    // If betData is attached, store pending bet in the database and trigger fraud detection hook
    if (betData) {
      betId = `bet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Execute Fraud Hook: Check if user places >5 bets in 1 minute
      const fraudCheck = fraudDetector.recordBet(userId, betData.amount || amount, betId);
      if (fraudCheck.isSuspicious) {
        console.warn(`[FRAUD SYSTEM] Flagged account ${userId} for suspicious betting rate.`);
      }

      await paymentDb.createPendingBet({
        id: betId,
        userId,
        betType: betData.betType || "count_prediction",
        criteria: betData.criteria || {},
        amount: betData.amount || amount,
        status: "payment_pending",
        paymentId,
      });
    }

    // Save initial payment record
    await paymentDb.savePayment({
      id: paymentId,
      userId,
      betId,
      amount,
      currency: targetCurrency,
      provider,
      status: "pending",
      phoneNumber,
      customerEmail: customerEmail || session?.user?.email || undefined,
      country: detectedCountry,
      metadata: {
        isMock,
        mockScenario,
        betData: betData as BetData,
      },
    });

    // Call the modular provider
    const paymentProvider = getPaymentProvider(provider as PaymentProviderId);
    const result = await paymentProvider.initiate({
      paymentId,
      userId,
      amount,
      currency: targetCurrency,
      provider: provider as PaymentProviderId,
      country: detectedCountry,
      phoneNumber,
      customerEmail: customerEmail || session?.user?.email || undefined,
      customerName: customerName || session?.user?.name || undefined,
      betData,
      isMock,
      mockScenario,
      redirectUrl: `${req.nextUrl.origin}/payment/callback?paymentId=${paymentId}`,
    });

    // Update payment record with provider reference
    if (result.providerReference) {
      await paymentDb.updatePaymentStatus(
        paymentId,
        result.status,
        result.providerReference,
        result.metadata
      );
    }

    return NextResponse.json({
      ...result,
      betId,
      detectedCountry,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Payment Initiate Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initiate payment gateway." },
      { status: 500 }
    );
  }
}
