import { NextRequest, NextResponse } from "next/server";
import { frontendTransactionService } from "@/lib/transaction-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await frontendTransactionService.triggerSweep(
      body.amount,
      body.operatorBankAccount
    );
    return NextResponse.json(result);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
