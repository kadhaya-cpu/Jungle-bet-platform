import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments";
import { paymentDb } from "@/lib/payment-db";

/**
 * Health check & reachability validation for M-Pesa webhook
 */
export async function GET() {
  const secretConfigured = Boolean(
    process.env.MPESA_PASSKEY ||
    process.env.MPESA_CONSUMER_KEY ||
    process.env.MPESA_CONSUMER_SECRET ||
    process.env.MPESA_WEBHOOK_SECRET
  );

  return NextResponse.json({
    status: "active",
    reachable: true,
    provider: "mpesa",
    endpoint: "/api/webhooks/mpesa",
    secretConfigured,
    message: "Payment Webhook endpoint at /api/webhooks/mpesa is reachable using secrets from environment variables.",
    timestamp: new Date().toISOString(),
  });
}

/**
 * M-Pesa Safaricom Daraja STK Push Callback and Webhook handler
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Convert NextRequest headers
    const headers: Record<string, string | undefined> = {};
    req.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val;
    });

    const provider = getPaymentProvider("mpesa_kenya");
    const verification = await provider.verifyWebhook(headers, rawBody);

    if (!verification.isValid) {
      return NextResponse.json(
        { error: verification.error || "M-Pesa webhook validation failed." },
        { status: 400 }
      );
    }

    // Locate or resolve payment record
    const lookupKey = verification.paymentId || verification.providerReference;
    let payment = lookupKey ? await paymentDb.getPayment(lookupKey) : null;
    if (!payment && verification.providerReference) {
      payment = await paymentDb.getPayment(verification.providerReference);
    }

    // Direct fallback for simulated webhooks or direct Daraja callbacks
    const rawObj =
      typeof verification.rawEvent === "object" && verification.rawEvent !== null
        ? (verification.rawEvent as Record<string, any>)
        : {};
    const fallbackUserId =
      (verification.metadata?.userId as string) ||
      rawObj.userId ||
      rawObj.metadata?.userId ||
      (verification.paymentId?.startsWith("test_user_") || verification.paymentId?.startsWith("usr_")
        ? verification.paymentId
        : undefined);
    const fallbackAmount =
      verification.amount !== undefined
        ? verification.amount
        : rawObj.amount !== undefined
        ? rawObj.amount
        : rawObj.TransAmount !== undefined
        ? parseFloat(rawObj.TransAmount)
        : undefined;
    const fallbackCurrency = verification.currency || rawObj.currency || "UGX";

    if (!payment && fallbackUserId && fallbackAmount !== undefined) {
      const generatedPayId = verification.paymentId || `pay_mpesa_${Date.now()}`;
      payment = {
        id: generatedPayId,
        userId: String(fallbackUserId),
        amount: Number(fallbackAmount),
        currency: fallbackCurrency,
        provider: "mpesa_kenya",
        status: verification.status,
        providerReference: verification.providerReference,
        metadata: verification.metadata,
      };
      await paymentDb.savePayment(payment);
    }

    let updatedBalance: number | undefined = undefined;

    if (payment) {
      await paymentDb.updatePaymentStatus(
        payment.id,
        verification.status,
        verification.providerReference,
        verification.metadata
      );

      if (verification.status === "completed") {
        if (payment.betId) {
          await paymentDb.confirmPendingBet(payment.betId);
        } else {
          updatedBalance = await paymentDb.creditUserBalance(
            payment.userId,
            payment.amount,
            `Deposit via M-Pesa Webhook (${payment.id})`
          );
        }
      }
    }

    return NextResponse.json({
      received: true,
      provider: "mpesa",
      status: verification.status,
      paymentId: payment?.id || verification.paymentId,
      userId: payment?.userId || fallbackUserId,
      amount: payment?.amount || fallbackAmount,
      currency: payment?.currency || fallbackCurrency,
      balance: updatedBalance !== undefined ? updatedBalance : (fallbackUserId ? await paymentDb.getUserBalance(String(fallbackUserId)) : undefined),
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[M-Pesa Webhook Route Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process M-Pesa webhook." },
      { status: 500 }
    );
  }
}
