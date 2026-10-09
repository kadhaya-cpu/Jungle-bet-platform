import { NextRequest, NextResponse } from "next/server";
import { fraudDetector } from "@/lib/fraud-detector";
import { authUserService } from "@/lib/auth-user-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, userId = "usr_demo_vip_001" } = body;

    const user = authUserService.findUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (type === "rapid_bets") {
      // Simulate 6 rapid bets in under a second
      for (let i = 1; i <= 6; i++) {
        fraudDetector.recordBet(userId, 50, `sim_bet_${i}`);
      }

      const updated = authUserService.findUserById(userId);
      return NextResponse.json({
        success: true,
        type: "rapid_bets",
        message: `Simulated 6 rapid bets for ${user.name}. Account flagged for >5 bets in 1 minute.`,
        user: updated,
      });
    }

    if (type === "large_win") {
      // Simulate an instant win of $1,500
      const winAmount = 1500;
      fraudDetector.recordWin(userId, winAmount, "sim_jackpot_win");

      const updated = authUserService.findUserById(userId);
      return NextResponse.json({
        success: true,
        type: "large_win",
        message: `Simulated instant win of $${winAmount} for ${user.name}. Account flagged for instant win >$1000.`,
        user: updated,
      });
    }

    return NextResponse.json({ error: "Specify type as 'rapid_bets' or 'large_win'" }, { status: 400 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
