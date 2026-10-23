import React, { useEffect, useState } from 'react';
import ReactPlayer from 'react-player';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Activity, Video, Tv, Wifi, WifiOff } from 'lucide-react';
import { API_BASE_URL, API_ENDPOINTS, WS_BASE_URL } from '../../utils/constants';
import { CameraFeedGame, useBettingStore } from '../../store/useBettingStore';

export interface VideoPlayerProps {
  feed?: CameraFeedGame | null;
  youtubeUrl?: string;
}

/**
 * Live Optical Stream Player with YOLOv8 Green Trigger Line & Real-Time WebSocket Counter
 * Supports both backend `/camera-feeds/{id}/stream` MP4/HLS proxy and YouTube live URLs via react-player.
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({ feed, youtubeUrl }) => {
  const {
    selectedFeedId,
    liveVehicleCount,
    lastVehicleCrossingX,
    wsConnected,
    setLiveTelemetry,
    setWsConnected,
  } = useBettingStore();

  const activeFeedId = feed?.id || selectedFeedId || 1;
  const [customStreamUrl, setCustomStreamUrl] = useState<string>(youtubeUrl || '');
  const [showYoutubeInput, setShowYoutubeInput] = useState<boolean>(false);
  const [pulseKey, setPulseKey] = useState<number>(0);

  // Connect to backend WebSocket `/ws/count/{feed_id}` for real-time YOLOv8 vehicle crossings
  useEffect(() => {
    let ws: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const connectWebSocket = () => {
      try {
        ws = new WebSocket(`${WS_BASE_URL}/ws/count/${activeFeedId}`);

        ws.onopen = () => {
          if (!isMounted) return;
          setWsConnected(true);
          pingTimer = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 20000);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const payload = JSON.parse(event.data);
            if (typeof payload.count === 'number') {
              setLiveTelemetry(payload.count, payload.crossing_x ?? 50);
              if (payload.type === 'CAR_DETECTED') {
                setPulseKey((k) => k + 1);
              }
            }
          } catch {
            // Ignore malformed messages
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWebSocket, 4000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        setWsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [activeFeedId, setLiveTelemetry, setWsConnected]);

  const backendStreamUrl = `${API_BASE_URL}${API_ENDPOINTS.BETTING.FEED_STREAM(activeFeedId)}`;
  const isYoutubeMode = Boolean(customStreamUrl.trim());
  const AnyReactPlayer = ReactPlayer as unknown as React.ComponentType<Record<string, unknown>>;

  return (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 overflow-hidden shadow-2xl">
      {/* Top Stream Telemetry Bar */}
      <div className="px-4 py-3 bg-[#141414] border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase bg-red-500/20 text-red-400 border border-red-500/40">
            <Radio className="w-3 h-3 animate-pulse" />
            LIVE FEED #{activeFeedId}
          </span>
          <div>
            <h4 className="text-sm font-bold text-white leading-tight">
              {feed?.name || `Camera Feed #${activeFeedId}`}
            </h4>
            <p className="text-[11px] text-gray-400">
              {feed?.location || 'Real-Time Optical Corridor'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* WebSocket Telemetry Status */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
              wsConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {wsConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                WS Telemetry Connected
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                WS Standby
              </>
            )}
          </span>

          {/* YouTube Live Feed Hook Toggle */}
          <button
            type="button"
            onClick={() => setShowYoutubeInput((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors"
          >
            <Tv className="w-3.5 h-3.5 text-red-400" />
            <span>YouTube Source</span>
          </button>
        </div>
      </div>

      {/* Optional YouTube URL Hook Input */}
      {showYoutubeInput && (
        <div className="px-4 py-2.5 bg-[#111111] border-b border-white/10 flex items-center gap-2">
          <Video className="w-4 h-4 text-[#FFD700] shrink-0" />
          <input
            type="url"
            placeholder="Paste YouTube Live URL (or leave empty for backend YOLOv8 stream proxy)..."
            value={customStreamUrl}
            onChange={(e) => setCustomStreamUrl(e.target.value)}
            className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
          />
          {customStreamUrl && (
            <button
              type="button"
              onClick={() => setCustomStreamUrl('')}
              className="text-[11px] text-[#FFD700] font-bold hover:underline shrink-0"
            >
              Reset to Proxy
            </button>
          )}
        </div>
      )}

      {/* Video Viewport with Optical Green Line Overlay */}
      <div className="relative aspect-video w-full bg-black overflow-hidden">
        {isYoutubeMode ? (
          <AnyReactPlayer
            url={customStreamUrl}
            playing
            muted
            controls
            width="100%"
            height="100%"
          />
        ) : (
          <video
            key={backendStreamUrl}
            src={backendStreamUrl}
            autoPlay
            muted
            loop
            playsInline
            crossOrigin="anonymous"
            className="w-full h-full object-cover"
          />
        )}

        {/* Superimposed Horizontal Optical Green Line (65% height) */}
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{ top: '65%' }}
        >
          <div className="h-[3px] w-full bg-emerald-400 shadow-[0_0_16px_#10B981,0_0_32px_#10B981]" />
          <div className="flex items-center justify-between px-3 mt-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-black/75 text-emerald-400 border border-emerald-500/40">
              YOLOv8 Optical Trigger Line
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/75 text-[#FFD700] border border-[#FFD700]/40">
              Sub-Second Resolution
            </span>
          </div>

          {/* Floating +1 Vehicle Crossing Indicator */}
          <AnimatePresence mode="popLayout">
            {pulseKey > 0 && (
              <motion.div
                key={pulseKey}
                initial={{ opacity: 1, y: 0, scale: 0.9 }}
                animate={{ opacity: 0, y: -36, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9 }}
                style={{ left: `${lastVehicleCrossingX ?? 50}%` }}
                className="absolute -top-6 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#FFD700] text-[#0f0f0f] font-black text-xs shadow-lg"
              >
                +1 VEHICLE
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live Optical Counter HUD Overlay */}
        <div className="absolute top-3 right-3 bg-[#0f0f0f]/85 backdrop-blur-md border border-[#FFD700]/40 rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-xl pointer-events-none">
          <Activity className="w-5 h-5 text-[#FFD700] animate-pulse" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Optical Vehicle Count
            </div>
            <div className="text-2xl font-black font-mono text-[#FFD700] leading-none">
              {liveVehicleCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
