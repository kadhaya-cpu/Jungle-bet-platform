"""
test_financial_core.py - Full Verification Test Suite for RUSH HOUR BET Financial Core & Mobile Monitoring

Validates:
1. Wallet Segregation (PLAYER vs HOUSE_REVENUE)
2. Direct SQL Update Prevention via Trigger
3. Strict Transaction Service & processBet Money Movement Logic:
   a. Locks user stake from PLAYER wallet.
   b. Loss: Moves stake to HOUSE_REVENUE wallet.
   c. Win: Moves (stake * odds) from HOUSE_REVENUE to PLAYER wallet.
4. Daily Settlement Job (calculates net profit, prepares operator bank transfer)
5. Real-Time Alerts (High win > $1,000, profit target, fraud trigger, 11:59 PM summary)
6. Financial Metrics & Admin Ban API endpoints
"""

import os
import sys
import asyncio
import unittest
import datetime
from sqlalchemy import select, text

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from database import AsyncSessionLocal
import models
from transaction_service import transaction_service
from notifications import notification_service
from fastapi.testclient import TestClient
from main import app


def run_async(coro):
    return asyncio.run(coro)


class TestFinancialCore(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print("\n" + "=" * 65)
        print("🏦 RUSH HOUR BET FINANCIAL CORE & MOBILE MONITORING TEST SUITE")
        print("=" * 65 + "\n")
        cls.client = TestClient(app)

        # Setup test user in database
        async def _setup_user():
            async with AsyncSessionLocal() as session:
                res = await session.execute(
                    select(models.User).where(models.User.username == "fin_test_user")
                )
                user = res.scalar_one_or_none()
                if not user:
                    user = models.User(
                        username="fin_test_user",
                        hashed_password="hashed_password_123",
                        v_coins=500.0,
                        provider="credentials",
                        providerAccountId="fin_test_user",
                        is_flagged=True,
                        flag_reason="Simulated test flag",
                        is_banned=False,
                    )
                    session.add(user)
                    await session.commit()
                    await session.refresh(user)
                else:
                    user.v_coins = 500.0
                    user.is_flagged = True
                    user.flag_reason = "Simulated test flag"
                    user.is_banned = False
                    await session.commit()
                return user.id

        cls.user_id = run_async(_setup_user())

    def test_01_wallet_segregation_and_types(self):
        """Verify existence of segregated PLAYER and HOUSE_REVENUE wallets."""
        print("--- 1. Testing Wallet Segregation & Types ---")

        async def _test():
            async with AsyncSessionLocal() as session:
                player_wallet = await transaction_service.get_or_create_player_wallet(
                    session, self.user_id
                )
                house_wallet = await transaction_service.get_house_wallet(session)
                await session.commit()

                self.assertIsNotNone(player_wallet)
                self.assertEqual(player_wallet.type, models.WalletType.PLAYER.value)
                self.assertEqual(player_wallet.user_id, self.user_id)

                self.assertIsNotNone(house_wallet)
                self.assertEqual(house_wallet.type, models.WalletType.HOUSE_REVENUE.value)
                self.assertIsNone(house_wallet.user_id)
                self.assertGreaterEqual(house_wallet.balance, 0.0)

        run_async(_test())
        print("  ✅ PASS: PLAYER and HOUSE_REVENUE wallets segregated correctly")

    def test_02_direct_sql_update_prevention(self):
        """Verify that direct SQL updates to wallet balance are rejected by trigger."""
        print("\n--- 2. Testing Direct SQL Update Prevention ---")

        async def _test():
            async with AsyncSessionLocal() as session:
                house_wallet = await transaction_service.get_house_wallet(session)
                direct_sql_failed = False
                try:
                    # Attempt unauthorized direct SQL update on wallet balance
                    await session.execute(
                        text(f"UPDATE wallets SET balance = balance + 100 WHERE id = {house_wallet.id}")
                    )
                    await session.commit()
                except Exception as e:
                    direct_sql_failed = True
                    err_msg = str(e)
                    self.assertIn("DIRECT_UPDATE_FORBIDDEN", err_msg)
                    await session.rollback()

                self.assertTrue(
                    direct_sql_failed,
                    "Direct SQL balance update should have been blocked by trigger",
                )

        run_async(_test())
        print("  ✅ PASS: Direct SQL balance update strictly blocked by database trigger")

    def test_03_transaction_service_deposit_and_withdraw(self):
        """Verify deposits and withdrawals work via transaction_service with ledger."""
        print("\n--- 3. Testing Deposits & Withdrawals via Transaction Service ---")

        async def _test():
            async with AsyncSessionLocal() as session:
                # 1. Deposit
                pw, txn_dep = await transaction_service.deposit(
                    session, self.user_id, 200.0, description="Test Deposit"
                )
                self.assertEqual(txn_dep.type, "deposit")
                self.assertEqual(txn_dep.amount, 200.0)
                self.assertEqual(txn_dep.status, "completed")
                bal_after_dep = pw.balance

                # 2. Withdraw
                pw, txn_with = await transaction_service.withdraw(
                    session, self.user_id, 50.0, description="Test Withdrawal"
                )
                self.assertEqual(txn_with.type, "withdrawal")
                self.assertEqual(txn_with.amount, 50.0)
                self.assertEqual(pw.balance, bal_after_dep - 50.0)

                await session.commit()

        run_async(_test())
        print("  ✅ PASS: Deposit and withdrawal executed with double-entry audit records")

    def test_04_process_bet_lock_stake(self):
        """Verify processBet step a: locks user stake from PLAYER wallet."""
        print("\n--- 4. Testing processBet (Step A: Lock Stake) ---")

        async def _test():
            async with AsyncSessionLocal() as session:
                pw = await transaction_service.get_or_create_player_wallet(session, self.user_id)
                init_balance = pw.balance
                stake = 100.0

                res = await transaction_service.processBet(
                    session=session,
                    user_id=self.user_id,
                    stake=stake,
                    outcome="lock",
                    bet_id=777,
                )
                await session.commit()

                self.assertEqual(res["status"], "locked")
                self.assertEqual(res["player_balance"], init_balance - stake)
                self.assertEqual(res["locked_balance"], stake)

        run_async(_test())
        print("  ✅ PASS: Stake locked atomically from PLAYER wallet")

    def test_05_process_bet_loss_moves_to_house_revenue(self):
        """Verify processBet step b: user loss moves stake to HOUSE_REVENUE."""
        print("\n--- 5. Testing processBet (Step B: Lost Bet -> HOUSE_REVENUE) ---")

        async def _test():
            async with AsyncSessionLocal() as session:
                hw = await transaction_service.get_house_wallet(session)
                init_house_balance = hw.balance
                stake = 100.0

                res = await transaction_service.processBet(
                    session=session,
                    user_id=self.user_id,
                    stake=stake,
                    outcome="loss",
                    bet_id=777,
                )
                await session.commit()

                self.assertEqual(res["status"], "completed")
                self.assertEqual(res["house_revenue_transferred"], stake)
                self.assertEqual(res["house_bankroll"], init_house_balance + stake)

        run_async(_test())
        print("  ✅ PASS: Lost stake moved to HOUSE_REVENUE wallet")

    def test_06_process_bet_win_moves_from_house_to_player(self):
        """Verify processBet step c: user win moves (stake * odds) from HOUSE_REVENUE to PLAYER."""
        print("\n--- 6. Testing processBet (Step C: Won Bet -> Payout from HOUSE_REVENUE) ---")

        async def _test():
            async with AsyncSessionLocal() as session:
                stake = 50.0
                odds = 3.6  # Over 13 market multiplier
                payout = stake * odds  # 180.0

                # Lock stake first
                await transaction_service.processBet(
                    session=session,
                    user_id=self.user_id,
                    stake=stake,
                    outcome="lock",
                    bet_id=888,
                )

                pw = await transaction_service.get_or_create_player_wallet(session, self.user_id)
                hw = await transaction_service.get_house_wallet(session)
                init_pw_balance = pw.balance
                init_hw_balance = hw.balance

                # Resolve as WIN
                res = await transaction_service.processBet(
                    session=session,
                    user_id=self.user_id,
                    stake=stake,
                    odds=odds,
                    outcome="win",
                    bet_id=888,
                    username="fin_test_user",
                )
                await session.commit()

                self.assertEqual(res["status"], "completed")
                self.assertEqual(res["payout"], payout)
                self.assertEqual(res["player_balance"], init_pw_balance + payout)
                self.assertEqual(res["house_bankroll"], init_hw_balance - payout)

        run_async(_test())
        print("  ✅ PASS: Winning payout (stake * odds) moved from HOUSE_REVENUE to PLAYER wallet")

    def test_07_daily_settlement_calculation_and_bank_transfer(self):
        """Verify daily settlement job calculates net profit and prepares transfer."""
        print("\n--- 7. Testing Daily Settlement Job & Operator Bank Transfer ---")

        async def _test():
            async with AsyncSessionLocal() as session:
                today = datetime.date.today()
                report = await transaction_service.daily_settlement(
                    session=session,
                    settlement_date=today,
                    operator_bank_account="Stanbic Bank - IBAN GB29JUNGLE8839210",
                )
                await session.commit()

                self.assertIsNotNone(report)
                self.assertEqual(report["settlement_date"], today.isoformat())
                self.assertIn("net_profit", report)
                self.assertIn("house_bankroll", report)
                self.assertIn("total_liability", report)
                self.assertEqual(report["status"], "PREPARED_FOR_TRANSFER")
                self.assertTrue(report["transfer_reference"].startswith("SETTLE-"))
                self.assertEqual(report["operator_bank_account"], "Stanbic Bank - IBAN GB29JUNGLE8839210")

        run_async(_test())
        print("  ✅ PASS: Daily settlement calculated net profit and prepared operator bank transfer")

    def test_08_realtime_alerts_high_win_and_fraud(self):
        """Verify instant alerts when user wins > $1,000, profit target hit, fraud triggered."""
        print("\n--- 8. Testing Real-Time Alerts (High Win, Target, Fraud) ---")

        async def _test():
            async with AsyncSessionLocal() as session:
                # 1. High Win Alert (> $1,000)
                win_alert = await notification_service.alert_high_win(
                    username="fin_test_winner",
                    user_id=self.user_id,
                    win_amount=1800.0,  # > 1000 threshold
                    bet_id=991,
                    odds=18.0,
                    session=session,
                )
                self.assertIsNotNone(win_alert)
                self.assertEqual(win_alert["alert_type"], "HIGH_WIN")
                self.assertIn("1,800.00", win_alert["title"])

                # 2. Daily Profit Target Alert (e.g. $5,000)
                target_alert = await notification_service.check_and_alert_profit_target(
                    daily_profit=6200.0,
                    active_players=25,
                    house_bankroll=106200.0,
                    target=5000.0,
                    session=session,
                )
                self.assertIsNotNone(target_alert)
                self.assertEqual(target_alert["alert_type"], "PROFIT_TARGET_REACHED")

                # 3. Fraud Alert Trigger
                fraud_alert = await notification_service.alert_fraud(
                    username="fin_test_user",
                    user_id=self.user_id,
                    alert_type="RAPID_BETTING",
                    reason="Placed 12 bets in 60s sliding window",
                    severity="HIGH",
                    session=session,
                )
                self.assertIsNotNone(fraud_alert)
                self.assertEqual(fraud_alert["alert_type"], "FRAUD_ALERT")

                # 4. Daily Summary Report at 11:59 PM
                summary_alert = await notification_service.send_daily_summary_report(
                    {
                        "settlement_date": datetime.date.today().isoformat(),
                        "net_profit": 4200.0,
                        "total_turnover": 15000.0,
                        "total_payouts": 9800.0,
                        "total_losses": 14000.0,
                        "house_bankroll": 104200.0,
                        "total_liability": 12500.0,
                        "active_players": 18,
                        "operator_bank_account": "Stanbic Bank IBAN GB29JUNGLE8839210",
                        "status": "PREPARED_FOR_TRANSFER",
                    },
                    session=session,
                )
                self.assertIsNotNone(summary_alert)
                self.assertEqual(summary_alert["alert_type"], "DAILY_SUMMARY")

                await session.commit()

        run_async(_test())
        print("  ✅ PASS: All real-time alert types dispatched and recorded")

    def test_09_mobile_metrics_and_ban_endpoints(self):
        """Verify GET /api/finance/metrics and POST /api/admin/ban for mobile ops."""
        print("\n--- 9. Testing Mobile Monitoring API Endpoints ---")

        # 1. Metrics API
        resp = self.client.get("/api/finance/metrics")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("today_net_profit", data)
        self.assertIn("active_players", data)
        self.assertIn("total_liability", data)
        self.assertIn("house_bankroll", data)
        self.assertIn("recent_transactions", data)
        print("  ✅ PASS: /api/finance/metrics returned all 4 key mobile metrics")

        # 2. One-Click Ban API
        ban_resp = self.client.post(
            "/api/admin/ban",
            json={"userId": str(self.user_id), "action": "ban"},
        )
        self.assertEqual(ban_resp.status_code, 200)
        ban_data = ban_resp.json()
        self.assertTrue(ban_data.get("isBanned"))

        # Unban user
        unban_resp = self.client.post(
            "/api/admin/ban",
            json={"userId": str(self.user_id), "action": "unban"},
        )
        self.assertEqual(unban_resp.status_code, 200)
        unban_data = unban_resp.json()
        self.assertFalse(unban_data.get("isBanned"))
        print("  ✅ PASS: /api/admin/ban successfully enforced one-click ban and unban")


if __name__ == "__main__":
    unittest.main()
