import { NextRequest, NextResponse } from "next/server";
import { fraudDetector } from "@/lib/fraud-detector";
import { authUserService } from "@/lib/auth-user-service";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    let session = null;
    try {
      session = await auth();
    } catch {
      // Ignored outside session context
    }

    const body = await req.json();
    const { action, userId: rawUserId, amount, betId } = body;

    const userId =
      rawUserId ||
      session?.user?.id ||
      (session?.user?.phone ? `usr_${session.user.phone}` : "usr_demo_vip_001");

    if (action === "win") {
      // Logic Hook 2: If a user wins >$1000 instantly, flag as Suspicious
      const winAmount = Number(amount || 0);
      const result = fraudDetector.recordWin(userId, winAmount, betId);

      return NextResponse.json({
        success: true,
        action: "win",
        userId,
        winAmount,
        isSuspicious: result.isSuspicious,
        reason: result.reason,
        flagged: result.flagged,
      });
    }

    if (action === "bet") {
      // Logic Hook 1: If a user places >5 bets in 1 minute, flag as Suspicious
      const betAmount = Number(amount || 10);
      const result = fraudDetector.recordBet(userId, betAmount, betId);

      return NextResponse.json({
        success: true,
        action: "bet",
        userId,
        recentBetsCount: result.recentBetsCount,
        isSuspicious: result.isSuspicious,
        reason: result.reason,
        flagged: result.flagged,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Specify 'bet' or 'win'." },
      { status: 400 }
    );
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const flagged = authUserService.getFlaggedUsers();
  return NextResponse.json({
    flaggedCount: flagged.length,
    flaggedUsers: flagged,
  });
}
