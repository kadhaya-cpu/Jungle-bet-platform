"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface VehicleCrossingEvent {
  type: string;
  feed_id: number;
  count: number;
  crossing_x?: number;
  x?: number;
  vehicle_type?: string;
  confidence?: number;
  timestamp?: number;
  delta?: number;
}

export interface UseWebSocketCountOptions {
  /**
   * Initial counter value before WebSocket connection or handshake.
   * Default: 14.
   */
  initialCount?: number;

  /**
   * Optional custom WebSocket base URL.
   * Defaults to NEXT_PUBLIC_WS_URL or "ws://localhost:8000".
   */
  wsUrl?: string;

  /**
   * Whether the WebSocket connection is active.
   * Default: true.
   */
  enabled?: boolean;

  /**
   * Callback fired whenever a vehicle crossing event is received.
   */
  onVehicleDetected?: (event: VehicleCrossingEvent) => void;

  /**
   * Callback fired on every count change.
   */
  onCountUpdate?: (count: number) => void;
}

export interface FloatingPing {
  id: number;
  x: number;
}

export interface UseWebSocketCountReturn {
  count: number;
  setCount: React.Dispatch<React.SetStateAction<number>>;
  isConnected: boolean;
  isLineTriggered: boolean;
  lastCrossingX: number;
  floatingPings: FloatingPing[];
  lastEvent: VehicleCrossingEvent | null;
  triggerCrossing: (customX?: number) => void;
  reconnect: () => void;
  resetCount: (newCount?: number) => void;
}

/**
 * Resolves the WebSocket URL for the /ws/count/{feed_id} endpoint.
 */
function getWsEndpoint(feedId: number, customBaseUrl?: string): string {
  if (customBaseUrl) {
    const base = customBaseUrl.replace(/\/$/, "");
    return base.includes("/ws/count")
      ? base.endsWith("/ws/count")
        ? `${base}/${feedId}`
        : base
      : `${base}/ws/count/${feedId}`;
  }

  const envWs = process.env.NEXT_PUBLIC_WS_URL;
  if (envWs) {
    try {
      const parsed = new URL(envWs);
      const origin = `${parsed.protocol}//${parsed.host}`;
      return `${origin}/ws/count/${feedId}`;
    } catch {
      const cleaned = envWs.replace(/\/ws\/.*$/, "").replace(/\/$/, "");
      return `${cleaned}/ws/count/${feedId}`;
    }
  }

  const envApi = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const wsProto = envApi.startsWith("https") ? "wss:" : "ws:";
  const host = envApi.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `${wsProto}//${host}/ws/count/${feedId}`;
}

/**
 * Custom React hook that connects to FastAPI /ws/count/{feed_id} over WebSocket
 * to stream real-time YOLO vehicle counts and synchronize visual counters immediately.
 */
export function useWebSocketCount(
  feedId: number,
  options: UseWebSocketCountOptions = {}
): UseWebSocketCountReturn {
  const {
    initialCount = 14,
    wsUrl,
    enabled = true,
    onVehicleDetected,
    onCountUpdate,
  } = options;

  const [count, setCount] = useState<number>(initialCount);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLineTriggered, setIsLineTriggered] = useState<boolean>(false);
  const [lastCrossingX, setLastCrossingX] = useState<number>(50);
  const [floatingPings, setFloatingPings] = useState<FloatingPing[]>([]);
  const [lastEvent, setLastEvent] = useState<VehicleCrossingEvent | null>(null);
  const [reconnectKey, setReconnectKey] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const triggerTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger optical Green Line laser pulse and floating +1 ping
  const triggerCrossing = useCallback((customX?: number) => {
    const x =
      typeof customX === "number"
        ? customX
        : Math.floor(Math.random() * 60) + 20;

    setLastCrossingX(x);

    // Pulse the Green Line glow effect
    setIsLineTriggered(true);
    if (triggerTimerRef.current) clearTimeout(triggerTimerRef.current);
    triggerTimerRef.current = setTimeout(() => {
      setIsLineTriggered(false);
    }, 380);

    // Spawn floating +1 indicator
    const pingId = Date.now() + Math.random();
    setFloatingPings((prev) => [...prev.slice(-3), { id: pingId, x }]);
    setTimeout(() => {
      setFloatingPings((prev) => prev.filter((p) => p.id !== pingId));
    }, 1200);
  }, []);

  // Sync count on initialCount changes if disconnected
  useEffect(() => {
    if (!isConnected && typeof initialCount === "number") {
      setCount(initialCount);
    }
  }, [initialCount, isConnected]);

  // Main WebSocket Lifecycle Effect
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let ws: WebSocket | null = null;
    let isDisposed = false;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    const connect = () => {
      if (isDisposed) return;

      const endpoint = getWsEndpoint(feedId, wsUrl);
      try {
        ws = new WebSocket(endpoint);
        wsRef.current = ws;
      } catch (err) {
        console.warn("[useWebSocketCount] Error creating WebSocket:", err);
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        if (isDisposed) return;
        setIsConnected(true);

        // Keep-alive heartbeat every 20s
        heartbeatInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 20000);
      };

      ws.onmessage = (event) => {
        if (isDisposed) return;
        try {
          const data: VehicleCrossingEvent = JSON.parse(event.data);
          setLastEvent(data);

          if (data.type === "connected") {
            setIsConnected(true);
            if (typeof data.count === "number") {
              setCount(data.count);
              onCountUpdate?.(data.count);
            }
          } else if (
            data.type === "CAR_DETECTED" ||
            data.type === "vehicle_crossing" ||
            data.type === "count_update"
          ) {
            // Synchronize visual counter immediately
            if (typeof data.count === "number") {
              setCount(data.count);
              onCountUpdate?.(data.count);
            } else if (typeof data.delta === "number") {
              setCount((prev) => {
                const next = prev + data.delta!;
                onCountUpdate?.(next);
                return next;
              });
            } else {
              setCount((prev) => {
                const next = prev + 1;
                onCountUpdate?.(next);
                return next;
              });
            }

            // Extract crossing coordinate along the Green Line (percentage 0-100)
            const crossingX =
              typeof data.crossing_x === "number"
                ? data.crossing_x
                : typeof data.x === "number"
                ? data.x
                : Math.floor(Math.random() * 60) + 20;

            triggerCrossing(crossingX);
            onVehicleDetected?.(data);
          }
        } catch {
          // Ignore invalid frames
        }
      };

      ws.onerror = () => {
        if (isDisposed) return;
        setIsConnected(false);
      };

      ws.onclose = () => {
        if (isDisposed) return;
        setIsConnected(false);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (isDisposed) return;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => {
        connect();
      }, 2000);
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      }
      wsRef.current = null;
    };
  }, [feedId, enabled, wsUrl, triggerCrossing, onVehicleDetected, onCountUpdate, reconnectKey]);

  // Clean up pulse timer
  useEffect(() => {
    return () => {
      if (triggerTimerRef.current) clearTimeout(triggerTimerRef.current);
    };
  }, []);

  const reconnect = useCallback(() => {
    setReconnectKey((prev) => prev + 1);
  }, []);

  const resetCount = useCallback(
    (newCount = 0) => {
      setCount(newCount);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "reset", count: newCount }));
      }
    },
    []
  );

  return {
    count,
    setCount,
    isConnected,
    isLineTriggered,
    lastCrossingX,
    floatingPings,
    lastEvent,
    triggerCrossing,
    reconnect,
    resetCount,
  };
}

export default useWebSocketCount;
