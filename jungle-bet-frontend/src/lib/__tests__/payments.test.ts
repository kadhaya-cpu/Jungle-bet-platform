import crypto from "crypto";
import {
  detectUserCountry,
  suggestPaymentMethod,
  convertUSDToCurrency,
  getPaymentProvider,
  getAllPaymentProviders,
  PaymentProviderId,
} from "../payments";
import { paymentDb } from "../payment-db";

async function runTests() {
  console.log("\n=======================================================");
  console.log("🦁 JUNGLE BET MULTI-COUNTRY PAYMENT GATEWAY TEST SUITE");
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
  // TEST 1: Country Detection
  // ------------------------------------------------------------------
  console.log("--- 1. Testing Country Detection Helpers ---");
  assert(detectUserCountry({ phone: "+256772123456" }) === "UG", "Detect Uganda from phone +256");
  assert(detectUserCountry({ phone: "+254712345678" }) === "KE", "Detect Kenya from phone +254");
  assert(detectUserCountry({ phone: "+2348012345678" }) === "NG", "Detect Nigeria from phone +234");
  assert(detectUserCountry({ phone: "+14155552671" }) === "US", "Detect USA from phone +1");
  assert(detectUserCountry({ phone: "+447911123456" }) === "GB", "Detect UK from phone +44");

  const cfHeaders = { "cf-ipcountry": "KE" };
  assert(detectUserCountry({ headers: cfHeaders }) === "KE", "Detect Kenya from Cloudflare cf-ipcountry header");

  const vercelHeaders = { "x-vercel-ip-country": "NG" };
  assert(detectUserCountry({ headers: vercelHeaders }) === "NG", "Detect Nigeria from Vercel header");

  // ------------------------------------------------------------------
  // TEST 2: Payment Method Suggestions
  // ------------------------------------------------------------------
  console.log("\n--- 2. Testing Payment Method Suggestions ---");
  const ugSuggest = suggestPaymentMethod("UG");
  assert(ugSuggest.method === "mobile_money" && ugSuggest.currency === "UGX", "Suggest Mobile Money in UGX for Uganda");

  const keSuggest = suggestPaymentMethod("KE");
  assert(keSuggest.method === "mpesa" && keSuggest.currency === "KES", "Suggest M-Pesa in KES for Kenya");

  const ngSuggest = suggestPaymentMethod("NG");
  assert(ngSuggest.method === "paystack" && ngSuggest.currency === "NGN", "Suggest Paystack in NGN for Nigeria");

  const usSuggest = suggestPaymentMethod("US");
  assert(usSuggest.method === "card" && usSuggest.currency === "USD", "Suggest Card in USD for USA / Global");

  // ------------------------------------------------------------------
  // TEST 3: Currency Conversions & Formats
  // ------------------------------------------------------------------
  console.log("\n--- 3. Testing Currency Conversions ---");
  const ugx = convertUSDToCurrency(100, "UGX");
  assert(ugx.amount === 375000 && ugx.formatted === "UGX 375,000", "Convert $100 to 375,000 UGX");

  const kes = convertUSDToCurrency(100, "KES");
  assert(kes.amount === 13000 && kes.formatted === "KES 13,000", "Convert $100 to 13,000 KES");

  const ngn = convertUSDToCurrency(100, "NGN");
  assert(ngn.amount === 150000 && ngn.formatted === "₦150,000", "Convert $100 to ₦150,000 NGN");

  // ------------------------------------------------------------------
  // TEST 4: Provider Registry
  // ------------------------------------------------------------------
  console.log("\n--- 4. Testing Provider Registry ---");
  const providers = getAllPaymentProviders();
  assert(providers.length >= 7, `Registered ${providers.length} payment providers`);

  const providerIds: PaymentProviderId[] = [
    "mtn_momo_uganda",
    "mpesa_kenya",
    "stripe",
    "paypal",
    "paystack",
    "flutterwave",
    "bank_transfer",
  ];
  for (const id of providerIds) {
    const p = getPaymentProvider(id);
    assert(!!p && p.id === id, `Provider [${id}] resolved: ${p.name}`);
  }

  // ------------------------------------------------------------------
  // TEST 5: Payment Initiation (All Providers & Mock Scenarios)
  // ------------------------------------------------------------------
  console.log("\n--- 5. Testing Payment Initiation Flows ---");

  // 5a. Mobile Money Uganda
  const momoProvider = getPaymentProvider("mtn_momo_uganda");
  const momoRes = await momoProvider.initiate({
    paymentId: `pay_test_momo_${Date.now()}`,
    userId: "usr_test_ug",
    amount: 50,
    currency: "UGX",
    provider: "mtn_momo_uganda",
    country: "UG",
    phoneNumber: "+256770000000",
    isMock: true,
  });
  assert(momoRes.success && momoRes.stkPushSent === true, "MTN MoMo USSD push initiated successfully");
  assert(momoRes.convertedAmount === 187500, `Converted $50 to UGX ${momoRes.convertedAmount}`);

  // 5b. M-Pesa Kenya
  const mpesaProvider = getPaymentProvider("mpesa_kenya");
  const mpesaRes = await mpesaProvider.initiate({
    paymentId: `pay_test_mpesa_${Date.now()}`,
    userId: "usr_test_ke",
    amount: 100,
    currency: "KES",
    provider: "mpesa_kenya",
    country: "KE",
    phoneNumber: "+254700000000",
    isMock: true,
  });
  assert(mpesaRes.success && mpesaRes.stkPushSent === true, "M-Pesa STK Push initiated successfully");
  assert(mpesaRes.convertedAmount === 13000, `Converted $100 to KES ${mpesaRes.convertedAmount}`);

  // 5c. Stripe Card
  const stripeProvider = getPaymentProvider("stripe");
  const stripeRes = await stripeProvider.initiate({
    paymentId: `pay_test_stripe_${Date.now()}`,
    userId: "usr_test_us",
    amount: 25,
    currency: "USD",
    provider: "stripe",
    country: "US",
    isMock: true,
  });
  assert(stripeRes.success && !!stripeRes.clientSecret, "Stripe PaymentIntent created with clientSecret");

  // 5d. Paystack Nigeria
  const paystackProvider = getPaymentProvider("paystack");
  const paystackRes = await paystackProvider.initiate({
    paymentId: `pay_test_pstk_${Date.now()}`,
    userId: "usr_test_ng",
    amount: 10,
    currency: "NGN",
    provider: "paystack",
    country: "NG",
    customerEmail: "racer@junglebet.io",
    isMock: true,
  });
  assert(paystackRes.success && !!paystackRes.providerReference, "Paystack transaction initialized with reference");

  // 5e. Flutterwave Pan-African
  const flwProvider = getPaymentProvider("flutterwave");
  const flwRes = await flwProvider.initiate({
    paymentId: `pay_test_flw_${Date.now()}`,
    userId: "usr_test_gh",
    amount: 40,
    currency: "USD",
    provider: "flutterwave",
    country: "GH",
    isMock: true,
  });
  assert(flwRes.success && !!flwRes.checkoutUrl, "Flutterwave checkout URL generated");

  // 5f. Bank Transfer with unique reference
  const bankProvider = getPaymentProvider("bank_transfer");
  const bankRes = await bankProvider.initiate({
    paymentId: `pay_test_bank_${Date.now()}`,
    userId: "usr_test_bank",
    amount: 500,
    currency: "UGX",
    provider: "bank_transfer",
    country: "UG",
  });
  assert(bankRes.success && Boolean(bankRes.instructions?.includes("Stanbic Bank")), "Bank transfer instructions with Stanbic Bank");
  assert(Boolean(bankRes.providerReference?.startsWith("JB-TRF")), "Unique Bank reference code generated");

  // 5g. Mock Failure Scenario
  const mockProvider = getPaymentProvider("mock_provider");
  const mockFailRes = await mockProvider.initiate({
    paymentId: `pay_test_mock_fail_${Date.now()}`,
    userId: "usr_test",
    amount: 10,
    currency: "USD",
    provider: "mock_provider",
    country: "UG",
    isMock: true,
    mockScenario: "failure",
  });
  assert(!mockFailRes.success && mockFailRes.status === "failed", "Mock failure scenario handled cleanly");

  // ------------------------------------------------------------------
  // TEST 6: Webhook Signature Verification
  // ------------------------------------------------------------------
  console.log("\n--- 6. Testing Webhook Signatures & Verification ---");

  // 6a. Paystack HMAC SHA-512 Verification
  const paystackSecret = "sk_test_mock_paystack_secret_key";
  process.env.PAYSTACK_SECRET_KEY = paystackSecret;

  const paystackPayload = JSON.stringify({
    event: "charge.success",
    data: {
      reference: "PSTK-REF-998811",
      amount: 15000000, // In kobo
      currency: "NGN",
      metadata: { paymentId: "pay_test_pstk_webhook" },
    },
  });

  const validPaystackSig = crypto.createHmac("sha512", paystackSecret).update(paystackPayload).digest("hex");
  const invalidPaystackSig = "bad_signature_attempt_123456";

  const pstkValidVerification = await paystackProvider.verifyWebhook(
    { "x-paystack-signature": validPaystackSig },
    paystackPayload
  );
  assert(pstkValidVerification.isValid && pstkValidVerification.status === "completed", "Paystack valid signature verified");

  const pstkInvalidVerification = await paystackProvider.verifyWebhook(
    { "x-paystack-signature": invalidPaystackSig },
    paystackPayload
  );
  assert(!pstkInvalidVerification.isValid, "Paystack invalid signature rejected");

  // 6b. Flutterwave Hash Verification
  const flwSecretHash = "mock_flw_secret_hash_2026";
  process.env.FLUTTERWAVE_WEBHOOK_SECRET = flwSecretHash;

  const flwPayload = JSON.stringify({
    event: "charge.completed",
    data: {
      id: 887766,
      tx_ref: "FLW-TX-123456",
      status: "successful",
      amount: 40,
      currency: "USD",
    },
  });

  const flwValidVerification = await flwProvider.verifyWebhook(
    { "verif-hash": flwSecretHash },
    flwPayload
  );
  assert(flwValidVerification.isValid && flwValidVerification.status === "completed", "Flutterwave secret hash verified");

  const flwInvalidVerification = await flwProvider.verifyWebhook(
    { "verif-hash": "wrong-hash" },
    flwPayload
  );
  assert(!flwInvalidVerification.isValid, "Flutterwave invalid hash rejected");

  // 6c. Safaricom M-Pesa STK Callback
  const mpesaCallbackPayload = JSON.stringify({
    Body: {
      stkCallback: {
        MerchantRequestID: "MR-100200",
        CheckoutRequestID: "ws_CO_TEST_9988",
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: 1300 },
            { Name: "MpesaReceiptNumber", Value: "QWE123RTY" },
            { Name: "TransactionDate", Value: 20261007123000 },
            { Name: "PhoneNumber", Value: 254700000000 },
          ],
        },
      },
    },
  });

  const mpesaVerification = await mpesaProvider.verifyWebhook({}, mpesaCallbackPayload);
  assert(
    mpesaVerification.isValid &&
    mpesaVerification.status === "completed" &&
    mpesaVerification.metadata?.mpesaReceiptNumber === "QWE123RTY",
    "M-Pesa STK Callback verified with receipt number QWE123RTY"
  );

  // ------------------------------------------------------------------
  // TEST 7: Database Pending Bet Lifecycle & Webhook Confirmation
  // ------------------------------------------------------------------
  console.log("\n--- 7. Testing Database Pending Bets & Confirmation ---");

  const testBetId = `bet_e2e_${Date.now()}`;
  const testPaymentId = `pay_e2e_${Date.now()}`;

  // 1. Store pending bet in database before payment
  await paymentDb.createPendingBet({
    id: testBetId,
    userId: "usr_demo_vip_001",
    betType: "count_prediction",
    criteria: { target_count: 13, operator: "over" },
    amount: 100,
    status: "payment_pending",
    paymentId: testPaymentId,
  });

  const savedPendingBet = await paymentDb.getPendingBet(testBetId);
  assert(
    savedPendingBet !== null && savedPendingBet.status === "payment_pending",
    `Pending bet saved in database with status: [${savedPendingBet?.status}]`
  );

  // 2. Save payment record
  await paymentDb.savePayment({
    id: testPaymentId,
    userId: "usr_demo_vip_001",
    betId: testBetId,
    amount: 100,
    currency: "USD",
    provider: "stripe",
    status: "pending",
  });

  const savedPayment = await paymentDb.getPayment(testPaymentId);
  assert(
    savedPayment !== null && savedPayment.status === "pending",
    `Payment record saved in database with status: [${savedPayment?.status}]`
  );

  // 3. Confirm payment via webhook simulation
  await paymentDb.updatePaymentStatus(testPaymentId, "completed", "pi_mock_confirmed");
  const confirmedBet = await paymentDb.confirmPendingBet(testBetId);

  assert(
    confirmedBet !== null && confirmedBet.status === "pending",
    `Pending bet successfully confirmed & activated for live game with status: [${confirmedBet?.status}]`
  );

  // 4. Wallet deposit test
  const previousUserBalance = 500;
  const newBalance = await paymentDb.creditUserBalance("usr_demo_vip_001", 100, "Deposit test");
  assert(newBalance > previousUserBalance, `User balance credited: from ${previousUserBalance} to ${newBalance}`);

  // ------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test execution fatal error:", e);
  process.exit(1);
});
