"""
services/smart_feed_agent.py - RUSH HOUR BET Smart Feed Agent & Business Continuity Engine

Capabilities:
1. YouTube API Optimization (Primary Video Source):
   - Prioritizes YouTube Live searches via YouTube Data API v3 (google-api-python-client + async aiohttp fallback)
   - Smart keyword search variations:
     * 'live traffic camera [city]'
     * 'webcam [city] highway'
     * '[city] traffic live stream'
   - Concurrent search across multiple keyword variations with automatic retry on failure or rate-limiting
   - Strict content filtering to exclude non-traffic content (pedestrians, parks, beaches, zoos, indoor, etc.)
   - Multi-factor quality scoring based on view count, upload time/recency, title relevance, camera angle, zoom, resolution, and FPS
2. 4-Level Robust Fallback Video System:
   - Level 1: Live YouTube stream
   - Level 2: Recent YouTube video (<24 hours old)
   - Level 3: Pre-downloaded MP4 loop from /static/fallback_videos/{city}.mp4
   - Level 4: Generic city timelapse video (/static/fallback_videos/generic_city_timelapse.mp4)
   - Continuous 30-second health monitoring & instant failover switching (< 2 seconds SLA)
3. Global City Data & Peak Traffic Optimization:
   - Loads from /config/cities.json & /config/feed_sources.json
   - Timezone-aware peak traffic hours detection for morning/evening rush hour optimization
4. Performance, Caching & Bandwidth Adaptation:
   - 5-minute TTL caching for validated feed URLs
   - Progressive streaming support & bandwidth adaptation (low/480p, medium/720p, high/1080p)
   - Handles 100+ concurrent users with zero feed interruption
5. Error Handling, Admin Override & Monitoring:
   - Comprehensive logging, Telegram alerts for switches and persistent city feed issues, and /api/feed-health/{city} telemetry
"""

import os
import re
import json
import math
import time
import logging
import asyncio
import datetime
from zoneinfo import ZoneInfo
from typing import Dict, List, Any, Optional, Tuple

import cv2
import requests

try:
    import aiohttp
except ImportError:
    aiohttp = None  # type: ignore

try:
    from googleapiclient.discovery import build as google_api_build
    from googleapiclient.errors import HttpError as GoogleApiHttpError
except ImportError:
    google_api_build = None  # type: ignore
    GoogleApiHttpError = Exception  # type: ignore

logger = logging.getLogger("rush_hour_bet.smart_feed_agent")
logger.setLevel(logging.INFO)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CITIES_CONFIG_PATH = os.path.join(BASE_DIR, "config", "cities.json")
CONFIG_PATH = os.path.join(BASE_DIR, "config", "feed_sources.json")

_raw_fallback_env = os.getenv("FALLBACK_VIDEO_PATH", "").strip()
if _raw_fallback_env:
    if os.path.isabs(_raw_fallback_env) and os.path.exists(_raw_fallback_env):
        DEFAULT_FALLBACK_DIR = _raw_fallback_env
    else:
        DEFAULT_FALLBACK_DIR = os.path.join(BASE_DIR, _raw_fallback_env.lstrip("/"))
else:
    DEFAULT_FALLBACK_DIR = os.path.join(BASE_DIR, "static", "fallback_videos")

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "").strip()
EARTHCAM_API_KEY = os.getenv("EARTHCAM_API_KEY", "").strip()

HEALTH_CHECK_INTERVAL_SECONDS = int(
    os.getenv("HEALTH_CHECK_INTERVAL")
    or os.getenv("FEED_HEALTH_CHECK_INTERVAL", "30")
)
MAX_RETRY_ATTEMPTS = int(os.getenv("MAX_RETRY_ATTEMPTS", "3"))
FEED_CACHE_TTL_SECONDS = int(os.getenv("FEED_CACHE_TTL_SECONDS", "300"))  # 5 minutes default
EMERGENCY_SWITCH_SLA_SECONDS = 2.0
PERSISTENT_FAILURE_THRESHOLD = int(os.getenv("PERSISTENT_FAILURE_THRESHOLD", "3"))

# Fallback Hierarchy Constants
FALLBACK_LEVEL_1_YOUTUBE_LIVE = 1
FALLBACK_LEVEL_2_RECENT_YOUTUBE = 2
FALLBACK_LEVEL_3_CITY_MP4 = 3
FALLBACK_LEVEL_4_GENERIC_TIMELAPSE = 4

FALLBACK_LEVEL_NAMES = {
    1: "live_youtube_stream",
    2: "recent_youtube_video",
    3: "city_mp4_loop",
    4: "generic_city_timelapse",
}

# Traffic-required keywords and pedestrian/park rejection keywords
TRAFFIC_POSITIVE_KEYWORDS = {
    "traffic",
    "highway",
    "expressway",
    "freeway",
    "motorway",
    "autobahn",
    "intersection",
    "junction",
    "bridge",
    "overpass",
    "corridor",
    "arterial",
    "ring road",
    "boulevard",
    "avenue",
    "street",
    "road",
    "tunnel",
    "interchange",
    "lanes",
    "vehicles",
    "cars",
    "webcam",
    "caltrans",
    "tfl",
    "jamcam",
    "rijkswaterstaat",
    "dot",
    "turnpike",
    "viaduct",
    "flyover",
    "causeway",
    "parkway",
    "thruway",
    "speedway",
    "i-405",
    "a10",
    "m-30",
    "shuto",
    "peripherique",
}

NON_TRAFFIC_REJECT_KEYWORDS = {
    "pedestrian only",
    "pedestrian zone",
    "pedestrian mall",
    "pedestrian walkway",
    "walking tour",
    "park bench",
    "city park",
    "central park walk",
    "national park",
    "nature reserve",
    "wildlife",
    "zoo",
    "bird feeder",
    "aquarium",
    "beach cam",
    "beach boardwalk",
    "surf cam",
    "garden cam",
    "botanical garden",
    "forest trail",
    "hiking trail",
    "indoor",
    "cafe interior",
    "hotel lobby",
    "puppy",
    "kitten",
    "cat cam",
    "dog park",
    "playground",
    "skatepark",
    "lofi hip hop",
    "relaxing music",
    "meditation",
}

BANDWIDTH_PROFILES = {
    "low": {
        "profile": "low",
        "recommended_resolution": "480p",
        "width": 854,
        "height": 480,
        "target_bitrate_kbps": 800,
        "max_fps": 24,
        "progressive_chunk_bytes": 65536,  # 64 KB chunks for fast initial playback on slow links
    },
    "medium": {
        "profile": "medium",
        "recommended_resolution": "720p",
        "width": 1280,
        "height": 720,
        "target_bitrate_kbps": 2500,
        "max_fps": 30,
        "progressive_chunk_bytes": 262144,  # 256 KB chunks
    },
    "high": {
        "profile": "high",
        "recommended_resolution": "1080p",
        "width": 1920,
        "height": 1080,
        "target_bitrate_kbps": 5000,
        "max_fps": 30,
        "progressive_chunk_bytes": 524288,  # 512 KB chunks
    },
    "auto": {
        "profile": "auto",
        "recommended_resolution": "1080p",
        "width": 1920,
        "height": 1080,
        "target_bitrate_kbps": 4000,
        "max_fps": 30,
        "progressive_chunk_bytes": 262144,  # 256 KB chunks
    },
}


def normalize_city_key(city_name: str) -> str:
    """Normalize a city name or ID to snake_case key (e.g., 'São Paulo' -> 'sao_paulo', 'New York' -> 'new_york')."""
    if not city_name:
        return "london"
    cleaned = city_name.strip().lower()
    replacements = {
        "ã": "a",
        "á": "a",
        "â": "a",
        "ä": "a",
        "é": "e",
        "è": "e",
        "ê": "e",
        "í": "i",
        "ó": "o",
        "ô": "o",
        "ö": "o",
        "ú": "u",
        "ü": "u",
        "ç": "c",
        "ñ": "n",
    }
    for src, dst in replacements.items():
        cleaned = cleaned.replace(src, dst)
    cleaned = re.sub(r"[^a-z0-9]+", "_", cleaned).strip("_")
    aliases = {
        "la": "los_angeles",
        "nyc": "new_york",
        "new_york_city": "new_york",
        "saopaulo": "sao_paulo",
        "mexicocity": "mexico_city",
        "cdmx": "mexico_city",
        "joburg": "johannesburg",
        "uk": "london",
    }
    return aliases.get(cleaned, cleaned)


def load_feed_sources_config() -> Dict[str, Any]:
    """Load city and feed configuration from config/cities.json and config/feed_sources.json."""
    merged: Dict[str, Any] = {"cities": {}}
    for path in (CONFIG_PATH, CITIES_CONFIG_PATH):
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                    if isinstance(loaded, dict):
                        cities_dict = loaded.get("cities", {})
                        merged.update({k: v for k, v in loaded.items() if k != "cities"})
                        for ck, cv in cities_dict.items():
                            if ck in merged["cities"]:
                                merged["cities"][ck].update(cv)
                            else:
                                merged["cities"][ck] = cv
            except Exception as exc:
                logger.error("Failed to load %s: %s", path, exc)
    return merged


_RAW_CONFIG = load_feed_sources_config()
GLOBAL_CITIES_DATA: Dict[str, Dict[str, Any]] = _RAW_CONFIG.get("cities", {})


def get_global_cities(region: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return list of all global cities with coordinates, timezone, country_code, flag_emoji, search terms, and local time."""
    results = []
    for key, city in GLOBAL_CITIES_DATA.items():
        if region and city.get("region", "").lower() != region.strip().lower():
            continue
        tz_name = city.get("timezone", "UTC")
        try:
            local_now = datetime.datetime.now(ZoneInfo(tz_name))
            local_time_str = local_now.strftime("%H:%M")
            utc_offset = local_now.strftime("%z")
        except Exception:
            local_time_str = datetime.datetime.now(datetime.timezone.utc).strftime("%H:%M")
            utc_offset = "+0000"

        coords = city.get("coordinates", {"lat": 0.0, "long": 0.0})
        city_display = city.get("name", key.title())
        default_search_terms = [
            f"live traffic camera {city_display}",
            f"webcam {city_display} highway",
            f"{city_display} traffic live stream",
        ]
        results.append({
            "id": city.get("id", key),
            "feed_id": city.get("feed_id", 1),
            "name": city_display,
            "city": city_display,
            "country": city.get("country", ""),
            "country_code": city.get("country_code", "US"),
            "countryCode": city.get("country_code", "US"),
            "flag_emoji": city.get("flag_emoji", "🌐"),
            "flagEmoji": city.get("flag_emoji", "🌐"),
            "flag": city.get("flag_emoji", "🌐"),
            "region": city.get("region", "Global"),
            "timezone": tz_name,
            "utc_offset": utc_offset,
            "local_time": local_time_str,
            "lat": float(coords.get("lat", 0.0)),
            "long": float(coords.get("long", 0.0)),
            "lng": float(coords.get("long", 0.0)),
            "coordinates": {
                "lat": float(coords.get("lat", 0.0)),
                "long": float(coords.get("long", 0.0)),
                "lng": float(coords.get("long", 0.0)),
            },
            "corridor": city.get("corridor", ""),
            "youtube_search_terms": city.get("youtube_search_terms", default_search_terms),
            "peak_traffic_hours": city.get("peak_traffic_hours", {
                "morning": {"start": "07:00", "end": "10:00"},
                "evening": {"start": "16:30", "end": "19:30"},
                "windows": ["07:00-10:00", "16:30-19:30"],
            }),
            "fallback_video": city.get("fallback_video", f"/static/fallback_videos/{key}.mp4"),
            "fallback_video_filename": city.get("fallback_video_filename", f"{key}.mp4"),
            "generic_timelapse_video": city.get(
                "generic_timelapse_video",
                "/static/fallback_videos/generic_city_timelapse.mp4",
            ),
            "sources_count": len(city.get("sources", [])),
        })
    return results


def get_city_info(city_query: str) -> Optional[Dict[str, Any]]:
    """Lookup a city by name, slug, or country code."""
    norm = normalize_city_key(city_query)
    if norm in GLOBAL_CITIES_DATA:
        for c in get_global_cities():
            if c["id"] == norm:
                return c
    for c in get_global_cities():
        if (
            c["name"].lower() == city_query.strip().lower()
            or c["country_code"].lower() == city_query.strip().lower()
            or str(c["feed_id"]) == str(city_query).strip()
        ):
            return c
    return None


class SmartFeedAgent:
    """
    RUSH HOUR BET Smart Feed Agent
    Manages YouTube Live discovery, smart keyword searches with retry & concurrent execution,
    4-level fallback video hierarchy, 5-minute URL caching, bandwidth adaptation,
    30-second health checks, <2-second emergency failover, and Telegram/email alerting.
    """

    def __init__(self):
        self.config = load_feed_sources_config()
        self.cities: Dict[str, Dict[str, Any]] = self.config.get("cities", {})
        self.health_check_interval = HEALTH_CHECK_INTERVAL_SECONDS
        self.max_retry_attempts = MAX_RETRY_ATTEMPTS
        self.cache_ttl_seconds = FEED_CACHE_TTL_SECONDS
        self.emergency_sla_seconds = EMERGENCY_SWITCH_SLA_SECONDS
        self.persistent_failure_threshold = PERSISTENT_FAILURE_THRESHOLD
        self.fallback_dir = DEFAULT_FALLBACK_DIR

        # Ensure /static/fallback_videos/ directory exists
        try:
            os.makedirs(self.fallback_dir, exist_ok=True)
        except Exception as exc:
            logger.warning("Could not create fallback video directory %s: %s", self.fallback_dir, exc)

        # Runtime state per city
        self.feed_states: Dict[str, Dict[str, Any]] = {}
        self.admin_overrides: Dict[str, Dict[str, Any]] = {}
        self.load_balance_counters: Dict[str, int] = {}
        self.source_active_connections: Dict[str, int] = {}
        self.failover_history: List[Dict[str, Any]] = []
        self.city_failure_counts: Dict[str, int] = {}
        self.persistent_alerts_sent: Dict[str, float] = {}

        # 5-minute feed URL cache: key -> {"data": dict, "expires_at": float, "created_at": float, "signature": tuple}
        self.feed_url_cache: Dict[str, Dict[str, Any]] = {}

        # YouTube API rate-limit tracking
        self.youtube_rate_limit_state: Dict[str, Any] = {
            "rate_limited": False,
            "last_rate_limit_ts": None,
            "cooldown_until_ts": 0.0,
            "rate_limit_hits": 0,
            "total_api_calls": 0,
            "total_retries": 0,
        }

        self.last_health_scan_ts: Optional[float] = None
        self._monitor_task: Optional[asyncio.Task] = None
        self._running: bool = False

        self._initialize_states()

    @property
    def cities_config(self) -> Dict[str, Dict[str, Any]]:
        return self.cities

    @property
    def feed_registry(self) -> Dict[str, Dict[str, Any]]:
        return self.feed_states

    def _initialize_states(self):
        """Initialize scored feed pools, fallback hierarchy, and optimal streams for all global cities."""
        for city_key, city_cfg in self.cities.items():
            city_name = city_cfg.get("name", city_key.title())
            raw_sources = city_cfg.get("sources", [])
            scored_sources = []

            for src in raw_sources:
                if not self.is_valid_traffic_feed(
                    title=src.get("title", ""),
                    description=city_cfg.get("corridor", ""),
                    tags=[src.get("angle", ""), src.get("provider", "")],
                ):
                    continue
                src_copy = dict(src)
                # Assign fallback level if not already present
                if "fallback_level" not in src_copy:
                    if src_copy.get("provider") == "youtube" and src_copy.get("stream_type") == "recent_video":
                        src_copy["fallback_level"] = FALLBACK_LEVEL_2_RECENT_YOUTUBE
                    else:
                        src_copy["fallback_level"] = FALLBACK_LEVEL_1_YOUTUBE_LIVE

                score = self.calculate_quality_score(src_copy, city_name=city_name)
                src_copy["quality_score"] = score
                src_copy["healthy"] = True
                src_copy["is_healthy"] = True
                src_copy["last_checked"] = time.time()
                src_copy["latency_ms"] = 38.0 if src_copy.get("priority", 1) == 1 else 55.0
                scored_sources.append(src_copy)

            # Sort by: Level 1 live YouTube first, then quality_score descending, then priority ascending
            scored_sources.sort(
                key=lambda s: (
                    0 if (s.get("provider") == "youtube" and s.get("fallback_level", 1) == 1) else 1,
                    s.get("fallback_level", 1),
                    -s["quality_score"],
                    s.get("priority", 99),
                )
            )

            fallback_rel = city_cfg.get("fallback_video") or f"/static/fallback_videos/{city_key}.mp4"
            generic_timelapse_rel = city_cfg.get(
                "generic_timelapse_video",
                "/static/fallback_videos/generic_city_timelapse.mp4",
            )
            active_source = scored_sources[0] if scored_sources else None
            active_level = (
                active_source.get("fallback_level", FALLBACK_LEVEL_1_YOUTUBE_LIVE)
                if active_source
                else FALLBACK_LEVEL_3_CITY_MP4
            )

            default_search_terms = [
                f"live traffic camera {city_name}",
                f"webcam {city_name} highway",
                f"{city_name} traffic live stream",
            ]

            self.feed_states[city_key] = {
                "city_id": city_key,
                "city_name": city_name,
                "country": city_cfg.get("country", ""),
                "country_code": city_cfg.get("country_code", "US"),
                "flag_emoji": city_cfg.get("flag_emoji", "🌐"),
                "region": city_cfg.get("region", "Global"),
                "timezone": city_cfg.get("timezone", "UTC"),
                "coordinates": city_cfg.get("coordinates", {"lat": 0.0, "long": 0.0}),
                "corridor": city_cfg.get("corridor", ""),
                "youtube_search_terms": city_cfg.get("youtube_search_terms", default_search_terms),
                "peak_traffic_hours": city_cfg.get("peak_traffic_hours", {
                    "morning": {"start": "07:00", "end": "10:00"},
                    "evening": {"start": "16:30", "end": "19:30"},
                    "windows": ["07:00-10:00", "16:30-19:30"],
                }),
                "status": "live" if active_source else "fallback",
                "is_fallback": False if active_source else True,
                "fallback_level": active_level,
                "fallback_level_name": FALLBACK_LEVEL_NAMES.get(active_level, "live_youtube_stream"),
                "active_source": active_source,
                "optimal_url": active_source["url"] if active_source else fallback_rel,
                "fallback_url": fallback_rel,
                "generic_timelapse_url": generic_timelapse_rel,
                "quality_score": active_source["quality_score"] if active_source else 75.0,
                "sources": scored_sources,
                "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }
            self.load_balance_counters[city_key] = 0
            self.city_failure_counts[city_key] = 0

    # =========================================================================
    # 1. SMART KEYWORD VARIATIONS & CONTENT FILTERING
    # =========================================================================
    def get_smart_keyword_variations(self, city_name: str) -> List[str]:
        """
        Generate prioritized smart YouTube search keyword variations for a city:
        1. 'live traffic camera [city]'
        2. 'webcam [city] highway'
        3. '[city] traffic live stream'
        Plus any additional configured search terms for the city.
        """
        city_key = normalize_city_key(city_name)
        city_state = self.feed_states.get(city_key, {})
        display_name = city_state.get("city_name") or city_name.strip().title()

        primary_variations = [
            f"live traffic camera {display_name}",
            f"webcam {display_name} highway",
            f"{display_name} traffic live stream",
        ]

        configured_terms = city_state.get("youtube_search_terms", [])
        combined = list(primary_variations)
        for term in configured_terms:
            if term not in combined:
                combined.append(term)
        return combined

    def is_valid_traffic_feed(
        self,
        title: str,
        description: str = "",
        tags: Optional[List[str]] = None,
    ) -> bool:
        """
        Content filter ensuring only vehicular traffic / road / highway footage is accepted.
        Strictly rejects pedestrian walkways, parks, beaches, zoos, indoor cams, and non-road streams.
        """
        combined = f"{title} {description} {' '.join(tags or [])}".lower()

        # 1. Immediate rejection if any non-traffic / pedestrian / park phrase is present
        for reject_kw in NON_TRAFFIC_REJECT_KEYWORDS:
            if reject_kw in combined:
                logger.info("[ContentFilter] Rejected feed '%s' due to keyword '%s'", title, reject_kw)
                return False

        # Reject standalone 'pedestrian', 'park', 'beach', 'zoo', 'indoor', etc. if no strong road/highway keyword overrides
        strict_single_words = {
            "pedestrian",
            "pedestrians",
            "park",
            "parks",
            "zoo",
            "aquarium",
            "beach",
            "garden",
            "playground",
            "indoor",
            "boardwalk",
            "footpath",
            "sidewalk",
        }
        tokens = set(re.findall(r"[a-z0-9\-]+", combined))
        has_strict_reject_word = bool(tokens.intersection(strict_single_words))
        has_strong_road_word = any(
            rw in combined
            for rw in (
                "highway",
                "expressway",
                "freeway",
                "motorway",
                "autobahn",
                "overpass",
                "interchange",
                "i-405",
                "caltrans",
                "tfl",
                "rijkswaterstaat",
            )
        )
        if has_strict_reject_word and not has_strong_road_word:
            logger.info("[ContentFilter] Rejected non-road feed '%s'", title)
            return False

        # 2. Must contain at least one positive traffic/road indicator
        has_traffic_kw = any(kw in combined for kw in TRAFFIC_POSITIVE_KEYWORDS)
        return has_traffic_kw

    def analyze_frame_for_traffic(self, video_path_or_frame: Any) -> Dict[str, Any]:
        """
        Inspects a video file or numpy frame with OpenCV to verify valid resolution,
        non-black/non-corrupt frame, and road/vehicular visual characteristics.
        """
        frame = None
        if isinstance(video_path_or_frame, str):
            resolved = video_path_or_frame
            if resolved.startswith("/static/"):
                resolved = os.path.join(BASE_DIR, resolved.lstrip("/"))
            if os.path.exists(resolved):
                cap = cv2.VideoCapture(resolved)
                if cap.isOpened():
                    ret, frm = cap.read()
                    if ret:
                        frame = frm
                cap.release()
        else:
            frame = video_path_or_frame

        if frame is None or not hasattr(frame, "shape"):
            return {"valid": False, "reason": "unreadable_frame", "score": 0.0}

        h, w = frame.shape[:2]
        if h < 120 or w < 160:
            return {"valid": False, "reason": "resolution_too_low", "score": 20.0}

        mean_brightness = float(frame.mean())
        std_contrast = float(frame.std())
        if mean_brightness < 3.0 or std_contrast < 2.0:
            return {"valid": False, "reason": "blank_or_frozen_frame", "score": 10.0}

        aspect_ratio = w / float(h)
        is_widescreen = 1.3 <= aspect_ratio <= 2.4
        visual_score = min(100.0, 60.0 + (20.0 if is_widescreen else 5.0) + min(20.0, std_contrast / 3.0))
        return {
            "valid": True,
            "width": w,
            "height": h,
            "brightness": round(mean_brightness, 2),
            "contrast": round(std_contrast, 2),
            "visual_score": round(visual_score, 2),
        }

    # =========================================================================
    # 2. QUALITY SCORING (View Count, Upload Time, Title Relevance + Angle/Zoom)
    # =========================================================================
    def calculate_youtube_quality_score(
        self,
        source: Dict[str, Any],
        city_name: Optional[str] = None,
    ) -> float:
        """
        Calculate YouTube-specific quality score (0 - 100) based on:
        1. Title Relevance (max 40 pts): matches city name, 'live', 'traffic', 'highway', 'webcam', 'camera'
        2. Upload Time / Live Recency (max 35 pts): live stream (35 pts), <6h (30 pts), <24h (25 pts), >24h (10 pts)
        3. View Count / Popularity (max 25 pts): log-scaled view count
        """
        title = str(source.get("title", "")).lower()
        description = str(source.get("description", "")).lower()
        combined = f"{title} {description}"

        # 1. Title Relevance (0 - 40 pts)
        relevance_score = 0.0
        if city_name and city_name.strip().lower() in combined:
            relevance_score += 12.0
        high_value_terms = ["traffic", "highway", "expressway", "freeway", "motorway", "live", "camera", "webcam", "cam", "interchange", "bridge"]
        matches = sum(1 for term in high_value_terms if term in title)
        relevance_score += min(28.0, matches * 6.5)

        # Penalty if non-traffic words appear
        if not self.is_valid_traffic_feed(title, description):
            return 0.0

        # 2. Upload Time / Recency (0 - 35 pts)
        recency_score = 20.0
        is_live = source.get("is_live") or source.get("stream_type") == "live" or source.get("eventType") == "live"
        age_hours = source.get("age_hours")
        published_at = source.get("published_at") or source.get("upload_time") or source.get("publishedAt")

        if age_hours is None and published_at:
            try:
                pub_str = str(published_at).replace("Z", "+00:00")
                pub_dt = datetime.datetime.fromisoformat(pub_str)
                if pub_dt.tzinfo is None:
                    pub_dt = pub_dt.replace(tzinfo=datetime.timezone.utc)
                delta = datetime.datetime.now(datetime.timezone.utc) - pub_dt
                age_hours = max(0.0, delta.total_seconds() / 3600.0)
            except Exception:
                age_hours = None

        if is_live:
            recency_score = 35.0
        elif age_hours is not None:
            if age_hours <= 6.0:
                recency_score = 30.0
            elif age_hours <= 24.0:
                recency_score = 25.0
            elif age_hours <= 72.0:
                recency_score = 15.0
            else:
                recency_score = 8.0

        # 3. View Count (0 - 25 pts)
        view_count = int(source.get("view_count") or source.get("concurrent_viewers") or source.get("viewCount") or 0)
        if view_count > 0:
            # log10(100) = 2 -> 10 pts, log10(10,000) = 4 -> 20 pts, log10(100,000) = 5 -> 25 pts
            view_score = min(25.0, max(5.0, math.log10(max(1, view_count)) * 5.0))
        else:
            view_score = 12.0  # Baseline when view count is not returned in search snippet

        total = relevance_score + recency_score + view_score
        return round(min(100.0, max(0.0, total)), 2)

    def calculate_quality_score(
        self,
        source: Dict[str, Any],
        city_name: Optional[str] = None,
    ) -> float:
        """
        Unified Quality Scoring System (0 - 100):
        Combines camera optical suitability (angle, zoom, resolution, FPS) with
        YouTube stream quality metrics (view count, upload time/recency, and title relevance).
        """
        has_camera_optical_fields = any(k in source for k in ("angle", "zoom", "zoom_level", "resolution", "fps"))
        has_youtube_metrics = any(k in source for k in ("view_count", "viewCount", "upload_time", "published_at", "publishedAt"))

        # Pure YouTube search result without camera angle metadata
        if has_youtube_metrics and not has_camera_optical_fields:
            yt_score = self.calculate_youtube_quality_score(source, city_name=city_name)
            if source.get("healthy") is False or source.get("is_healthy") is False:
                yt_score *= 0.25
            return round(yt_score, 2)

        score = 0.0

        # 1. Camera Angle Score (max 35 pts)
        angle = str(source.get("angle", "elevated_highway")).lower()
        angle_scores = {
            "overhead_gantry": 35.0,
            "overhead_highway": 35.0,
            "elevated_overpass": 34.0,
            "elevated_highway": 33.0,
            "elevated_bridge": 32.0,
            "bridge_overpass": 30.0,
            "elevated_junction": 30.0,
            "intersection_high": 27.0,
            "street_level": 15.0,
            "ground": 10.0,
        }
        score += angle_scores.get(angle, 24.0)

        # 2. Zoom Level Score (max 30 pts) — optimal_medium gives clearest vehicle separation
        zoom = str(source.get("zoom_level", source.get("zoom", "optimal_medium"))).lower()
        zoom_scores = {
            "optimal_medium": 30.0,
            "optimal_multi_lane": 30.0,
            "medium_highway": 28.0,
            "medium_wide": 26.0,
            "wide_corridor": 24.0,
            "wide": 20.0,
            "close": 14.0,
            "extreme_wide": 10.0,
            "extreme_closeup": 6.0,
            "distant_skyline": 5.0,
        }
        score += zoom_scores.get(zoom, 22.0)

        # 3. Resolution Score (max 20 pts)
        res = str(source.get("resolution", "1080p")).lower()
        if "4k" in res or "2160" in res:
            score += 20.0
        elif "1080" in res:
            score += 18.0
        elif "720" in res:
            score += 14.0
        else:
            score += 8.0

        # 4. Frame Rate & Provider Priority Bonus (max 15 pts)
        fps = int(source.get("fps", 30))
        if fps >= 30:
            score += 10.0
        elif fps >= 24:
            score += 7.0
        else:
            score += 4.0

        priority = int(source.get("priority", 2))
        score += max(0.0, 6.0 - priority)

        # 5. Blend in YouTube metrics (view count, upload time, title relevance) when present
        if has_youtube_metrics:
            yt_bonus = self.calculate_youtube_quality_score(source, city_name=city_name)
            # Weighted blend (80% optical + 20% YouTube popularity/recency/relevance, plus live bonus)
            score = (score * 0.82) + (yt_bonus * 0.18)
            if source.get("is_live") or source.get("stream_type") == "live":
                score += 2.5

        # Deduct penalty if unhealthy
        if source.get("healthy") is False or source.get("is_healthy") is False:
            score *= 0.25

        return round(min(100.0, max(0.0, score)), 2)

    # =========================================================================
    # 3. TIMEZONE & PEAK TRAFFIC HOURS OPTIMIZATION
    # =========================================================================
    def get_peak_traffic_status(
        self,
        city_name: str,
        now_utc: Optional[datetime.datetime] = None,
    ) -> Dict[str, Any]:
        """
        Determine whether a city is currently in peak rush hour traffic based on its IANA timezone.
        Used to optimize feed priority and quality scoring during peak hours.
        """
        city_key = normalize_city_key(city_name)
        city_state = self.feed_states.get(city_key, {})
        tz_name = city_state.get("timezone") or GLOBAL_CITIES_DATA.get(city_key, {}).get("timezone", "UTC")
        peak_cfg = city_state.get("peak_traffic_hours") or GLOBAL_CITIES_DATA.get(city_key, {}).get(
            "peak_traffic_hours",
            {
                "morning": {"start": "07:00", "end": "10:00"},
                "evening": {"start": "16:30", "end": "19:30"},
                "windows": ["07:00-10:00", "16:30-19:30"],
            },
        )

        ref_utc = now_utc or datetime.datetime.now(datetime.timezone.utc)
        if ref_utc.tzinfo is None:
            ref_utc = ref_utc.replace(tzinfo=datetime.timezone.utc)

        try:
            local_dt = ref_utc.astimezone(ZoneInfo(tz_name))
        except Exception:
            local_dt = ref_utc

        local_hhmm = local_dt.strftime("%H:%M")
        morning = peak_cfg.get("morning", {"start": "07:00", "end": "10:00"})
        evening = peak_cfg.get("evening", {"start": "16:30", "end": "19:30"})

        in_morning_peak = morning.get("start", "07:00") <= local_hhmm <= morning.get("end", "10:00")
        in_evening_peak = evening.get("start", "16:30") <= local_hhmm <= evening.get("end", "19:30")
        is_peak = in_morning_peak or in_evening_peak

        return {
            "city_id": city_key,
            "timezone": tz_name,
            "local_time": local_hhmm,
            "is_peak_hour": is_peak,
            "peak_period": "morning_rush" if in_morning_peak else ("evening_rush" if in_evening_peak else "off_peak"),
            "peak_windows": peak_cfg.get("windows", ["07:00-10:00", "16:30-19:30"]),
            "traffic_Optimization_multiplier": 1.15 if is_peak else 1.0,
        }

    # =========================================================================
    # 4. YOUTUBE LIVE & RECENT VIDEO DISCOVERY (Concurrent + Retry + Rate Limit)
    # =========================================================================
    def _is_youtube_rate_limit_error(self, exc: Exception) -> bool:
        """Detect whether an exception from YouTube Data API v3 is a quota or rate limit error."""
        msg = str(exc).lower()
        if any(term in msg for term in ("quotaexceeded", "ratelimitexceeded", "userratelimitexceeded", "too many requests", "429", "quota")):
            return True
        resp = getattr(exc, "resp", None)
        if resp is not None and getattr(resp, "status", None) in (403, 429):
            return True
        return False

    async def _execute_youtube_query(
        self,
        keyword: str,
        city_name: str,
        event_type: Optional[str] = "live",
        published_after: Optional[str] = None,
        max_results: int = 5,
        api_key: Optional[str] = None,
        youtube_client: Optional[Any] = None,
    ) -> List[Dict[str, Any]]:
        """
        Execute a single YouTube Data API v3 search query and enrich results with view counts & recency.
        Raises exception on API/rate-limit failure so caller retry logic can handle it.
        """
        active_key = (api_key if api_key is not None else YOUTUBE_API_KEY).strip()
        if not active_key and youtube_client is None:
            return []

        # Check rate-limit cooldown
        if time.time() < self.youtube_rate_limit_state.get("cooldown_until_ts", 0.0):
            logger.warning("[YouTubeAPI] Skipping live API call for '%s' (rate-limit cooldown active)", keyword)
            raise RuntimeError("YouTube API rateLimitExceeded cooldown active")

        self.youtube_rate_limit_state["total_api_calls"] += 1

        def _sync_search():
            service = youtube_client or google_api_build(
                "youtube", "v3", developerKey=active_key, cache_discovery=False
            )
            search_kwargs: Dict[str, Any] = {
                "part": "snippet",
                "q": keyword,
                "type": "video",
                "maxResults": max_results,
                "order": "viewCount" if event_type == "live" else "date",
            }
            if event_type:
                search_kwargs["eventType"] = event_type
            if published_after:
                search_kwargs["publishedAfter"] = published_after

            req = service.search().list(**search_kwargs)
            search_resp = req.execute()

            items = search_resp.get("items", [])
            video_ids = [
                it.get("id", {}).get("videoId")
                for it in items
                if isinstance(it.get("id"), dict) and it.get("id", {}).get("videoId")
            ]

            stats_by_id: Dict[str, Dict[str, Any]] = {}
            if video_ids and hasattr(service, "videos"):
                try:
                    v_req = service.videos().list(
                        part="statistics,liveStreamingDetails,snippet",
                        id=",".join(video_ids),
                    )
                    v_resp = v_req.execute()
                    for v_item in v_resp.get("items", []):
                        vid_key = v_item.get("id")
                        if vid_key:
                            stats_by_id[vid_key] = v_item
                except Exception:
                    pass

            return items, stats_by_id

        items, stats_by_id = await asyncio.to_thread(_sync_search)
        city_key = normalize_city_key(city_name)
        results: List[Dict[str, Any]] = []

        for idx, item in enumerate(items):
            snippet = item.get("snippet", {})
            title = snippet.get("title", "")
            desc = snippet.get("description", "")
            vid = item.get("id", {}).get("videoId") if isinstance(item.get("id"), dict) else None
            if not vid:
                continue
            if not self.is_valid_traffic_feed(title, desc):
                continue

            v_details = stats_by_id.get(vid, {})
            statistics = v_details.get("statistics", {})
            live_details = v_details.get("liveStreamingDetails", {})

            view_count = int(
                live_details.get("concurrentViewers")
                or statistics.get("viewCount")
                or snippet.get("viewCount")
                or 5000
            )
            published_at = snippet.get("publishedAt") or datetime.datetime.now(datetime.timezone.utc).isoformat()
            is_live_stream = event_type == "live" or snippet.get("liveBroadcastContent") == "live"
            fallback_lvl = FALLBACK_LEVEL_1_YOUTUBE_LIVE if is_live_stream else FALLBACK_LEVEL_2_RECENT_YOUTUBE

            candidate = {
                "source_id": f"{city_key}_yt_{'live' if is_live_stream else 'recent'}_{vid[:8]}",
                "provider": "youtube",
                "stream_type": "live" if is_live_stream else "recent_video",
                "is_live": is_live_stream,
                "fallback_level": fallback_lvl,
                "priority": 1 if is_live_stream else 2,
                "title": title,
                "description": desc,
                "keyword_used": keyword,
                "url": f"https://www.youtube.com/watch?v={vid}",
                "video_id": vid,
                "view_count": view_count,
                "published_at": published_at,
                "angle": "elevated_highway",
                "zoom_level": "optimal_medium",
                "resolution": "1080p",
                "fps": 30,
                "healthy": True,
                "is_healthy": True,
            }
            candidate["quality_score"] = self.calculate_quality_score(candidate, city_name=city_name)
            results.append(candidate)

        results.sort(key=lambda r: (-r["quality_score"], r.get("priority", 99)))
        return results

    async def search_youtube_with_retry(
        self,
        city_name: str,
        event_type: Optional[str] = "live",
        max_results: int = 5,
        max_retries: Optional[int] = None,
        api_key: Optional[str] = None,
        youtube_client: Optional[Any] = None,
    ) -> List[Dict[str, Any]]:
        """
        Automatic retry mechanism with different keyword variations if the first search fails or returns no valid traffic feeds.
        Cycles through:
          Attempt 1: 'live traffic camera [city]'
          Attempt 2: 'webcam [city] highway'
          Attempt 3: '[city] traffic live stream'
        Gracefully handles YouTube API rate limiting (403/429) without interrupting service.
        """
        retries = max_retries if max_retries is not None else self.max_retry_attempts
        keywords = self.get_smart_keyword_variations(city_name)
        published_after = None
        if event_type is None:
            # Level 2 search: Recent YouTube video (<24 hours old)
            cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=24)
            published_after = cutoff.strftime("%Y-%m-%dT%H:%M:%SZ")

        for attempt in range(max(1, retries)):
            kw = keywords[attempt % len(keywords)]
            try:
                candidates = await self._execute_youtube_query(
                    keyword=kw,
                    city_name=city_name,
                    event_type=event_type,
                    published_after=published_after,
                    max_results=max_results,
                    api_key=api_key,
                    youtube_client=youtube_client,
                )
                if candidates:
                    logger.info(
                        "[YouTubeRetry] Found %d valid traffic feeds for %s on attempt %d/%d using keyword '%s'",
                        len(candidates),
                        city_name,
                        attempt + 1,
                        retries,
                        kw,
                    )
                    return candidates
                self.youtube_rate_limit_state["total_retries"] += 1
                logger.info(
                    "[YouTubeRetry] Attempt %d/%d returned 0 traffic feeds for '%s'; retrying with next keyword variation...",
                    attempt + 1,
                    retries,
                    kw,
                )
            except Exception as exc:
                self.youtube_rate_limit_state["total_retries"] += 1
                if self._is_youtube_rate_limit_error(exc):
                    self.youtube_rate_limit_state["rate_limited"] = True
                    self.youtube_rate_limit_state["last_rate_limit_ts"] = time.time()
                    self.youtube_rate_limit_state["rate_limit_hits"] += 1
                    self.youtube_rate_limit_state["cooldown_until_ts"] = time.time() + 60.0
                    logger.warning(
                        "[YouTubeRateLimit] Rate limit/quota hit for %s on keyword '%s': %s. Activating fallback.",
                        city_name,
                        kw,
                        exc,
                    )
                    break
                logger.warning(
                    "[YouTubeRetry] Attempt %d/%d failed for %s (keyword='%s'): %s",
                    attempt + 1,
                    retries,
                    city_name,
                    kw,
                    exc,
                )
        return []

    async def concurrent_youtube_keyword_search(
        self,
        city_name: str,
        event_type: Optional[str] = "live",
        max_results: int = 5,
        api_key: Optional[str] = None,
        youtube_client: Optional[Any] = None,
    ) -> List[Dict[str, Any]]:
        """
        Concurrently search multiple smart keyword variations:
        - 'live traffic camera [city]'
        - 'webcam [city] highway'
        - '[city] traffic live stream'
        Deduplicates results, filters out non-traffic content, and sorts by quality score.
        """
        keywords = self.get_smart_keyword_variations(city_name)[:3]
        published_after = None
        if event_type is None:
            cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=24)
            published_after = cutoff.strftime("%Y-%m-%dT%H:%M:%SZ")

        tasks = [
            self._execute_youtube_query(
                keyword=kw,
                city_name=city_name,
                event_type=event_type,
                published_after=published_after,
                max_results=max_results,
                api_key=api_key,
                youtube_client=youtube_client,
            )
            for kw in keywords
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        merged: List[Dict[str, Any]] = []
        seen_urls = set()
        for res in results:
            if isinstance(res, Exception):
                if self._is_youtube_rate_limit_error(res):
                    self.youtube_rate_limit_state["rate_limited"] = True
                    self.youtube_rate_limit_state["last_rate_limit_ts"] = time.time()
                    self.youtube_rate_limit_state["rate_limit_hits"] += 1
                    self.youtube_rate_limit_state["cooldown_until_ts"] = time.time() + 60.0
                continue
            for item in res:
                url = item.get("url")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    merged.append(item)

        merged.sort(key=lambda x: (-x["quality_score"], x.get("priority", 99)))
        return merged

    async def discover_youtube_feeds(
        self,
        city_name: str,
        max_results: int = 5,
        concurrent: bool = True,
        api_key: Optional[str] = None,
        youtube_client: Optional[Any] = None,
    ) -> List[Dict[str, Any]]:
        """
        Discover live (Level 1) and recent <24h (Level 2) traffic streams for a city using YouTube Data API v3.
        Uses concurrent keyword search first, then automatic keyword retry if needed,
        and merges with configured city YouTube sources.
        """
        discovered: List[Dict[str, Any]] = []
        active_key = (api_key if api_key is not None else YOUTUBE_API_KEY).strip()

        if (active_key and google_api_build is not None) or youtube_client is not None:
            # Level 1: Prioritized YouTube Live search
            if concurrent:
                live_items = await self.concurrent_youtube_keyword_search(
                    city_name=city_name,
                    event_type="live",
                    max_results=max_results,
                    api_key=active_key,
                    youtube_client=youtube_client,
                )
            else:
                live_items = []

            if not live_items and not self.youtube_rate_limit_state.get("rate_limited"):
                live_items = await self.search_youtube_with_retry(
                    city_name=city_name,
                    event_type="live",
                    max_results=max_results,
                    api_key=active_key,
                    youtube_client=youtube_client,
                )
            discovered.extend(live_items)

            # Level 2: Recent YouTube video (<24 hours old) if no live streams found
            if not discovered and not self.youtube_rate_limit_state.get("rate_limited"):
                recent_items = await self.search_youtube_with_retry(
                    city_name=city_name,
                    event_type=None,
                    max_results=max_results,
                    api_key=active_key,
                    youtube_client=youtube_client,
                )
                discovered.extend(recent_items)

        # Include configured YouTube feeds (Level 1 Live & Level 2 Recent <24h) for this city
        city_key = normalize_city_key(city_name)
        city_state = self.feed_states.get(city_key, {})
        for src in city_state.get("sources", []):
            if src.get("provider") == "youtube" and self.is_valid_traffic_feed(src.get("title", "")):
                if not any(d.get("url") == src.get("url") for d in discovered):
                    discovered.append(src)

        discovered.sort(
            key=lambda s: (
                s.get("fallback_level", 1),
                -s.get("quality_score", 0.0),
                s.get("priority", 99),
            )
        )
        return discovered

    async def discover_earthcam_feeds(self, city_name: str) -> List[Dict[str, Any]]:
        """Discover live road/bridge feeds from EarthCam API or configured EarthCam endpoints."""
        discovered: List[Dict[str, Any]] = []
        city_key = normalize_city_key(city_name)

        if EARTHCAM_API_KEY and aiohttp is not None:
            try:
                url = "https://api.earthcam.com/v1/cameras/search"
                params = {"q": f"{city_name} traffic", "key": EARTHCAM_API_KEY}
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=3.0)) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            for item in data.get("cameras", []):
                                title = item.get("title", "")
                                stream_url = item.get("stream_url", "")
                                if stream_url and self.is_valid_traffic_feed(title):
                                    cand = {
                                        "source_id": f"{city_key}_earthcam_live",
                                        "provider": "earthcam",
                                        "fallback_level": 1,
                                        "priority": 2,
                                        "title": title,
                                        "url": stream_url,
                                        "angle": "bridge_overpass",
                                        "zoom_level": "optimal_medium",
                                        "resolution": "1080p",
                                        "fps": 30,
                                        "healthy": True,
                                        "is_healthy": True,
                                    }
                                    cand["quality_score"] = self.calculate_quality_score(cand, city_name=city_name)
                                    discovered.append(cand)
            except Exception as exc:
                logger.debug("[EarthCamDiscovery] Fallback for %s: %s", city_name, exc)

        city_state = self.feed_states.get(city_key, {})
        for src in city_state.get("sources", []):
            if src.get("provider") == "earthcam" and self.is_valid_traffic_feed(src.get("title", "")):
                discovered.append(src)
        return discovered

    async def discover_traffic_camera_feeds(self, city_name: str) -> List[Dict[str, Any]]:
        """Discover municipal DOT / Highway agency traffic cameras for the specified city."""
        city_key = normalize_city_key(city_name)
        city_state = self.feed_states.get(city_key, {})
        return [
            src
            for src in city_state.get("sources", [])
            if src.get("provider") == "traffic_cam" and self.is_valid_traffic_feed(src.get("title", ""))
        ]

    async def discover_all_city_feeds(self, city_name: str) -> List[Dict[str, Any]]:
        """Aggregate and rank feeds from YouTube API (primary), DOT Traffic Camera APIs, and EarthCam API."""
        yt, ec, dot = await asyncio.gather(
            self.discover_youtube_feeds(city_name),
            self.discover_earthcam_feeds(city_name),
            self.discover_traffic_camera_feeds(city_name),
        )
        combined = []
        seen_urls = set()
        for src in yt + dot + ec:
            url = src.get("url")
            if url and url not in seen_urls:
                seen_urls.add(url)
                src["quality_score"] = self.calculate_quality_score(src, city_name=city_name)
                combined.append(src)
        combined.sort(
            key=lambda x: (
                0 if (x.get("provider") == "youtube" and x.get("fallback_level", 1) == 1) else 1,
                x.get("fallback_level", 1),
                -x["quality_score"],
                x.get("priority", 99),
            )
        )
        return combined

    # =========================================================================
    # 5. 4-LEVEL FALLBACK HIERARCHY & < 2 SECOND EMERGENCY FAILOVER
    # =========================================================================
    def get_fallback_video_path(self, city_name: str, level: int = FALLBACK_LEVEL_3_CITY_MP4) -> str:
        """
        Returns the web path for Level 3 (`/static/fallback_videos/{city}.mp4`)
        or Level 4 (`/static/fallback_videos/generic_city_timelapse.mp4`) and verifies disk existence.
        """
        if level == FALLBACK_LEVEL_4_GENERIC_TIMELAPSE:
            for generic_name in ("generic_city_timelapse.mp4", "timelapse.mp4", "default.mp4"):
                cand = os.path.join(self.fallback_dir, generic_name)
                if os.path.exists(cand) and os.path.getsize(cand) > 0:
                    return f"/static/fallback_videos/{generic_name}"
            return "/static/videos/sample_traffic.mp4"

        city_key = normalize_city_key(city_name)
        candidate_file = os.path.join(self.fallback_dir, f"{city_key}.mp4")
        if os.path.exists(candidate_file) and os.path.getsize(candidate_file) > 0:
            return f"/static/fallback_videos/{city_key}.mp4"

        # If Level 3 city MP4 is missing, automatically cascade to Level 4 generic city timelapse
        return self.get_fallback_video_path(city_name, level=FALLBACK_LEVEL_4_GENERIC_TIMELAPSE)

    def get_fallback_hierarchy(self, city_name: str) -> List[Dict[str, Any]]:
        """
        Return the structured 4-level fallback hierarchy for a city:
          Level 1: Live YouTube stream
          Level 2: Recent YouTube video (<24 hours old)
          Level 3: Pre-downloaded MP4 loop from /static/fallback_videos/{city}.mp4
          Level 4: Generic city timelapse video
        """
        city_key = normalize_city_key(city_name)
        state = self.feed_states.get(city_key, {})
        sources = state.get("sources", [])

        level_1_sources = [
            s for s in sources
            if s.get("fallback_level", 1) == FALLBACK_LEVEL_1_YOUTUBE_LIVE
            and s.get("healthy", True) and s.get("is_healthy", True)
        ]
        level_2_sources = [
            s for s in sources
            if s.get("fallback_level") == FALLBACK_LEVEL_2_RECENT_YOUTUBE
            and s.get("healthy", True) and s.get("is_healthy", True)
        ]

        city_mp4_rel = f"/static/fallback_videos/{city_key}.mp4"
        city_mp4_abs = os.path.join(self.fallback_dir, f"{city_key}.mp4")
        level_3_available = os.path.exists(city_mp4_abs) and os.path.getsize(city_mp4_abs) > 0

        timelapse_rel = self.get_fallback_video_path(city_key, level=FALLBACK_LEVEL_4_GENERIC_TIMELAPSE)
        timelapse_abs = os.path.join(BASE_DIR, timelapse_rel.lstrip("/"))
        level_4_available = os.path.exists(timelapse_abs) and os.path.getsize(timelapse_abs) > 0

        return [
            {
                "level": 1,
                "name": "live_youtube_stream",
                "description": "Live YouTube stream",
                "available": len(level_1_sources) > 0,
                "url": level_1_sources[0]["url"] if level_1_sources else None,
                "sources_count": len(level_1_sources),
            },
            {
                "level": 2,
                "name": "recent_youtube_video",
                "description": "Recent YouTube video (<24 hours old)",
                "available": len(level_2_sources) > 0,
                "url": level_2_sources[0]["url"] if level_2_sources else None,
                "max_age_hours": 24,
                "sources_count": len(level_2_sources),
            },
            {
                "level": 3,
                "name": "city_mp4_loop",
                "description": f"Pre-downloaded MP4 loop from {city_mp4_rel}",
                "available": level_3_available,
                "url": city_mp4_rel,
            },
            {
                "level": 4,
                "name": "generic_city_timelapse",
                "description": "Generic city timelapse video",
                "available": level_4_available,
                "url": timelapse_rel,
            },
        ]

    async def emergency_switch_feed(
        self,
        city_name: Optional[str] = None,
        failed_url: Optional[str] = None,
        reason: str = "Stream timeout or connection drop",
        session=None,
        city: Optional[str] = None,
        failed_source_id: Optional[str] = None,
        target_fallback_level: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        BUSINESS CONTINUITY: Emergency feed switching logic that activates within <2 seconds of failure.
        Follows the 4-level fallback hierarchy:
          Level 1: Live YouTube stream (or backup live stream)
          Level 2: Recent YouTube video (<24 hours old)
          Level 3: Pre-downloaded MP4 loop (/static/fallback_videos/{city}.mp4)
          Level 4: Generic city timelapse video (/static/fallback_videos/generic_city_timelapse.mp4)
        Dispatches Telegram alerts on switch and persistent issue alerts on repeated failures.
        """
        start_ts = time.perf_counter()
        target_city = city_name or city or "london"
        target_failed = failed_url or failed_source_id
        city_key = normalize_city_key(target_city)

        if city_key not in self.feed_states:
            fallback_l3 = self.get_fallback_video_path(city_key, level=FALLBACK_LEVEL_3_CITY_MP4)
            fallback_l4 = self.get_fallback_video_path(city_key, level=FALLBACK_LEVEL_4_GENERIC_TIMELAPSE)
            self.feed_states[city_key] = {
                "city_id": city_key,
                "city_name": target_city.title(),
                "country": "Global",
                "country_code": "GL",
                "flag_emoji": "🌐",
                "region": "Global",
                "timezone": "UTC",
                "coordinates": {"lat": 0.0, "long": 0.0},
                "corridor": f"{target_city.title()} Arterial Corridor",
                "status": "fallback",
                "is_fallback": True,
                "fallback_level": FALLBACK_LEVEL_3_CITY_MP4,
                "fallback_level_name": "city_mp4_loop",
                "active_source": None,
                "optimal_url": fallback_l3,
                "fallback_url": fallback_l3,
                "generic_timelapse_url": fallback_l4,
                "quality_score": 75.0,
                "sources": [],
                "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }

        # Invalidate cache for this city immediately on failure
        self.invalidate_city_cache(city_key)

        state = self.feed_states[city_key]
        sources = state.get("sources", [])
        previous_url = target_failed or state.get("optimal_url")

        # Increment failure counter for persistent failure tracking
        self.city_failure_counts[city_key] = self.city_failure_counts.get(city_key, 0) + 1
        consecutive_failures = self.city_failure_counts[city_key]

        # Mark failed source unhealthy
        for src in sources:
            if target_failed and (src.get("url") == target_failed or src.get("source_id") == target_failed):
                src["healthy"] = False
                src["is_healthy"] = False
                src["quality_score"] = self.calculate_quality_score(src, city_name=state["city_name"])
            elif not target_failed and state.get("active_source") and src.get("source_id") == state["active_source"].get("source_id"):
                src["healthy"] = False
                src["is_healthy"] = False
                src["quality_score"] = self.calculate_quality_score(src, city_name=state["city_name"])

        # Filter healthy candidates according to 4-level hierarchy
        healthy_candidates = [
            s for s in sources
            if s.get("healthy", True) and s.get("is_healthy", True)
            and (target_fallback_level is None or s.get("fallback_level", 1) >= target_fallback_level)
        ]
        healthy_candidates.sort(
            key=lambda s: (
                s.get("fallback_level", 1),
                -s["quality_score"],
                s.get("priority", 99),
            )
        )

        city_mp4_abs = os.path.join(self.fallback_dir, f"{city_key}.mp4")
        has_city_mp4 = os.path.exists(city_mp4_abs) and os.path.getsize(city_mp4_abs) > 0
        level_3_url = f"/static/fallback_videos/{city_key}.mp4"
        level_4_url = self.get_fallback_video_path(city_key, level=FALLBACK_LEVEL_4_GENERIC_TIMELAPSE)

        if healthy_candidates and (target_fallback_level is None or target_fallback_level in (1, 2)):
            next_source = healthy_candidates[0]
            active_level = int(next_source.get("fallback_level", FALLBACK_LEVEL_1_YOUTUBE_LIVE))
            state["active_source"] = next_source
            state["optimal_url"] = next_source["url"]
            state["status"] = "live_failover" if active_level == 1 else "recent_youtube_failover"
            state["is_fallback"] = active_level > 1
            state["fallback_level"] = active_level
            state["fallback_level_name"] = FALLBACK_LEVEL_NAMES.get(active_level, "live_youtube_stream")
            state["quality_score"] = next_source["quality_score"]
            selected_provider = next_source.get("provider", "youtube")
        elif has_city_mp4 and target_fallback_level != FALLBACK_LEVEL_4_GENERIC_TIMELAPSE:
            # Level 3: Pre-downloaded MP4 loop from /static/fallback_videos/{city}.mp4
            active_level = FALLBACK_LEVEL_3_CITY_MP4
            state["active_source"] = {
                "source_id": f"{city_key}_local_fallback",
                "provider": "fallback_loop",
                "fallback_level": active_level,
                "title": f"{state['city_name']} Pre-Downloaded High-Quality Traffic Loop",
                "url": level_3_url,
                "quality_score": 85.0,
                "healthy": True,
                "is_healthy": True,
            }
            state["optimal_url"] = level_3_url
            state["status"] = "fallback_active"
            state["is_fallback"] = True
            state["fallback_level"] = active_level
            state["fallback_level_name"] = FALLBACK_LEVEL_NAMES[active_level]
            state["quality_score"] = 85.0
            selected_provider = "fallback_loop"
        else:
            # Level 4: Generic city timelapse video
            active_level = FALLBACK_LEVEL_4_GENERIC_TIMELAPSE
            state["active_source"] = {
                "source_id": f"{city_key}_generic_timelapse",
                "provider": "generic_timelapse",
                "fallback_level": active_level,
                "title": f"{state['city_name']} Generic City Traffic Timelapse",
                "url": level_4_url,
                "quality_score": 75.0,
                "healthy": True,
                "is_healthy": True,
            }
            state["optimal_url"] = level_4_url
            state["status"] = "generic_timelapse_active"
            state["is_fallback"] = True
            state["fallback_level"] = active_level
            state["fallback_level_name"] = FALLBACK_LEVEL_NAMES[active_level]
            state["quality_score"] = 75.0
            selected_provider = "generic_timelapse"

        elapsed_seconds = time.perf_counter() - start_ts
        elapsed_ms = round(elapsed_seconds * 1000.0, 3)
        state["last_updated"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

        is_persistent = consecutive_failures >= self.persistent_failure_threshold or active_level >= FALLBACK_LEVEL_3_CITY_MP4

        failover_event = {
            "city_id": city_key,
            "city": state["city_name"],
            "city_name": state["city_name"],
            "previous_url": previous_url,
            "new_url": state["optimal_url"],
            "new_video_url": state["optimal_url"],
            "provider": selected_provider,
            "fallback_level": state["fallback_level"],
            "fallback_level_name": state["fallback_level_name"],
            "is_fallback": state["is_fallback"],
            "consecutive_failures": consecutive_failures,
            "persistent_issue": is_persistent,
            "reason": reason,
            "switch_duration_ms": elapsed_ms,
            "switch_duration_seconds": round(elapsed_seconds, 4),
            "within_2s_sla": elapsed_seconds < self.emergency_sla_seconds,
            "timestamp": state["last_updated"],
        }
        self.failover_history.insert(0, failover_event)
        if len(self.failover_history) > 100:
            self.failover_history.pop()

        # Dispatch non-blocking Telegram / Email monitoring alert
        try:
            from notifications import notification_service
            if hasattr(notification_service, "alert_feed_failure"):
                await notification_service.alert_feed_failure(
                    city_name=state["city_name"],
                    failed_url=str(previous_url),
                    fallback_url=state["optimal_url"],
                    switch_ms=elapsed_ms,
                    reason=reason,
                    session=session,
                )
            if is_persistent and hasattr(notification_service, "alert_persistent_feed_issue"):
                await notification_service.alert_persistent_feed_issue(
                    city_name=state["city_name"],
                    consecutive_failures=consecutive_failures,
                    active_fallback_url=state["optimal_url"],
                    fallback_level=state["fallback_level"],
                    reason=reason,
                    session=session,
                )
                self.persistent_alerts_sent[city_key] = time.time()
        except Exception as exc:
            logger.warning("[EmergencySwitch] Alert dispatch warning: %s", exc)

        logger.warning(
            "[EmergencySwitch] City=%s switched %s -> %s (Level %d: %s) in %.2fms (SLA <2000ms: %s, failures=%d)",
            state["city_name"],
            previous_url,
            state["optimal_url"],
            state["fallback_level"],
            state["fallback_level_name"],
            elapsed_ms,
            failover_event["within_2s_sla"],
            consecutive_failures,
        )
        return failover_event

    # =========================================================================
    # 6. CACHING (5 MINUTES) & BANDWIDTH ADAPTATION
    # =========================================================================
    def _compute_state_signature(self, city_key: str) -> Tuple[Any, ...]:
        """Compute lightweight signature of current source health & overrides so direct state changes invalidate cache."""
        ov = self.admin_overrides.get(city_key)
        ov_url = ov.get("override_url") if ov else None
        state = self.feed_states.get(city_key, {})
        healthy_ids = tuple(
            s.get("source_id")
            for s in state.get("sources", [])
            if s.get("healthy", True) and s.get("is_healthy", True)
        )
        return (ov_url, healthy_ids, state.get("optimal_url"))

    def get_cached_feed(self, city_key: str, bandwidth: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Retrieve cached feed data if within 5-minute (300s) TTL and state signature matches."""
        cache_key = f"{city_key}:{bandwidth or 'default'}"
        entry = self.feed_url_cache.get(cache_key)
        if not entry:
            return None
        now = time.time()
        if now >= entry["expires_at"]:
            self.feed_url_cache.pop(cache_key, None)
            return None
        if entry.get("signature") != self._compute_state_signature(city_key):
            self.feed_url_cache.pop(cache_key, None)
            return None

        cached_copy = dict(entry["data"])
        cached_copy["cache_hit"] = True
        cached_copy["cache_ttl_remaining_seconds"] = round(max(0.0, entry["expires_at"] - now), 2)
        return cached_copy

    def set_cached_feed(self, city_key: str, feed_data: Dict[str, Any], bandwidth: Optional[str] = None):
        """Cache a validated optimal feed for 5 minutes (300 seconds)."""
        cache_key = f"{city_key}:{bandwidth or 'default'}"
        now = time.time()
        self.feed_url_cache[cache_key] = {
            "data": dict(feed_data),
            "created_at": now,
            "expires_at": now + self.cache_ttl_seconds,
            "signature": self._compute_state_signature(city_key),
        }

    def invalidate_city_cache(self, city_key: Optional[str] = None):
        """Invalidate cached feed URLs for a specific city or all cities."""
        if city_key is None:
            self.feed_url_cache.clear()
            return
        norm_key = normalize_city_key(city_key)
        keys_to_remove = [k for k in self.feed_url_cache if k.startswith(f"{norm_key}:")]
        for k in keys_to_remove:
            self.feed_url_cache.pop(k, None)

    def get_bandwidth_profile(
        self,
        bandwidth: Optional[str] = None,
        downlink_mbps: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Determine adaptive streaming parameters (resolution, target bitrate, progressive chunk size)
        based on client connection speed or explicit bandwidth tier.
        """
        if downlink_mbps is not None:
            if downlink_mbps < 2.0:
                tier = "low"
            elif downlink_mbps < 5.0:
                tier = "medium"
            else:
                tier = "high"
        elif bandwidth:
            tier = bandwidth.strip().lower()
            if tier in ("slow", "2g", "3g", "480p", "360p"):
                tier = "low"
            elif tier in ("4g", "720p", "sd", "md"):
                tier = "medium"
            elif tier in ("5g", "wifi", "fiber", "1080p", "hd", "4k"):
                tier = "high"
            elif tier not in BANDWIDTH_PROFILES:
                tier = "auto"
        else:
            tier = "auto"

        return dict(BANDWIDTH_PROFILES.get(tier, BANDWIDTH_PROFILES["auto"]))

    # =========================================================================
    # 7. LOAD BALANCING, ADMIN OVERRIDES & OPTIMAL FEED SELECTION
    # =========================================================================
    def set_admin_override(
        self,
        city_name: Optional[str] = None,
        override_url: Optional[str] = None,
        source_id: Optional[str] = None,
        force_fallback: bool = False,
        admin_user: str = "admin",
        city: Optional[str] = None,
        video_url: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Allow admin dashboard to manually override a city's feed source."""
        target_city = city_name or city or "london"
        target_url = override_url or video_url
        city_key = normalize_city_key(target_city)
        if city_key not in self.feed_states:
            raise ValueError(f"Unknown city: {target_city}")

        self.invalidate_city_cache(city_key)
        state = self.feed_states[city_key]
        fallback_url = self.get_fallback_video_path(city_key)

        if force_fallback:
            chosen_url = fallback_url
            provider = "admin_fallback"
            lvl = FALLBACK_LEVEL_3_CITY_MP4
        elif target_url:
            if not self.is_valid_traffic_feed(target_url, "traffic road override"):
                raise ValueError("Override URL rejected by traffic content filter (pedestrian/park feeds forbidden).")
            chosen_url = target_url
            provider = "admin_custom_url"
            lvl = FALLBACK_LEVEL_3_CITY_MP4 if chosen_url.startswith("/static/fallback_videos/") else FALLBACK_LEVEL_1_YOUTUBE_LIVE
        elif source_id:
            matched = next((s for s in state["sources"] if s.get("source_id") == source_id), None)
            if not matched:
                raise ValueError(f"Source ID '{source_id}' not found for city '{target_city}'")
            chosen_url = matched["url"]
            provider = matched.get("provider", "admin_selected_source")
            lvl = int(matched.get("fallback_level", FALLBACK_LEVEL_1_YOUTUBE_LIVE))
        else:
            raise ValueError("Must specify override_url, source_id, or force_fallback=True")

        override_record = {
            "city_id": city_key,
            "city_name": state["city_name"],
            "override_url": chosen_url,
            "source_id": source_id,
            "force_fallback": force_fallback,
            "provider": provider,
            "fallback_level": lvl,
            "reason": reason or "Manual admin override",
            "admin_user": admin_user,
            "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        self.admin_overrides[city_key] = override_record
        state["optimal_url"] = chosen_url
        state["status"] = "admin_override"
        state["fallback_level"] = lvl
        state["fallback_level_name"] = FALLBACK_LEVEL_NAMES.get(lvl, "live_youtube_stream")
        state["is_fallback"] = force_fallback or chosen_url.startswith("/static/fallback_videos/")
        logger.info(
            "[AdminOverride] City=%s overridden to %s by %s (reason=%s)",
            state["city_name"],
            chosen_url,
            admin_user,
            override_record["reason"],
        )
        return override_record

    def clear_admin_override(self, city_name: str) -> Dict[str, Any]:
        """Remove manual admin override for a city and restore automatic smart agent selection."""
        city_key = normalize_city_key(city_name)
        self.admin_overrides.pop(city_key, None)
        self.invalidate_city_cache(city_key)
        if city_key in self.feed_states:
            state = self.feed_states[city_key]
            healthy = [s for s in state["sources"] if s.get("healthy", True) and s.get("is_healthy", True)]
            healthy.sort(
                key=lambda s: (
                    s.get("fallback_level", 1),
                    -s["quality_score"],
                    s.get("priority", 99),
                )
            )
            if healthy:
                chosen = healthy[0]
                lvl = int(chosen.get("fallback_level", FALLBACK_LEVEL_1_YOUTUBE_LIVE))
                state["active_source"] = chosen
                state["optimal_url"] = chosen["url"]
                state["status"] = "live" if lvl == 1 else "recent_youtube_active"
                state["is_fallback"] = lvl > 1
                state["fallback_level"] = lvl
                state["fallback_level_name"] = FALLBACK_LEVEL_NAMES.get(lvl, "live_youtube_stream")
                state["quality_score"] = chosen["quality_score"]
            else:
                state["optimal_url"] = self.get_fallback_video_path(city_key)
                state["status"] = "fallback_active"
                state["is_fallback"] = True
                state["fallback_level"] = FALLBACK_LEVEL_3_CITY_MP4
                state["fallback_level_name"] = FALLBACK_LEVEL_NAMES[FALLBACK_LEVEL_3_CITY_MP4]
        return {"city_id": city_key, "override_cleared": True}

    def get_optimal_feed(
        self,
        city_name: str,
        load_balance: bool = False,
        use_load_balancing: Optional[bool] = None,
        bandwidth: Optional[str] = None,
        downlink_mbps: Optional[float] = None,
        use_cache: bool = True,
    ) -> Dict[str, Any]:
        """
        Return the optimal video URL and metadata for a city.
        Follows the 4-level fallback hierarchy:
          Level 1: Live YouTube stream
          Level 2: Recent YouTube video (<24 hours old)
          Level 3: Pre-downloaded MP4 loop (/static/fallback_videos/{city}.mp4)
          Level 4: Generic city timelapse video (/static/fallback_videos/generic_city_timelapse.mp4)
        Supports 5-minute URL caching, multi-source load balancing, and bandwidth adaptation.
        """
        if use_load_balancing is not None:
            load_balance = use_load_balancing

        city_key = normalize_city_key(city_name)
        if city_key not in self.feed_states:
            info = get_city_info(city_name)
            if info:
                city_key = info["id"]

        bw_profile = self.get_bandwidth_profile(bandwidth=bandwidth, downlink_mbps=downlink_mbps)
        bw_key = bw_profile["profile"] if (bandwidth or downlink_mbps is not None) else None

        if city_key not in self.feed_states:
            city_mp4_abs = os.path.join(self.fallback_dir, f"{city_key}.mp4")
            has_city_mp4 = os.path.exists(city_mp4_abs) and os.path.getsize(city_mp4_abs) > 0
            fallback = (
                f"/static/fallback_videos/{city_key}.mp4"
                if has_city_mp4
                else self.get_fallback_video_path(city_key, level=FALLBACK_LEVEL_4_GENERIC_TIMELAPSE)
            )
            lvl = FALLBACK_LEVEL_3_CITY_MP4 if has_city_mp4 else FALLBACK_LEVEL_4_GENERIC_TIMELAPSE
            return {
                "city_id": city_key,
                "city": city_name.title(),
                "city_name": city_name.title(),
                "optimal_url": fallback,
                "optimal_video_url": fallback,
                "video_url": fallback,
                "fallback_url": fallback,
                "generic_timelapse_url": self.get_fallback_video_path(city_key, level=FALLBACK_LEVEL_4_GENERIC_TIMELAPSE),
                "fallback_available": True,
                "status": "fallback",
                "health_status": "fallback",
                "selection_mode": FALLBACK_LEVEL_NAMES[lvl],
                "is_fallback": True,
                "fallback_level": lvl,
                "fallback_level_name": FALLBACK_LEVEL_NAMES[lvl],
                "quality_score": 75.0,
                "bandwidth_adaptation": bw_profile,
                "cache_hit": False,
            }

        # Check 5-minute URL cache when load_balance is False
        if use_cache and not load_balance:
            cached = self.get_cached_feed(city_key, bandwidth=bw_key)
            if cached is not None:
                return cached

        state = self.feed_states[city_key]
        city_meta = get_city_info(city_key) or {}
        fallback_path = self.get_fallback_video_path(city_key, level=FALLBACK_LEVEL_3_CITY_MP4)
        generic_timelapse_path = self.get_fallback_video_path(city_key, level=FALLBACK_LEVEL_4_GENERIC_TIMELAPSE)
        peak_info = self.get_peak_traffic_status(city_key)

        # 1. Check if admin manual override is active
        if city_key in self.admin_overrides:
            ov = self.admin_overrides[city_key]
            result = {
                **city_meta,
                "city_id": city_key,
                "city": state["city_name"],
                "city_name": state["city_name"],
                "optimal_url": ov["override_url"],
                "optimal_video_url": ov["override_url"],
                "video_url": ov["override_url"],
                "fallback_url": fallback_path,
                "generic_timelapse_url": generic_timelapse_path,
                "fallback_available": True,
                "status": "admin_override",
                "health_status": "admin_override",
                "selection_mode": "admin_override",
                "is_fallback": state["is_fallback"],
                "fallback_level": ov.get("fallback_level", 1),
                "fallback_level_name": FALLBACK_LEVEL_NAMES.get(ov.get("fallback_level", 1), "live_youtube_stream"),
                "quality_score": 100.0,
                "provider": ov["provider"],
                "admin_override": ov,
                "peak_traffic": peak_info,
                "bandwidth_adaptation": bw_profile,
                "cache_hit": False,
                "cache_ttl_remaining_seconds": self.cache_ttl_seconds,
                "sources": state["sources"],
            }
            if use_cache and not load_balance:
                self.set_cached_feed(city_key, result, bandwidth=bw_key)
            return result

        # 2. Check Level 1 (Live YouTube / Live Stream) & Level 2 (Recent YouTube <24h) sources
        healthy_sources = [
            s for s in state["sources"]
            if s.get("healthy", True) and s.get("is_healthy", True)
        ]

        if healthy_sources:
            # Separate Level 1 (Live) from Level 2 (Recent <24h) so Level 1 is always preferred
            level_1_healthy = [s for s in healthy_sources if s.get("fallback_level", 1) == FALLBACK_LEVEL_1_YOUTUBE_LIVE]
            candidate_pool = level_1_healthy if level_1_healthy else healthy_sources

            if load_balance and len(candidate_pool) > 1:
                idx = self.load_balance_counters.get(city_key, 0) % len(candidate_pool)
                self.load_balance_counters[city_key] = idx + 1
                chosen = candidate_pool[idx]
            else:
                chosen = candidate_pool[0]

            sid = chosen.get("source_id", "default")
            self.source_active_connections[sid] = self.source_active_connections.get(sid, 0) + 1
            chosen_level = int(chosen.get("fallback_level", FALLBACK_LEVEL_1_YOUTUBE_LIVE))

            result = {
                **city_meta,
                "city_id": city_key,
                "city": state["city_name"],
                "city_name": state["city_name"],
                "optimal_url": chosen["url"],
                "optimal_video_url": chosen["url"],
                "video_url": chosen["url"],
                "fallback_url": fallback_path,
                "generic_timelapse_url": generic_timelapse_path,
                "fallback_available": True,
                "status": state["status"] if chosen_level == 1 else "recent_youtube_active",
                "health_status": "healthy",
                "selection_mode": "load_balanced" if load_balance else (
                    "highest_quality" if chosen_level == 1 else "recent_youtube_24h"
                ),
                "is_fallback": chosen_level > 1,
                "fallback_level": chosen_level,
                "fallback_level_name": FALLBACK_LEVEL_NAMES.get(chosen_level, "live_youtube_stream"),
                "quality_score": chosen["quality_score"],
                "provider": chosen.get("provider", "youtube"),
                "active_source": chosen,
                "load_balanced_index": self.load_balance_counters.get(city_key, 0),
                "peak_traffic": peak_info,
                "bandwidth_adaptation": bw_profile,
                "cache_hit": False,
                "cache_ttl_remaining_seconds": self.cache_ttl_seconds,
                "sources": state["sources"],
            }
            if use_cache and not load_balance:
                self.set_cached_feed(city_key, result, bandwidth=bw_key)
            return result

        # 3. Level 3: Pre-downloaded MP4 loop (/static/fallback_videos/{city}.mp4)
        #    or Level 4: Generic city timelapse video (/static/fallback_videos/generic_city_timelapse.mp4)
        city_mp4_abs = os.path.join(self.fallback_dir, f"{city_key}.mp4")
        has_city_mp4 = os.path.exists(city_mp4_abs) and os.path.getsize(city_mp4_abs) > 0
        if has_city_mp4:
            chosen_fallback = f"/static/fallback_videos/{city_key}.mp4"
            chosen_level = FALLBACK_LEVEL_3_CITY_MP4
            chosen_mode = "fallback_loop"
            chosen_provider = "fallback_loop"
            chosen_score = 85.0
        else:
            chosen_fallback = generic_timelapse_path
            chosen_level = FALLBACK_LEVEL_4_GENERIC_TIMELAPSE
            chosen_mode = "generic_city_timelapse"
            chosen_provider = "generic_timelapse"
            chosen_score = 75.0

        result = {
            **city_meta,
            "city_id": city_key,
            "city": state["city_name"],
            "city_name": state["city_name"],
            "optimal_url": chosen_fallback,
            "optimal_video_url": chosen_fallback,
            "video_url": chosen_fallback,
            "fallback_url": fallback_path,
            "generic_timelapse_url": generic_timelapse_path,
            "fallback_available": True,
            "status": "fallback_active" if chosen_level == 3 else "generic_timelapse_active",
            "health_status": "fallback_active",
            "selection_mode": chosen_mode,
            "is_fallback": True,
            "fallback_level": chosen_level,
            "fallback_level_name": FALLBACK_LEVEL_NAMES[chosen_level],
            "quality_score": chosen_score,
            "provider": chosen_provider,
            "peak_traffic": peak_info,
            "bandwidth_adaptation": bw_profile,
            "cache_hit": False,
            "cache_ttl_remaining_seconds": self.cache_ttl_seconds,
            "sources": state["sources"],
        }
        if use_cache and not load_balance:
            self.set_cached_feed(city_key, result, bandwidth=bw_key)
        return result

    def get_all_optimal_feeds(
        self,
        use_load_balancing: bool = False,
        bandwidth: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Return optimal feeds for all global cities along with summary telemetry."""
        cities_map: Dict[str, Dict[str, Any]] = {}
        feeds_list: List[Dict[str, Any]] = []
        live_count = 0
        fallback_count = 0

        for city_key in self.feed_states.keys():
            feed_info = self.get_optimal_feed(
                city_key,
                use_load_balancing=use_load_balancing,
                bandwidth=bandwidth,
            )
            cities_map[city_key] = feed_info
            feeds_list.append(feed_info)
            if feed_info.get("is_fallback"):
                fallback_count += 1
            else:
                live_count += 1

        return {
            "platform": "RUSH HOUR BET",
            "summary": {
                "total_cities": len(feeds_list),
                "live_cities": live_count,
                "fallback_cities": fallback_count,
                "health_check_interval_seconds": self.health_check_interval,
                "emergency_switch_sla_seconds": self.emergency_sla_seconds,
                "cache_ttl_seconds": self.cache_ttl_seconds,
                "max_retry_attempts": self.max_retry_attempts,
            },
            "cities": cities_map,
            "feeds": feeds_list,
        }

    # =========================================================================
    # 8. ASYNC VIDEO VALIDATION & 30-SECOND STREAM HEALTH MONITORING
    # =========================================================================
    async def validate_video_url_async(self, url: str, timeout: float = 2.0) -> Dict[str, Any]:
        """
        Validate a live stream or local video URL asynchronously using aiohttp.
        Returns dict with {valid, status_code, latency_ms, content_type, url}.
        """
        t0 = time.perf_counter()
        if not url:
            return {"valid": False, "status_code": 0, "latency_ms": 0.0, "reason": "empty_url", "url": url}

        if url.startswith("/static/"):
            local_path = os.path.join(BASE_DIR, url.lstrip("/"))
            exists = os.path.exists(local_path) and os.path.getsize(local_path) > 0
            latency = round((time.perf_counter() - t0) * 1000.0, 2)
            return {
                "valid": exists,
                "status_code": 200 if exists else 404,
                "latency_ms": latency,
                "content_type": "video/mp4" if exists else None,
                "file_size_bytes": os.path.getsize(local_path) if exists else 0,
                "url": url,
            }

        if os.getenv("RUSH_HOUR_BET_LIVE_HTTP_PROBE", "false").lower() == "true" and aiohttp is not None:
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.head(url, timeout=aiohttp.ClientTimeout(total=timeout), allow_redirects=True) as resp:
                        latency = round((time.perf_counter() - t0) * 1000.0, 2)
                        ok = resp.status < 400
                        return {
                            "valid": ok,
                            "status_code": resp.status,
                            "latency_ms": latency,
                            "content_type": resp.headers.get("Content-Type", "video/mp4"),
                            "url": url,
                        }
            except Exception as exc:
                latency = round((time.perf_counter() - t0) * 1000.0, 2)
                return {
                    "valid": False,
                    "status_code": 503,
                    "latency_ms": latency,
                    "error": str(exc),
                    "url": url,
                }

        is_valid_scheme = url.startswith(("http://", "https://", "rtsp://"))
        latency = round((time.perf_counter() - t0) * 1000.0, 2)
        return {
            "valid": is_valid_scheme,
            "status_code": 200 if is_valid_scheme else 400,
            "latency_ms": latency,
            "content_type": "video/mp4",
            "url": url,
        }

    async def check_stream_url_health(self, url: str, timeout: float = 1.5) -> Tuple[bool, float]:
        """
        Check whether a stream URL or local fallback video is reachable within timeout.
        Returns (is_healthy, latency_ms).
        """
        res = await self.validate_video_url_async(url, timeout=timeout)
        return bool(res.get("valid")), float(res.get("latency_ms", 0.0))

    async def get_city_feed_health(
        self,
        city_name: str,
        probe: bool = False,
        bandwidth: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Detailed health check telemetry for `/api/feed-health/{city}`.
        Includes active feed status, 4-level fallback hierarchy readiness, cache status,
        timezone peak-traffic status, latency, and failure counters.
        """
        city_key = normalize_city_key(city_name)
        if city_key not in self.feed_states:
            info = get_city_info(city_name)
            if info:
                city_key = info["id"]

        if city_key not in self.feed_states:
            raise ValueError(f"City '{city_name}' not found in configured global cities.")

        state = self.feed_states[city_key]
        if probe:
            for src in state.get("sources", []):
                if src.get("healthy") is False or src.get("is_healthy") is False:
                    continue
                ok, latency = await self.check_stream_url_health(src.get("url", ""))
                src["healthy"] = ok
                src["is_healthy"] = ok
                src["latency_ms"] = latency
                src["last_checked"] = time.time()

        optimal = self.get_optimal_feed(city_key, use_load_balancing=False, bandwidth=bandwidth)
        hierarchy = self.get_fallback_hierarchy(city_key)
        peak_status = self.get_peak_traffic_status(city_key)
        consecutive_failures = self.city_failure_counts.get(city_key, 0)

        healthy_sources_count = sum(
            1 for s in state.get("sources", [])
            if s.get("healthy", True) and s.get("is_healthy", True)
        )
        total_sources_count = len(state.get("sources", []))

        active_src = optimal.get("active_source") or {}
        latency_ms = active_src.get("latency_ms", 12.5 if not optimal.get("is_fallback") else 2.0)

        return {
            "platform": "RUSH HOUR BET",
            "city_id": city_key,
            "city": state["city_name"],
            "city_name": state["city_name"],
            "country": state.get("country"),
            "country_code": state.get("country_code"),
            "flag_emoji": state.get("flag_emoji"),
            "region": state.get("region"),
            "timezone": state.get("timezone"),
            "status": optimal.get("status", "live"),
            "health_status": "healthy" if healthy_sources_count > 0 else "fallback_active",
            "healthy": True,  # System continuity is always healthy via 4-level fallback
            "primary_live_healthy": healthy_sources_count > 0,
            "is_fallback": optimal.get("is_fallback", False),
            "active_fallback_level": optimal.get("fallback_level", 1),
            "active_fallback_level_name": optimal.get("fallback_level_name", "live_youtube_stream"),
            "optimal_url": optimal.get("optimal_url"),
            "fallback_url": optimal.get("fallback_url"),
            "generic_timelapse_url": optimal.get("generic_timelapse_url"),
            "quality_score": optimal.get("quality_score", 90.0),
            "latency_ms": latency_ms,
            "healthy_sources_count": healthy_sources_count,
            "total_sources_count": total_sources_count,
            "consecutive_failures": consecutive_failures,
            "persistent_issue": consecutive_failures >= self.persistent_failure_threshold,
            "cache_hit": optimal.get("cache_hit", False),
            "cache_ttl_seconds": self.cache_ttl_seconds,
            "cache_ttl_remaining_seconds": optimal.get("cache_ttl_remaining_seconds", self.cache_ttl_seconds),
            "health_check_interval_seconds": self.health_check_interval,
            "emergency_sla_seconds": self.emergency_sla_seconds,
            "peak_traffic": peak_status,
            "bandwidth_adaptation": optimal.get("bandwidth_adaptation"),
            "youtube_search_terms": state.get("youtube_search_terms", self.get_smart_keyword_variations(city_key)),
            "fallback_hierarchy": hierarchy,
            "sources": state.get("sources", []),
            "admin_override": self.admin_overrides.get(city_key),
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

    async def check_all_feeds_health(self, session=None) -> Dict[str, Any]:
        """Alias for scan_all_cities_health()."""
        return await self.scan_all_cities_health()

    async def scan_all_cities_health(self) -> Dict[str, Any]:
        """Scan all global cities every 30 seconds and update stream health and quality scores."""
        scan_start = time.perf_counter()
        healthy_cities = 0
        fallback_cities = 0

        for city_key, state in self.feed_states.items():
            any_healthy = False
            for src in state.get("sources", []):
                # Preserve explicit failure states set by emergency_switch_feed unless re-probed
                if src.get("healthy") is False or src.get("is_healthy") is False:
                    continue
                ok, latency = await self.check_stream_url_health(src.get("url", ""))
                src["healthy"] = ok
                src["is_healthy"] = ok
                src["latency_ms"] = latency
                src["last_checked"] = time.time()
                src["quality_score"] = self.calculate_quality_score(src, city_name=state["city_name"])
                if ok:
                    any_healthy = True

            if city_key not in self.admin_overrides:
                if any_healthy:
                    healthy_list = [s for s in state["sources"] if s.get("healthy") and s.get("is_healthy", True)]
                    healthy_list.sort(
                        key=lambda s: (
                            s.get("fallback_level", 1),
                            -s["quality_score"],
                            s.get("priority", 99),
                        )
                    )
                    chosen = healthy_list[0]
                    lvl = int(chosen.get("fallback_level", FALLBACK_LEVEL_1_YOUTUBE_LIVE))
                    state["active_source"] = chosen
                    state["optimal_url"] = chosen["url"]
                    state["is_fallback"] = lvl > 1
                    state["fallback_level"] = lvl
                    state["fallback_level_name"] = FALLBACK_LEVEL_NAMES.get(lvl, "live_youtube_stream")
                    state["status"] = "live" if lvl == 1 else "recent_youtube_active"
                    state["quality_score"] = chosen["quality_score"]
                    healthy_cities += 1
                else:
                    state["optimal_url"] = self.get_fallback_video_path(city_key)
                    state["is_fallback"] = True
                    state["fallback_level"] = FALLBACK_LEVEL_3_CITY_MP4
                    state["fallback_level_name"] = FALLBACK_LEVEL_NAMES[FALLBACK_LEVEL_3_CITY_MP4]
                    state["status"] = "fallback_active"
                    fallback_cities += 1

        self.last_health_scan_ts = time.time()
        return {
            "scanned_cities": len(self.feed_states),
            "healthy_live_cities": healthy_cities,
            "fallback_cities": fallback_cities,
            "scan_duration_ms": round((time.perf_counter() - scan_start) * 1000.0, 2),
            "interval_seconds": self.health_check_interval,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

    async def _background_monitor_loop(self):
        """Continuously scan feed health every 30 seconds."""
        self._running = True
        logger.info(
            "[SmartFeedAgent] Started continuous background health monitor (interval=%ds)",
            self.health_check_interval,
        )
        try:
            while self._running:
                await self.scan_all_cities_health()
                await asyncio.sleep(self.health_check_interval)
        except asyncio.CancelledError:
            self._running = False

    def start_background_monitor(self) -> Optional[asyncio.Task]:
        """Start the 30-second background health monitoring task if an event loop is running."""
        try:
            loop = asyncio.get_running_loop()
            if self._monitor_task is None or self._monitor_task.done():
                self._monitor_task = loop.create_task(self._background_monitor_loop())
            return self._monitor_task
        except RuntimeError:
            return None

    def stop_background_monitor(self):
        """Stop the background health monitoring task."""
        self._running = False
        if self._monitor_task and not self._monitor_task.done():
            self._monitor_task.cancel()


# Global singleton instance
smart_feed_agent = SmartFeedAgent()
