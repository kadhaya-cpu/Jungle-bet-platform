import { NextResponse } from "next/server";
import { frontendTransactionService } from "@/lib/transaction-service";

export async function GET() {
  try {
    const data = await frontendTransactionService.getTreasuryStatus();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
