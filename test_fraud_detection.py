import unittest
import asyncio
import time
from fastapi.testclient import TestClient
from main import app
import models
from database import AsyncSessionLocal
from fraud_detection import fraud_service, FraudDetectionService
from sqlalchemy import select

class TestFraudDetection(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        fraud_service.clear_logs()

    def test_01_win_over_1000_triggers_flag(self):
        """Rule 1: Instant win > 1,000 flags user as Suspicious."""
        loop = asyncio.new_event_loop()
        res_small = loop.run_until_complete(
            fraud_service.record_win(user_id="test_win_user", win_amount=500.0, username="test_win_user")
        )
        self.assertFalse(res_small["is_suspicious"])
        self.assertFalse(res_small["flagged"])

        res_large = loop.run_until_complete(
            fraud_service.record_win(user_id="test_win_user", win_amount=1500.0, username="test_win_user")
        )
        loop.close()
        self.assertTrue(res_large["is_suspicious"])
        self.assertTrue(res_large["flagged"])
        self.assertIn("1,500", res_large["reason"])

    def test_02_more_than_10_bets_per_minute_triggers_flag(self):
        """Rule 2: >10 bets in 1 minute flags user as Suspicious."""
        loop = asyncio.new_event_loop()
        test_uid = f"rapid_user_{int(time.time())}"

        # Bets 1 to 10 should not flag
        for i in range(1, 11):
            r = loop.run_until_complete(
                fraud_service.record_bet(user_id=test_uid, amount=10.0, username=test_uid)
            )
            self.assertFalse(r["is_suspicious"], f"Bet {i} should not be flagged")

        # 11th bet triggers flag!
        r_11 = loop.run_until_complete(
            fraud_service.record_bet(user_id=test_uid, amount=10.0, username=test_uid)
        )
        loop.close()
        self.assertTrue(r_11["is_suspicious"])
        self.assertTrue(r_11["flagged"])
        self.assertEqual(r_11["recent_bets_count"], 11)
        self.assertIn(">10", r_11["reason"])

    def test_03_fraud_check_api_endpoint(self):
        """Test POST /fraud-detector-api/check endpoint for win and bet."""
        # Win check over 1000
        res = self.client.post("/fraud-detector-api/check", json={
            "action": "win",
            "amount": 2500.0,
            "userId": "api_test_winner",
            "username": "api_test_winner"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["isSuspicious"])
        self.assertTrue(data["flagged"])
        self.assertIn("2,500", data["reason"])

        # Bet check
        res_bet = self.client.post("/fraud-detector-api/check", json={
            "action": "bet",
            "amount": 50.0,
            "userId": "api_test_bettor"
        })
        self.assertEqual(res_bet.status_code, 200)
        self.assertFalse(res_bet.json()["isSuspicious"])

    def test_04_fraud_alerts_listing(self):
        """Test GET /fraud-detector-api/alerts returns generated alerts."""
        res = self.client.get("/fraud-detector-api/alerts")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("alerts", data)
        self.assertGreaterEqual(data["count"], 1)

    def test_05_admin_ban_and_unban_flow(self):
        """Test admin ban and unban action endpoints."""
        ban_res = self.client.post("/api/admin/ban", json={"userId": "1", "action": "ban"})
        self.assertEqual(ban_res.status_code, 200)
        self.assertTrue(ban_res.json()["isBanned"])

        unban_res = self.client.post("/api/admin/ban", json={"userId": "1", "action": "unban"})
        self.assertEqual(unban_res.status_code, 200)
        self.assertFalse(unban_res.json()["isBanned"])

    def test_06_admin_analytics_endpoint(self):
        """Test GET /api/admin/analytics returns revenue and map locations."""
        res = self.client.get("/api/admin/analytics")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("revenue", data)
        self.assertIn("mapLocations", data)
        self.assertIn("dailyRevenueSeries", data)
        self.assertGreaterEqual(len(data["mapLocations"]), 3)

if __name__ == "__main__":
    unittest.main()
