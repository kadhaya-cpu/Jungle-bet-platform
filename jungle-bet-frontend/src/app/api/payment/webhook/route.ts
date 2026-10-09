import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider, PaymentProviderId } from "@/lib/payments";
import { paymentDb } from "@/lib/payment-db";
import axios from "axios";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const searchParams = req.nextUrl.searchParams;
    let providerParam = searchParams.get("provider") as PaymentProviderId | null;

    // Convert NextRequest headers to simple dictionary
    const headers: Record<string, string | undefined> = {};
    req.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val;
    });

    // Auto-detect provider from headers or payload if not in query params
    if (!providerParam) {
      if (headers["stripe-signature"]) {
        providerParam = "stripe";
      } else if (headers["x-paystack-signature"]) {
        providerParam = "paystack";
      } else if (headers["verif-hash"]) {
        providerParam = "flutterwave";
      } else {
        try {
          const parsed = JSON.parse(rawBody || "{}");
          if (parsed.Body?.stkCallback) {
            providerParam = "mpesa_kenya";
          } else if (parsed.payer && parsed.externalId) {
            providerParam = "mtn_momo_uganda";
          } else if (parsed.event_type?.startsWith("PAYMENT") || parsed.event_type?.startsWith("CHECKOUT")) {
            providerParam = "paypal";
          } else if (parsed.isMock || parsed.scenario) {
            providerParam = "mock_provider";
          }
        } catch {
          // Leave as null
        }
      }
    }

    if (!providerParam) {
      return NextResponse.json(
        { error: "Unable to detect payment provider for incoming webhook." },
        { status: 400 }
      );
    }

    // Verify webhook signature & parse event
    const provider = getPaymentProvider(providerParam);
    const verification = await provider.verifyWebhook(headers, rawBody);

    if (!verification.isValid) {
      return NextResponse.json(
        { error: verification.error || "Webhook signature verification failed." },
        { status: 400 }
      );
    }

    // Locate the payment record
    const lookupKey = verification.paymentId || verification.providerReference;
    let payment = lookupKey ? await paymentDb.getPayment(lookupKey) : null;

    if (!payment && verification.providerReference) {
      payment = await paymentDb.getPayment(verification.providerReference);
    }

    // Direct fallback for simulated webhooks or direct provider callbacks with userId and amount
    const rawObj = (typeof verification.rawEvent === "object" && verification.rawEvent !== null) ? (verification.rawEvent as Record<string, any>) : {};
    const fallbackUserId = (verification.metadata?.userId as string) || rawObj.userId || rawObj.data?.object?.metadata?.userId || (verification.paymentId?.startsWith("usr_") || verification.paymentId?.startsWith("test_user_") ? verification.paymentId : undefined);
    const fallbackAmount = verification.amount !== undefined ? verification.amount : (rawObj.amount !== undefined ? rawObj.amount : (rawObj.data?.object?.amount !== undefined ? rawObj.data.object.amount : undefined));
    const fallbackCurrency = verification.currency || rawObj.currency || "UGX";

    if (!payment && fallbackUserId && fallbackAmount !== undefined) {
      const generatedPayId = verification.paymentId || `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      payment = {
        id: generatedPayId,
        userId: String(fallbackUserId),
        amount: Number(fallbackAmount),
        currency: fallbackCurrency,
        provider: providerParam,
        status: verification.status,
        providerReference: verification.providerReference,
        metadata: verification.metadata,
      };
      await paymentDb.savePayment(payment);
    }

    // If payment record found, update its status
    if (payment) {
      await paymentDb.updatePaymentStatus(
        payment.id,
        verification.status,
        verification.providerReference,
        verification.metadata
      );

      // If payment completed successfully, activate bet or credit wallet!
      if (verification.status === "completed") {
        if (payment.betId) {
          // 1. Confirm Pending Bet in Database
          const confirmedBet = await paymentDb.confirmPendingBet(payment.betId);

          // 2. Proactively register with FastAPI backend if running
          try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            if (confirmedBet) {
              await axios.post(
                `${apiUrl}/bet/place`,
                {
                  bet_type: confirmedBet.betType,
                  criteria: confirmedBet.criteria,
                  amount: confirmedBet.amount,
                },
                { timeout: 2000 }
              ).catch(() => {
                // If backend requires token or is offline, bet is already safely active in database
              });
            }
          } catch {
            // Silently handle backend offline
          }
        } else {
          // Wallet deposit without bet
          await paymentDb.creditUserBalance(
            payment.userId,
            payment.amount,
            `Deposit via ${provider.name} (${payment.id})`
          );
        }
      }
    }

    return NextResponse.json({
      received: true,
      provider: providerParam,
      status: verification.status,
      paymentId: payment?.id || verification.paymentId,
      betId: payment?.betId,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Payment Webhook Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process payment webhook." },
      { status: 500 }
    );
  }
}

/**
 * GET route for webhook health check or testing
 */
export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider") || "all";
  return NextResponse.json({
    status: "active",
    message: "Jungle Bet Multi-Country Payment Webhook Gateway is healthy.",
    provider,
    timestamp: new Date().toISOString(),
  });
}
