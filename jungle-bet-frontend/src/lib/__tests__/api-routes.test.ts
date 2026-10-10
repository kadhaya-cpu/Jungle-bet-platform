import { POST as initiateRoute } from "../../app/api/payment/initiate/route";
import { POST as webhookRoute, GET as webhookGetRoute } from "../../app/api/payment/webhook/route";
import { NextRequest } from "next/server";
import { paymentDb } from "../payment-db";

async function runApiRouteTests() {
  console.log("\n=======================================================");
  console.log("🌐 TESTING NEXT.JS PAYMENT API ROUTES (END-TO-END)");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${detail ? `-> ${detail}` : ""}`);
      failed++;
    }
  }

  // ------------------------------------------------------------------
  // 1. Health check GET /api/payment/webhook
  // ------------------------------------------------------------------
  const getReq = new NextRequest("http://localhost:3000/api/payment/webhook");
  const getRes = await webhookGetRoute(getReq);
  const getData = await getRes.json();
  assert(getRes.status === 200 && getData.status === "active", "GET /api/payment/webhook returns 200 health check");

  // ------------------------------------------------------------------
  // 2. POST /api/payment/initiate with Bet Placement (M-Pesa Kenya)
  // ------------------------------------------------------------------
  const initiateMpesaReq = new NextRequest("http://localhost:3000/api/payment/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: 100,
      provider: "mpesa_kenya",
      country: "KE",
      phoneNumber: "+254712345678",
      betData: {
        betType: "count_prediction",
        criteria: { target_count: 13, operator: "over" },
        amount: 100,
        title: "OVER 13",
        odds: "3.60x",
      },
      isMock: true,
      mockScenario: "success",
    }),
  });

  const mpesaRes = await initiateRoute(initiateMpesaReq);
  const mpesaData = await mpesaRes.json();

  assert(mpesaRes.status === 200 && mpesaData.success === true, "POST /api/payment/initiate returns success for M-Pesa");
  assert(!!mpesaData.paymentId && !!mpesaData.betId, `Created payment [${mpesaData.paymentId}] and pending bet [${mpesaData.betId}]`);
  assert(mpesaData.stkPushSent === true, "M-Pesa STK Push flag returned to client");

  // Verify bet is stored as payment_pending in DB
  const storedBet = await paymentDb.getPendingBet(mpesaData.betId);
  assert(storedBet?.status === "payment_pending", `Bet record in DB is pending payment (status: ${storedBet?.status})`);

  // ------------------------------------------------------------------
  // 3. POST /api/payment/webhook (M-Pesa STK Push Callback)
  // ------------------------------------------------------------------
  const mpesaWebhookReq = new NextRequest("http://localhost:3000/api/payment/webhook?provider=mpesa_kenya", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Body: {
        stkCallback: {
          MerchantRequestID: "MR-998811",
          CheckoutRequestID: mpesaData.providerReference || mpesaData.paymentId,
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: 13000 },
              { Name: "MpesaReceiptNumber", Value: "QWE998877" },
              { Name: "PhoneNumber", Value: 254712345678 },
            ],
          },
        },
      },
    }),
  });

  const webhookRes = await webhookRoute(mpesaWebhookReq);
  const webhookData = await webhookRes.json();

  assert(webhookRes.status === 200 && webhookData.received === true, "M-Pesa Webhook processed with 200 OK");
  assert(webhookData.status === "completed", `Payment marked as completed via webhook: [${webhookData.status}]`);

  // Verify that the pending bet was activated in the database!
  const activatedBet = await paymentDb.getPendingBet(mpesaData.betId);
  assert(activatedBet?.status === "pending", `Pending bet in DB successfully activated to [${activatedBet?.status}] (ready for race analysis)`);

  // ------------------------------------------------------------------
  // 4. POST /api/payment/webhook with Invalid Signature
  // ------------------------------------------------------------------
  const invalidStripeReq = new NextRequest("http://localhost:3000/api/payment/webhook?provider=paystack", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-paystack-signature": "tampered_fake_signature",
    },
    body: JSON.stringify({ event: "charge.success", data: { reference: "fake" } }),
  });

  const invalidRes = await webhookRoute(invalidStripeReq);
  assert(invalidRes.status === 400, "Webhook with invalid signature properly rejected with 400 Bad Request");

  // ------------------------------------------------------------------
  // 5. POST /api/payment/initiate with Card (Stripe)
  // ------------------------------------------------------------------
  const stripeReq = new NextRequest("http://localhost:3000/api/payment/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: 50,
      provider: "stripe",
      country: "US",
      isMock: true,
    }),
  });
  const stripeRes = await initiateRoute(stripeReq);
  const stripeData = await stripeRes.json();
  assert(stripeRes.status === 200 && !!stripeData.clientSecret, "Stripe initiation returned clientSecret");

  console.log("\n=======================================================");
  console.log(`🏁 API ROUTE TESTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runApiRouteTests().catch((e) => {
  console.error("API Route test failed:", e);
  process.exit(1);
});
