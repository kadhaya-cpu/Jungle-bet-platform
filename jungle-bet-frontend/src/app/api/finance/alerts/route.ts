import { NextRequest, NextResponse } from "next/server";
import { frontendTransactionService } from "@/lib/transaction-service";

export async function GET() {
  try {
    const data = await frontendTransactionService.getAlerts();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await frontendTransactionService.sendTestAlert(
      body.alertType,
      body.username,
      body.amount
    );
    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
