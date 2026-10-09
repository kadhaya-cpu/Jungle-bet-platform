import axios from "axios";
import Stripe from "stripe";
import { paymentDb } from "../payment-db";
import { authUserService } from "../auth-user-service";

const NEXTJS_BASE_URL = "http://localhost:3000";
const FASTAPI_BASE_URL = "http://localhost:8000";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || "sk_test_mock_stripe_key_junglebet";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_mock_stripe_webhook_secret";
const MPESA_PASSKEY = process.env.MPESA_PASSKEY || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

async function runPaymentWebhookValidationTests() {
  console.log("\n=======================================================");
  console.log("💳 PAYMENT WEBHOOKS VALIDATION & SIMULATION SUITE");
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

  const testUserId = "test_user_01";

  // ------------------------------------------------------------------
  // 1. Validate /api/webhooks/stripe is reachable using env secrets
  // ------------------------------------------------------------------
  console.log("\n🔍 Step 1: Validating Stripe Webhook Endpoint Reachability...");
  try {
    const res = await axios.get(`${NEXTJS_BASE_URL}/api/webhooks/stripe`);
    assert(res.status === 200, "Next.js GET /api/webhooks/stripe returns 200 OK");
    assert(res.data.status === "active" && res.data.reachable === true, "Endpoint reports active & reachable status");
    assert(res.data.secretConfigured === true, "Endpoint verifies STRIPE_WEBHOOK_SECRET is configured in environment");
  } catch (err: any) {
    assert(false, "Next.js GET /api/webhooks/stripe reachable", err.message);
  }

  try {
    const resFastApi = await axios.get(`${FASTAPI_BASE_URL}/api/webhooks/stripe`);
    assert(resFastApi.status === 200, "FastAPI GET /api/webhooks/stripe returns 200 OK");
    assert(resFastApi.data.reachable === true, "FastAPI Stripe endpoint reports reachable status");
  } catch (err: any) {
    assert(false, "FastAPI GET /api/webhooks/stripe reachable", err.message);
  }

  // ------------------------------------------------------------------
  // 2. Validate /api/webhooks/mpesa is reachable using env secrets
  // ------------------------------------------------------------------
  console.log("\n🔍 Step 2: Validating M-Pesa Webhook Endpoint Reachability...");
  try {
    const res = await axios.get(`${NEXTJS_BASE_URL}/api/webhooks/mpesa`);
    assert(res.status === 200, "Next.js GET /api/webhooks/mpesa returns 200 OK");
    assert(res.data.status === "active" && res.data.reachable === true, "Endpoint reports active & reachable status");
    assert(res.data.secretConfigured === true, "Endpoint verifies MPESA secrets configured in environment");
  } catch (err: any) {
    assert(false, "Next.js GET /api/webhooks/mpesa reachable", err.message);
  }

  try {
    const resFastApi = await axios.get(`${FASTAPI_BASE_URL}/api/webhooks/mpesa`);
    assert(resFastApi.status === 200, "FastAPI GET /api/webhooks/mpesa returns 200 OK");
    assert(resFastApi.data.reachable === true, "FastAPI M-Pesa endpoint reports reachable status");
  } catch (err: any) {
    assert(false, "FastAPI GET /api/webhooks/mpesa reachable", err.message);
  }

  // ------------------------------------------------------------------
  // 3. Security: Validate invalid secret signatures are rejected (400)
  // ------------------------------------------------------------------
  console.log("\n🔒 Step 3: Validating Secret Verification & Signature Rejection...");
  try {
    await axios.post(
      `${NEXTJS_BASE_URL}/api/webhooks/stripe`,
      JSON.stringify({ type: "payment_intent.succeeded" }),
      {
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "t=1234567,v1=forged_invalid_signature_hash",
        },
      }
    );
    assert(false, "Tampered Stripe signature rejected", "Expected HTTP 400 but succeeded");
  } catch (err: any) {
    assert(err.response?.status === 400, "Stripe endpoint rejects forged signature with 400 Bad Request");
  }

  try {
    await axios.post(
      `${NEXTJS_BASE_URL}/api/webhooks/mpesa`,
      { userId: testUserId, amount: 5000 },
      {
        headers: {
          "Content-Type": "application/json",
          "x-mpesa-secret": "unauthorized_secret_key",
        },
      }
    );
    assert(false, "Unauthorized M-Pesa secret rejected", "Expected HTTP 400 but succeeded");
  } catch (err: any) {
    assert(err.response?.status === 400, "M-Pesa endpoint rejects unauthorized secret with 400 Bad Request");
  }

  // ------------------------------------------------------------------
  // 4. Record baseline balance for test_user_01
  // ------------------------------------------------------------------
  console.log("\n💰 Step 4: Baseline Balance for test_user_01...");
  const initialBalance = await paymentDb.getUserBalance(testUserId);
  console.log(`  ℹ️ Initial balance for ${testUserId}: ${initialBalance} UGX`);

  // ------------------------------------------------------------------
  // 5. Simulate Payment Success Event for 5000 UGX via Stripe
  // ------------------------------------------------------------------
  console.log("\n🧪 Step 5: Simulating Stripe Payment Success (5000 UGX) without real money...");
  const stripeSdk = new Stripe(STRIPE_SECRET_KEY);
  const stripePayload = JSON.stringify({
    id: `evt_sim_stripe_${Date.now()}`,
    object: "event",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: `pi_sim_${Date.now()}`,
        amount: 5000,
        currency: "ugx",
        status: "succeeded",
        metadata: {
          userId: testUserId,
          paymentId: `pay_stripe_sim_${Date.now()}`,
          amount: 5000,
          currency: "UGX",
        },
      },
    },
  });

  const validStripeSig = stripeSdk.webhooks.generateTestHeaderString({
    payload: stripePayload,
    secret: STRIPE_WEBHOOK_SECRET,
  });

  const stripeRes = await axios.post(
    `${NEXTJS_BASE_URL}/api/webhooks/stripe`,
    stripePayload,
    {
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": validStripeSig,
      },
    }
  );

  assert(stripeRes.status === 200, "Stripe simulation POST returns 200 OK");
  assert(stripeRes.data.received === true, "Stripe webhook event acknowledged as received");
  assert(stripeRes.data.status === "completed", "Payment marked as completed");
  assert(Number(stripeRes.data.amount) === 5000, "Webhook payload recorded 5000 UGX amount");

  const balanceAfterStripe = await paymentDb.getUserBalance(testUserId);
  assert(
    balanceAfterStripe === initialBalance + 5000,
    `Balance updated after Stripe webhook: ${initialBalance} -> ${balanceAfterStripe} UGX (+5000 UGX)`
  );

  // ------------------------------------------------------------------
  // 6. Simulate Payment Success Event for 5000 UGX via M-Pesa STK Push
  // ------------------------------------------------------------------
  console.log("\n🧪 Step 6: Simulating M-Pesa STK Callback Payment Success (5000 UGX) without real money...");
  const mpesaCheckoutId = `ws_CO_sim_${Date.now()}`;
  const mpesaPayload = {
    userId: testUserId,
    currency: "UGX",
    Body: {
      stkCallback: {
        MerchantRequestID: `MR_sim_${Date.now()}`,
        CheckoutRequestID: mpesaCheckoutId,
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: 5000 },
            { Name: "MpesaReceiptNumber", Value: `NLJ${Date.now().toString().slice(-6)}` },
            { Name: "PhoneNumber", Value: "256700000001" },
            { Name: "TransactionDate", Value: 20261008143500 },
          ],
        },
      },
    },
  };

  const mpesaRes = await axios.post(
    `${NEXTJS_BASE_URL}/api/webhooks/mpesa`,
    mpesaPayload,
    {
      headers: {
        "Content-Type": "application/json",
        "x-mpesa-secret": MPESA_PASSKEY,
      },
    }
  );

  assert(mpesaRes.status === 200, "M-Pesa simulation POST returns 200 OK");
  assert(mpesaRes.data.received === true, "M-Pesa callback event acknowledged as received");
  assert(mpesaRes.data.status === "completed", "M-Pesa payment marked as completed");
  assert(Number(mpesaRes.data.amount) === 5000, "M-Pesa payload recorded 5000 UGX amount");

  const balanceAfterMpesa = await paymentDb.getUserBalance(testUserId);
  assert(
    balanceAfterMpesa === balanceAfterStripe + 5000,
    `Balance updated after M-Pesa webhook: ${balanceAfterStripe} -> ${balanceAfterMpesa} UGX (+5000 UGX)`
  );

  // ------------------------------------------------------------------
  // 7. Verify balance in AuthUserService & User API
  // ------------------------------------------------------------------
  console.log("\n👤 Step 7: Verifying user balance in AuthUserService and User Balance API...");
  const authUser = authUserService.findUserById(testUserId);
  assert(authUser !== null, "User found in AuthUserService");
  assert(authUser?.balance === balanceAfterMpesa, `AuthUserService profile balance equals ${balanceAfterMpesa}`);

  const userApiRes = await axios.get(`${NEXTJS_BASE_URL}/api/user/balance?userId=${testUserId}`);
  assert(userApiRes.status === 200, "GET /api/user/balance returns 200 OK");
  assert(
    userApiRes.data.balance === balanceAfterMpesa,
    `GET /api/user/balance reports expected total balance: ${userApiRes.data.balance} UGX`
  );

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`🏁 VALIDATION RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPaymentWebhookValidationTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
