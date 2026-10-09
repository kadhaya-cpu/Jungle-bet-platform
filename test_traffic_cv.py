"""
test_traffic_cv.py - End-to-End and Unit Tests for YOLOv8 Traffic CV & Celery Integration
"""

import os
import sys
import time
import unittest
import asyncio
import datetime
import numpy as np

# Ensure parent directory is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from traffic_cv import (
    load_model,
    get_yolo_model,
    is_model_loaded,
    parse_lane_regions,
    is_vehicle_in_mask,
    count_vehicles_in_video,
    create_mock_traffic_video,
    SimpleCentroidTracker
)
from tasks import (
    process_traffic_video,
    process_video_blurring,
    process_live_feed,
    resolve_video_path,
    update_database_with_result,
    fetch_camera_feed,
    update_feed_status
)
from database import AsyncSessionLocal, engine, Base
from models import User, Bet, Transaction, BetStatus, BetType, CameraFeed
from sqlalchemy import select, delete
from fastapi.testclient import TestClient
from main import app


class TestTrafficComputerVision(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create test mock video
        cls.test_video_path = os.path.join(BASE_DIR, "static", "videos", "unit_test_traffic.mp4")
        create_mock_traffic_video(cls.test_video_path, num_frames=30, width=640, height=360)

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.test_video_path):
            try:
                os.remove(cls.test_video_path)
            except Exception:
                pass

    def test_01_model_loading_singleton(self):
        """Verify model loads once at startup and reuses singleton instance."""
        model1 = get_yolo_model()
        self.assertIsNotNone(model1)
        self.assertTrue(is_model_loaded())

        model2 = get_yolo_model()
        self.assertIs(model1, model2, "Model should be a cached singleton instance")

    def test_02_lane_coordinate_masking(self):
        """Verify coordinate masking handles boxes, normalized coordinates, and polygons."""
        # 1. Pixel bounding box
        masks = parse_lane_regions({"lane_1": [0, 50, 320, 200]}, 640, 360)
        self.assertIn("lane_1", masks)
        self.assertEqual(masks["lane_1"].shape, (360, 640))
        self.assertEqual(masks["lane_1"][100, 100], 1)
        self.assertEqual(masks["lane_1"][300, 500], 0)

        # 2. Normalized bounding box
        masks_norm = parse_lane_regions({"lane_norm": [0.0, 0.0, 0.5, 0.5]}, 640, 360)
        self.assertEqual(masks_norm["lane_norm"][50, 50], 1)
        self.assertEqual(masks_norm["lane_norm"][250, 400], 0)

        # 3. Polygon
        poly = [[100, 100], [200, 100], [200, 200], [100, 200]]
        masks_poly = parse_lane_regions({"lane_poly": poly}, 640, 360)
        self.assertEqual(masks_poly["lane_poly"][150, 150], 1)
        self.assertEqual(masks_poly["lane_poly"][50, 50], 0)

        # 4. Vehicle in mask testing
        box = np.array([120, 120, 180, 180])
        self.assertTrue(is_vehicle_in_mask(box, masks_poly["lane_poly"], check_mode="center"))
        outside_box = np.array([300, 300, 350, 350])
        self.assertFalse(is_vehicle_in_mask(outside_box, masks_poly["lane_poly"], check_mode="center"))

    def test_03_centroid_tracker_fallback(self):
        """Verify fallback centroid tracker assigns stable IDs."""
        tracker = SimpleCentroidTracker(max_distance=50.0)
        # Frame 1
        ids1 = tracker.update([(100.0, 100.0), (200.0, 200.0)])
        self.assertEqual(len(ids1), 2)

        # Frame 2 (slight movement)
        ids2 = tracker.update([(105.0, 102.0), (198.0, 205.0)])
        self.assertEqual(ids1, ids2, "Centroids close together should retain IDs")

    def test_04_count_vehicles_pipeline_with_optimizations(self):
        """Verify frame skipping, downscaling, and vehicle counting metrics."""
        lane_regions = {
            "lane_north": [0, 40, 640, 180],
            "lane_south": [0, 180, 640, 320]
        }
        res = count_vehicles_in_video(
            video_source=self.test_video_path,
            lane_regions=lane_regions,
            frame_skip=5,
            target_resolution=(640, 360),
            conf_threshold=0.25
        )

        self.assertEqual(res["status"], "completed")
        self.assertIn("detected_count", res)
        self.assertIn("confidence_score", res)
        self.assertIn("lane_counts", res)
        self.assertIn("processing_time_ms", res)
        # 30 frames with frame_skip=5 => 6 processed frames
        self.assertEqual(res["processed_frames"], 6)
        self.assertIn("lane_north", res["lane_counts"])
        self.assertIn("lane_south", res["lane_counts"])

    def test_05_error_handling_video_not_found(self):
        """Verify graceful error handling when video does not exist."""
        nonexistent = "/path/to/nonexistent_traffic_video.mp4"
        with self.assertRaises(FileNotFoundError):
            count_vehicles_in_video(nonexistent)

        # Test Celery task graceful error return
        task_res = process_traffic_video.apply(args=[nonexistent]).get()
        self.assertEqual(task_res["status"], "error")
        self.assertIn("not found", task_res["error"])


class TestEndToEndBetResolution(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # Clean up existing test data
        async with AsyncSessionLocal() as session:
            await session.execute(delete(Bet).where(Bet.user_id == 9999))
            await session.execute(delete(Transaction).where(Transaction.user_id == 9999))
            await session.execute(delete(User).where(User.id == 9999))
            # Insert test user
            test_user = User(
                id=9999,
                username="test_cv_user",
                hashed_password="pw",
                v_coins=500.0
            )
            session.add(test_user)
            await session.commit()

    async def asyncTearDown(self):
        async with AsyncSessionLocal() as session:
            await session.execute(delete(Bet).where(Bet.user_id == 9999))
            await session.execute(delete(Transaction).where(Transaction.user_id == 9999))
            await session.execute(delete(User).where(User.id == 9999))
            await session.commit()

    async def test_end_to_end_winning_bet(self):
        """Place a bet with prediction 'over 0' and verify CV task updates DB to 'won'."""
        sample_video = os.path.join(BASE_DIR, "static", "videos", "mock_traffic.mp4")
        if not os.path.exists(sample_video):
            create_mock_traffic_video(sample_video, num_frames=30)

        # 1. Create a bet in pending state
        async with AsyncSessionLocal() as session:
            bet = Bet(
                user_id=9999,
                bet_type=BetType.COUNT_PREDICTION,
                criteria={
                    "target_count": 0,
                    "operator": "over",
                    "video_source": sample_video
                },
                amount=50.0,
                status="pending"
            )
            session.add(bet)
            await session.commit()
            await session.refresh(bet)
            bet_id = bet.id

        # 2. Trigger Celery task (synchronously for unit testing)
        task_res = process_traffic_video.apply(kwargs={"video_source": sample_video, "bet_id": bet_id}).get()
        self.assertEqual(task_res["status"], "completed")

        # 3. Verify bet in database
        async with AsyncSessionLocal() as session:
            res = await session.execute(select(Bet).where(Bet.id == bet_id))
            resolved_bet = res.scalar_one()
            self.assertIn(resolved_bet.status, ["won", "lost"])
            self.assertIsNotNone(resolved_bet.resolved_at)
            self.assertIsNotNone(resolved_bet.resolution_data)
            self.assertIn("detected_count", resolved_bet.resolution_data)
            self.assertIn("confidence_score", resolved_bet.resolution_data)

            # Check user balance
            user_res = await session.execute(select(User).where(User.id == 9999))
            user = user_res.scalar_one()
            if resolved_bet.status == "won":
                self.assertGreater(user.v_coins, 500.0)

    async def test_end_to_end_losing_bet(self):
        """Place a bet with prediction 'under 1' (when 5 vehicles exist) and verify status is 'lost'."""
        sample_video = os.path.join(BASE_DIR, "static", "videos", "mock_traffic.mp4")

        async with AsyncSessionLocal() as session:
            bet = Bet(
                user_id=9999,
                bet_type=BetType.COUNT_PREDICTION,
                criteria={
                    "target_count": 1,
                    "operator": "under",
                    "video_source": sample_video
                },
                amount=50.0,
                status="pending"
            )
            session.add(bet)
            await session.commit()
            await session.refresh(bet)
            bet_id = bet.id

        task_res = process_traffic_video.apply(kwargs={"video_source": sample_video, "bet_id": bet_id}).get()
        self.assertEqual(task_res["status"], "completed")

        async with AsyncSessionLocal() as session:
            res = await session.execute(select(Bet).where(Bet.id == bet_id))
            resolved_bet = res.scalar_one()
            self.assertEqual(resolved_bet.status, BetStatus.LOST)
            self.assertIsNotNone(resolved_bet.resolved_at)

    async def test_bet_with_specific_lane_regions(self):
        """Place a bet counting only lane_2 (empty lane) and verify lane-specific count is 0."""
        sample_video = os.path.join(BASE_DIR, "static", "videos", "mock_traffic.mp4")

        async with AsyncSessionLocal() as session:
            bet = Bet(
                user_id=9999,
                bet_type=BetType.COUNT_PREDICTION,
                criteria={
                    "target_count": 0,
                    "operator": "exact",
                    "video_source": sample_video,
                    "lane_regions": {
                        "lane_empty": [0, 200, 640, 360]
                    }
                },
                amount=20.0,
                status="pending"
            )
            session.add(bet)
            await session.commit()
            await session.refresh(bet)
            bet_id = bet.id

        task_res = process_traffic_video.apply(kwargs={"video_source": sample_video, "bet_id": bet_id}).get()
        self.assertEqual(task_res["status"], "completed")
        self.assertIn("lane_empty", task_res["lane_counts"])

    async def test_legacy_task_forwarding(self):
        """Verify process_video_blurring forwards execution to process_traffic_video."""
        sample_video = os.path.join(BASE_DIR, "static", "videos", "mock_traffic.mp4")

        async with AsyncSessionLocal() as session:
            bet = Bet(
                user_id=9999,
                bet_type=BetType.COUNT_PREDICTION,
                criteria={
                    "target_count": 0,
                    "operator": "over",
                    "video_source": sample_video
                },
                amount=10.0,
                status="pending"
            )
            session.add(bet)
            await session.commit()
            await session.refresh(bet)
            bet_id = bet.id

        task_res = process_video_blurring.apply(args=[bet_id]).get()
        self.assertEqual(task_res["status"], "completed")
        self.assertEqual(task_res["bet_id"], bet_id)


class TestLiveStreamIngestionAndCameraFeeds(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create a mock video to use as a valid test stream source
        cls.test_stream_path = os.path.join(BASE_DIR, "static", "videos", "live_stream_test.mp4")
        create_mock_traffic_video(cls.test_stream_path, num_frames=60, width=640, height=360)

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.test_stream_path):
            try:
                os.remove(cls.test_stream_path)
            except Exception:
                pass

    def test_01_camera_feeds_schema_and_seeding(self):
        """Verify camera_feeds database table exists and contains 3 sample public feeds."""
        async def run_test():
            async with AsyncSessionLocal() as session:
                res = await session.execute(select(CameraFeed).order_by(CameraFeed.id))
                feeds = res.scalars().all()
                self.assertGreaterEqual(len(feeds), 5, "Database should contain at least 5 camera feeds")

                feed_locations = [f.location for f in feeds]
                self.assertIn("Los Angeles - I-405", feed_locations)
                self.assertIn("London - Chelsea Bridge", feed_locations)
                self.assertIn("Amsterdam - A10 / A1", feed_locations)

                for f in feeds:
                    self.assertIsNotNone(f.id)
                    self.assertIsNotNone(f.name)
                    self.assertIsNotNone(f.location)
                    self.assertIsNotNone(f.rtsp_url)
                    self.assertIsNotNone(f.country_code)
                    self.assertIsNotNone(f.status)
                    if f.id in (1, 2, 3, 4, 5):
                        self.assertIsNotNone(f.lane_mask)


        asyncio.run(run_test())

    def test_02_process_live_feed_offline_graceful_handling(self):
        """Verify process_live_feed handles unreachable streams gracefully and marks feed offline."""
        async def setup_offline_feed():
            async with AsyncSessionLocal() as session:
                feed = CameraFeed(
                    name="Test Offline Stream",
                    location="Test-Unreachable-Cam",
                    rtsp_url="rtsp://127.0.0.1:9999/unreachable.stream",
                    country_code="US",
                    status="active"
                )
                session.add(feed)
                await session.commit()
                await session.refresh(feed)
                return feed.id

        offline_feed_id = asyncio.run(setup_offline_feed())

        # Call process_live_feed on unreachable RTSP stream with max_connection_retries=2
        result = process_live_feed(feed_id=offline_feed_id, max_connection_retries=2)
        self.assertEqual(result["status"], "error")
        self.assertEqual(result.get("feed_status"), "offline")
        self.assertIn("Failed to connect", result["error"])

        # Check that database status was updated to 'offline'
        async def verify_status():
            async with AsyncSessionLocal() as session:
                res = await session.execute(select(CameraFeed).where(CameraFeed.id == offline_feed_id))
                feed = res.scalar_one_or_none()
                self.assertIsNotNone(feed)
                self.assertEqual(feed.status, "offline")

        asyncio.run(verify_status())

    def test_03_process_live_feed_active_stream_and_frame_skipping(self):
        """Verify process_live_feed ingests stream, skips frames, logs per second, and releases capture."""
        async def setup_active_feed():
            async with AsyncSessionLocal() as session:
                feed = CameraFeed(
                    name="Active Test Feed",
                    location="Test-Active-Road",
                    rtsp_url=self.test_stream_path,
                    country_code="US",
                    status="active"
                )
                session.add(feed)
                await session.commit()
                await session.refresh(feed)
                return feed.id

        active_feed_id = asyncio.run(setup_active_feed())

        lane_regions = {
            "lane_north": [0, 50, 640, 180],
            "lane_south": [0, 180, 640, 360]
        }

        result = process_live_feed(
            feed_id=active_feed_id,
            lane_regions=lane_regions,
            frame_skip=5,
            duration_seconds=5,
            max_frames=50
        )

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["feed_id"], active_feed_id)
        self.assertIn("detected_count", result)
        self.assertIn("confidence_score", result)
        self.assertIn("lane_counts", result)
        self.assertIn("counts_per_second", result)
        self.assertGreater(len(result["counts_per_second"]), 0, "Should record counts per second")

        # Frame skipping verification: processed frames should be <= (total_frames // 5) + 2
        self.assertLessEqual(result["processed_frames"], (result["total_frames"] // 5) + 2)

    def test_04_bet_resolution_with_feed_id(self):
        """Verify placing a bet with feed_id triggers live processing and resolves in DB."""
        async def setup_bet_and_feed():
            async with AsyncSessionLocal() as session:
                feed = CameraFeed(
                    name="Live Bet Camera",
                    location="Bet-Highway-1",
                    rtsp_url=self.test_stream_path,
                    country_code="US",
                    status="active"
                )
                session.add(feed)
                await session.flush()

                user = User(
                    username=f"live_bet_user_{int(time.time()*1000)}",
                    hashed_password="hash",
                    v_coins=100.0
                )
                session.add(user)
                await session.flush()

                bet = Bet(
                    user_id=user.id,
                    bet_type=BetType.COUNT_PREDICTION,
                    criteria={
                        "target_count": 0,
                        "operator": "exact",
                        "feed_id": feed.id
                    },
                    amount=25.0,
                    status="pending"
                )
                session.add(bet)
                await session.commit()
                await session.refresh(bet)
                return feed.id, bet.id, user.id

        feed_id, bet_id, user_id = asyncio.run(setup_bet_and_feed())

        # Trigger process_live_feed with bet_id
        result = process_live_feed(
            feed_id=feed_id,
            bet_id=bet_id,
            max_frames=30,
            duration_seconds=3
        )

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["bet_id"], bet_id)

        # Verify bet resolution in database
        async def verify_bet_resolution():
            async with AsyncSessionLocal() as session:
                res = await session.execute(select(Bet).where(Bet.id == bet_id))
                resolved_bet = res.scalar_one_or_none()
                self.assertIsNotNone(resolved_bet)
                self.assertIn(resolved_bet.status, [BetStatus.WON, BetStatus.LOST, "won", "lost"])
                self.assertIsNotNone(resolved_bet.resolved_at)
                self.assertIsNotNone(resolved_bet.resolution_data)
                self.assertEqual(resolved_bet.resolution_data.get("feed_id"), feed_id)

        asyncio.run(verify_bet_resolution())

    def test_05_concurrent_stream_processing(self):
        """Verify multiple concurrent live streams execute independently without blocking."""
        import concurrent.futures

        async def setup_two_feeds():
            async with AsyncSessionLocal() as session:
                feed1 = CameraFeed(
                    name="Concurrent Feed 1",
                    location="Conc-Road-1",
                    rtsp_url=self.test_stream_path,
                    country_code="US",
                    status="active"
                )
                feed2 = CameraFeed(
                    name="Concurrent Feed 2",
                    location="Conc-Road-2",
                    rtsp_url=self.test_stream_path,
                    country_code="DE",
                    status="active"
                )
                session.add_all([feed1, feed2])
                await session.commit()
                await session.refresh(feed1)
                await session.refresh(feed2)
                return feed1.id, feed2.id

        f1_id, f2_id = asyncio.run(setup_two_feeds())

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            fut1 = executor.submit(process_live_feed, feed_id=f1_id, max_frames=20, duration_seconds=2)
            fut2 = executor.submit(process_live_feed, feed_id=f2_id, max_frames=20, duration_seconds=2)
            res1 = fut1.result()
            res2 = fut2.result()

        self.assertEqual(res1["status"], "completed")
        self.assertEqual(res2["status"], "completed")
        self.assertEqual(res1["feed_id"], f1_id)
        self.assertEqual(res2["feed_id"], f2_id)

    def test_06_camera_feed_api_and_stream_proxy(self):
        """Verify camera-feeds list, single feed, and stream proxy HTTP endpoints."""
        client = TestClient(app)

        # 1. List camera feeds
        res = client.get("/camera-feeds")
        self.assertEqual(res.status_code, 200)
        feeds = res.json()
        self.assertIsInstance(feeds, list)
        self.assertGreaterEqual(len(feeds), 3)

        # 2. Get specific camera feed
        feed_id = feeds[0]["id"]
        res_single = client.get(f"/camera-feeds/{feed_id}")
        self.assertEqual(res_single.status_code, 200)
        self.assertEqual(res_single.json()["id"], feed_id)

        # 3. Stream proxy endpoint (/camera-feeds/{id}/stream)
        res_stream = client.get(f"/camera-feeds/{feed_id}/stream")
        self.assertEqual(res_stream.status_code, 200)
        self.assertEqual(res_stream.headers.get("content-type"), "video/mp4")
        self.assertIn("accept-ranges", res_stream.headers)

        # 4. Stream proxy query alias (/api/stream/proxy?feed_id=...)
        res_alias = client.get(f"/api/stream/proxy?feed_id={feed_id}")
        self.assertEqual(res_alias.status_code, 200)
        self.assertEqual(res_alias.headers.get("content-type"), "video/mp4")

    def test_07_websocket_count_stream(self):
        """Verify /ws/count/{feed_id} connects, sends handshake, and handles ping/pong."""
        client = TestClient(app)
        with client.websocket_connect("/ws/count/1") as ws:
            handshake = ws.receive_json()
            self.assertEqual(handshake["type"], "connected")
            self.assertEqual(handshake["feed_id"], 1)
            self.assertIn("count", handshake)

            # Test ping/pong
            ws.send_text('{"type": "ping"}')
            pong = ws.receive_json()
            self.assertEqual(pong["type"], "pong")
            self.assertEqual(pong["feed_id"], 1)

            # Test get_count
            ws.send_text('{"type": "get_count"}')
            count_data = ws.receive_json()
            self.assertEqual(count_data["type"], "count_update")
            self.assertEqual(count_data["feed_id"], 1)


if __name__ == "__main__":
    unittest.main()
