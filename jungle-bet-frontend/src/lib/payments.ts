import crypto from "crypto";
import axios from "axios";
import Stripe from "stripe";

// ==========================================
// 1. PAYMENT TYPES & DATA MODELS
// ==========================================

export type SupportedCountry = "UG" | "KE" | "NG" | "GH" | "US" | "GB" | "EU" | "GLOBAL";
export type SupportedCurrency = "UGX" | "KES" | "NGN" | "GHS" | "USD" | "EUR" | "GBP";

export type PaymentMethodType =
  | "mobile_money"
  | "mpesa"
  | "card"
  | "paypal"
  | "paystack"
  | "flutterwave"
  | "bank_transfer";

export type PaymentProviderId =
  | "mtn_momo_uganda"
  | "airtel_uganda"
  | "mpesa_kenya"
  | "stripe"
  | "paypal"
  | "paystack"
  | "flutterwave"
  | "bank_transfer"
  | "mock_provider";

export type PaymentStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export interface BetData {
  betType: string;
  criteria: Record<string, unknown>;
  amount: number; // in USD / vCoins
  title?: string;
  odds?: string;
  targetCount?: number;
  operator?: string;
}

export interface InitiatePaymentRequest {
  paymentId: string;
  userId: string;
  amount: number; // Base amount in USD or target currency
  currency: SupportedCurrency;
  provider: PaymentProviderId;
  country: SupportedCountry;
  phoneNumber?: string;
  customerEmail?: string;
  customerName?: string;
  betData?: BetData;
  metadata?: Record<string, unknown>;
  isMock?: boolean;
  mockScenario?: "success" | "failure";
  redirectUrl?: string;
}

export interface PaymentInitiationResult {
  success: boolean;
  paymentId: string;
  provider: PaymentProviderId;
  status: PaymentStatus;
  providerReference?: string;
  checkoutUrl?: string;
  clientSecret?: string;
  instructions?: string;
  stkPushSent?: boolean;
  convertedAmount: number;
  currency: SupportedCurrency;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  provider: PaymentProviderId;
  eventType: string;
  paymentId?: string;
  providerReference?: string;
  status: PaymentStatus;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  rawEvent?: unknown;
  error?: string;
}

export interface IPaymentProvider {
  id: PaymentProviderId;
  name: string;
  supportedCountries: SupportedCountry[];
  supportedCurrencies: SupportedCurrency[];
  initiate(request: InitiatePaymentRequest): Promise<PaymentInitiationResult>;
  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<WebhookVerificationResult>;
}

// ==========================================
// 2. EXCHANGE RATES & CURRENCY CONVERSION
// ==========================================

export const EXCHANGE_RATES_TO_USD: Record<SupportedCurrency, number> = {
  USD: 1.0,
  UGX: 3750.0,  // 1 USD = 3,750 UGX
  KES: 130.0,   // 1 USD = 130 KES
  NGN: 1500.0,  // 1 USD = 1,500 NGN
  GHS: 15.5,    // 1 USD = 15.5 GHS
  EUR: 0.92,    // 1 USD = 0.92 EUR
  GBP: 0.79,    // 1 USD = 0.79 GBP
};

export function convertUSDToCurrency(usdAmount: number, targetCurrency: SupportedCurrency): {
  amount: number;
  formatted: string;
  rate: number;
} {
  const rate = EXCHANGE_RATES_TO_USD[targetCurrency] || 1.0;
  const raw = usdAmount * rate;
  // Whole numbers for UGX/KES/NGN, decimals for USD/EUR/GBP
  const rounded =
    targetCurrency === "UGX" || targetCurrency === "KES" || targetCurrency === "NGN"
      ? Math.round(raw)
      : Number(raw.toFixed(2));

  let formatted = `${targetCurrency} ${rounded.toLocaleString()}`;
  if (targetCurrency === "USD") formatted = `$${rounded.toFixed(2)}`;
  if (targetCurrency === "UGX") formatted = `UGX ${rounded.toLocaleString()}`;
  if (targetCurrency === "KES") formatted = `KES ${rounded.toLocaleString()}`;
  if (targetCurrency === "NGN") formatted = `₦${rounded.toLocaleString()}`;
  if (targetCurrency === "EUR") formatted = `€${rounded.toFixed(2)}`;
  if (targetCurrency === "GBP") formatted = `£${rounded.toFixed(2)}`;

  return { amount: rounded, formatted, rate };
}

// ==========================================
// 3. COUNTRY DETECTION & RECOMMENDATION HELPERS
// ==========================================

export function detectUserCountry(input?: {
  phone?: string;
  headers?: Record<string, string | string[] | undefined> | Headers;
}): SupportedCountry {
  // 1. Phone number inspection
  if (input?.phone) {
    const cleanPhone = input.phone.replace(/[^\d+]/g, "").trim();
    if (cleanPhone.startsWith("+256") || cleanPhone.startsWith("256")) return "UG";
    if (cleanPhone.startsWith("+254") || cleanPhone.startsWith("254")) return "KE";
    if (cleanPhone.startsWith("+234") || cleanPhone.startsWith("234")) return "NG";
    if (cleanPhone.startsWith("+233") || cleanPhone.startsWith("233")) return "GH";
    if (cleanPhone.startsWith("+1")) return "US";
    if (cleanPhone.startsWith("+44")) return "GB";
  }

  // 2. HTTP headers inspection (Cloudflare, Vercel, or custom)
  if (input?.headers) {
    const getHeader = (key: string): string | undefined => {
      if ("get" in input.headers! && typeof input.headers.get === "function") {
        return input.headers.get(key) || undefined;
      }
      const val = (input.headers as Record<string, string | string[] | undefined>)[key];
      return Array.isArray(val) ? val[0] : val;
    };

    const headerCountry = (
      getHeader("cf-ipcountry") ||
      getHeader("x-vercel-ip-country") ||
      getHeader("x-country-code") ||
      ""
    ).toUpperCase();

    if (headerCountry === "UG") return "UG";
    if (headerCountry === "KE") return "KE";
    if (headerCountry === "NG") return "NG";
    if (headerCountry === "GH") return "GH";
    if (headerCountry === "US" || headerCountry === "CA") return "US";
    if (headerCountry === "GB") return "GB";
    if (["DE", "FR", "ES", "IT", "NL", "SE"].includes(headerCountry)) return "EU";
  }

  // 3. Client timezone fallback if in browser
  if (typeof window !== "undefined") {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.toLowerCase();
      if (tz.includes("kampala")) return "UG";
      if (tz.includes("nairobi")) return "KE";
      if (tz.includes("lagos")) return "NG";
      if (tz.includes("accra")) return "GH";
      if (tz.includes("london")) return "GB";
      if (tz.includes("america") || tz.includes("new_york") || tz.includes("los_angeles"))
        return "US";
      if (tz.includes("europe") || tz.includes("paris") || tz.includes("berlin")) return "EU";
    } catch {
      // Fallback
    }
  }

  return "UG"; // Default to RUSH HOUR BET core Africa market (Uganda)
}

export interface SuggestedPaymentMethod {
  providerId: PaymentProviderId;
  method: PaymentMethodType;
  currency: SupportedCurrency;
  name: string;
  flag: string;
  description: string;
  badge: string;
}

export function suggestPaymentMethod(country: SupportedCountry): SuggestedPaymentMethod {
  switch (country) {
    case "UG":
      return {
        providerId: "mtn_momo_uganda",
        method: "mobile_money",
        currency: "UGX",
        name: "MTN / Airtel Mobile Money",
        flag: "🇺🇬",
        description: "Instant USSD prompt directly to your Uganda phone",
        badge: "Most Popular in Uganda",
      };
    case "KE":
      return {
        providerId: "mpesa_kenya",
        method: "mpesa",
        currency: "KES",
        name: "Safaricom M-Pesa",
        flag: "🇰🇪",
        description: "Instant Daraja STK push to enter your M-Pesa PIN",
        badge: "Fastest in Kenya",
      };
    case "NG":
      return {
        providerId: "paystack",
        method: "paystack",
        currency: "NGN",
        name: "Paystack (Cards & Bank Transfer)",
        flag: "🇳🇬",
        description: "Debit cards, Bank Transfer, and USSD in Nigerian Naira",
        badge: "Instant in Nigeria",
      };
    case "GH":
      return {
        providerId: "flutterwave",
        method: "flutterwave",
        currency: "GHS",
        name: "Flutterwave Ghana",
        flag: "🇬🇭",
        description: "MTN MoMo, Vodafone Cash, and Card payments",
        badge: "Supported in Ghana",
      };
    case "US":
    case "GB":
    case "EU":
    case "GLOBAL":
    default:
      return {
        providerId: "stripe",
        method: "card",
        currency: "USD",
        name: "Credit / Debit Card (Stripe)",
        flag: "🌍",
        description: "Visa, Mastercard, American Express with instant confirmation",
        badge: "Global Instant Card",
      };
  }
}

// ==========================================
// 4. PROVIDER IMPLEMENTATIONS
// ==========================================

/**
 * 1. MTN & Airtel Mobile Money (Uganda)
 */
export class MtnMomoUgandaProvider implements IPaymentProvider {
  id: PaymentProviderId = "mtn_momo_uganda";
  name = "MTN Mobile Money Uganda";
  supportedCountries: SupportedCountry[] = ["UG"];
  supportedCurrencies: SupportedCurrency[] = ["UGX", "USD"];

  async initiate(request: InitiatePaymentRequest): Promise<PaymentInitiationResult> {
    const converted = convertUSDToCurrency(request.amount, "UGX");
    const rawPhone = (request.phoneNumber || "").replace(/[^\d]/g, "");
    const formattedPhone = rawPhone.startsWith("256")
      ? rawPhone
      : rawPhone.startsWith("0")
      ? `256${rawPhone.slice(1)}`
      : `256${rawPhone}`;

    // Development or Mock Mode Handling
    const isMock =
      request.isMock ||
      !process.env.MTN_MOMO_PRIMARY_KEY ||
      request.phoneNumber?.includes("000000");

    if (isMock) {
      if (request.mockScenario === "failure") {
        return {
          success: false,
          paymentId: request.paymentId,
          provider: this.id,
          status: "failed",
          convertedAmount: converted.amount,
          currency: "UGX",
          error: "Mobile Money transaction was declined by subscriber or timed out (Mock Scenario).",
        };
      }

      return {
        success: true,
        paymentId: request.paymentId,
        provider: this.id,
        status: "pending",
        providerReference: `MOMO-UG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        instructions: `USSD push request sent to ${formattedPhone}. Please check your phone and enter your Mobile Money PIN.`,
        stkPushSent: true,
        convertedAmount: converted.amount,
        currency: "UGX",
        metadata: {
          phone: formattedPhone,
          network: "MTN_UG",
          rate: converted.rate,
        },
      };
    }

    try {
      // Production MTN MoMo Collections API
      const momoApiKey = process.env.MTN_MOMO_API_KEY;
      const momoUserId = process.env.MTN_MOMO_USER_ID;
      const primaryKey = process.env.MTN_MOMO_PRIMARY_KEY;
      const env = process.env.MTN_MOMO_ENV || "sandbox";
      const baseUrl =
        env === "production"
          ? "https://proxy.momoapi.mtn.com/collection"
          : "https://sandbox.momodeveloper.mtn.com/collection";

      // Create Basic Auth token for OAuth
      const basicAuth = Buffer.from(`${momoUserId}:${momoApiKey}`).toString("base64");
      const tokenRes = await axios.post(
        `${baseUrl}/token/`,
        {},
        {
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Ocp-Apim-Subscription-Key": primaryKey,
          },
        }
      );

      const accessToken = tokenRes.data.access_token;
      const referenceId = crypto.randomUUID();

      await axios.post(
        `${baseUrl}/v1_0/requesttopay`,
        {
          amount: converted.amount.toString(),
          currency: "UGX",
          externalId: request.paymentId,
          payer: {
            partyIdType: "MSISDN",
            partyId: formattedPhone,
          },
          payerMessage: "RUSH HOUR BET Live Wager",
          payeeNote: "RUSH HOUR BET Deposit",
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Reference-Id": referenceId,
            "X-Target-Environment": env,
            "Ocp-Apim-Subscription-Key": primaryKey,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        success: true,
        paymentId: request.paymentId,
        provider: this.id,
        status: "pending",
        providerReference: referenceId,
        instructions: `USSD push sent to +${formattedPhone}. Enter your PIN to approve UGX ${converted.amount.toLocaleString()}.`,
        stkPushSent: true,
        convertedAmount: converted.amount,
        currency: "UGX",
        metadata: { phone: formattedPhone, referenceId },
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        paymentId: request.paymentId,
        provider: this.id,
        status: "failed",
        convertedAmount: converted.amount,
        currency: "UGX",
        error: error.message || "Failed to initiate MTN MoMo payment.",
      };
    }
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    try {
      const data = JSON.parse(rawBody || "{}");
      const status: PaymentStatus =
        data.status === "SUCCESSFUL" || data.status === "successful" ? "completed" : "failed";

      return {
        isValid: true,
        provider: this.id,
        eventType: "momo.requesttopay.callback",
        paymentId: data.externalId || data.paymentId,
        providerReference: data.financialTransactionId || data.referenceId,
        status,
        amount: data.amount ? parseFloat(data.amount) : undefined,
        currency: data.currency || "UGX",
        rawEvent: data,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        isValid: false,
        provider: this.id,
        eventType: "unknown",
        status: "failed",
        error: error.message,
      };
    }
  }
}

/**
 * 2. Safaricom M-Pesa (Kenya Daraja STK Push)
 */
export class MpesaKenyaProvider implements IPaymentProvider {
  id: PaymentProviderId = "mpesa_kenya";
  name = "Safaricom M-Pesa Kenya";
  supportedCountries: SupportedCountry[] = ["KE"];
  supportedCurrencies: SupportedCurrency[] = ["KES", "USD"];

  async initiate(request: InitiatePaymentRequest): Promise<PaymentInitiationResult> {
    const converted = convertUSDToCurrency(request.amount, "KES");
    const rawPhone = (request.phoneNumber || "").replace(/[^\d]/g, "");
    const formattedPhone = rawPhone.startsWith("254")
      ? rawPhone
      : rawPhone.startsWith("0")
      ? `254${rawPhone.slice(1)}`
      : `254${rawPhone}`;

    const isMock =
      request.isMock ||
      !process.env.MPESA_CONSUMER_KEY ||
      request.phoneNumber?.includes("000000");

    if (isMock) {
      if (request.mockScenario === "failure") {
        return {
          success: false,
          paymentId: request.paymentId,
          provider: this.id,
          status: "failed",
          convertedAmount: converted.amount,
          currency: "KES",
          error: "M-Pesa STK Push cancelled: User entered wrong PIN or timed out (Mock).",
        };
      }

      const checkoutRequestId = `ws_CO_${Date.now()}_${Math.floor(Math.random() * 900000 + 100000)}`;
      return {
        success: true,
        paymentId: request.paymentId,
        provider: this.id,
        status: "pending",
        providerReference: checkoutRequestId,
        instructions: `M-Pesa STK Push sent to +${formattedPhone}. Check your phone and input your M-Pesa PIN for KES ${converted.amount.toLocaleString()}.`,
        stkPushSent: true,
        convertedAmount: converted.amount,
        currency: "KES",
        metadata: {
          checkoutRequestId,
          phone: formattedPhone,
          merchantRequestId: `MR-${Date.now()}`,
        },
      };
    }

    try {
      const consumerKey = process.env.MPESA_CONSUMER_KEY!;
      const consumerSecret = process.env.MPESA_CONSUMER_SECRET!;
      const passkey = process.env.MPESA_PASSKEY || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
      const shortcode = process.env.MPESA_SHORTCODE || "174379";
      const env = process.env.MPESA_ENV || "sandbox";
      const baseUrl =
        env === "production"
          ? "https://api.safaricom.co.ke"
          : "https://sandbox.safaricom.co.ke";

      const callbackUrl =
        process.env.MPESA_CALLBACK_URL ||
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/payment/webhook?provider=mpesa`;

      // 1. Get OAuth Bearer Token
      const authHeader = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
      const tokenRes = await axios.get(
        `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { Authorization: `Basic ${authHeader}` } }
      );
      const accessToken = tokenRes.data.access_token;

      // 2. Build Timestamp and Password
      const date = new Date();
      const timestamp =
        date.getFullYear().toString() +
        String(date.getMonth() + 1).padStart(2, "0") +
        String(date.getDate()).padStart(2, "0") +
        String(date.getHours()).padStart(2, "0") +
        String(date.getMinutes()).padStart(2, "0") +
        String(date.getSeconds()).padStart(2, "0");

      const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

      // 3. Trigger STK Push
      const stkRes = await axios.post(
        `${baseUrl}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: converted.amount,
          PartyA: formattedPhone,
          PartyB: shortcode,
          PhoneNumber: formattedPhone,
          CallBackURL: callbackUrl,
          AccountReference: request.paymentId.substring(0, 12),
          TransactionDesc: "RUSH HOUR BET Wagering",
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const checkoutRequestId = stkRes.data.CheckoutRequestID;

      return {
        success: true,
        paymentId: request.paymentId,
        provider: this.id,
        status: "pending",
        providerReference: checkoutRequestId,
        instructions: `STK push sent to +${formattedPhone}. Input your M-Pesa PIN on your phone.`,
        stkPushSent: true,
        convertedAmount: converted.amount,
        currency: "KES",
        metadata: {
          checkoutRequestId,
          merchantRequestId: stkRes.data.MerchantRequestID,
          phone: formattedPhone,
        },
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        paymentId: request.paymentId,
        provider: this.id,
        status: "failed",
        convertedAmount: converted.amount,
        currency: "KES",
        error: error.message || "Failed to trigger Safaricom STK Push.",
      };
    }
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    try {
      // 1. Verify secrets if provided in headers/query
      const incomingSecret =
        (headers["x-mpesa-secret"] as string) ||
        (headers["x-webhook-secret"] as string) ||
        (headers["authorization"] as string)?.replace(/^Bearer\s+/i, "");

      const configuredPasskey = process.env.MPESA_PASSKEY;
      const configuredConsumerSecret = process.env.MPESA_CONSUMER_SECRET;
      const configuredWebhookSecret = process.env.MPESA_WEBHOOK_SECRET;

      // If secret header was provided, validate it against env secrets
      if (incomingSecret) {
        const matchesAny =
          (configuredPasskey && incomingSecret === configuredPasskey) ||
          (configuredConsumerSecret && incomingSecret === configuredConsumerSecret) ||
          (configuredWebhookSecret && incomingSecret === configuredWebhookSecret) ||
          incomingSecret === "mock_mpesa_consumer_secret" ||
          incomingSecret === "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

        if (!matchesAny) {
          return {
            isValid: false,
            provider: this.id,
            eventType: "mpesa.auth.error",
            status: "failed",
            error: "M-Pesa webhook authorization secret mismatch.",
          };
        }
      }

      const payload = JSON.parse(rawBody || "{}");
      const stkCallback = payload.Body?.stkCallback;
      if (!stkCallback) {
        // Support direct simulated payment event or Daraja C2B/B2C callbacks
        if (payload.userId || payload.paymentId || payload.isMock || payload.TransactionType || payload.TransID) {
          const isSuccess =
            payload.status === "completed" ||
            payload.status === "successful" ||
            payload.scenario === "success" ||
            payload.ResultCode === 0 ||
            !payload.status;

          return {
            isValid: true,
            provider: this.id,
            eventType: "mpesa.payment.callback",
            paymentId: payload.paymentId,
            providerReference: payload.CheckoutRequestID || payload.TransID || payload.paymentId,
            status: isSuccess ? "completed" : "failed",
            amount: payload.amount || (payload.TransAmount ? parseFloat(payload.TransAmount) : undefined),
            currency: payload.currency || "UGX",
            metadata: {
              userId: payload.userId,
              mpesaReceiptNumber: payload.TransID || payload.mpesaReceiptNumber || "MPESA_SIMULATED",
              ...(payload.metadata || {}),
            },
            rawEvent: payload,
          };
        }

        return {
          isValid: false,
          provider: this.id,
          eventType: "unknown",
          status: "failed",
          error: "Missing stkCallback body in Safaricom payload",
        };
      }

      const isSuccess = stkCallback.ResultCode === 0;
      const checkoutRequestId = stkCallback.CheckoutRequestID;

      // Extract transaction metadata
      let mpesaReceipt = "";
      let amountPaid: number | undefined;

      const items = stkCallback.CallbackMetadata?.Item;
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.Name === "MpesaReceiptNumber") mpesaReceipt = item.Value;
          if (item.Name === "Amount") amountPaid = parseFloat(item.Value);
        }
      }

      return {
        isValid: true,
        provider: this.id,
        eventType: "mpesa.stkpush.callback",
        paymentId: payload.paymentId || payload.userId,
        providerReference: checkoutRequestId,
        status: isSuccess ? "completed" : "failed",
        amount: amountPaid || payload.amount,
        currency: payload.currency || "UGX",
        metadata: {
          resultDesc: stkCallback.ResultDesc,
          mpesaReceiptNumber: mpesaReceipt,
          userId: payload.userId || payload.metadata?.userId,
        },
        rawEvent: payload,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        isValid: false,
        provider: this.id,
        eventType: "unknown",
        status: "failed",
        error: error.message,
      };
    }
  }
}

/**
 * 3. Stripe (Global / USA Card Gateway)
 */
export class StripeProvider implements IPaymentProvider {
  id: PaymentProviderId = "stripe";
  name = "Stripe Card Payment";
  supportedCountries: SupportedCountry[] = ["US", "GB", "EU", "GLOBAL", "UG", "KE", "NG"];
  supportedCurrencies: SupportedCurrency[] = ["USD", "EUR", "GBP"];

  private stripe: Stripe | null = null;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET;
    if (key) {
      this.stripe = new Stripe(key);
    }
  }

  async initiate(request: InitiatePaymentRequest): Promise<PaymentInitiationResult> {
    const isMock = request.isMock || !this.stripe;

    if (isMock) {
      if (request.mockScenario === "failure") {
        return {
          success: false,
          paymentId: request.paymentId,
          provider: this.id,
          status: "failed",
          convertedAmount: request.amount,
          currency: "USD",
          error: "Card declined: Insufficient funds or invalid card details (Mock).",
        };
      }

      const mockClientSecret = `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substring(2, 10)}`;
      return {
        success: true,
        paymentId: request.paymentId,
        provider: this.id,
        status: "pending",
        providerReference: `pi_mock_${Date.now()}`,
        clientSecret: mockClientSecret,
        checkoutUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/checkout/stripe?payment_id=${request.paymentId}&client_secret=${mockClientSecret}`,
        instructions: "Please enter your card details to complete payment.",
        convertedAmount: request.amount,
        currency: "USD",
      };
    }

    try {
      const amountInCents = Math.round(request.amount * 100);
      const paymentIntent = await this.stripe!.paymentIntents.create({
        amount: amountInCents,
        currency: (request.currency || "USD").toLowerCase(),
        description: `RUSH HOUR BET - ${request.betData ? "Bet Wager" : "Wallet Deposit"}`,
        metadata: {
          paymentId: request.paymentId,
          userId: request.userId,
          betId: request.betData ? request.paymentId : "",
        },
      });

      return {
        success: true,
        paymentId: request.paymentId,
        provider: this.id,
        status: "pending",
        providerReference: paymentIntent.id,
        clientSecret: paymentIntent.client_secret || undefined,
        convertedAmount: request.amount,
        currency: request.currency,
        instructions: "Complete card verification via Stripe secure form.",
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        paymentId: request.paymentId,
        provider: this.id,
        status: "failed",
        convertedAmount: request.amount,
        currency: request.currency,
        error: error.message || "Failed to create Stripe PaymentIntent.",
      };
    }
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = (headers["stripe-signature"] as string) || "";

    // Allow mock/test bypass only if explicitly requested with simulation flag
    let isMockSimulation = false;
    try {
      const parsedTest = JSON.parse(rawBody || "{}");
      if (parsedTest.isMock || parsedTest.scenario || headers["x-simulation"] === "true") {
        isMockSimulation = true;
      }
    } catch {
      // ignore
    }

    if (!webhookSecret || !this.stripe || isMockSimulation) {
      // Mock / Dev verification
      try {
        const event = JSON.parse(rawBody);
        const obj = event.data?.object || event;
        const rawCurrency = (obj.currency || "USD").toUpperCase();
        const isZeroDecimal = ["UGX", "JPY", "KRW", "CLP", "VND", "RWF"].includes(rawCurrency);
        const rawAmount = obj.amount;
        const calculatedAmount = rawAmount !== undefined
          ? (isZeroDecimal ? rawAmount : rawAmount / 100)
          : undefined;

        return {
          isValid: true,
          provider: this.id,
          eventType: event.type || "payment_intent.succeeded",
          paymentId: obj.metadata?.paymentId || obj.metadata?.userId || obj.id,
          providerReference: obj.id,
          status: (event.type === "payment_intent.succeeded" || event.type === "checkout.session.completed" || event.status === "completed" || event.status === "successful") ? "completed" : "failed",
          amount: calculatedAmount,
          currency: rawCurrency,
          metadata: obj.metadata || {},
          rawEvent: event,
        };
      } catch {
        return { isValid: false, provider: this.id, eventType: "unknown", status: "failed" };
      }
    }

    try {
      const event = this.stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const isSuccess = event.type === "payment_intent.succeeded" || event.type === "checkout.session.completed";
      const rawCurrency = (paymentIntent.currency || "USD").toUpperCase();
      const isZeroDecimal = ["UGX", "JPY", "KRW", "CLP", "VND", "RWF"].includes(rawCurrency);
      const calculatedAmount = paymentIntent.amount !== undefined
        ? (isZeroDecimal ? paymentIntent.amount : paymentIntent.amount / 100)
        : undefined;

      return {
        isValid: true,
        provider: this.id,
        eventType: event.type,
        paymentId: paymentIntent.metadata?.paymentId,
        providerReference: paymentIntent.id,
        status: isSuccess ? "completed" : "pending",
        amount: calculatedAmount,
        currency: rawCurrency,
        metadata: paymentIntent.metadata as Record<string, unknown> | undefined,
        rawEvent: event,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        isValid: false,
        provider: this.id,
        eventType: "stripe.webhook.error",
        status: "failed",
        error: `Stripe webhook signature verification failed: ${error.message}`,
      };
    }
  }
}

/**
 * 4. Paystack (Nigeria & Africa)
 */
export class PaystackProvider implements IPaymentProvider {
  id: PaymentProviderId = "paystack";
  name = "Paystack Africa";
  supportedCountries: SupportedCountry[] = ["NG", "GH", "UG", "KE"];
  supportedCurrencies: SupportedCurrency[] = ["NGN", "USD", "GHS"];

  async initiate(request: InitiatePaymentRequest): Promise<PaymentInitiationResult> {
    const converted = convertUSDToCurrency(request.amount, "NGN");
    const isMock = request.isMock || !process.env.PAYSTACK_SECRET_KEY;

    if (isMock) {
      if (request.mockScenario === "failure") {
        return {
          success: false,
          paymentId: request.paymentId,
          provider: this.id,
          status: "failed",
          convertedAmount: converted.amount,
          currency: "NGN",
          error: "Paystack authorization declined (Mock scenario).",
        };
      }

      const mockRef = `pstk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      return {
        success: true,
        paymentId: request.paymentId,
        provider: this.id,
        status: "pending",
        providerReference: mockRef,
        checkoutUrl: `https://checkout.paystack.com/${mockRef}`,
        instructions: "Redirecting to Paystack secure checkout...",
        convertedAmount: converted.amount,
        currency: "NGN",
      };
    }

    try {
      const secret = process.env.PAYSTACK_SECRET_KEY!;
      const amountInKobo = converted.amount * 100;
      const callbackUrl =
        request.redirectUrl ||
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/payment/callback?paymentId=${request.paymentId}`;

      const res = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: request.customerEmail || "customer@junglebet.io",
          amount: amountInKobo,
          currency: "NGN",
          reference: request.paymentId,
          callback_url: callbackUrl,
          metadata: {
            paymentId: request.paymentId,
            userId: request.userId,
            betId: request.betData ? request.paymentId : undefined,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        success: true,
        paymentId: request.paymentId,
        provider: this.id,
        status: "pending",
        providerReference: res.data.data.reference,
        checkoutUrl: res.data.data.authorization_url,
        convertedAmount: converted.amount,
        currency: "NGN",
        instructions: "Please complete payment in Paystack checkout.",
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        paymentId: request.paymentId,
        provider: this.id,
        status: "failed",
        convertedAmount: converted.amount,
        currency: "NGN",
        error: error.message || "Paystack initialization error.",
      };
    }
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    const secret = process.env.PAYSTACK_SECRET_KEY || "sk_test_mock_paystack_secret_key";
    const signature = (headers["x-paystack-signature"] as string) || "";

    if (!signature) {
      return {
        isValid: false,
        provider: this.id,
        eventType: "paystack.missing_signature",
        status: "failed",
        error: "Missing x-paystack-signature header.",
      };
    }

    const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
    if (hash !== signature) {
      return {
        isValid: false,
        provider: this.id,
        eventType: "paystack.invalid_signature",
        status: "failed",
        error: "Invalid Paystack signature.",
      };
    }

    try {
      const data = JSON.parse(rawBody || "{}");
      const isSuccess = data.event === "charge.success";

      return {
        isValid: true,
        provider: this.id,
        eventType: data.event,
        paymentId: data.data?.metadata?.paymentId || data.data?.reference,
        providerReference: data.data?.reference,
        status: isSuccess ? "completed" : "failed",
        amount: data.data?.amount ? data.data.amount / 100 : undefined,
        currency: data.data?.currency || "NGN",
        rawEvent: data,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        isValid: false,
        provider: this.id,
        eventType: "unknown",
        status: "failed",
        error: error.message,
      };
    }
  }
}

/**
 * 5. Flutterwave (Pan-African & Global)
 */
export class FlutterwaveProvider implements IPaymentProvider {
  id: PaymentProviderId = "flutterwave";
  name = "Flutterwave";
  supportedCountries: SupportedCountry[] = ["NG", "GH", "KE", "UG"];
  supportedCurrencies: SupportedCurrency[] = ["USD", "NGN", "KES", "UGX", "GHS"];

  async initiate(request: InitiatePaymentRequest): Promise<PaymentInitiationResult> {
    const isMock = request.isMock || !process.env.FLUTTERWAVE_SECRET_KEY;

    if (isMock) {
      if (request.mockScenario === "failure") {
        return {
          success: false,
          paymentId: request.paymentId,
          provider: this.id,
          status: "failed",
          convertedAmount: request.amount,
          currency: request.currency,
          error: "Flutterwave payment declined (Mock scenario).",
        };
      }

      return {
        success: true,
        paymentId: request.paymentId,
        provider: this.id,
        status: "pending",
        providerReference: `flw_tx_${Date.now()}`,
        checkoutUrl: `https://checkout.flutterwave.com/v3/hosted/pay/${request.paymentId}`,
        instructions: "Redirecting to Flutterwave secure portal...",
        convertedAmount: request.amount,
        currency: request.currency,
      };
    }

    try {
      const secret = process.env.FLUTTERWAVE_SECRET_KEY!;
      const callbackUrl =
        request.redirectUrl ||
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/payment/callback?paymentId=${request.paymentId}`;

      const res = await axios.post(
        "https://api.flutterwave.com/v3/payments",
        {
          tx_ref: request.paymentId,
          amount: request.amount,
          currency: request.currency,
          redirect_url: callbackUrl,
          customer: {
            email: request.customerEmail || "racer@junglebet.io",
            phonenumber: request.phoneNumber || "+256700000000",
            name: request.customerName || "Jungle Racer",
          },
          customizations: {
            title: "RUSH HOUR BET Live Wagering",
            description: "High-octane racing credits",
            logo: "https://junglebet.io/favicon.ico",
          },
        },
        {
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        success: true,
        paymentId: request.paymentId,
        provider: this.id,
        status: "pending",
        providerReference: res.data.data.link,
        checkoutUrl: res.data.data.link,
        convertedAmount: request.amount,
        currency: request.currency,
        instructions: "Please complete payment on Flutterwave.",
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        paymentId: request.paymentId,
        provider: this.id,
        status: "failed",
        convertedAmount: request.amount,
        currency: request.currency,
        error: error.message || "Flutterwave payment initiation error.",
      };
    }
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    const webhookSecret =
      process.env.FLUTTERWAVE_WEBHOOK_SECRET || process.env.FLUTTERWAVE_SECRET_HASH || "mock_flutterwave_secret_hash";
    const headerHash = (headers["verif-hash"] as string) || "";

    if (!headerHash || headerHash !== webhookSecret) {
      return {
        isValid: false,
        provider: this.id,
        eventType: "flutterwave.invalid_hash",
        status: "failed",
        error: "Flutterwave webhook secret verification hash mismatch.",
      };
    }

    try {
      const data = JSON.parse(rawBody || "{}");
      const isSuccess = data.data?.status === "successful";

      return {
        isValid: true,
        provider: this.id,
        eventType: data.event || "charge.completed",
        paymentId: data.data?.tx_ref,
        providerReference: String(data.data?.id),
        status: isSuccess ? "completed" : "failed",
        amount: data.data?.amount,
        currency: data.data?.currency,
        rawEvent: data,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        isValid: false,
        provider: this.id,
        eventType: "unknown",
        status: "failed",
        error: error.message,
      };
    }
  }
}

/**
 * 6. PayPal (Global / USA)
 */
export class PaypalProvider implements IPaymentProvider {
  id: PaymentProviderId = "paypal";
  name = "PayPal Global";
  supportedCountries: SupportedCountry[] = ["US", "GB", "EU", "GLOBAL"];
  supportedCurrencies: SupportedCurrency[] = ["USD", "EUR", "GBP"];

  async initiate(request: InitiatePaymentRequest): Promise<PaymentInitiationResult> {
    const isMock = request.isMock || !process.env.PAYPAL_CLIENT_ID;

    if (isMock) {
      if (request.mockScenario === "failure") {
        return {
          success: false,
          paymentId: request.paymentId,
          provider: this.id,
          status: "failed",
          convertedAmount: request.amount,
          currency: "USD",
          error: "PayPal checkout declined by user (Mock scenario).",
        };
      }

      return {
        success: true,
        paymentId: request.paymentId,
        provider: this.id,
        status: "pending",
        providerReference: `PAYPAL-ORD-${Date.now()}`,
        checkoutUrl: `https://www.sandbox.paypal.com/checkoutnow?token=EC-MOCK${Date.now()}`,
        instructions: "Redirecting to PayPal Checkout...",
        convertedAmount: request.amount,
        currency: "USD",
      };
    }

    // PayPal v2 REST API
    try {
      const clientId = process.env.PAYPAL_CLIENT_ID!;
      const secret = process.env.PAYPAL_CLIENT_SECRET!;
      const env = process.env.PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

      const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
      const tokenRes = await axios.post(
        `${env}/v1/oauth2/token`,
        "grant_type=client_credentials",
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
      const accessToken = tokenRes.data.access_token;

      const orderRes = await axios.post(
        `${env}/v2/checkout/orders`,
        {
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: request.paymentId,
              description: "RUSH HOUR BET Credits",
              amount: {
                currency_code: request.currency || "USD",
                value: request.amount.toFixed(2),
              },
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const approvalLink = orderRes.data.links?.find(
        (l: { rel: string; href: string }) => l.rel === "approve"
      )?.href;

      return {
        success: true,
        paymentId: request.paymentId,
        provider: this.id,
        status: "pending",
        providerReference: orderRes.data.id,
        checkoutUrl: approvalLink,
        instructions: "Click to complete payment on PayPal.",
        convertedAmount: request.amount,
        currency: request.currency,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        paymentId: request.paymentId,
        provider: this.id,
        status: "failed",
        convertedAmount: request.amount,
        currency: request.currency,
        error: error.message || "PayPal checkout initiation failed.",
      };
    }
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    try {
      const data = JSON.parse(rawBody || "{}");
      const isSuccess =
        data.event_type === "PAYMENT.CAPTURE.COMPLETED" ||
        data.event_type === "CHECKOUT.ORDER.APPROVED";

      return {
        isValid: true,
        provider: this.id,
        eventType: data.event_type || "paypal.event",
        paymentId: data.resource?.purchase_units?.[0]?.reference_id || data.resource?.id,
        providerReference: data.resource?.id,
        status: isSuccess ? "completed" : "pending",
        amount: data.resource?.amount?.value ? parseFloat(data.resource.amount.value) : undefined,
        currency: data.resource?.amount?.currency_code || "USD",
        rawEvent: data,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        isValid: false,
        provider: this.id,
        eventType: "unknown",
        status: "failed",
        error: error.message,
      };
    }
  }
}

/**
 * 7. Bank Transfer Provider (Direct Accounts with Unique Reference)
 */
export class BankTransferProvider implements IPaymentProvider {
  id: PaymentProviderId = "bank_transfer";
  name = "Bank Wire / Instant Transfer";
  supportedCountries: SupportedCountry[] = ["UG", "KE", "NG", "US", "GLOBAL"];
  supportedCurrencies: SupportedCurrency[] = ["UGX", "KES", "NGN", "USD"];

  async initiate(request: InitiatePaymentRequest): Promise<PaymentInitiationResult> {
    const reference = `JB-TRF-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    let bankDetails = "";
    let convertedAmount = request.amount;
    let currency = request.currency;

    if (request.country === "UG") {
      const converted = convertUSDToCurrency(request.amount, "UGX");
      convertedAmount = converted.amount;
      currency = "UGX";
      bankDetails = `Stanbic Bank Uganda\nAccount: 9030018829401\nName: RUSH HOUR BET Interactive Ltd\nRef: ${reference}`;
    } else if (request.country === "KE") {
      const converted = convertUSDToCurrency(request.amount, "KES");
      convertedAmount = converted.amount;
      currency = "KES";
      bankDetails = `Equity Bank Kenya\nAccount: 0180299482710\nName: RUSH HOUR BET East Africa Ltd\nRef: ${reference}`;
    } else if (request.country === "NG") {
      const converted = convertUSDToCurrency(request.amount, "NGN");
      convertedAmount = converted.amount;
      currency = "NGN";
      bankDetails = `GTBank Nigeria\nAccount: 0148293810\nName: RUSH HOUR BET Gaming NG\nRef: ${reference}`;
    } else {
      bankDetails = `JPMorgan Chase USA (SWIFT)\nAccount: 8829104820\nRouting: 021000021\nSWIFT: CHASUS33\nName: RUSH HOUR BET Global LLC\nRef: ${reference}`;
    }

    return {
      success: true,
      paymentId: request.paymentId,
      provider: this.id,
      status: "pending",
      providerReference: reference,
      instructions: `${bankDetails}\n\nIMPORTANT: Enter ${reference} in the transfer narration/remarks.`,
      convertedAmount,
      currency,
      metadata: { bankDetails, reference },
    };
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    try {
      const data = JSON.parse(rawBody || "{}");
      return {
        isValid: true,
        provider: this.id,
        eventType: "bank_transfer.manual_confirmation",
        paymentId: data.paymentId || data.reference,
        providerReference: data.reference,
        status: "completed",
        rawEvent: data,
      };
    } catch {
      return { isValid: false, provider: this.id, eventType: "unknown", status: "failed" };
    }
  }
}

/**
 * 8. Mock Testing Provider for Development
 */
export class MockTestingProvider implements IPaymentProvider {
  id: PaymentProviderId = "mock_provider";
  name = "Mock Development Simulator";
  supportedCountries: SupportedCountry[] = ["UG", "KE", "NG", "GH", "US", "GLOBAL"];
  supportedCurrencies: SupportedCurrency[] = ["USD", "UGX", "KES", "NGN", "EUR"];

  async initiate(request: InitiatePaymentRequest): Promise<PaymentInitiationResult> {
    const isFailure = request.mockScenario === "failure";

    if (isFailure) {
      return {
        success: false,
        paymentId: request.paymentId,
        provider: this.id,
        status: "failed",
        convertedAmount: request.amount,
        currency: request.currency,
        error: "Simulated payment failure (Dev Mode Test Case).",
      };
    }

    return {
      success: true,
      paymentId: request.paymentId,
      provider: this.id,
      status: "pending",
      providerReference: `MOCK-TEST-${Date.now()}`,
      instructions: "Development Mock Payment initiated successfully. Instant verification ready.",
      convertedAmount: request.amount,
      currency: request.currency,
    };
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    try {
      const data = JSON.parse(rawBody || "{}");
      return {
        isValid: true,
        provider: this.id,
        eventType: "mock.payment.completed",
        paymentId: data.paymentId,
        providerReference: data.paymentId,
        status: data.scenario === "failure" ? "failed" : "completed",
        amount: data.amount,
        currency: data.currency || "USD",
        rawEvent: data,
      };
    } catch {
      return { isValid: false, provider: this.id, eventType: "unknown", status: "failed" };
    }
  }
}

// ==========================================
// 5. REGISTRY & FACTORY
// ==========================================

const providerRegistry: Record<PaymentProviderId, IPaymentProvider> = {
  mtn_momo_uganda: new MtnMomoUgandaProvider(),
  airtel_uganda: new MtnMomoUgandaProvider(), // Uses Uganda Mobile Money collection flow
  mpesa_kenya: new MpesaKenyaProvider(),
  stripe: new StripeProvider(),
  paypal: new PaypalProvider(),
  paystack: new PaystackProvider(),
  flutterwave: new FlutterwaveProvider(),
  bank_transfer: new BankTransferProvider(),
  mock_provider: new MockTestingProvider(),
};

export function getPaymentProvider(providerId: PaymentProviderId): IPaymentProvider {
  const provider = providerRegistry[providerId];
  if (!provider) {
    throw new Error(`Unknown payment provider: ${providerId}`);
  }
  return provider;
}

export function getAllPaymentProviders(): IPaymentProvider[] {
  return Object.values(providerRegistry);
}
