"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactPlayer from "react-player";
import Hls from "hls.js";
import { CameraFeed } from "./LiveFeedPreview";
import {
  CityFeed,
  CITY_FEEDS,
  extractYouTubeId,
  getYouTubeWatchUrl,
  getYouTubeEmbedUrl,
} from "@/data/cityFeeds";
import { EuropeanCity, cityToCameraFeed } from "@/lib/european-cities";
import { useStore } from "@/lib/store";
import {
  RefreshCw,
  Radio,
  AlertCircle,
  Volume2,
  VolumeX,
  Maximize2,
  Layers,
  Tv,
} from "lucide-react";

export type CompatibleFeed =
  | CameraFeed
  | CityFeed
  | EuropeanCity
  | {
      id: number;
      name?: string;
      location?: string;
      city?: string;
      cityName?: string;
      rtsp_url?: string;
      streamUrl?: string;
      youtube_id?: string;
      youtubeId?: string;
      youtubeVideoId?: string;
      videoId?: string;
      fallbackUrl?: string;
      fallbackVideoId?: string;
      fallbackId?: string;
    };

export interface VideoPlayerProps {
  feed?: CompatibleFeed;
  className?: string;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  onStatusChange?: (status: "loading" | "playing" | "error" | "offline") => void;
  showOverlayBadge?: boolean;
  initialMode?: "embed" | "hls";
  children?: React.ReactNode;
}

/**
 * Resolves video ID and fallback URLs from any compatible feed format.
 */
function resolveFeedMetadata(f?: CompatibleFeed): {
  videoId: string;
  watchUrl: string;
  fallbackUrl: string;
  fallbackVideoId: string;
} {
  if (!f) {
    return {
      videoId: "2srYSk0_yrE",
      watchUrl: getYouTubeWatchUrl("2srYSk0_yrE"),
      fallbackUrl: getYouTubeWatchUrl("IJdzev5gHgM"),
      fallbackVideoId: "IJdzev5gHgM",
    };
  }

  const candidateId =
    ("youtubeVideoId" in f && (f as any).youtubeVideoId ? (f as any).youtubeVideoId : undefined) ||
    ("videoId" in f && f.videoId ? f.videoId : undefined) ||
    ("youtubeId" in f && f.youtubeId ? f.youtubeId : undefined) ||
    ("youtube_id" in f && f.youtube_id ? f.youtube_id : undefined);

  let videoId = candidateId || "2srYSk0_yrE";
  if (!candidateId) {
    const candidateStream =
      ("streamUrl" in f && f.streamUrl ? f.streamUrl : undefined) ||
      ("rtsp_url" in f && f.rtsp_url ? f.rtsp_url : undefined);
    if (candidateStream) {
      const extracted = extractYouTubeId(candidateStream);
      if (extracted) videoId = extracted;
    }
  }

  const candidateFallback =
    ("fallbackVideoId" in f && f.fallbackVideoId ? f.fallbackVideoId : undefined) ||
    ("fallbackId" in f && f.fallbackId ? f.fallbackId : undefined);

  let fallbackVideoId = candidateFallback || "IJdzev5gHgM";
  if (!candidateFallback && "fallbackUrl" in f && f.fallbackUrl) {
    const extracted = extractYouTubeId(f.fallbackUrl);
    if (extracted) fallbackVideoId = extracted;
  }

  const watchUrl = getYouTubeWatchUrl(videoId);
  const fallbackUrl = getYouTubeWatchUrl(fallbackVideoId);

  return { videoId, watchUrl, fallbackUrl, fallbackVideoId };
}

export default function VideoPlayer({
  feed,
  className = "",
  poster = "/road-bg.jpg",
  autoPlay = true,
  muted = true,
  loop = true,
  onStatusChange,
  showOverlayBadge = true,
  initialMode = "embed",
  children,
}: VideoPlayerProps) {
  // Listen to global selectedCity state from Zustand store
  const storeSelectedCity = useStore((state) => state.selectedCity);

  // Active feed resolves from explicit prop or global selectedCity state
  const effectiveFeed: CompatibleFeed =
    feed ?? (storeSelectedCity ? cityToCameraFeed(storeSelectedCity) : CITY_FEEDS[0]);

  const [hasMounted, setHasMounted] = useState<boolean>(false);
  const [playbackMode, setPlaybackMode] = useState<"embed" | "hls">(initialMode);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isMuted, setIsMuted] = useState<boolean>(muted);
  const [retryKey, setRetryKey] = useState<number>(0);
  const [hlsStreamUrl, setHlsStreamUrl] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const prevFeedIdRef = useRef<number>(effectiveFeed.id);

  const feedLocation =
    ("cityName" in effectiveFeed && (effectiveFeed as any).cityName ? (effectiveFeed as any).cityName : undefined) ||
    ("city" in effectiveFeed && effectiveFeed.city ? effectiveFeed.city : undefined) ||
    ("location" in effectiveFeed && effectiveFeed.location ? effectiveFeed.location : undefined) ||
    ("name" in effectiveFeed && effectiveFeed.name ? effectiveFeed.name : "Live Feed");

  const { videoId: activeYtId, watchUrl: activeStreamUrl, fallbackUrl } =
    resolveFeedMetadata(effectiveFeed);
  const [currentUrl, setCurrentUrl] = useState<string>(activeStreamUrl);
  const prevYtIdRef = useRef<string>(activeYtId);

  // Client hydration flag
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Update on feed prop change or global selectedCity change
  useEffect(() => {
    const metadata = resolveFeedMetadata(effectiveFeed);
    if (prevFeedIdRef.current !== effectiveFeed.id || prevYtIdRef.current !== metadata.videoId) {
      prevFeedIdRef.current = effectiveFeed.id;
      prevYtIdRef.current = metadata.videoId;
      setCurrentUrl(metadata.watchUrl);
      setHlsStreamUrl(null);
      setIsBuffering(true);
      setHasError(false);
      setIsOffline(false);
      setErrorMessage("");
      onStatusChange?.("loading");
    }
  }, [effectiveFeed, onStatusChange]);

  // Fetch direct HLS stream using internal API (powered by ytdl-core) when falling back to HLS
  const fetchHlsStream = useCallback(
    async (targetVideoId: string) => {
      setIsBuffering(true);
      try {
        const res = await fetch(`/api/youtube/stream?videoId=${encodeURIComponent(targetVideoId)}`);
        const data = await res.json();
        if (data.success && data.streamUrl) {
          setHlsStreamUrl(data.streamUrl);
          setIsOffline(false);
          setHasError(false);
          return data.streamUrl;
        } else {
          setIsOffline(Boolean(data.isOffline));
          setHasError(true);
          setErrorMessage(data.error || "Live stream offline or unavailable.");
          onStatusChange?.(data.isOffline ? "offline" : "error");
          return null;
        }
      } catch (err: any) {
        console.warn(`[VideoPlayer] Failed to extract HLS stream via ytdl-core:`, err);
        setIsOffline(true);
        setHasError(true);
        setErrorMessage("Traffic camera offline or stream unreachable.");
        onStatusChange?.("offline");
        return null;
      }
    },
    [onStatusChange]
  );

  // Fallback to direct HLS streaming using ytdl-core for better overlay control
  const switchToDirectHls = useCallback(async () => {
    setPlaybackMode("hls");
    setHasError(false);
    setIsOffline(false);
    await fetchHlsStream(activeYtId);
  }, [activeYtId, fetchHlsStream]);

  // HLS.js Lifecycle for Native Video Element
  useEffect(() => {
    if (playbackMode !== "hls" || !hasMounted) return;

    if (!hlsStreamUrl) {
      fetchHlsStream(activeYtId);
      return;
    }

    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 3,
      });
      hlsRef.current = hls;

      hls.loadSource(hlsStreamUrl);
      hls.attachMedia(videoElement);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        setIsOffline(false);
        setHasError(false);
        if (autoPlay) {
          videoElement.play().catch(() => {});
        }
        onStatusChange?.("playing");
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              setHasError(true);
              setIsOffline(true);
              setErrorMessage("Direct HLS feed lost connection.");
              onStatusChange?.("offline");
              break;
          }
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Safari HLS
      videoElement.src = hlsStreamUrl;
      if (autoPlay) {
        videoElement.play().catch(() => {});
      }
      setIsBuffering(false);
    }
  }, [playbackMode, hlsStreamUrl, hasMounted, activeYtId, autoPlay, fetchHlsStream, onStatusChange]);

  // ReactPlayer Callbacks
  const handleReady = useCallback(() => {
    setIsBuffering(false);
    setHasError(false);
    setIsOffline(false);
    onStatusChange?.("playing");
  }, [onStatusChange]);

  const handlePlay = useCallback(() => {
    setIsBuffering(false);
    setHasError(false);
    setIsOffline(false);
    onStatusChange?.("playing");
  }, [onStatusChange]);

  const handleBuffer = useCallback(() => {
    setIsBuffering(true);
  }, []);

  // Error handler: Falls back to direct HLS streaming using ytdl-core, or displays offline state
  const handlePlayerError = useCallback(() => {
    console.warn(`[VideoPlayer] Playback error on feed ${effectiveFeed.id} (${feedLocation}).`);

    // If currently in embed mode, try falling back to direct HLS streaming using ytdl-core
    if (playbackMode === "embed") {
      console.log(`[VideoPlayer] Falling back to direct HLS streaming using ytdl-core for ${feedLocation}...`);
      switchToDirectHls();
      return;
    }

    // If already in HLS mode or direct stream failed, try fallback URL or show offline screen
    if (currentUrl !== fallbackUrl) {
      setCurrentUrl(fallbackUrl);
    } else {
      setHasError(true);
      setIsOffline(true);
      setIsBuffering(false);
      setErrorMessage(`Live traffic feed for ${feedLocation} is currently offline on YouTube.`);
      onStatusChange?.("offline");
    }
  }, [currentUrl, fallbackUrl, effectiveFeed.id, feedLocation, onStatusChange, playbackMode, switchToDirectHls]);

  const handleManualRetry = () => {
    setHasError(false);
    setIsOffline(false);
    setIsBuffering(true);
    setErrorMessage("");
    const metadata = resolveFeedMetadata(effectiveFeed);
    setCurrentUrl(metadata.watchUrl);
    setHlsStreamUrl(null);
    setRetryKey((prev) => prev + 1);
    if (playbackMode === "hls") {
      fetchHlsStream(metadata.videoId);
    }
  };

  const handleFullscreenToggle = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="video-player-container"
      className={`relative w-full h-full bg-[#080c14] overflow-hidden select-none ${className}`}
    >
      {/* 1. VIDEO PLAYBACK LAYER */}
      <div
        className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center bg-black"
        data-testid="react-player-wrapper"
      >
        {hasMounted ? (
          playbackMode === "hls" && hlsStreamUrl ? (
            /* Direct HLS Stream for Enhanced Optical Overlay Control */
            <video
              ref={videoRef}
              key={`hls-stream-${effectiveFeed.id}-${retryKey}`}
              playsInline
              autoPlay={autoPlay}
              muted={isMuted}
              loop={loop}
              poster={poster}
              className="w-full h-full object-cover pointer-events-none"
              onPlaying={handlePlay}
              onWaiting={handleBuffer}
            />
          ) : (
            /* Simple Embedding with React-Player */
            <ReactPlayer
              key={`stream-${effectiveFeed.id}-${retryKey}`}
              src={currentUrl}
              width="100%"
              height="100%"
              playing={autoPlay}
              muted={isMuted}
              loop={loop}
              controls={false}
              playsInline
              config={{
                youtube: {
                  disablekb: 1,
                  iv_load_policy: 3,
                  rel: 0,
                  fs: 0,
                },
              }}
              onReady={handleReady}
              onPlay={handlePlay}
              onWaiting={handleBuffer}
              onError={handlePlayerError}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                minWidth: "100%",
                minHeight: "100%",
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
            />
          )
        ) : (
          <div className="absolute inset-0 bg-[#080c14] flex flex-col items-center justify-center z-10">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0f1624] border border-[#00e5b9]/30 shadow-[0_0_20px_rgba(0,229,185,0.2)]">
              <RefreshCw size={15} className="text-[#00e5b9] animate-spin" />
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-white">
                Loading Feed: {feedLocation}...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. AMBIENT STREAM VIGNETTE (NON-INTERACTIVE) */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#080c14]/90 via-transparent to-black/40 pointer-events-none z-10" />

      {/* 3. CSS OVERLAY CONTAINER FOR GREEN LINE COUNTER & CHILDREN */}
      {children && (
        <div
          className="absolute inset-0 pointer-events-none z-20"
          data-testid="green-line-overlay-container"
        >
          {children}
        </div>
      )}

      {/* 4. BUFFERING SPINNER OVERLAY */}
      {isBuffering && !hasError && !isOffline && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center pointer-events-none z-25">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0f1624]/90 border border-white/10 shadow-lg text-xs font-mono text-gray-200">
            <RefreshCw size={14} className="animate-spin text-[#00e5b9]" />
            <span>
              {playbackMode === "hls"
                ? `Streaming Direct HLS (${feedLocation})...`
                : `Connecting YouTube Live (${feedLocation})...`}
            </span>
          </div>
        </div>
      )}

      {/* 5. ERROR / OFFLINE STREAM OVERLAY */}
      {(hasError || isOffline) && (
        <div
          data-testid="stream-offline-overlay"
          className="absolute inset-0 bg-[#080c14]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30"
        >
          <div className="p-3 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 mb-3 animate-pulse">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
            {isOffline ? "Traffic Feed Offline or Unavailable" : "Live Stream Signal Interrupted"}
          </h3>
          <p className="text-xs text-gray-300 mt-1 max-w-sm">
            {errorMessage ||
              `YouTube live traffic feed for ${feedLocation} is currently unavailable or offline.`}
          </p>
          <div className="flex items-center gap-2.5 mt-4">
            <button
              onClick={handleManualRetry}
              className="px-4 py-2 rounded-full bg-[#00e5b9] text-black font-extrabold text-xs hover:shadow-[0_0_15px_rgba(0,229,185,0.5)] transition-all cursor-pointer active:scale-95 pointer-events-auto"
            >
              Retry Connection
            </button>
            <button
              onClick={() => {
                if (playbackMode === "embed") {
                  switchToDirectHls();
                } else {
                  setPlaybackMode("embed");
                  handleManualRetry();
                }
              }}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-mono text-xs border border-white/20 transition-all cursor-pointer active:scale-95 pointer-events-auto flex items-center gap-1.5"
            >
              {playbackMode === "embed" ? (
                <>
                  <Layers size={13} className="text-[#00e5b9]" />
                  <span>Try Direct HLS</span>
                </>
              ) : (
                <>
                  <Tv size={13} className="text-[#00e5b9]" />
                  <span>Try YouTube Embed</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 6. BOTTOM-RIGHT QUICK CONTROLS (MODE TOGGLE / MUTE / FULLSCREEN) */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 z-30 pointer-events-auto">
        {/* Toggle between simple embed and direct HLS streaming */}
        <button
          onClick={() => {
            if (playbackMode === "embed") {
              switchToDirectHls();
            } else {
              setPlaybackMode("embed");
              setHlsStreamUrl(null);
              setIsBuffering(true);
            }
          }}
          className="px-2 py-1 rounded-md bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/15 text-[10px] font-mono text-gray-300 hover:text-white transition-all cursor-pointer flex items-center gap-1"
          title={
            playbackMode === "embed"
              ? "Switch to Direct HLS Stream (Better Overlay Control)"
              : "Switch to YouTube Embed Player"
          }
        >
          {playbackMode === "embed" ? (
            <>
              <Layers size={11} className="text-[#00e5b9]" />
              <span className="hidden sm:inline">HLS Overlay Mode</span>
            </>
          ) : (
            <>
              <Tv size={11} className="text-amber-400" />
              <span className="hidden sm:inline">Embed Mode</span>
            </>
          )}
        </button>

        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-1.5 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/15 text-white/80 hover:text-white transition-all cursor-pointer"
          title={isMuted ? "Unmute audio" : "Mute audio"}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        <button
          onClick={handleFullscreenToggle}
          className="p-1.5 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/15 text-white/80 hover:text-white transition-all cursor-pointer"
          title="Toggle Fullscreen"
          aria-label="Fullscreen"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* 7. OVERLAY STATUS BADGE */}
      {showOverlayBadge && (
        <div className="absolute top-3 right-3 pointer-events-none z-30">
          <div className="px-2.5 py-1 rounded-md bg-[#0f1624]/85 backdrop-blur-md border border-[#00e5b9]/30 text-[10px] font-mono text-[#00e5b9] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md">
            <Radio size={12} className="animate-pulse" />
            <span>
              {playbackMode === "hls" ? "DIRECT HLS • OPTICAL SYNC" : "YOUTUBE LIVE 60FPS"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
