import { fraudDetector, FraudAlertItem } from "@/lib/fraud-detector";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial handshake
      const initPayload = {
        type: "connected",
        status: "streaming_fraud_alerts",
        timestamp: Date.now(),
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initPayload)}\n\n`));

      // 2. Replay recent alerts
      const recent = fraudDetector.getAlerts().slice(0, 3);
      for (const alert of recent) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "fraud_alert", alert })}\n\n`)
        );
      }

      // 3. Subscribe to real-time alerts
      const unsubscribe = fraudDetector.subscribe((alert: FraudAlertItem) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "fraud_alert", alert })}\n\n`)
          );
        } catch {
          // Stream might be closed
        }
      });

      // 4. Heartbeat ping interval
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
