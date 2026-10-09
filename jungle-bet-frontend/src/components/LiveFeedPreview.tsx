"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Radio, Signal, MapPin } from "lucide-react";
import axios from "axios";
import VideoPlayer from "./VideoPlayer";

export interface CameraFeed {
  id: number;
  name: string;
  location: string;
  rtsp_url: string;
  country_code: string;
  status: string;
  lane_mask?: { coordinates?: number[][] } | null;
}

// ONLY THE 3 VERIFIED WORKING STREAMS
export const VERIFIED_WORKING_FEEDS: CameraFeed[] = [
  {
    id: 1,
    name: "Caltrans I-405 Culver Overpass",
    location: "Los Angeles - I-405",
    rtsp_url: "https://wzmedia.dot.ca.gov/D12/SB405CulverBlvd.stream/playlist.m3u8",
    country_code: "US",
    status: "active",
    lane_mask: { coordinates: [[0.10, 0.45], [0.90, 0.45], [0.95, 0.95], [0.05, 0.95]] },
  },
  {
    id: 2,
    name: "TfL Chelsea Bridge Junction",
    location: "London - Chelsea Bridge",
    rtsp_url: "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.04641.mp4",
    country_code: "UK",
    status: "active",
    lane_mask: { coordinates: [[0.15, 0.40], [0.85, 0.40], [0.90, 0.95], [0.10, 0.95]] },
  },
  {
    id: 3,
    name: "Rijkswaterstaat A10 Overpass",
    location: "Amsterdam - A10",
    rtsp_url: "https://stream.inmoves.nl/rtplive/IB_55.stream/playlist.m3u8",
    country_code: "NL",
    status: "active",
    lane_mask: { coordinates: [[0.05, 0.45], [0.95, 0.45], [0.98, 0.95], [0.02, 0.95]] },
  },
];

export const DEFAULT_FEEDS = VERIFIED_WORKING_FEEDS;

export function filterOnlyVerifiedFeeds(incoming: CameraFeed[]): CameraFeed[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return VERIFIED_WORKING_FEEDS;

  const valid = incoming.filter((feed) => {
    const loc = (feed.location || "").toLowerCase();
    const name = (feed.name || "").toLowerCase();

    // Strictly remove all "Simulation" or "Test" feeds
    if (loc.includes("simulat") || name.includes("simulat") || loc.includes("test") || name.includes("test")) {
      return false;
    }

    // Include ONLY the 3 verified working streams: "Los Angeles - I-405", "London - Chelsea Bridge", and "Amsterdam - A10"
    const isLA = loc.includes("i-405") || name.includes("i-405") || loc.includes("los angeles");
    const isLondon = loc.includes("chelsea") || name.includes("chelsea") || loc.includes("london");
    const isAmsterdam = loc.includes("a10") || loc.includes("amsterdam") || name.includes("hoevelaken");

    return isLA || isLondon || isAmsterdam;
  });

  return valid.length > 0 ? valid : VERIFIED_WORKING_FEEDS;
}

interface LiveFeedPreviewProps {
  selectedFeedId?: number;
  onSelectFeed?: (feed: CameraFeed) => void;
  className?: string;
}

export default function LiveFeedPreview({
  selectedFeedId = 1,
  onSelectFeed,
  className = "",
}: LiveFeedPreviewProps) {
  const [feeds, setFeeds] = useState<CameraFeed[]>(VERIFIED_WORKING_FEEDS);

  // Fetch feeds from backend API and strictly filter to only verified streams
  useEffect(() => {
    let isMounted = true;
    const fetchFeeds = async () => {
      try {
        const res = await axios.get("http://localhost:8000/camera-feeds", { timeout: 3000 });
        if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
          const verified = filterOnlyVerifiedFeeds(res.data);
          setFeeds(verified);
        }
      } catch (err) {
        console.warn("Using default verified camera feeds (backend offline or loading):", err);
      }
    };

    fetchFeeds();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeFeed = feeds.find((f) => f.id === selectedFeedId) || feeds[0] || VERIFIED_WORKING_FEEDS[0];

  const handleFeedChange = (feed: CameraFeed) => {
    if (onSelectFeed) {
      onSelectFeed(feed);
    }
  };

  const getCountryFlag = (code: string) => {
    switch (code?.toUpperCase()) {
      case "US":
        return "🇺🇸";
      case "UK":
      case "GB":
        return "🇬🇧";
      case "NL":
        return "🇳🇱";
      default:
        return "🌐";
    }
  };

  return (
    <div
      className={`live-feed-preview-container flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-black/60 backdrop-blur-md shadow-2xl ${className}`}
    >
      {/* HEADER BAR */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-black/80 via-black/60 to-black/80 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-[var(--jungle-green)]" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--jungle-green)] shadow-[0_0_8px_var(--jungle-green)]" />
          </span>
          <span className="text-xs font-black tracking-wider uppercase text-white flex items-center gap-1.5">
            <Radio size={14} className="text-[var(--jungle-green)] animate-pulse" />
            VERIFIED OPTICAL STREAMS
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-gray-300 flex items-center gap-1">
            <Signal size={10} className="text-[var(--jungle-green)]" />
            LIVE RTSP
          </span>
          <span className="text-xs">{getCountryFlag(activeFeed.country_code)}</span>
        </div>
      </div>

      {/* HTML5 VIDEO PREVIEW STAGE WITH UNMOUNT/REMOUNT GUARANTEE */}
      <div className="relative aspect-video w-full bg-black overflow-hidden group">
        <VideoPlayer
          feed={activeFeed}
          className="w-full h-full"
          showOverlayBadge={true}
        />

        {/* Top-Left Feed Metadata Tag */}
        <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none z-20">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md border border-white/10">
            <MapPin size={12} className="text-[var(--jungle-green)]" />
            <span className="text-xs font-bold text-white tracking-wide">{activeFeed.location}</span>
            <span className="text-[10px] text-gray-400 font-mono">({activeFeed.country_code})</span>
          </div>
          <span className="text-[11px] font-medium text-gray-300 drop-shadow-md pl-1">
            {activeFeed.name}
          </span>
        </div>
      </div>

      {/* ROAD FEED SELECTOR TABS (ONLY 3 VERIFIED STREAMS) */}
      <div className="p-3 bg-black/80 border-t border-white/10 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400">
            SWITCH LIVE ROAD STREAM
          </span>
          <span className="text-[10px] font-mono text-[var(--jungle-green)] font-semibold">
            3 ACTIVE CAMS
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {feeds.map((feed) => {
            const isSelected = feed.id === activeFeed.id;
            return (
              <motion.button
                key={feed.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleFeedChange(feed)}
                type="button"
                className={`flex flex-col text-left p-2 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[var(--jungle-green)]/15 border-[var(--jungle-green)] shadow-[0_0_15px_rgba(204,255,0,0.25)] ring-1 ring-[var(--jungle-green)]"
                    : "bg-white/5 border-white/10 hover:border-white/30 text-gray-300"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-[10px] font-black text-white truncate max-w-[70px] sm:max-w-[100px]" title={feed.location}>
                    {feed.location}
                  </span>
                  <span className="text-xs shrink-0">{getCountryFlag(feed.country_code)}</span>
                </div>
                <div className="flex items-center justify-between w-full">
                  <span className="text-[9px] text-gray-400 truncate max-w-[65px] sm:max-w-[85px]" title={feed.name}>
                    {feed.name}
                  </span>
                  <span className="text-[8px] font-bold px-1 rounded uppercase bg-[var(--jungle-green)]/20 text-[var(--jungle-green)]">
                    LIVE
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
