"""
test_youtube_fallback_system.py - Comprehensive Test Suite for RUSH HOUR BET
YouTube API Optimization, 4-Level Fallback System, Health Monitoring, Caching,
Progressive Streaming, Bandwidth Adaptation, and 100+ Concurrent Users Load Testing.
"""

import os
import time
import json
import asyncio
import datetime
import unittest
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient

from main import app
from notifications import notification_service
from services.smart_feed_agent import (
    SmartFeedAgent,
    smart_feed_agent,
    FALLBACK_LEVEL_1_YOUTUBE_LIVE,
    FALLBACK_LEVEL_2_RECENT_YOUTUBE,
    FALLBACK_LEVEL_3_CITY_MP4,
    FALLBACK_LEVEL_4_GENERIC_TIMELAPSE,
)


REQUIRED_19_CITIES = [
    "London",
    "Paris",
    "Berlin",
    "Rome",
    "Amsterdam",
    "Madrid",
    "Vienna",
    "Prague",
    "Zurich",
    "Tokyo",
    "Shanghai",
    "Beijing",
    "New York",
    "Los Angeles",
    "Casablanca",
    "Lagos",
    "Cairo",
    "Sydney",
    "Melbourne",
]


class MockYouTubeService:
    """Mock google-api-python-client YouTube service for testing retry, rate-limiting, and concurrent search."""

    def __init__(self, fail_first_n: int = 0, raise_rate_limit: bool = False):
        self.fail_first_n = fail_first_n
        self.raise_rate_limit = raise_rate_limit
        self.calls = []

    def search(self):
        parent = self

        class _SearchResource:
            def list(self, **kwargs):
                parent.calls.append(kwargs)

                class _Req:
                    def execute(_self):
                        call_idx = len(parent.calls)
                        if parent.raise_rate_limit:
                            raise RuntimeError("HttpError 429: quotaExceeded / rateLimitExceeded")
                        if call_idx <= parent.fail_first_n:
                            # Simulate empty/failed first search to trigger keyword retry
                            return {"items": []}
                        q = kwargs.get("q", "London")
                        return {
                            "items": [
                                {
                                    "id": {"videoId": f"yt_live_{call_idx:03d}"},
                                    "snippet": {
                                        "title": f"{q.title()} - Highway Overpass Live Traffic Stream",
                                        "description": "Real-time multi-lane highway traffic camera",
                                        "publishedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                                        "liveBroadcastContent": "live",
                                    },
                                },
                                {
                                    "id": {"videoId": f"yt_ped_{call_idx:03d}"},
                                    "snippet": {
                                        "title": "Central Park Pedestrian Walking Tour & Dog Park",
                                        "description": "Pedestrian only park walkway",
                                        "publishedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                                        "liveBroadcastContent": "live",
                                    },
                                },
                            ]
                        }

                return _Req()

        return _SearchResource()

    def videos(self):
        class _VideosResource:
            def list(self, **kwargs):
                vid_ids = kwargs.get("id", "").split(",")

                class _Req:
                    def execute(_self):
                        return {
                            "items": [
                                {
                                    "id": vid,
                                    "statistics": {"viewCount": "45000"},
                                    "liveStreamingDetails": {"concurrentViewers": "1850"},
                                }
                                for vid in vid_ids
                                if vid
                            ]
                        }

                return _Req()

        return _VideosResource()


class TestYouTubeFallbackSystem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.base_dir = os.path.dirname(os.path.abspath(__file__))

    def setUp(self):
        # Reset agent state before each test for clean isolation
        smart_feed_agent._initialize_states()
        smart_feed_agent.invalidate_city_cache()
        smart_feed_agent.admin_overrides.clear()
        smart_feed_agent.youtube_rate_limit_state["rate_limited"] = False
        smart_feed_agent.youtube_rate_limit_state["cooldown_until_ts"] = 0.0

    # =========================================================================
    # 1. YOUTUBE API OPTIMIZATION TESTS
    # =========================================================================
    def test_01_smart_keyword_variations_and_content_filtering(self):
        keywords = smart_feed_agent.get_smart_keyword_variations("London")
        self.assertGreaterEqual(len(keywords), 3)
        self.assertEqual(keywords[0], "live traffic camera London")
        self.assertEqual(keywords[1], "webcam London highway")
        self.assertEqual(keywords[2], "London traffic live stream")

        # Valid traffic content passes
        self.assertTrue(smart_feed_agent.is_valid_traffic_feed("live traffic camera London M25 highway"))
        self.assertTrue(smart_feed_agent.is_valid_traffic_feed("webcam Paris highway Boulevard Peripherique"))
        # Non-traffic content (pedestrians, parks, zoos, beaches) excluded
        self.assertFalse(smart_feed_agent.is_valid_traffic_feed("Hyde Park pedestrian walkway & bird feeder live"))
        self.assertFalse(smart_feed_agent.is_valid_traffic_feed("Santa Monica beach boardwalk & skatepark cam"))
        self.assertFalse(smart_feed_agent.is_valid_traffic_feed("Indoor hotel lobby & cafe interior stream"))

    def test_02_youtube_quality_scoring_view_count_upload_time_relevance(self):
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        old_iso = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=10)).isoformat()

        live_high_views = {
            "title": "London Highway Live Traffic Camera Webcam Stream",
            "description": "Multi-lane highway intersection traffic",
            "view_count": 85000,
            "published_at": now_iso,
            "is_live": True,
        }
        old_low_views = {
            "title": "City Street Road",
            "description": "Road clip",
            "view_count": 25,
            "published_at": old_iso,
            "is_live": False,
        }

        score_high = smart_feed_agent.calculate_youtube_quality_score(live_high_views, city_name="London")
        score_low = smart_feed_agent.calculate_youtube_quality_score(old_low_views, city_name="London")

        self.assertGreater(score_high, 80.0)
        self.assertLess(score_low, 45.0)
        self.assertGreater(score_high, score_low)

    def test_03_automatic_keyword_retry_and_concurrent_search(self):
        # Simulate first 2 keyword searches returning empty so 3rd variation ('London traffic live stream') succeeds
        mock_yt = MockYouTubeService(fail_first_n=2)
        results = asyncio.run(
            smart_feed_agent.search_youtube_with_retry(
                city_name="London",
                max_retries=3,
                youtube_client=mock_yt,
            )
        )
        self.assertEqual(len(mock_yt.calls), 3)
        self.assertEqual(mock_yt.calls[0]["q"], "live traffic camera London")
        self.assertEqual(mock_yt.calls[1]["q"], "webcam London highway")
        self.assertEqual(mock_yt.calls[2]["q"], "London traffic live stream")
        # Pedestrian item must be filtered out automatically, leaving only the valid traffic stream
        self.assertEqual(len(results), 1)
        self.assertIn("Traffic", results[0]["title"])

        # Test concurrent search across all 3 keyword variations
        mock_yt_concurrent = MockYouTubeService(fail_first_n=0)
        conc_results = asyncio.run(
            smart_feed_agent.concurrent_youtube_keyword_search(
                city_name="Tokyo",
                youtube_client=mock_yt_concurrent,
            )
        )
        self.assertEqual(len(mock_yt_concurrent.calls), 3)
        self.assertGreaterEqual(len(conc_results), 3)

    def test_04_youtube_api_rate_limiting_handling(self):
        mock_rate_limited = MockYouTubeService(raise_rate_limit=True)
        results = asyncio.run(
            smart_feed_agent.search_youtube_with_retry(
                city_name="Paris",
                max_retries=3,
                youtube_client=mock_rate_limited,
            )
        )
        # Should stop retrying immediately on 429 rate limit and record rate-limit state without raising
        self.assertEqual(results, [])
        self.assertTrue(smart_feed_agent.youtube_rate_limit_state["rate_limited"])
        self.assertGreaterEqual(smart_feed_agent.youtube_rate_limit_state["rate_limit_hits"], 1)

        # Even while YouTube API is rate-limited, discover_youtube_feeds & get_optimal_feed must still serve feeds
        fallback_feeds = asyncio.run(
            smart_feed_agent.discover_youtube_feeds("Paris", youtube_client=mock_rate_limited)
        )
        self.assertGreaterEqual(len(fallback_feeds), 1)
        optimal = smart_feed_agent.get_optimal_feed("Paris")
        self.assertTrue(optimal["optimal_video_url"])

    # =========================================================================
    # 2. 4-LEVEL FALLBACK HIERARCHY & <2s SWITCHING TESTS
    # =========================================================================
    def test_05_four_level_fallback_hierarchy_cascade(self):
        city = "Berlin"
        hierarchy = smart_feed_agent.get_fallback_hierarchy(city)
        self.assertEqual(len(hierarchy), 4)
        self.assertEqual(hierarchy[0]["level"], 1)
        self.assertEqual(hierarchy[1]["level"], 2)
        self.assertEqual(hierarchy[2]["level"], 3)
        self.assertEqual(hierarchy[3]["level"], 4)

        # Initially at Level 1 (Live YouTube stream)
        initial = smart_feed_agent.get_optimal_feed(city)
        self.assertEqual(initial["fallback_level"], FALLBACK_LEVEL_1_YOUTUBE_LIVE)
        self.assertEqual(initial["provider"], "youtube")
        self.assertFalse(initial["is_fallback"])

        # Fail all Level 1 sources -> should switch to Level 2 (Recent YouTube video <24h old)
        berlin_sources = smart_feed_agent.feed_registry["berlin"]["sources"]
        for s in berlin_sources:
            if s.get("fallback_level", 1) == FALLBACK_LEVEL_1_YOUTUBE_LIVE:
                s["healthy"] = False
                s["is_healthy"] = False

        switch_l2 = asyncio.run(
            smart_feed_agent.emergency_switch_feed(city_name=city, reason="Level 1 live streams offline")
        )
        self.assertLess(switch_l2["switch_duration_seconds"], 2.0)
        self.assertTrue(switch_l2["within_2s_sla"])
        self.assertEqual(switch_l2["fallback_level"], FALLBACK_LEVEL_2_RECENT_YOUTUBE)
        self.assertIn("youtube.com", switch_l2["new_video_url"])

        # Fail Level 2 sources as well -> should switch to Level 3 (/static/fallback_videos/berlin.mp4)
        for s in berlin_sources:
            s["healthy"] = False
            s["is_healthy"] = False

        switch_l3 = asyncio.run(
            smart_feed_agent.emergency_switch_feed(city_name=city, reason="All YouTube streams offline")
        )
        self.assertLess(switch_l3["switch_duration_seconds"], 2.0)
        self.assertEqual(switch_l3["fallback_level"], FALLBACK_LEVEL_3_CITY_MP4)
        self.assertEqual(switch_l3["new_video_url"], "/static/fallback_videos/berlin.mp4")

        # Force Level 4 (Generic city timelapse video)
        switch_l4 = asyncio.run(
            smart_feed_agent.emergency_switch_feed(
                city_name=city,
                reason="City MP4 unavailable, testing Level 4 generic timelapse",
                target_fallback_level=FALLBACK_LEVEL_4_GENERIC_TIMELAPSE,
            )
        )
        self.assertLess(switch_l4["switch_duration_seconds"], 2.0)
        self.assertEqual(switch_l4["fallback_level"], FALLBACK_LEVEL_4_GENERIC_TIMELAPSE)
        self.assertIn("timelapse", switch_l4["new_video_url"])

    # =========================================================================
    # 3. CITY DATA (/config/cities.json) & TIMEZONE PEAK TRAFFIC TESTS
    # =========================================================================
    def test_06_cities_json_and_peak_traffic_optimization(self):
        cities_json_path = os.path.join(self.base_dir, "config", "cities.json")
        self.assertTrue(os.path.exists(cities_json_path), "config/cities.json must exist")
        with open(cities_json_path, "r", encoding="utf-8") as f:
            cities_cfg = json.load(f)

        by_name = {v["name"]: (k, v) for k, v in cities_cfg["cities"].items()}
        for req_city in REQUIRED_19_CITIES:
            self.assertIn(req_city, by_name, f"Missing required city {req_city} in config/cities.json")
            slug, c_data = by_name[req_city]
            self.assertGreaterEqual(len(c_data.get("youtube_search_terms", [])), 3)
            self.assertIn(f"live traffic camera {req_city}", c_data["youtube_search_terms"])
            self.assertIn(f"webcam {req_city} highway", c_data["youtube_search_terms"])
            self.assertIn(f"{req_city} traffic live stream", c_data["youtube_search_terms"])
            self.assertEqual(c_data.get("fallback_video"), f"/static/fallback_videos/{slug}.mp4")
            self.assertEqual(c_data.get("fallback_video_filename"), f"{slug}.mp4")
            self.assertTrue(c_data.get("timezone"))
            self.assertIn("peak_traffic_hours", c_data)

            # Verify fallback MP4 exists on disk
            mp4_disk_path = os.path.join(self.base_dir, "static", "fallback_videos", f"{slug}.mp4")
            self.assertTrue(os.path.exists(mp4_disk_path), f"Missing fallback MP4 for {slug}")

            # Verify timezone peak traffic calculation works
            peak_info = smart_feed_agent.get_peak_traffic_status(req_city)
            self.assertIn("is_peak_hour", peak_info)
            self.assertIn("local_time", peak_info)

    # =========================================================================
    # 4. MONITORING, TELEGRAM ALERTS & /api/feed-health/{city} TESTS
    # =========================================================================
    def test_07_feed_health_endpoint_and_persistent_telegram_alerts(self):
        # Test GET /api/feed-health/{city}
        res = self.client.get("/api/feed-health/London?bandwidth=medium")
        self.assertEqual(res.status_code, 200)
        health = res.json()
        self.assertEqual(health["city"], "London")
        self.assertTrue(health["healthy"])
        self.assertEqual(health["active_fallback_level"], 1)
        self.assertEqual(len(health["fallback_hierarchy"]), 4)
        self.assertEqual(health["bandwidth_adaptation"]["recommended_resolution"], "720p")
        self.assertIn("peak_traffic", health)

        # Test GET /api/feed-health summary
        all_health_res = self.client.get("/api/feed-health")
        self.assertEqual(all_health_res.status_code, 200)
        self.assertEqual(all_health_res.json()["status"], "healthy")

        # Trigger persistent failures in Rome (3 consecutive failures) and verify PERSISTENT_FEED_ISSUE alert
        before_alerts = len(notification_service.get_recent_alerts(50))
        for i in range(3):
            self.client.post(
                "/api/feed-manager/failover",
                json={"city": "Rome", "reason": f"Persistent failure test #{i + 1}"},
            )
        recent_alerts = notification_service.get_recent_alerts(10)
        self.assertGreater(len(recent_alerts), 0)
        alert_types = {a["alert_type"] for a in recent_alerts}
        self.assertIn("FEED_FAILURE_SWITCH", alert_types)
        self.assertIn("PERSISTENT_FEED_ISSUE", alert_types)

    # =========================================================================
    # 5. CACHING (5 MINUTES), PROGRESSIVE STREAMING & BANDWIDTH ADAPTATION
    # =========================================================================
    def test_08_five_minute_feed_caching_and_invalidation(self):
        smart_feed_agent.invalidate_city_cache("madrid")
        first_call = smart_feed_agent.get_optimal_feed("Madrid", use_load_balancing=False)
        self.assertFalse(first_call["cache_hit"])

        second_call = smart_feed_agent.get_optimal_feed("Madrid", use_load_balancing=False)
        self.assertTrue(second_call["cache_hit"])
        self.assertGreater(second_call["cache_ttl_remaining_seconds"], 290.0)
        self.assertLessEqual(second_call["cache_ttl_remaining_seconds"], 300.0)

        # Admin override must immediately invalidate cache
        smart_feed_agent.set_admin_override(
            city="Madrid",
            video_url="https://www.youtube.com/watch?v=madrid_highway_traffic",
            reason="Cache invalidation test",
        )
        after_ov = smart_feed_agent.get_optimal_feed("Madrid", use_load_balancing=False)
        self.assertFalse(after_ov["cache_hit"])
        self.assertEqual(after_ov["optimal_url"], "https://www.youtube.com/watch?v=madrid_highway_traffic")

    def test_09_progressive_streaming_and_bandwidth_adaptation(self):
        # Test HTTP Range progressive streaming (206 Partial Content)
        range_res = self.client.get(
            "/static/fallback_videos/tokyo.mp4?bandwidth=low",
            headers={"Range": "bytes=0-65535"},
        )
        self.assertEqual(range_res.status_code, 206)
        self.assertEqual(range_res.headers.get("Accept-Ranges"), "bytes")
        self.assertIn("bytes 0-65535/", range_res.headers.get("Content-Range", ""))
        self.assertEqual(len(range_res.content), 65536)
        self.assertEqual(range_res.headers.get("X-Bandwidth-Profile"), "low")
        self.assertEqual(range_res.headers.get("X-Recommended-Resolution"), "480p")

        # Test Level 4 generic timelapse video playback
        tl_res = self.client.get("/static/fallback_videos/generic_city_timelapse.mp4?bandwidth=high")
        self.assertEqual(tl_res.status_code, 200)
        self.assertEqual(tl_res.headers.get("X-Fallback-Level"), "4")
        self.assertEqual(tl_res.headers.get("X-Recommended-Resolution"), "1080p")
        self.assertGreater(len(tl_res.content), 10000)

    # =========================================================================
    # 6. 100+ CONCURRENT USERS MULTI-CITY STRESS TEST
    # =========================================================================
    def test_10_concurrent_120_users_multi_city_feed_requests(self):
        cities_cycle = REQUIRED_19_CITIES

        def _fetch_city_feed(idx: int):
            city = cities_cycle[idx % len(cities_cycle)]
            bw = ["low", "medium", "high"][idx % 3]
            feed = smart_feed_agent.get_optimal_feed(city, use_load_balancing=True, bandwidth=bw)
            return feed.get("optimal_video_url"), feed.get("city")

        start_ts = time.perf_counter()
        with ThreadPoolExecutor(max_workers=24) as pool:
            results = list(pool.map(_fetch_city_feed, range(120)))
        elapsed = time.perf_counter() - start_ts

        self.assertEqual(len(results), 120)
        for url, city_name in results:
            self.assertTrue(url, f"Empty feed URL for {city_name} under concurrent load")
        self.assertLess(elapsed, 2.0, f"120 concurrent user feed requests took {elapsed:.2f}s (expected < 2.0s)")


if __name__ == "__main__":
    unittest.main(verbosity=2)
