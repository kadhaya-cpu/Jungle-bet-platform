"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { CameraFeed } from "./LiveFeedPreview";
import { RefreshCw, Radio, AlertCircle, Volume2, VolumeX } from "lucide-react";

interface VideoPlayerProps {
  feed: CameraFeed;
  className?: string;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  onStatusChange?: (status: "loading" | "playing" | "error") => void;
  showOverlayBadge?: boolean;
}

export default function VideoPlayer({
  feed,
  className = "",
  poster = "/road-bg.jpg",
  autoPlay = true,
  muted = true,
  loop = true,
  onStatusChange,
  showOverlayBadge = false,
}: VideoPlayerProps) {
  // Key used to force complete unmount and remount of video element
  const [renderKey, setRenderKey] = useState<string>(() => `feed-${feed.id}-${Date.now()}`);
  const [isUnmounted, setIsUnmounted] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(muted);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const prevFeedIdRef = useRef<number>(feed.id);

  // Active stream URL pointing to backend proxy
  const primaryStreamUrl = `http://localhost:8000/camera-feeds/${feed.id}/stream`;
  const [currentSrc, setCurrentSrc] = useState<string>(primaryStreamUrl);

  // Complete unmount/remount whenever the location / feed changes
  useEffect(() => {
    if (prevFeedIdRef.current !== feed.id) {
      prevFeedIdRef.current = feed.id;

      // 1. Immediately pause and reset the previous video element if it exists
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.removeAttribute("src");
          videoRef.current.load();
        } catch {
          // Ignore DOM exception during unmount
        }
      }

      // 2. Unmount video component completely to destroy media decoders
      setIsUnmounted(true);
      setIsBuffering(true);
      setHasError(false);
      setCurrentSrc(`http://localhost:8000/camera-feeds/${feed.id}/stream`);

      if (onStatusChange) onStatusChange("loading");

      // 3. Remount fresh video element on next frame with unique mounting key
      const timer = setTimeout(() => {
        setRenderKey(`feed-${feed.id}-${Date.now()}`);
        setIsUnmounted(false);
      }, 60);

      return () => clearTimeout(timer);
    }
  }, [feed.id, onStatusChange]);

  const handleCanPlay = useCallback(() => {
    setIsBuffering(false);
    setHasError(false);
    if (autoPlay && videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (onStatusChange) onStatusChange("playing");
          })
          .catch(() => {
            // Autoplay policy fallback: ensure muted and retry
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play().catch(() => {});
            }
          });
      }
    }
  }, [autoPlay, onStatusChange]);

  const handleWaiting = useCallback(() => {
    setIsBuffering(true);
  }, []);

  const handlePlaying = useCallback(() => {
    setIsBuffering(false);
    setHasError(false);
    if (onStatusChange) onStatusChange("playing");
  }, [onStatusChange]);

  const handleError = useCallback(() => {
    console.warn(`Video playback error for feed ${feed.id} (${feed.location})`);
    // Attempt fallback to direct stream URL if available
    if (currentSrc === primaryStreamUrl && feed.rtsp_url && feed.rtsp_url.startsWith("http")) {
      setCurrentSrc(feed.rtsp_url);
    } else {
      setHasError(true);
      setIsBuffering(false);
      if (onStatusChange) onStatusChange("error");
    }
  }, [currentSrc, primaryStreamUrl, feed.id, feed.location, feed.rtsp_url, onStatusChange]);

  const handleManualRetry = () => {
    setHasError(false);
    setIsBuffering(true);
    setCurrentSrc(`http://localhost:8000/camera-feeds/${feed.id}/stream?retry=${Date.now()}`);
    setRenderKey(`feed-${feed.id}-${Date.now()}`);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div className={`relative w-full h-full bg-black overflow-hidden select-none ${className}`}>
      {/* COMPLETELY UNMOUNTED TRANSITION STATE */}
      {isUnmounted ? (
        <div className="absolute inset-0 bg-[#0a0a0c] flex flex-col items-center justify-center z-10">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/80 border border-[var(--jungle-green)]/30 shadow-[0_0_20px_rgba(204,255,0,0.2)]">
            <RefreshCw size={16} className="text-[var(--jungle-green)] animate-spin" />
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-white">
              Connecting Feed: {feed.location}...
            </span>
          </div>
        </div>
      ) : (
        /* FRESH MOUNTED VIDEO ELEMENT */
        <video
          ref={videoRef}
          key={renderKey}
          src={currentSrc}
          autoPlay={autoPlay}
          loop={loop}
          muted={isMuted}
          playsInline
          poster={poster}
          className="w-full h-full object-cover transition-opacity duration-500"
          onCanPlay={handleCanPlay}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onError={handleError}
        />
      )}

      {/* SCANLINE / AMBIENT STREAM EFFECT */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30 pointer-events-none" />

      {/* BUFFERING SPINNER OVERLAY */}
      {isBuffering && !hasError && !isUnmounted && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center pointer-events-none z-10">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/80 border border-white/10 shadow-lg text-xs font-mono text-gray-200">
            <RefreshCw size={15} className="animate-spin text-[var(--jungle-green)]" />
            <span>Establishing Low-Latency Stream ({feed.location})...</span>
          </div>
        </div>
      )}

      {/* STREAM ERROR / RECONNECT OVERLAY */}
      {hasError && !isUnmounted && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
          <AlertCircle size={32} className="text-amber-400 mb-2 animate-bounce" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wide">
            Live Stream Reconnecting
          </h3>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            Connecting to traffic optical feed for {feed.location} ({feed.name}).
          </p>
          <button
            onClick={handleManualRetry}
            className="mt-3 px-4 py-1.5 rounded-full bg-[var(--jungle-green)] text-black font-bold text-xs hover:shadow-[0_0_15px_var(--jungle-green)] transition-all cursor-pointer active:scale-95"
          >
            Reconnect Stream
          </button>
        </div>
      )}

      {/* BOTTOM-RIGHT QUICK CONTROLS */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 z-20">
        <button
          onClick={() => {
            const nextMuted = !isMuted;
            setIsMuted(nextMuted);
            if (videoRef.current) videoRef.current.muted = nextMuted;
          }}
          className="p-1.5 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/15 text-white/80 hover:text-white transition-all cursor-pointer"
          title={isMuted ? "Unmute stream audio" : "Mute stream audio"}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>

      {/* OVERLAY BADGE (OPTIONAL) */}
      {showOverlayBadge && (
        <div className="absolute top-3 right-3 pointer-events-none z-10">
          <div className="px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md border border-[var(--jungle-green)]/30 text-[10px] font-mono text-[var(--jungle-green)] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md">
            <Radio size={12} className="animate-pulse" />
            <span>LIVE 60FPS</span>
          </div>
        </div>
      )}
    </div>
  );
}
