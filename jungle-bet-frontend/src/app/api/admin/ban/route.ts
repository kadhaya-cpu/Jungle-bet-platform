import { NextRequest, NextResponse } from "next/server";
import { authUserService } from "@/lib/auth-user-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, action = "ban" } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const user = authUserService.findUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (action === "ban") {
      authUserService.banUser(userId);
      return NextResponse.json({
        success: true,
        message: `User ${user.name} (${user.id}) has been banned from Jungle Bet.`,
        user: authUserService.findUserById(userId),
      });
    } else if (action === "unban") {
      authUserService.unbanUser(userId);
      return NextResponse.json({
        success: true,
        message: `User ${user.name} (${user.id}) has been unbanned.`,
        user: authUserService.findUserById(userId),
      });
    } else if (action === "unflag") {
      authUserService.unflagUser(userId);
      return NextResponse.json({
        success: true,
        message: `Flags cleared for user ${user.name} (${user.id}).`,
        user: authUserService.findUserById(userId),
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
