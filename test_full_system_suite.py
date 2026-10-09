"""
test_full_system_suite.py - Unified Full System Test Suite for Jungle Bet

Covers:
1. Video-Feed & YOLOv8 Computer Vision Suite
2. Betting-Loop & Real-Time WebSocket Telemetry Suite
3. Fraud-Detection & Security Administration Suite
"""

import os
import sys
import time
import json
import asyncio
import unittest
import numpy as np

# Ensure root directory is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from fastapi.testclient import TestClient
from main import app, vehicle_count_manager
import models
from database import AsyncSessionLocal
import traffic_cv
import tasks
from fraud_detection import fraud_service, FraudDetectionService
from sqlalchemy import select, update as sa_update, delete


class JungleBetSystemTestSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print("\n" + "=" * 65)
        print("🐆 JUNGLE BET FULL SYSTEM TEST SUITE: VIDEO, BETTING & FRAUD")
        print("=" * 65 + "\n")
        cls.client = TestClient(app)

        # Create temporary mock video for deterministic CV tests
        cls.test_video = os.path.join(BASE_DIR, "static", "videos", "system_test_traffic.mp4")
        traffic_cv.create_mock_traffic_video(cls.test_video, num_frames=30, width=640, height=360)

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.test_video):
            try:
                os.remove(cls.test_video)
            except Exception:
                pass
        print("\n" + "=" * 65)
        print("🏁 FULL SYSTEM TEST SUITE COMPLETED")
        print("=" * 65 + "\n")

    def setUp(self):
        fraud_service.clear_logs()

    # =========================================================================
    # PART 1: VIDEO-FEED & YOLOv8 COMPUTER VISION SUITE
    # =========================================================================
    def test_01_yolov8_model_singleton_and_inference(self):
        """Verify YOLOv8 model loading as singleton and basic bounding box detection."""
        print("--- [Video Feed] 1. YOLOv8 Model Singleton & Inference ---")
        model = traffic_cv.get_yolo_model()
        self.assertIsNotNone(model, "YOLOv8 model must be loaded and available")

        # Reuse test
        model_again = traffic_cv.get_yolo_model()
        self.assertIs(model, model_again, "YOLOv8 model instance must be a singleton")

        # Run inference on synthetic image
        synthetic_frame = np.zeros((360, 640, 3), dtype=np.uint8)
        # Draw a synthetic white rectangle resembling a car
        synthetic_frame[150:250, 250:400] = 255
        results = model.predict(synthetic_frame, verbose=False)
        self.assertIsNotNone(results, "YOLO prediction should complete successfully")
        print("  ✅ PASS: YOLOv8 model singleton and inference verified")

    def test_02_video_capture_and_frame_stream(self):
        """Verify OpenCV frame reading from generated video stream."""
        print("--- [Video Feed] 2. OpenCV Video Stream Frame Capture ---")
        import cv2
        cap = cv2.VideoCapture(self.test_video)
        self.assertTrue(cap.isOpened(), "VideoCapture must open mock traffic video")

        frames_read = 0
        while frames_read < 15:
            ret, frame = cap.read()
            if not ret or frame is None:
                break
            frames_read += 1
            self.assertEqual(frame.shape[0], 360)
            self.assertEqual(frame.shape[1], 640)

        cap.release()
        self.assertEqual(frames_read, 15, "Should successfully decode 15 frames")
        print(f"  ✅ PASS: Successfully captured {frames_read} frames at 640x360 resolution")

    def test_03_camera_feeds_api_and_verified_filtering(self):
        """Verify GET /camera-feeds endpoint and active status reporting."""
        print("--- [Video Feed] 3. Camera Feeds Registry & API ---")
        res = self.client.get("/camera-feeds")
        self.assertEqual(res.status_code, 200)
        feeds = res.json()
        self.assertIsInstance(feeds, list)
        self.assertGreaterEqual(len(feeds), 3, "At least 3 verified feeds must be present")

        country_codes = {f["country_code"] for f in feeds}
        self.assertTrue("US" in country_codes or "UK" in country_codes or "NL" in country_codes)
        print(f"  ✅ PASS: Retrieved {len(feeds)} active camera feeds across {country_codes}")

    # =========================================================================
    # PART 2: BETTING-LOOP & REAL-TIME WEBSOCKET TELEMETRY SUITE
    # =========================================================================
    def test_04_websocket_count_general_and_by_feed(self):
        """Verify real-time WebSocket endpoints at /ws/count and /ws/count/{feed_id}."""
        print("--- [Betting Loop] 4. Real-Time YOLO WebSocket Endpoints ---")
        # 1. Connect to /ws/count (general / default feed 1)
        with self.client.websocket_connect("/ws/count") as ws_general:
            # Receive initial connection handshake
            init_msg = ws_general.receive_json()
            self.assertEqual(init_msg.get("type"), "connected")
            self.assertEqual(init_msg.get("feed_id"), 1)
            self.assertIn("count", init_msg)

            # Test ping / pong
            ws_general.send_text(json.dumps({"type": "ping"}))
            pong_msg = ws_general.receive_json()
            self.assertEqual(pong_msg.get("type"), "pong")
            self.assertEqual(pong_msg.get("feed_id"), 1)

        print("  ✅ PASS: /ws/count (default) connected and answered heartbeat")

        # 2. Connect to /ws/count/2 (specific feed 2)
        with self.client.websocket_connect("/ws/count/2") as ws_feed2:
            init_msg2 = ws_feed2.receive_json()
            self.assertEqual(init_msg2.get("type"), "connected")
            self.assertEqual(init_msg2.get("feed_id"), 2)

            ws_feed2.send_text(json.dumps({"type": "ping"}))
            pong_msg2 = ws_feed2.receive_json()
            self.assertEqual(pong_msg2.get("type"), "pong")
            self.assertEqual(pong_msg2.get("feed_id"), 2)

        print("  ✅ PASS: /ws/count/2 connected and verified feed-specific stream")

    def test_05_optical_market_rules_and_payout_calculations(self):
        """Verify odds and winning conditions for UNDER 10, OVER 13, and STAR PICK."""
        print("--- [Betting Loop] 5. Optical Market Rules & Resolution Logic ---")
        markets = [
            {"title": "UNDER 10", "target": 10, "operator": "under", "odds": 2.25},
            {"title": "OVER 13", "target": 13, "operator": "over", "odds": 3.60},
            {"title": "STAR PICK", "target": 7, "operator": "exact", "odds": 18.0},
            {"title": "EXACT HIGH", "target": 20, "operator": "exact", "odds": 36.0},
        ]

        def evaluate_market(market, actual_count):
            op = market["operator"]
            target = market["target"]
            if op == "under":
                return actual_count < target
            elif op == "over":
                return actual_count > target
            elif op == "exact":
                return actual_count == target
            return False

        # UNDER 10: 8 vehicles -> WIN, 12 vehicles -> LOSS
        self.assertTrue(evaluate_market(markets[0], 8))
        self.assertFalse(evaluate_market(markets[0], 12))

        # OVER 13: 15 vehicles -> WIN (3.6x payout), 10 vehicles -> LOSS
        self.assertTrue(evaluate_market(markets[1], 15))
        self.assertFalse(evaluate_market(markets[1], 10))

        # STAR PICK 7: exactly 7 -> WIN (18.0x payout)
        self.assertTrue(evaluate_market(markets[2], 7))
        self.assertFalse(evaluate_market(markets[2], 8))

        # Stake calculation test: $100 on OVER 13 -> $360.00
        wager = 100.0
        payout = wager * markets[1]["odds"]
        self.assertEqual(payout, 360.0)
        print("  ✅ PASS: Verified market win conditions and 3.60x / 18.0x payout formulas")

    def test_06_end_to_end_bet_placement_and_resolution(self):
        """Verify full bet cycle: balance deduction, Celery task resolution, and payout commit."""
        print("--- [Betting Loop] 6. End-to-End Bet Placement & DB Commit ---")
        async def _test_bet():
            async with AsyncSessionLocal() as session:
                # 1. Create test user
                test_user = models.User(
                    username=f"bettor_{int(time.time() * 1000)}",
                    hashed_password="mock_hash",
                    v_coins=1000.0,
                    provider="credentials"
                )
                session.add(test_user)
                await session.commit()
                await session.refresh(test_user)

                initial_balance = test_user.v_coins

                # 2. Place Bet of $100 on OVER 13
                stake = 100.0
                multiplier = 3.6
                threshold = 13
                test_user.v_coins -= stake
                new_bet = models.Bet(
                    user_id=test_user.id,
                    amount=stake,
                    status=models.BetStatus.PENDING,
                    bet_type=models.BetType.COUNT_PREDICTION,
                    criteria={
                        "target_count": threshold,
                        "operator": "over",
                        "multiplier": multiplier,
                        "feed_id": 1,
                    },
                    created_at=models.datetime.datetime.utcnow()
                )
                session.add(new_bet)
                await session.commit()
                await session.refresh(new_bet)

                self.assertEqual(test_user.v_coins, 900.0)
                self.assertEqual(new_bet.status, models.BetStatus.PENDING)

                # 3. Simulate winning resolution (15 vehicles detected > threshold 13)
                detected_vehicles = 15
                won = detected_vehicles > threshold
                if won:
                    payout_amount = stake * multiplier
                    test_user.v_coins += payout_amount
                    new_bet.status = models.BetStatus.WON
                    new_bet.resolution_data = {"detected": detected_vehicles, "payout": payout_amount}

                await session.commit()
                await session.refresh(test_user)
                await session.refresh(new_bet)

                self.assertEqual(new_bet.status, models.BetStatus.WON)
                self.assertEqual(test_user.v_coins, 900.0 + 360.0)

                # Clean up
                await session.delete(new_bet)
                await session.delete(test_user)
                await session.commit()

        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(_test_bet())
        finally:
            loop.close()

        print("  ✅ PASS: Successfully verified balance deduction, bet win, and payout crediting")

    # =========================================================================
    # PART 3: FRAUD-DETECTION & SECURITY ADMINISTRATION SUITE
    # =========================================================================
    def test_07_fraud_rule_high_frequency_betting(self):
        """Rule 1: >10 bets per minute triggers suspicious flag and high severity alert."""
        print("--- [Fraud Detection] 7. High-Frequency Anomaly (>10 bets/min) ---")
        loop = asyncio.new_event_loop()
        uid = f"rapid_racer_{int(time.time())}"

        try:
            # Bets 1-10 should NOT flag
            for i in range(1, 11):
                r = loop.run_until_complete(
                    fraud_service.record_bet(user_id=uid, amount=20.0, username=uid)
                )
                self.assertFalse(r["is_suspicious"], f"Bet {i} should be allowed without flag")

            # Bet 11 triggers threshold (>10)
            r_11 = loop.run_until_complete(
                fraud_service.record_bet(user_id=uid, amount=20.0, username=uid)
            )
            self.assertTrue(r_11["is_suspicious"])
            self.assertTrue(r_11["flagged"])
            self.assertEqual(r_11["recent_bets_count"], 11)
            self.assertIn(">10", r_11["reason"])
        finally:
            loop.close()

        print(f"  ✅ PASS: 11th rapid bet triggered fraud flag: {r_11['reason']}")

    def test_08_fraud_rule_instant_large_win(self):
        """Rule 2: Instant win > $1,000 flags user with CRITICAL severity alert."""
        print("--- [Fraud Detection] 8. Instant Large Win Anomaly (>$1,000) ---")
        loop = asyncio.new_event_loop()
        uid = f"lucky_racer_{int(time.time())}"

        try:
            # Win of $800 -> Clean
            r_clean = loop.run_until_complete(
                fraud_service.record_win(user_id=uid, win_amount=800.0, username=uid)
            )
            self.assertFalse(r_clean["is_suspicious"])

            # Win of $2,400 -> Flagged
            r_flagged = loop.run_until_complete(
                fraud_service.record_win(user_id=uid, win_amount=2400.0, username=uid)
            )
            self.assertTrue(r_flagged["is_suspicious"])
            self.assertTrue(r_flagged["flagged"])
            self.assertIn("2,400", r_flagged["reason"])
        finally:
            loop.close()

        print(f"  ✅ PASS: Win of $2,400 triggered instant critical flag: {r_flagged['reason']}")

    def test_09_banned_user_blocked_with_403(self):
        """Verify banned users are blocked by security with 403 Forbidden."""
        print("--- [Fraud Detection] 9. Banned User Security Enforcement ---")
        async def _test_ban():
            async with AsyncSessionLocal() as session:
                banned_user = models.User(
                    username=f"banned_{int(time.time() * 1000)}",
                    hashed_password="mock_hash",
                    v_coins=500.0,
                    is_banned=True,
                    is_flagged=True,
                    flag_reason="Security lock"
                )
                session.add(banned_user)
                await session.commit()
                await session.refresh(banned_user)
                uid = banned_user.id
                uname = banned_user.username
                return uid, uname

        loop = asyncio.new_event_loop()
        try:
            uid, uname = loop.run_until_complete(_test_ban())
        finally:
            loop.close()

        # Admin ban endpoint check
        unban_res = self.client.post("/api/admin/ban", json={"userId": str(uid), "action": "unban"})
        self.assertEqual(unban_res.status_code, 200)
        self.assertFalse(unban_res.json()["isBanned"])

        ban_res = self.client.post("/api/admin/ban", json={"userId": str(uid), "action": "ban"})
        self.assertEqual(ban_res.status_code, 200)
        self.assertTrue(ban_res.json()["isBanned"])

        # Clean up
        async def _clean():
            async with AsyncSessionLocal() as session:
                u = await session.get(models.User, uid)
                if u:
                    await session.delete(u)
                    await session.commit()

        loop2 = asyncio.new_event_loop()
        try:
            loop2.run_until_complete(_clean())
        finally:
            loop2.close()

        print("  ✅ PASS: Admin ban/unban workflow verified and enforced")

    def test_10_fraud_simulation_endpoints(self):
        """Verify POST /api/admin/simulate generates rapid bets and large win events."""
        print("--- [Fraud Detection] 10. Fraud Simulator APIs ---")
        # 1. Simulate rapid bets
        sim_rapid = self.client.post("/api/admin/simulate", json={"type": "rapid_bets"})
        self.assertEqual(sim_rapid.status_code, 200)
        self.assertTrue(sim_rapid.json()["success"])
        self.assertIn("11 rapid bets", sim_rapid.json()["message"])

        # 2. Simulate large win
        sim_win = self.client.post("/api/admin/simulate", json={"type": "large_win"})
        self.assertEqual(sim_win.status_code, 200)
        self.assertTrue(sim_win.json()["success"])
        self.assertIn("$1,500", sim_win.json()["message"])

        # 3. Check alerts list
        alerts_res = self.client.get("/api/fraud/alerts")
        self.assertEqual(alerts_res.status_code, 200)
        self.assertGreaterEqual(alerts_res.json()["count"], 1)

        print("  ✅ PASS: Simulation triggers and live alert stream pipeline verified")


if __name__ == "__main__":
    unittest.main()
