import { NextRequest, NextResponse } from "next/server";
import { authUserService } from "@/lib/auth-user-service";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    let session = null;
    try {
      session = await auth();
    } catch {
      // safe fallback
    }

    const body = await req.json();
    const { action, userId: reqUserId, enabled, name, email } = body;

    const userId =
      reqUserId ||
      session?.user?.id ||
      (session?.user?.phone ? `usr_${session.user.phone}` : null);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    if (action === "toggle_2fa") {
      const status = authUserService.toggleTwoFactor(userId, enabled);
      return NextResponse.json({
        success: true,
        twoFactorEnabled: status,
        message: status ? "2-Factor Authentication enabled." : "2-Factor Authentication disabled.",
      });
    }

    if (action === "update_profile") {
      const updated = authUserService.updateUserProfile(userId, { name, email });
      if (!updated) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        user: updated,
        message: "Profile updated successfully.",
      });
    }

    if (action === "delete_account") {
      const deleted = authUserService.deleteUser(userId);
      return NextResponse.json({
        success: deleted,
        message: "Your Jungle Bet account has been permanently deleted.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
