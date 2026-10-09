import { NextRequest, NextResponse } from "next/server";
import { paymentDb } from "@/lib/payment-db";
import { authUserService } from "@/lib/auth-user-service";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId") || "test_user_01";
  const balance = await paymentDb.getUserBalance(userId);
  const user = authUserService.findUserById(userId);

  return NextResponse.json({
    userId,
    balance,
    user: user
      ? {
          id: user.id,
          name: user.name,
          phone: user.phone,
          balance: user.balance,
        }
      : null,
  });
}
