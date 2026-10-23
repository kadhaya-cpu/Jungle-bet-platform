"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Sparkles,
  User,
  RotateCcw,
  WifiOff,
  Radio,
  Zap,
  Activity,
  RefreshCw,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import axios from "axios";

export interface ChatMessage {
  id: string;
  sender: "user" | "leo";
  text: string;
  timestamp: string;
  suggestions?: string[];
  isBroadcast?: boolean;
  isFraudAlert?: boolean;
  alertSeverity?: "CRITICAL" | "HIGH" | "MEDIUM";
  fraudAlertData?: {
    id?: string | number;
    userId?: string;
    username?: string;
    reason?: string;
    alertType?: string;
    amount?: number;
    recentBetsCount?: number;
    severity?: string;
  };
}

export type ConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "fallback_http";

export interface LeoChatWidgetProps {
  wsUrl?: string;
  fraudStreamUrl?: string;
  activeFeedId?: number;
  onTrackEventReceived?: (event: unknown) => void;
  onFraudAlertReceived?: (alert: unknown) => void;
  className?: string;
}

let globalMessageCounter = 0;
function createMessageId(prefix: string): string {
  globalMessageCounter += 1;
  return `${prefix}-${globalMessageCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

function getFormattedCurrentTime(): string {
  try {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "Just now";
  }
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "welcome-1",
    sender: "leo",
    text: "🦁 **Greetings, Racer! I'm Leo**, your RUSH HOUR BET AI assistant connected via real-time WebSocket stream.\n\nI analyze live camera feeds, optical YOLOv8 vehicle detections, Green Line crossing telemetry, and active odds in real-time.\n\nHow can I help you win today?",
    timestamp: "Just now",
    suggestions: [
      "How does the Green Line work?",
      "What are the current odds?",
      "Which camera has the most traffic?",
      "How do I deposit funds?",
    ],
  },
];

export default function LeoChatWidget({
  wsUrl: propWsUrl,
  fraudStreamUrl: propFraudStreamUrl,
  activeFeedId = 1,
  onTrackEventReceived,
  onFraudAlertReceived,
  className = "",
}: LeoChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [liveEventBanner, setLiveEventBanner] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const pingStartRef = useRef<number>(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const connectWebSocketRef = useRef<() => void>(() => {});
  const seenAlertIdsRef = useRef<Set<string>>(new Set());

  // Handle incoming real-time fraud alert from WebSocket or SSE stream
  const handleIncomingFraudAlert = useCallback(
    (alert: any, rawText?: string) => {
      const alertId = String(alert?.id || `${alert?.userId}-${alert?.timestamp || Date.now()}`);
      if (seenAlertIdsRef.current.has(alertId)) return;
      seenAlertIdsRef.current.add(alertId);

      const alertSeverity = ((alert?.severity || "HIGH") as string).toUpperCase() as "CRITICAL" | "HIGH" | "MEDIUM";
      const anomalyReason = alert?.reason || "High betting rate or instant payout anomaly detected.";
      const targetUser = alert?.username || alert?.userId || "Unknown Racer";

      const fraudMsg: ChatMessage = {
        id: createMessageId("fraud-alert"),
        sender: "leo",
        text: rawText || `🚨 **[FRAUD SHIELD DETECTOR ALERT]**\n\n• **Anomaly:** ${anomalyReason}\n• **Account:** @${targetUser}\n• **Severity:** ${alertSeverity}\n• **Trigger Rules:** >10 bets/min or >$1,000 instant payout`,
        timestamp: getFormattedCurrentTime(),
        isFraudAlert: true,
        alertSeverity,
        fraudAlertData: alert,
        suggestions: [
          "Inspect Flagged Accounts",
          "What triggers fraud detection?",
          "View Admin Dashboard",
        ],
      };

      setMessages((prev) => [...prev, fraudMsg]);
      setLiveEventBanner(`🚨 Security Alert: ${anomalyReason}`);
      setTimeout(() => setLiveEventBanner(null), 8000);

      if (!isOpen) {
        setUnreadCount((c) => c + 1);
      }

      if (onFraudAlertReceived) {
        try {
          onFraudAlertReceived(alert);
        } catch {
          // ignore callback error
        }
      }
    },
    [isOpen, onFraudAlertReceived]
  );

  // Connect to fraud-detector-api SSE stream to receive live alerts
  useEffect(() => {
    if (typeof window === "undefined") return;

    let eventSource: EventSource | null = null;
    let fallbackPollTimer: NodeJS.Timeout | null = null;

    const streamUrl = propFraudStreamUrl || "/api/fraud/stream";

    try {
      eventSource = new EventSource(streamUrl);
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "fraud_alert" && payload.alert) {
            handleIncomingFraudAlert(payload.alert);
          }
        } catch {
          // ignore non-json
        }
      };
      eventSource.onerror = () => {
        // Fallback polling if EventSource fails or closes
        if (!fallbackPollTimer) {
          fallbackPollTimer = setInterval(async () => {
            try {
              const res = await axios.get("/api/fraud/alerts");
              const alerts = res.data?.alerts || [];
              for (const a of alerts) {
                const aId = String(a.id);
                if (!seenAlertIdsRef.current.has(aId)) {
                  handleIncomingFraudAlert(a);
                }
              }
            } catch {
              // ignore fetch error
            }
          }, 10000);
        }
      };
    } catch {
      // EventSource unavailable
    }

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackPollTimer) clearInterval(fallbackPollTimer);
    };
  }, [propFraudStreamUrl, handleIncomingFraudAlert]);

  // Determine WebSocket Endpoint URL
  const getWebSocketUrl = useCallback(() => {
    if (propWsUrl) return propWsUrl;
    if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;

    if (typeof window !== "undefined") {
      const isHttps = window.location.protocol === "https:";
      const protocol = isHttps ? "wss:" : "ws:";
      const hostname = window.location.hostname || "localhost";
      // Connect to FastAPI on port 8000
      return `${protocol}//${hostname}:8000/ws/leo-chat`;
    }
    return "ws://localhost:8000/ws/leo-chat";
  }, [propWsUrl]);

  // Connect WebSocket
  const connectWebSocket = useCallback(() => {
    if (typeof window === "undefined") return;

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        // ignore
      }
    }

    const targetUrl = getWebSocketUrl();

    try {
      const ws = new WebSocket(targetUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnectionState("connected");
        setReconnectAttempts(0);
        // Measure initial ping
        pingStartRef.current = Date.now();
        ws.send(JSON.stringify({ type: "ping" }));

        // Start periodic heartbeat ping (every 25s)
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            pingStartRef.current = Date.now();
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "pong") {
            if (pingStartRef.current > 0) {
              setLatencyMs(Date.now() - pingStartRef.current);
            }
            return;
          }

          if (data.type === "leo_typing") {
            setIsTyping(!!data.isTyping);
            return;
          }

          if (data.type === "fraud_alert") {
            const alert = data.alert || data;
            handleIncomingFraudAlert(alert, data.text);
            return;
          }

          if (data.type === "leo_response") {
            setIsTyping(false);
            const leoMsg: ChatMessage = {
              id: createMessageId("leo-ws"),
              sender: "leo",
              text: data.text || "Analyzing telemetry conditions...",
              timestamp: data.timestamp || getFormattedCurrentTime(),
              suggestions: data.suggestions || [],
            };
            setMessages((prev) => [...prev, leoMsg]);

            if (!isOpen) {
              setUnreadCount((c) => c + 1);
            }
            return;
          }

          if (data.type === "connected") {
            // Handshake confirmed
            return;
          }

          // Real-time track broadcast events over WebSocket
          if (
            data.type === "tripwire_cross" ||
            data.type === "optical_crossing_alert" ||
            data.type === "odds_movement"
          ) {
            const bannerText =
              data.text ||
              `🟢 Optical alert: Cross count updated (${data.count ?? 1}) on Camera ${data.feedId ?? activeFeedId}`;
            setLiveEventBanner(bannerText);
            setTimeout(() => setLiveEventBanner(null), 6000);
            if (onTrackEventReceived) onTrackEventReceived(data);
          }
        } catch {
          // Non-JSON message fallback
        }
      };

      ws.onerror = () => {
        // Switch to fallback HTTP gracefully
        if (reconnectAttempts >= 3) {
          setConnectionState("fallback_http");
        }
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        setReconnectAttempts((prev) => {
          const next = prev + 1;
          if (next <= 4) {
            setConnectionState("reconnecting");
            const delay = Math.min(1000 * Math.pow(2, next), 8000);
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocketRef.current();
            }, delay);
          } else {
            setConnectionState("fallback_http");
          }
          return next;
        });
      };
    } catch {
      setConnectionState("fallback_http");
    }
  }, [getWebSocketUrl, activeFeedId, onTrackEventReceived, isOpen, reconnectAttempts]);

  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
  }, [connectWebSocket]);

  // Initialize WebSocket connection on mount
  useEffect(() => {
    const initTimer = setTimeout(() => {
      connectWebSocket();
    }, 0);

    return () => {
      clearTimeout(initTimer);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, [connectWebSocket]);

  // Scroll to bottom when messages or typing changes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isTyping, isOpen]);

  const handleOpenChat = () => {
    setIsOpen(true);
    setUnreadCount(0);
  };

  const sendViaHttpFallback = useCallback(
    async (text: string) => {
      try {
        const res = await axios.post("/api/leo-chat", {
          message: text,
          feedId: activeFeedId,
          history: messages.map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.text,
          })),
        });

        const data = res.data;
        const leoMsg: ChatMessage = {
          id: createMessageId("leo-http"),
          sender: "leo",
          text: data.reply || "I am analyzing the track conditions. Ask me anything!",
          timestamp: getFormattedCurrentTime(),
          suggestions: data.suggestions || [],
        };

        setMessages((prev) => [...prev, leoMsg]);
      } catch {
        const errorMsg: ChatMessage = {
          id: createMessageId("leo-err"),
          sender: "leo",
          text: "🦁 Network connection hiccup! Here is a quick summary:\n\n• The **Green Line** counts vehicles in real-time using YOLOv8 optical CV.\n• Popular odds: **OVER 13 (3.60x)** & **UNDER 10 (2.25x)**.\n• You can switch cameras and select stakes above/below the video player.",
          timestamp: getFormattedCurrentTime(),
          suggestions: ["How does the Green Line work?", "What are the current odds?"],
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsTyping(false);
      }
    },
    [activeFeedId, messages]
  );

  // Send message over WebSocket (or fallback to HTTP)
  const handleSend = useCallback(
    async (messageText?: string) => {
      const textToSend = messageText || input;
      if (!textToSend.trim() || isTyping) return;

      const userMsg: ChatMessage = {
        id: createMessageId("usr"),
        sender: "user",
        text: textToSend.trim(),
        timestamp: getFormattedCurrentTime(),
      };

      setMessages((prev) => [...prev, userMsg]);
      if (!messageText) setInput("");
      setIsTyping(true);

      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && connectionState === "connected") {
        // 1. Send via WebSocket
        try {
          ws.send(
            JSON.stringify({
              type: "chat_message",
              text: userMsg.text,
              feedId: activeFeedId,
              history: messages.map((m) => ({
                role: m.sender === "user" ? "user" : "assistant",
                content: m.text,
              })),
            })
          );
          // Server will respond with 'leo_typing' and 'leo_response'
        } catch {
          // Fallback to HTTP if WS send failed
          sendViaHttpFallback(userMsg.text);
        }
      } else {
        // 2. Send via HTTP Fallback
        sendViaHttpFallback(userMsg.text);
      }
    },
    [input, isTyping, connectionState, activeFeedId, messages, sendViaHttpFallback]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resetChat = () => {
    setMessages(INITIAL_MESSAGES);
  };

  const formatMessageText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      // Bold text processing
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const renderedParts = parts.map((part, pIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={pIdx} className="font-extrabold text-[var(--jungle-green)]">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      if (line.startsWith("• ") || line.startsWith("- ")) {
        return (
          <li key={idx} className="ml-3 list-disc my-0.5 text-xs text-gray-200">
            {renderedParts}
          </li>
        );
      }

      if (line.trim() === "") {
        return <div key={idx} className="h-1.5" />;
      }

      return (
        <p key={idx} className="my-0.5 text-xs leading-relaxed text-gray-200">
          {renderedParts}
        </p>
      );
    });
  };

  return (
    <div className={className}>
      {/* ------------------------------------------------------------- */}
      {/* FLOATING CHAT TRIGGER BUTTON (BOTTOM-LEFT CORNER)             */}
      {/* ------------------------------------------------------------- */}
      <div className="fixed bottom-5 left-5 z-50 select-none">
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpenChat}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-black/95 hover:bg-black border border-[var(--jungle-green)] shadow-[0_0_20px_rgba(204,255,0,0.35)] hover:shadow-[0_0_30px_rgba(204,255,0,0.6)] text-white transition-all cursor-pointer group"
              aria-label="Open Leo AI Assistant"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-[var(--jungle-green)]/20 border border-[var(--jungle-green)] flex items-center justify-center text-base">
                  🦁
                </div>
                {/* Dynamic Online / WebSocket Status Indicator */}
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  {connectionState === "connected" ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--jungle-green)] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--jungle-green)]" />
                    </>
                  ) : connectionState === "reconnecting" || connectionState === "connecting" ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gray-500" />
                  )}
                </span>
              </div>

              <div className="flex flex-col text-left pr-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black tracking-wider text-white uppercase flex items-center gap-1">
                    Leo AI <Sparkles size={11} className="text-[var(--jungle-green)]" />
                  </span>
                  {connectionState === "connected" && (
                    <span className="text-[8px] font-mono font-bold px-1 py-0.2 rounded bg-[var(--jungle-green)]/20 text-[var(--jungle-green)]">
                      WS
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 font-mono">
                  {connectionState === "connected"
                    ? "Live Neural Stream"
                    : connectionState === "reconnecting"
                    ? "Reconnecting..."
                    : "Strategist & Odds"}
                </span>
              </div>

              {unreadCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black">
                  {unreadCount}
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* EXPANDED CHAT MODAL WINDOW WITH WEBSOCKET FEATURES            */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.92 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-5 left-5 z-50 w-[92vw] sm:w-[420px] h-[550px] max-h-[85vh] rounded-3xl bg-[#0c0c0e]/95 backdrop-blur-2xl border border-[var(--jungle-green)]/40 shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_30px_rgba(204,255,0,0.15)] flex flex-col overflow-hidden"
          >
            {/* CHAT HEADER WITH WEBSOCKET STATUS BADGE */}
            <div className="px-4 py-3 bg-gradient-to-r from-black/95 via-black/85 to-black/95 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-9 h-9 rounded-2xl bg-black border border-[var(--jungle-green)] flex items-center justify-center text-lg shadow-[0_0_12px_rgba(204,255,0,0.3)]">
                    🦁
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                    {connectionState === "connected" ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--jungle-green)] opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--jungle-green)]" />
                      </>
                    ) : (
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
                    )}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-black text-white tracking-wide uppercase">
                      Leo AI
                    </h3>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--jungle-green)]/20 text-[var(--jungle-green)] font-bold">
                      STRATEGIST
                    </span>
                  </div>

                  {/* WEBSOCKET CONNECTION BADGE */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {connectionState === "connected" ? (
                      <span className="text-[10px] text-[var(--jungle-green)] font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--jungle-green)] inline-block animate-pulse" />
                        WS Live {latencyMs !== null ? `(${latencyMs}ms)` : ""}
                      </span>
                    ) : connectionState === "reconnecting" ? (
                      <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                        <RefreshCw size={10} className="animate-spin" />
                        WS Reconnecting ({reconnectAttempts}/4)...
                      </span>
                    ) : connectionState === "connecting" ? (
                      <span className="text-[10px] text-blue-400 font-mono flex items-center gap-1">
                        <Activity size={10} className="animate-pulse" />
                        Connecting WS...
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                        <WifiOff size={10} />
                        HTTP REST Mode
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* HEADER ACTIONS: RECONNECT, RESET, CLOSE */}
              <div className="flex items-center gap-1">
                {connectionState !== "connected" && (
                  <button
                    onClick={() => {
                      setConnectionState("connecting");
                      connectWebSocket();
                    }}
                    title="Reconnect WebSocket"
                    className="p-1.5 rounded-lg text-amber-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <RefreshCw size={13} />
                  </button>
                )}

                <button
                  onClick={resetChat}
                  title="Reset Conversation"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <RotateCcw size={14} />
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  title="Close Assistant"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* REAL-TIME TRACK BROADCAST BANNER (OVER WEBSOCKET) */}
            <AnimatePresence>
              {liveEventBanner && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-3 py-1.5 bg-[var(--jungle-green)]/15 border-b border-[var(--jungle-green)]/30 flex items-center justify-between text-[11px] text-[var(--jungle-green)] font-mono"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Radio size={12} className="animate-pulse shrink-0" />
                    <span className="truncate">{liveEventBanner}</span>
                  </div>
                  <button
                    onClick={() => setLiveEventBanner(null)}
                    className="text-[var(--jungle-green)]/70 hover:text-[var(--jungle-green)] ml-2"
                  >
                    <X size={11} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* MESSAGE HISTORY CONTAINER */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar">
              {messages.map((msg) => {
                const isUser = msg.sender === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-end gap-1.5 max-w-[88%]">
                      {!isUser && (
                        <div className="w-6 h-6 rounded-full bg-black/80 border border-[var(--jungle-green)]/40 flex items-center justify-center text-xs shrink-0 mb-1">
                          🦁
                        </div>
                      )}

                      {msg.isFraudAlert ? (
                        <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/50 text-white shadow-[0_0_20px_rgba(239,68,68,0.25)] w-full">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
                              <ShieldAlert size={16} />
                            </div>
                            <div>
                              <h4 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                                Fraud Shield Alert
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/30 text-red-300 font-mono">
                                  {msg.alertSeverity || "CRITICAL"}
                                </span>
                              </h4>
                              <p className="text-[10px] text-gray-400">Automated Security Hook Triggered</p>
                            </div>
                          </div>
                          <div className="text-xs text-gray-200 leading-relaxed bg-black/50 p-2.5 rounded-xl border border-white/10 mb-2.5 font-mono">
                            {formatMessageText(msg.text)}
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-red-500/20 text-[10px]">
                            <span className="text-gray-400 font-mono">
                              Target: @{msg.fraudAlertData?.username || msg.fraudAlertData?.userId || "user"}
                            </span>
                            <Link
                              href="/admin/dashboard"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/25 hover:bg-red-500/40 text-red-300 border border-red-500/40 transition-colors font-bold cursor-pointer"
                            >
                              <span>Open Admin</span>
                              <ExternalLink size={10} />
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`p-3 rounded-2xl text-xs ${
                            isUser
                              ? "bg-[var(--jungle-green)] text-black font-semibold rounded-br-none shadow-[0_0_15px_rgba(204,255,0,0.25)]"
                              : "bg-[#161619] border border-white/10 text-gray-200 rounded-bl-none shadow-md"
                          }`}
                        >
                          {isUser ? (
                            <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                          ) : (
                            <div>{formatMessageText(msg.text)}</div>
                          )}
                        </div>
                      )}

                      {isUser && (
                        <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0 mb-1">
                          <User size={12} className="text-gray-300" />
                        </div>
                      )}
                    </div>

                    <span className="text-[9px] font-mono text-gray-500 mt-1 px-1">
                      {msg.timestamp}
                    </span>

                    {/* SUGGESTION CHIPS UNDER LEO RESPONSES */}
                    {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 ml-7 max-w-[90%]">
                        {msg.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => handleSend(sug)}
                            className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-[var(--jungle-green)]/15 border border-white/10 hover:border-[var(--jungle-green)]/40 text-gray-300 hover:text-[var(--jungle-green)] transition-all cursor-pointer text-left"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* TYPING INDICATOR */}
              {isTyping && (
                <div className="flex items-center gap-1.5 ml-1">
                  <div className="w-6 h-6 rounded-full bg-black/80 border border-[var(--jungle-green)]/40 flex items-center justify-center text-xs shrink-0">
                    🦁
                  </div>
                  <div className="px-3 py-2 rounded-2xl bg-[#161619] border border-white/10 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--jungle-green)] animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--jungle-green)] animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--jungle-green)] animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* CHAT INPUT AREA */}
            <div className="p-3 bg-black/95 border-t border-white/10 shrink-0">
              <div className="flex items-center gap-2 bg-[#141416] border border-white/15 focus-within:border-[var(--jungle-green)] rounded-2xl px-3 py-1.5 transition-all">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Leo about optical feeds, odds, Green Line..."
                  className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none py-1"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                  className="p-1.5 rounded-xl bg-[var(--jungle-green)] text-black hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 transition-all cursor-pointer shrink-0 shadow-[0_0_10px_rgba(204,255,0,0.3)]"
                  aria-label="Send message"
                >
                  <Send size={13} />
                </button>
              </div>

              {/* FOOTER CONNECTION NOTICE */}
              <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-gray-500 px-1">
                <span className="flex items-center gap-1">
                  <Zap size={9} className="text-[var(--jungle-green)]" />
                  {connectionState === "connected"
                    ? "Live WebSocket Neural Stream"
                    : "Automatic Fallback Mode Active"}
                </span>
                <span>RUSH HOUR BET AI</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
