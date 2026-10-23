import React, { useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio,
  Activity,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Users,
  AlertTriangle,
  RefreshCw,
  Clock,
  Tv,
} from 'lucide-react';
import { WS_BASE_URL } from '../../utils/constants';
import { CameraFeedGame, useBettingStore } from '../../store/useBettingStore';
import { EUROPE_CITIES, getCityById } from '../../utils/cityData';

export interface VideoPlayerProps {
  feed?: CameraFeedGame | null;
  youtubeUrl?: string;
}

/**
 * Live Traffic Video Player with ReactPlayer YouTube integration,
 * Play/Pause, Volume & Fullscreen controls, 'Live Now' & Viewer Count overlay,
 * Loading Skeleton, Error Handling, and 'Coming Soon' placeholder fallback.
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({ feed, youtubeUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    selectedCity,
    selectedFeedId,
    liveVehicleCount,
    lastVehicleCrossingX,
    setLiveTelemetry,
    setWsConnected,
  } = useBettingStore();

  const resolvedCity =
    (feed?.cityId && getCityById(feed.cityId)) ||
    (feed?.cityName && getCityById(feed.cityName)) ||
    EUROPE_CITIES.find((c) => c.feedId === (feed?.id || selectedFeedId)) ||
    selectedCity ||
    EUROPE_CITIES[0];

  const activeStreamUrl =
    youtubeUrl ?? feed?.youtubeLiveUrl ?? resolvedCity.youtubeLiveUrl ?? '';
  const hasStreamAvailable =
    Boolean(activeStreamUrl.trim()) && resolvedCity.isStreamAvailable !== false;

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(0.6);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isLoadingVideo, setIsLoadingVideo] = useState<boolean>(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [useSimulatedCanvas, setUseSimulatedCanvas] = useState<boolean>(false);
  const [pulseKey, setPulseKey] = useState<number>(0);
  const [viewerCount, setViewerCount] = useState<number>(resolvedCity.viewerCount || 1240);

  // Reset loading & error states when switching cities
  useEffect(() => {
    setIsLoadingVideo(true);
    setVideoError(null);
    setUseSimulatedCanvas(false);
    setViewerCount(resolvedCity.viewerCount || 950);

    const timer = setTimeout(() => {
      setIsLoadingVideo(false);
    }, 650);

    return () => clearTimeout(timer);
  }, [resolvedCity.id, activeStreamUrl]);

  // Simulate realistic viewer count & vehicle telemetry updates when WebSocket is on standby
  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount((prev) => {
        const delta = Math.floor(Math.random() * 11) - 5;
        return Math.max(120, prev + delta);
      });
      if (isPlaying && hasStreamAvailable) {
        setLiveTelemetry(
          Math.max(1, (useBettingStore.getState().liveVehicleCount + 1) % 35),
          Math.floor(20 + Math.random() * 60)
        );
        setPulseKey((k) => k + 1);
      }
    }, 4500);
    return () => clearInterval(interval);
  }, [isPlaying, hasStreamAvailable, setLiveTelemetry]);

  // Connect to backend WebSocket `/ws/count/{feed_id}` for real-time YOLOv8 vehicle crossings
  useEffect(() => {
    const activeFeedId = feed?.id || selectedFeedId || resolvedCity.feedId || 1;
    let ws: WebSocket | null = null;
    let isMounted = true;

    try {
      ws = new WebSocket(`${WS_BASE_URL}/ws/count/${activeFeedId}`);
      ws.onopen = () => {
        if (isMounted) setWsConnected(true);
      };
      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const payload = JSON.parse(event.data);
          if (typeof payload.count === 'number') {
            setLiveTelemetry(payload.count, payload.crossing_x ?? 50);
            setPulseKey((k) => k + 1);
          }
        } catch {
          // Ignore malformed WS frames
        }
      };
      ws.onclose = () => {
        if (isMounted) setWsConnected(false);
      };
      ws.onerror = () => {
        ws?.close();
      };
    } catch {
      setWsConnected(false);
    }

    return () => {
      isMounted = false;
      ws?.close();
    };
  }, [feed?.id, selectedFeedId, resolvedCity.feedId, setLiveTelemetry, setWsConnected]);

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {
        // Ignore fullscreen permission errors
      });
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const AnyReactPlayer = ReactPlayer as unknown as React.ComponentType<Record<string, unknown>>;

  return (
    <div
      ref={containerRef}
      className="rounded-2xl bg-[#1a1a1a] border border-white/10 overflow-hidden shadow-2xl flex flex-col"
    >
      {/* Top Overlay Header Bar */}
      <div className="px-4 py-3 bg-[#141414] border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {hasStreamAvailable ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase bg-red-500/20 text-red-400 border border-red-500/40">
              <Radio className="w-3 h-3 animate-pulse" />
              Live Now
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <Clock className="w-3 h-3" />
              Coming Soon
            </span>
          )}

          <div>
            <h4 className="text-sm font-extrabold text-white leading-tight flex items-center gap-1.5">
              <span>{resolvedCity.flagEmoji}</span>
              <span>{resolvedCity.name}</span>
              <span className="text-gray-500 font-normal">•</span>
              <span className="text-xs font-semibold text-[#FFD700]">
                {resolvedCity.country}
              </span>
            </h4>
            <p className="text-[11px] text-gray-400 truncate max-w-xs sm:max-w-md">
              {resolvedCity.corridorName}
            </p>
          </div>
        </div>

        {/* Viewer Count & Stream Source Toggle */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-200">
            <Users className="w-3.5 h-3.5 text-[#FFD700]" />
            <span>{viewerCount.toLocaleString()} watching</span>
          </div>

          {hasStreamAvailable && (
            <button
              type="button"
              onClick={() => {
                setVideoError(null);
                setUseSimulatedCanvas((prev) => !prev);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30 hover:bg-[#FFD700]/25 transition-colors"
              title="Switch between YouTube embed and Optical Telemetry Stream"
            >
              <Tv className="w-3 h-3" />
              <span>{useSimulatedCanvas ? 'YouTube Feed' : 'Optical Sim'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 16:9 Video Viewport */}
      <div className="relative aspect-video w-full bg-[#0a0a0a] overflow-hidden select-none">
        {/* Loading Skeleton while switching cities */}
        {isLoadingVideo && (
          <div className="absolute inset-0 z-30 bg-[#121212] flex flex-col items-center justify-center gap-3 p-6 animate-pulse">
            <div className="w-12 h-12 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700]/40 flex items-center justify-center">
              <Radio className="w-6 h-6 text-[#FFD700] animate-spin" />
            </div>
            <div className="h-4 w-48 rounded bg-white/10" />
            <div className="h-3 w-32 rounded bg-white/5" />
            <span className="text-xs font-semibold text-gray-400">
              Connecting to {resolvedCity.name} traffic camera...
            </span>
          </div>
        )}

        {/* CASE 1: No Live Stream Available -> Placeholder Image with 'Coming Soon' */}
        {!hasStreamAvailable ? (
          <div className="relative w-full h-full">
            <img
              src={resolvedCity.thumbnailUrl}
              alt={`${resolvedCity.name} placeholder`}
              className="w-full h-full object-cover opacity-35 blur-[1px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/60 to-transparent flex flex-col items-center justify-center p-6 text-center">
              <span className="px-3.5 py-1 rounded-full bg-[#FFD700]/20 border border-[#FFD700] text-[#FFD700] text-xs font-black uppercase tracking-widest mb-3">
                Coming Soon
              </span>
              <h3 className="text-xl font-black text-white mb-1">
                {resolvedCity.flagEmoji} {resolvedCity.name} Live Traffic Feed
              </h3>
              <p className="text-xs text-gray-300 max-w-md mb-4">
                Optical camera calibration for {resolvedCity.corridorName} is currently in
                progress. Select another European city pin or preview the optical simulation.
              </p>
              <button
                type="button"
                onClick={() => {
                  setUseSimulatedCanvas(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#FFD700] text-[#0f0f0f] font-extrabold text-xs hover:bg-amber-400 transition-colors"
              >
                Switch to Active London Feed
              </button>
            </div>
          </div>
        ) : videoError && !useSimulatedCanvas ? (
          /* CASE 2: Error Handling UI when video stream fails to load */
          <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#111111]">
            <img
              src={resolvedCity.thumbnailUrl}
              alt={resolvedCity.name}
              className="absolute inset-0 w-full h-full object-cover opacity-20"
            />
            <div className="relative z-10 max-w-md space-y-3 bg-[#1a1a1a]/95 border border-red-500/40 rounded-2xl p-5 shadow-2xl">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-extrabold text-white">
                Live Stream Connection Interrupted
              </h4>
              <p className="text-xs text-gray-400">{videoError}</p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setVideoError(null);
                    setIsLoadingVideo(true);
                    setTimeout(() => setIsLoadingVideo(false), 500);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Stream
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVideoError(null);
                    setUseSimulatedCanvas(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFD700] text-[#0f0f0f] text-xs font-extrabold hover:bg-amber-400 transition-colors"
                >
                  Launch Optical Backup Feed
                </button>
              </div>
            </div>
          </div>
        ) : useSimulatedCanvas ? (
          /* CASE 3: High-Availability Simulated Live Corridor View */
          <div className="relative w-full h-full">
            <img
              src={resolvedCity.thumbnailUrl}
              alt={resolvedCity.name}
              className={`w-full h-full object-cover transition-transform duration-1000 ${
                isPlaying ? 'scale-105' : 'scale-100 opacity-75'
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />
          </div>
        ) : (
          /* CASE 4: ReactPlayer YouTube Live Stream */
          <div className="relative w-full h-full">
            <img
              src={resolvedCity.thumbnailUrl}
              alt={resolvedCity.name}
              className="absolute inset-0 w-full h-full object-cover opacity-45"
            />
            <AnyReactPlayer
              url={activeStreamUrl}
              playing={isPlaying}
              volume={volume}
              muted={isMuted}
              width="100%"
              height="100%"
              onReady={() => setIsLoadingVideo(false)}
              onError={() => {
                setIsLoadingVideo(false);
                setVideoError(
                  `Unable to reach YouTube stream (${activeStreamUrl}). You can retry or switch to the Optical Backup Feed.`
                );
              }}
              config={{
                youtube: {
                  playerVars: {
                    autoplay: 1,
                    modestbranding: 1,
                    rel: 0,
                  },
                },
              }}
            />
          </div>
        )}

        {/* Top-Left Overlay: City Name + 'Live Now' Badge + Viewer Count */}
        {hasStreamAvailable && (
          <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 pointer-events-none">
            <div className="bg-[#0f0f0f]/85 backdrop-blur-md border border-white/15 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                {resolvedCity.flagEmoji} {resolvedCity.name}
              </span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                LIVE NOW
              </span>
            </div>
            <div className="bg-[#0f0f0f]/85 backdrop-blur-md border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-gray-200 flex items-center gap-1.5 shadow-lg">
              <Users className="w-3 h-3 text-[#FFD700]" />
              <span>{viewerCount.toLocaleString()} viewers</span>
            </div>
          </div>
        )}

        {/* Top-Right Overlay: Live Optical Vehicle Counter */}
        {hasStreamAvailable && (
          <div className="absolute top-3 right-3 z-20 bg-[#0f0f0f]/85 backdrop-blur-md border border-[#FFD700]/40 rounded-2xl px-3.5 py-2 flex items-center gap-2.5 shadow-xl pointer-events-none">
            <Activity className="w-4 h-4 text-[#FFD700] animate-pulse" />
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                Optical Count
              </div>
              <div className="text-lg font-black font-mono text-[#FFD700] leading-none">
                {liveVehicleCount}
              </div>
            </div>
          </div>
        )}

        {/* Superimposed Horizontal Optical Green Line (65% height) */}
        {hasStreamAvailable && (
          <div
            className="absolute left-0 right-0 z-20 pointer-events-none"
            style={{ top: '65%' }}
          >
            <div className="h-[2.5px] w-full bg-emerald-400 shadow-[0_0_14px_#10B981,0_0_28px_#10B981]" />
            <div className="flex items-center justify-between px-3 mt-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-black/75 text-emerald-400 border border-emerald-500/40">
                YOLOv8 Optical Trigger Line
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/75 text-[#FFD700] border border-[#FFD700]/40">
                {resolvedCity.id.toUpperCase()}-CAM
              </span>
            </div>

            <AnimatePresence mode="popLayout">
              {pulseKey > 0 && (
                <motion.div
                  key={pulseKey}
                  initial={{ opacity: 1, y: 0, scale: 0.9 }}
                  animate={{ opacity: 0, y: -32, scale: 1.15 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.85 }}
                  style={{ left: `${lastVehicleCrossingX ?? 50}%` }}
                  className="absolute -top-6 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#FFD700] text-[#0f0f0f] font-black text-[10px] shadow-lg"
                >
                  +1 VEHICLE
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar: Play/Pause, Volume Slider, Mute, Fullscreen */}
      <div className="px-4 py-2.5 bg-[#141414] border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Play / Pause Button */}
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            disabled={!hasStreamAvailable}
            className="p-2 rounded-xl bg-white/5 hover:bg-[#FFD700] text-white hover:text-[#0f0f0f] disabled:opacity-40 transition-colors"
            aria-label={isPlaying ? 'Pause stream' : 'Play stream'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Volume Mute + Range Slider */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              className="p-1.5 rounded-lg text-gray-300 hover:text-[#FFD700] transition-colors"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-gray-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#FFD700]" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const nextVol = parseFloat(e.target.value);
                setVolume(nextVol);
                if (nextVol > 0 && isMuted) setIsMuted(false);
              }}
              aria-label="Volume control"
              className="w-20 sm:w-24 accent-[#FFD700] cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-gray-400 hidden sm:inline truncate max-w-[220px]">
            {activeStreamUrl || 'Stream Standby'}
          </span>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-gray-300 hover:text-[#FFD700] transition-colors"
            title="Toggle Fullscreen"
            aria-label="Toggle Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
