"""
test_rush_hour_bet_transformation.py - Comprehensive Verification Suite for RUSH HOUR BET

Tests:
1. Rebranding consistency across backend, frontend, configs, and docs.
2. Currency conversion accuracy, USD-only wallet enforcement, GET /api/currencies, POST /api/withdraw-preview, and CurrencyConversionMiddleware.
3. Global city coordinates (lat/long), IANA timezones, country codes, and flag emojis across Asia, Africa, Americas, Europe, and Oceania.
4. Smart Feed Agent discovery, traffic-only content filtering, quality scoring, fallback videos, <2s emergency failover, load balancing, and admin overrides.
"""

import os
import time
import json
import unittest
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient

import models
from main import app
from transaction_service import transaction_service
from services.smart_feed_agent import smart_feed_agent, SmartFeedAgent


REQUIRED_GLOBAL_CITIES = {
    "Asia": ["Tokyo", "Shanghai", "Beijing", "Mumbai", "Bangkok", "Singapore"],
    "Africa": ["Casablanca", "Lagos", "Cairo", "Nairobi", "Johannesburg"],
    "Americas": ["New York", "Los Angeles", "São Paulo", "Mexico City", "Toronto"],
    "Europe": ["London", "Paris", "Berlin", "Madrid", "Rome", "Amsterdam", "Vienna", "Prague", "Zurich"],
    "Oceania": ["Sydney", "Melbourne", "Auckland"],
}


class TestRushHourBetTransformation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.base_dir = os.path.dirname(os.path.abspath(__file__))

    # =========================================================================
    # 1. REBRANDING CONSISTENCY TESTS
    # =========================================================================
    def test_01_rebranding_consistency(self):
        self.assertEqual(app.title, "RUSH HOUR BET API")

        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body.get("platform"), "RUSH HOUR BET")
        self.assertEqual(body.get("internal_currency"), "USD")

        files_to_verify = [
            "README.md",
            "RUSH_HOUR_BET_SETUP.md",
            "FEED_MANAGEMENT_GUIDE.md",
            ".env.example",
            "config/feed_sources.json",
            "frontend/index.html",
            "frontend/src/utils/constants.ts",
            "jungle-bet-frontend/src/components/Header.tsx",
            "jungle-bet-frontend/src/app/page.tsx",
        ]
        for rel_path in files_to_verify:
            full_path = os.path.join(self.base_dir, rel_path)
            self.assertTrue(os.path.exists(full_path), f"Missing expected file: {rel_path}")
            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read()
            self.assertIn("RUSH HOUR BET", content, f"{rel_path} should contain 'RUSH HOUR BET'")

    # =========================================================================
    # 2. CURRENCY SYSTEM OVERHAUL & USD-ONLY ACCOUNTING TESTS
    # =========================================================================
    def test_02_usd_only_wallet_model_enforcement(self):
        # Valid USD wallet succeeds
        w_usd = models.Wallet(user_id=999, type=models.WalletType.PLAYER.value, currency="USD", balance=50.0)
        self.assertEqual(w_usd.currency, "USD")

        # Non-USD wallet raises ValueError (USD_ONLY_ACCOUNTING_VIOLATION)
        with self.assertRaises(ValueError) as ctx:
            models.Wallet(user_id=999, type=models.WalletType.PLAYER.value, currency="UGX", balance=50000.0)
        self.assertIn("USD_ONLY_ACCOUNTING_VIOLATION", str(ctx.exception))

        with self.assertRaises(ValueError) as ctx2:
            transaction_service.validate_usd_currency("EUR")
        self.assertIn("USD_ONLY_ACCOUNTING_VIOLATION", str(ctx2.exception))

    def test_03_currency_conversion_accuracy(self):
        # Local -> USD conversion test (UGX: market=4040, custom=3800)
        dep_conv = transaction_service.convert_local_to_usd(
            amount_local=40400.0,
            market_rate=4040.0,
            custom_rate=3800.0,
        )
        self.assertAlmostEqual(dep_conv["real_usd"], 10.0, places=4)
        expected_credited = (40400.0 / 4040.0) * (3800.0 / 4040.0)
        self.assertAlmostEqual(dep_conv["usd_credited"], expected_credited, places=4)
        self.assertEqual(dep_conv["currency_stored"], "USD")

        # USD -> Local conversion test (JPY: market=152, custom=146)
        wd_conv = transaction_service.convert_usd_to_local(
            amount_usd=100.0,
            market_rate=152.0,
            custom_rate=146.0,
        )
        self.assertAlmostEqual(wd_conv["local_payout"], 14600.0, places=2)
        self.assertAlmostEqual(wd_conv["market_local_equivalent"], 15200.0, places=2)
        self.assertAlmostEqual(wd_conv["spread_profit_local"], 600.0, places=2)
        self.assertEqual(wd_conv["internal_currency"], "USD")

    def test_04_currencies_and_withdraw_preview_endpoints(self):
        # GET /api/currencies
        res = self.client.get("/api/currencies")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["internal_accounting_currency"], "USD")
        self.assertGreaterEqual(data["count"], 20)
        codes = {c["code"] for c in data["currencies"]}
        for expected_code in ["USD", "EUR", "GBP", "UGX", "KES", "NGN", "JPY", "CNY", "INR", "BRL", "MXN", "CAD", "AUD", "NZD"]:
            self.assertIn(expected_code, codes)

        # POST /api/withdraw-preview
        prev_res = self.client.post(
            "/api/withdraw-preview",
            json={"amount_usd": 25.0, "currency": "UGX"},
        )
        self.assertEqual(prev_res.status_code, 200)
        self.assertEqual(prev_res.headers.get("X-Internal-Accounting-Currency"), "USD")
        self.assertEqual(prev_res.headers.get("X-Currency-Conversion-Applied"), "true")
        self.assertEqual(prev_res.headers.get("X-Currency-Conversion-Direction"), "USD_TO_LOCAL")
        prev_data = prev_res.json()
        self.assertEqual(prev_data["internal_currency"], "USD")
        self.assertEqual(prev_data["currency"], "UGX")
        self.assertEqual(prev_data["amount_usd"], 25.0)
        self.assertAlmostEqual(prev_data["local_payout"], 25.0 * prev_data["custom_rate"], places=2)
        self.assertTrue(prev_data["meets_minimum"])

    # =========================================================================
    # 3. GLOBAL MAP EXPANSION & TIMEZONE VALIDATION TESTS
    # =========================================================================
    def test_05_global_cities_coordinates_and_timezones(self):
        res = self.client.get("/api/cities")
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(payload["platform"], "RUSH HOUR BET")
        cities_by_name = {c["city"]: c for c in payload["cities"]}

        for region, city_list in REQUIRED_GLOBAL_CITIES.items():
            for city_name in city_list:
                self.assertIn(city_name, cities_by_name, f"Missing required city {city_name} in {region}")
                city_info = cities_by_name[city_name]
                self.assertEqual(city_info["region"], region)

                # Validate lat/long coordinates
                lat = float(city_info["lat"])
                lng = float(city_info["long"])
                self.assertGreaterEqual(lat, -90.0)
                self.assertLessEqual(lat, 90.0)
                self.assertGreaterEqual(lng, -180.0)
                self.assertLessEqual(lng, 180.0)

                # Validate IANA timezone
                tz_name = city_info["timezone"]
                self.assertTrue(tz_name, f"Missing timezone for {city_name}")
                tz_obj = ZoneInfo(tz_name)
                self.assertIsNotNone(tz_obj)

                # Validate country code & flag emoji
                self.assertEqual(len(city_info["country_code"]), 2)
                self.assertTrue(len(city_info["flag_emoji"]) >= 1)

    # =========================================================================
    # 4. SMART FEED AGENT & BUSINESS CONTINUITY TESTS
    # =========================================================================
    def test_06_smart_feed_content_filtering_and_quality_scoring(self):
        # Must accept road/traffic feeds
        self.assertTrue(
            smart_feed_agent.is_valid_traffic_feed(
                "Tokyo Shuto Expressway Live Traffic Camera",
                "Real-time multi-lane highway vehicle flow",
            )
        )
        # Must reject pedestrian / park / beach feeds
        self.assertFalse(
            smart_feed_agent.is_valid_traffic_feed(
                "Central Park Pedestrian Walking Path Live Cam",
                "Relaxing park footpath and nature trail",
            )
        )
        self.assertFalse(
            smart_feed_agent.is_valid_traffic_feed(
                "Venice Beach Boardwalk Live Cam",
                "Beachfront pedestrian promenade",
            )
        )

        # Quality scoring prioritizes overhead 1080p multi-lane over street-level 480p
        high_quality_source = {
            "angle": "overhead_highway",
            "zoom": "optimal_multi_lane",
            "resolution": "1080p",
            "fps": 30,
            "priority": 1,
        }
        low_quality_source = {
            "angle": "street_level",
            "zoom": "extreme_wide",
            "resolution": "480p",
            "fps": 15,
            "priority": 3,
        }
        hq_score = smart_feed_agent.calculate_quality_score(high_quality_source)
        lq_score = smart_feed_agent.calculate_quality_score(low_quality_source)
        self.assertGreater(hq_score, 90.0)
        self.assertLess(lq_score, 60.0)
        self.assertGreater(hq_score, lq_score)

    def test_07_feed_fallback_videos_and_feed_manager_endpoint(self):
        # Verify GET /api/feed-manager returns optimal feed for all cities
        res = self.client.get("/api/feed-manager")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["platform"], "RUSH HOUR BET")
        self.assertGreaterEqual(data["summary"]["total_cities"], 28)

        # Check specific city query
        tokyo_res = self.client.get("/api/feed-manager?city=Tokyo")
        self.assertEqual(tokyo_res.status_code, 200)
        tokyo_feed = tokyo_res.json()
        self.assertEqual(tokyo_feed["city"], "Tokyo")
        self.assertTrue(tokyo_feed["optimal_video_url"])
        self.assertTrue(tokyo_feed["fallback_available"])

        # Verify fallback video endpoint serves valid MP4
        fb_res = self.client.get("/static/fallback_videos/tokyo.mp4")
        self.assertEqual(fb_res.status_code, 200)
        self.assertEqual(fb_res.headers.get("content-type"), "video/mp4")
        self.assertGreater(len(fb_res.content), 10000)

    def test_08_emergency_failover_under_2_seconds_and_admin_override(self):
        # 1. Test emergency failover (< 2 seconds SLA)
        start = time.perf_counter()
        failover_res = self.client.post(
            "/api/feed-manager/failover",
            json={
                "city": "London",
                "failed_source_id": "lon_yt_1",
                "reason": "Simulated primary stream failure",
            },
        )
        elapsed = time.perf_counter() - start
        self.assertEqual(failover_res.status_code, 200)
        f_data = failover_res.json()
        self.assertLess(elapsed, 2.0, "Emergency feed switch must complete within 2 seconds")
        self.assertTrue(f_data["within_2s_sla"])
        self.assertTrue(f_data["new_video_url"])

        # 2. Test fallback when all live sources for a city are marked unhealthy
        city_state = smart_feed_agent.feed_registry["prague"]
        for src in city_state["sources"]:
            src["is_healthy"] = False
        prague_optimal = smart_feed_agent.get_optimal_feed("Prague", use_load_balancing=False)
        self.assertTrue(prague_optimal["is_fallback"])
        self.assertEqual(prague_optimal["optimal_video_url"], "/static/fallback_videos/prague.mp4")
        # Restore health
        for src in city_state["sources"]:
            src["is_healthy"] = True

        # 3. Test Admin manual override and clear override
        override_url = "https://www.youtube.com/watch?v=custom_admin_stream"
        ov_res = self.client.post(
            "/api/feed-manager/override",
            json={
                "city": "Paris",
                "video_url": override_url,
                "reason": "Admin special event stream",
                "admin_user": "admin_tester",
            },
        )
        self.assertEqual(ov_res.status_code, 200)
        ov_data = ov_res.json()
        self.assertEqual(ov_data["feed"]["optimal_video_url"], override_url)
        self.assertEqual(ov_data["feed"]["selection_mode"], "admin_override")

        clear_res = self.client.delete("/api/feed-manager/override/Paris")
        self.assertEqual(clear_res.status_code, 200)
        cleared_data = clear_res.json()
        self.assertNotEqual(cleared_data["feed"]["selection_mode"], "admin_override")


if __name__ == "__main__":
    unittest.main(verbosity=2)
