import twilio from "twilio";

const accountSid = process.env.TWILIO_SID || process.env.TWILIO_ACCOUNT_SID || "";
const authToken = process.env.TWILIO_AUTH_TOKEN || "";
const fromPhone = process.env.TWILIO_PHONE_NUMBER || "";

// Cache Twilio client instance
let twilioClient: twilio.Twilio | null = null;

export function getTwilioClient(): twilio.Twilio | null {
  if (twilioClient) return twilioClient;
  if (!accountSid || !authToken || accountSid.includes("XXXX") || authToken.includes("xxxx")) {
    return null;
  }
  try {
    twilioClient = twilio(accountSid, authToken);
    return twilioClient;
  } catch (error) {
    console.warn("[Twilio] Initialization error:", error);
    return null;
  }
}

// In-memory OTP storage for verification codes
const otpStore = new Map<string, { code: string; expiresAt: number }>();

export async function sendOtpSms(
  toPhone: string,
  code?: string
): Promise<{ success: boolean; code?: string; message: string; sid?: string }> {
  const generatedCode = code || Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

  // Store for verification
  otpStore.set(toPhone, { code: generatedCode, expiresAt });

  const client = getTwilioClient();
  if (!client || !fromPhone) {
    // Development / Sandbox fallback: Log code so devs can test without live Twilio account
    console.log(`[Twilio DEV MODE] Verification SMS for ${toPhone}: Code is [${generatedCode}]`);
    return {
      success: true,
      code: generatedCode,
      message: `[Dev Mode] Verification code generated: ${generatedCode}`,
    };
  }

  try {
    const response = await client.messages.create({
      body: `Your RUSH HOUR BET verification code is: ${generatedCode}. Valid for 10 minutes. Keep your garage secure!`,
      from: fromPhone,
      to: toPhone,
    });

    return {
      success: true,
      sid: response.sid,
      message: "SMS sent successfully",
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Failed to send SMS via Twilio";
    console.error("[Twilio] SMS Send Failed:", errorMsg);
    return {
      success: false,
      message: errorMsg,
    };
  }
}

export function verifyPhoneOtp(
  toPhone: string,
  inputCode: string
): { success: boolean; message: string } {
  const record = otpStore.get(toPhone);
  if (!record) {
    return { success: false, message: "No verification code requested for this phone number." };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(toPhone);
    return { success: false, message: "Verification code has expired. Please request a new one." };
  }

  if (record.code !== inputCode.trim()) {
    return { success: false, message: "Incorrect verification code." };
  }

  // Clear code after successful verification
  otpStore.delete(toPhone);
  return { success: true, message: "Phone number verified successfully." };
}
