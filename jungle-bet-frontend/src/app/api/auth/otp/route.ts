import { NextRequest, NextResponse } from "next/server";
import { sendOtpSms, verifyPhoneOtp } from "@/lib/twilio";
import { authUserService } from "@/lib/auth-user-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, phone, code } = body;

    if (!phone || typeof phone !== "string") {
      return NextResponse.json(
        { error: "Phone number is required." },
        { status: 400 }
      );
    }

    const normalized = authUserService.normalizePhone(phone);

    if (action === "send") {
      const result = await sendOtpSms(normalized);
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        message: result.message,
        // In dev mode, return the simulated code for easy testing
        devCode: result.code,
      });
    }

    if (action === "verify") {
      if (!code || typeof code !== "string") {
        return NextResponse.json(
          { error: "Verification code is required." },
          { status: 400 }
        );
      }
      const verified = verifyPhoneOtp(normalized, code);
      if (!verified.success) {
        return NextResponse.json({ error: verified.message }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        message: verified.message,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Supported actions: 'send', 'verify'." },
      { status: 400 }
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal server error";
    console.error("[OTP API Error]:", error);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
