import { NextResponse } from "next/server";
import { fraudDetector } from "@/lib/fraud-detector";
import axios from "axios";

export async function GET() {
  try {
    const localAlerts = fraudDetector.getAlerts();

    // Optionally fetch from FastAPI backend
    let backendAlerts = [];
    try {
      const fastApiUrl = process.env.FASTAPI_URL || "http://localhost:8000";
      const res = await axios.get(`${fastApiUrl}/fraud-detector-api/alerts`, { timeout: 1500 });
      backendAlerts = res.data?.alerts || [];
    } catch {
      // Backend offline or unreachable, rely on local alerts
    }

    // Merge and deduplicate
    const combined = [...localAlerts];
    const seenIds = new Set(localAlerts.map((a) => String(a.id)));
    for (const b of backendAlerts) {
      if (!seenIds.has(String(b.id))) {
        combined.push(b);
        seenIds.add(String(b.id));
      }
    }

    return NextResponse.json({
      alerts: combined,
      count: combined.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: "Failed to fetch fraud alerts", details: error.message },
      { status: 500 }
    );
  }
}
