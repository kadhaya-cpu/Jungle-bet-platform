import { NextRequest, NextResponse } from "next/server";
import { authUserService } from "@/lib/auth-user-service";
import { verifyPhoneOtp } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, code, newPassword } = body;

    if (!phone || typeof phone !== "string") {
      return NextResponse.json(
        { error: "Phone number is required." },
        { status: 400 }
      );
    }

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Verification code is required." },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const normalized = authUserService.normalizePhone(phone);

    // Verify OTP code (allow standard demo code '123456' or twilio validation)
    const verification = verifyPhoneOtp(normalized, code);
    if (!verification.success && code !== "123456") {
      return NextResponse.json(
        { error: verification.message || "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    // Reset password
    const success = authUserService.resetPassword(normalized, newPassword);
    if (!success) {
      // Check if user exists, if not, create or return not found
      return NextResponse.json(
        { error: "No account found associated with this phone number." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal server error";
    console.error("[Reset Password API Error]:", error);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
