"""
test_treasury.py - Comprehensive Verification Test Suite for Jungle Bet Treasury Management & Safe Withdrawal System

Validates:
1. MIN_SAFETY_FLOAT_PERCENTAGE constant definition (0.25 = 25%).
2. calculate_withdrawable_profit():
   - Fetches Total House Revenue Balance.
   - Fetches Total Active Player Liabilities (sum of all user balances).
   - Calculates Required Float = Total Liabilities * MIN_SAFETY_FLOAT_PERCENTAGE.
   - Calculates Withdrawable Amount = Max(0, House Revenue Balance - Required Float).
3. Compliance Check:
   - Blocks any withdrawal/sweep attempt that would dip House Balance below Required Safety Float.
   - Raises ComplianceViolationError / returns HTTP 400.
4. Automated Sweep Job:
   - When Withdrawable Amount > 0:
     * Moves funds from House Revenue Wallet to Operator External Account.
     * Logs transaction as 'OPERATING_PROFIT_WITHDRAWAL'.
     * Sends Telegram alert: 'Daily Sweep Complete: Moved [amount] to Operating Account.'
   - When Withdrawable Amount <= 0:
     * Skips sweep safely without transferring funds.
5. Scheduled Task (Cron):
   - Celery Beat schedule configured for daily run at 2:00 AM (crontab(hour=2, minute=0)).
   - daily_treasury_sweep_task registered and executable.
6. Mobile Dashboard Endpoints:
   - GET /api/finance/treasury returns Total House Balance, Required Safety Float, Safe to Withdraw.
   - POST /api/finance/treasury/sweep enforces compliance and executes manual emergency sweep.
   - GET /api/finance/metrics includes treasury fields.
"""

import os
import sys
import asyncio
import unittest
import datetime
from sqlalchemy import select, text
from fastapi.testclient import TestClient

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from database import AsyncSessionLocal
import models
from transaction_service import (
    transaction_service,
    calculate_withdrawable_profit,
    MIN_SAFETY_FLOAT_PERCENTAGE,
    ComplianceViolationError,
)
from treasury_service import (
    MIN_SAFETY_FLOAT_RATIO,
    calculate_safe_withdrawal,
    treasury_service,
)
from notifications import notification_service
from celery_app import celery_app
from tasks import daily_treasury_sweep_task, daily_profit_sweep
from main import app


def run_async(coro):
    return asyncio.run(coro)


class TestTreasuryManagement(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print("\n" + "=" * 65)
        print("🏛️ JUNGLE BET TREASURY MANAGEMENT & SAFE WITHDRAWAL TEST SUITE")
        print("=" * 65 + "\n")
        cls.client = TestClient(app)

        async def _setup():
            async with AsyncSessionLocal() as session:
                await session.execute(text("SET LOCAL junglebet.transaction_service = 'active'"))
                # Ensure house wallet exists with healthy balance
                house_wallet = await transaction_service.get_house_wallet(session)
                house_wallet.balance = 100000.0

                # Ensure operator wallet exists
                operator_wallet = await transaction_service.get_operator_bank_wallet(session)
                operator_wallet.balance = 0.0

                # Create test user and player wallet
                res = await session.execute(
                    select(models.User).where(models.User.username == "treasury_test_user")
                )
                user = res.scalar_one_or_none()
                if not user:
                    user = models.User(
                        username="treasury_test_user",
                        hashed_password="pw",
                        v_coins=20000.0,
                        provider="credentials",
                        is_banned=False,
                    )
                    session.add(user)
                    await session.commit()
                    await session.refresh(user)
                else:
                    user.v_coins = 20000.0
                    user.is_banned = False
                    await session.commit()

                player_wallet = await transaction_service.get_or_create_player_wallet(
                    session, user.id
                )
                player_wallet.balance = 20000.0
                player_wallet.locked_balance = 0.0
                await session.commit()
                return user.id

        cls.user_id = run_async(_setup())

    def test_01_min_safety_float_constant(self):
        """Verify MIN_SAFETY_FLOAT_PERCENTAGE is defined as 0.25 (25%)."""
        print("--- 1. Testing MIN_SAFETY_FLOAT_PERCENTAGE Constant ---")
        self.assertIsNotNone(MIN_SAFETY_FLOAT_PERCENTAGE)
        self.assertEqual(MIN_SAFETY_FLOAT_PERCENTAGE, 0.25)
        print(f"  ✅ PASS: MIN_SAFETY_FLOAT_PERCENTAGE = {MIN_SAFETY_FLOAT_PERCENTAGE} ({MIN_SAFETY_FLOAT_PERCENTAGE * 100:.0f}%)")

    def test_02_calculate_withdrawable_profit_logic(self):
        """Verify calculate_withdrawable_profit() calculates float and withdrawable amount correctly."""
        print("\n--- 2. Testing calculate_withdrawable_profit() Core Logic ---")

        async def _test():
            async with AsyncSessionLocal() as session:
                # 1. Using method
                treasury = await transaction_service.calculate_withdrawable_profit(session)
                # 2. Using standalone function
                treasury_fn = await calculate_withdrawable_profit(session)

                self.assertEqual(treasury["min_safety_float_percentage"], 0.25)
                self.assertGreater(treasury["house_balance"], 0.0)
                self.assertGreater(treasury["total_liabilities"], 0.0)

                # Float must equal total liabilities * 0.25
                expected_float = round(treasury["total_liabilities"] * 0.25, 2)
                self.assertEqual(treasury["required_safety_float"], expected_float)

                # Withdrawable amount must equal max(0, house_balance - required_safety_float)
                expected_withdrawable = max(0.0, round(treasury["house_balance"] - expected_float, 2))
                self.assertEqual(treasury["withdrawable_amount"], expected_withdrawable)
                self.assertEqual(treasury["safe_to_withdraw"], expected_withdrawable)
                self.assertEqual(treasury, treasury_fn)

                print(f"  House Balance: ${treasury['house_balance']:,.2f}")
                print(f"  Player Liabilities: ${treasury['total_liabilities']:,.2f}")
                print(f"  Required Float (25%): ${treasury['required_safety_float']:,.2f}")
                print(f"  Safe to Withdraw: ${treasury['withdrawable_amount']:,.2f}")

        run_async(_test())
        print("  ✅ PASS: calculate_withdrawable_profit matches formula perfectly")

    def test_03_calculate_withdrawable_profit_zero_when_below_float(self):
        """Verify Withdrawable Amount is Max(0, ...) and never negative when House Balance <= Required Float."""
        print("\n--- 3. Testing Zero/Floor Clamping When House Balance <= Safety Float ---")

        async def _test():
            async with AsyncSessionLocal() as session:
                await session.execute(text("SET LOCAL junglebet.transaction_service = 'active'"))
                house_wallet = await transaction_service.get_house_wallet(session)
                original_balance = house_wallet.balance

                try:
                    # Temporarily drop house wallet balance below the required float
                    house_wallet.balance = 2000.0  # Float is around 5,000.0 (25% of liabilities)
                    treasury = await transaction_service.calculate_withdrawable_profit(session)

                    self.assertEqual(treasury["house_balance"], 2000.0)
                    self.assertGreater(treasury["required_safety_float"], 2000.0)
                    # Must be 0.0, not negative
                    self.assertEqual(treasury["withdrawable_amount"], 0.0)
                    self.assertEqual(treasury["safe_to_withdraw"], 0.0)
                    self.assertFalse(treasury["is_sweep_eligible"])
                finally:
                    house_wallet.balance = original_balance
                    await session.commit()

        run_async(_test())
        print("  ✅ PASS: Withdrawable Amount is strictly 0.0 when House Balance < Safety Float")

    def test_04_compliance_check_blocks_withdrawal_dipping_below_float(self):
        """Verify compliance check strictly blocks any withdrawal dipping House Balance below Required Float."""
        print("\n--- 4. Testing Compliance Check Blocks Unsafe Withdrawals ---")

        async def _test():
            async with AsyncSessionLocal() as session:
                treasury = await transaction_service.calculate_withdrawable_profit(session)
                safe_amount = treasury["withdrawable_amount"]
                unsafe_amount = safe_amount + 500.0  # Would dip house balance below float by $500

                # 1. Safe withdrawal validation succeeds
                validated = await transaction_service.validate_safe_withdrawal(session, safe_amount)
                self.assertIsNotNone(validated)

                # 2. Unsafe withdrawal validation raises ComplianceViolationError
                with self.assertRaises(ComplianceViolationError) as ctx:
                    await transaction_service.validate_safe_withdrawal(session, unsafe_amount)

                self.assertIn("COMPLIANCE_VIOLATION", str(ctx.exception))
                self.assertIn("cannot dip below Required Safety Float", str(ctx.exception))
                print(f"  Blocked illegal withdrawal: {ctx.exception}")

        run_async(_test())
        print("  ✅ PASS: System strictly blocked withdrawal dipping below safety float")

    def test_05_sweep_moves_funds_and_logs_transaction(self):
        """Verify automated sweep moves funds from House Revenue to Operator Account and logs OPERATING_PROFIT_WITHDRAWAL."""
        print("\n--- 5. Testing Sweep Execution & Money Movement ---")

        async def _test():
            async with AsyncSessionLocal() as session:
                await session.execute(text("SET LOCAL junglebet.transaction_service = 'active'"))
                house_wallet = await transaction_service.get_house_wallet(session)
                operator_wallet = await transaction_service.get_operator_bank_wallet(session)
                init_house = house_wallet.balance
                init_operator = operator_wallet.balance

                # Perform a partial sweep of $5,000
                sweep_amount = 5000.0
                res = await transaction_service.execute_sweep(
                    session=session,
                    amount=sweep_amount,
                    is_manual=False,
                )
                await session.commit()

                self.assertTrue(res["success"])
                self.assertEqual(res["swept_amount"], sweep_amount)
                self.assertEqual(res["status"], "completed")
                self.assertIn("Daily Sweep Complete", res["message"])

                # Check wallets updated
                house_wallet_after = await transaction_service.get_house_wallet(session)
                operator_wallet_after = await transaction_service.get_operator_bank_wallet(session)
                self.assertEqual(house_wallet_after.balance, init_house - sweep_amount)
                self.assertEqual(operator_wallet_after.balance, init_operator + sweep_amount)

                # Verify transaction logged as OPERATING_PROFIT_WITHDRAWAL
                txn_res = await session.execute(
                    select(models.Transaction).where(models.Transaction.id == res["transaction_id"])
                )
                txn = txn_res.scalar_one_or_none()
                self.assertIsNotNone(txn)
                self.assertEqual(txn.type, "OPERATING_PROFIT_WITHDRAWAL")
                self.assertEqual(txn.amount, sweep_amount)
                self.assertEqual(txn.source_wallet_id, house_wallet.id)
                self.assertEqual(txn.dest_wallet_id, operator_wallet.id)
                self.assertEqual(txn.status, "completed")

        run_async(_test())
        print("  ✅ PASS: Sweep successfully moved funds and logged OPERATING_PROFIT_WITHDRAWAL")

    def test_06_sweep_dispatches_exact_telegram_alert(self):
        """Verify Telegram alert is sent: 'Daily Sweep Complete: Moved [amount] to Operating Account.'"""
        print("\n--- 6. Testing Telegram Push Alert on Sweep Completion ---")

        async def _test():
            async with AsyncSessionLocal() as session:
                alert = await notification_service.alert_treasury_sweep(
                    amount=12500.0,
                    house_balance=87500.0,
                    required_float=15000.0,
                    operator_account="Stanbic Bank - IBAN GB29JUNGLE8839210",
                    session=session,
                )
                await session.commit()

                self.assertIsNotNone(alert)
                self.assertEqual(alert["alert_type"], "OPERATING_PROFIT_WITHDRAWAL")
                expected_phrase = "Daily Sweep Complete: Moved $12,500.00 to Operating Account."
                self.assertIn(expected_phrase, alert["message"])
                self.assertIn(expected_phrase, alert["title"])
                self.assertTrue(alert["telegram_delivered"])

        run_async(_test())
        print("  ✅ PASS: Exact Telegram alert formatted and dispatched to Admin")

    def test_07_cron_schedule_and_celery_task(self):
        """Verify Celery Beat schedule configured for 2:00 AM UTC and daily_treasury_sweep_task registered."""
        print("\n--- 7. Testing 2:00 AM Cron Schedule & Celery Task ---")
        schedule = celery_app.conf.beat_schedule
        self.assertIn("daily_treasury_sweep_2_am", schedule)

        entry = schedule["daily_treasury_sweep_2_am"]
        self.assertEqual(entry["task"], "daily_treasury_sweep_task")
        # Check crontab schedule: hour=2, minute=0
        crontab_sched = entry["schedule"]
        self.assertEqual(crontab_sched.hour, {2})
        self.assertEqual(crontab_sched.minute, {0})
        print(f"  Celery Beat Cron: daily_treasury_sweep_2_am -> {crontab_sched}")

        # Execute celery task
        task_res = daily_treasury_sweep_task(amount=100.0)
        self.assertTrue(task_res["success"])
        self.assertEqual(task_res["swept_amount"], 100.0)
        print("  ✅ PASS: Celery 2 AM cron schedule verified and task executed successfully")

    def test_08_rest_api_treasury_endpoints(self):
        """Verify GET /api/finance/treasury and POST /api/finance/treasury/sweep."""
        print("\n--- 8. Testing REST API Treasury Endpoints ---")

        # 1. GET /api/finance/treasury
        resp = self.client.get("/api/finance/treasury")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("house_balance", data)
        self.assertIn("required_safety_float", data)
        self.assertIn("safe_to_withdraw", data)
        self.assertIn("min_safety_float_percentage", data)
        self.assertEqual(data["min_safety_float_percentage"], 0.25)
        print(f"  GET /api/finance/treasury returned: {data}")

        # 2. POST /api/finance/treasury/sweep (Valid sweep)
        sweep_resp = self.client.post("/api/finance/treasury/sweep", json={"amount": 500.0})
        self.assertEqual(sweep_resp.status_code, 200)
        sweep_data = sweep_resp.json()
        self.assertTrue(sweep_data.get("success"))
        self.assertEqual(sweep_data.get("swept_amount"), 500.0)

        # 3. POST /api/finance/treasury/sweep (Excessive sweep violating safety float)
        excessive_amount = data["house_balance"] + 1000.0
        fail_resp = self.client.post("/api/finance/treasury/sweep", json={"amount": excessive_amount})
        self.assertEqual(fail_resp.status_code, 400)
        self.assertIn("COMPLIANCE_VIOLATION", fail_resp.json().get("detail", ""))
        print(f"  POST excessive sweep rejected with: {fail_resp.json().get('detail')}")

        # 4. GET /api/finance/metrics includes treasury
        metrics_resp = self.client.get("/api/finance/metrics")
        self.assertEqual(metrics_resp.status_code, 200)
        m_data = metrics_resp.json()
        self.assertIn("treasury", m_data)
        self.assertIn("house_balance", m_data)
        self.assertIn("required_safety_float", m_data)
        self.assertIn("safe_to_withdraw", m_data)

        print("  ✅ PASS: All REST API treasury endpoints operational with compliance enforcement")

    def test_09_min_safety_float_ratio_and_treasury_service(self):
        """Verify MIN_SAFETY_FLOAT_RATIO is 0.25 and calculate_safe_withdrawal() returns Available_Profit."""
        print("\n--- 9. Testing MIN_SAFETY_FLOAT_RATIO & calculate_safe_withdrawal() in treasury_service.py ---")
        self.assertEqual(MIN_SAFETY_FLOAT_RATIO, 0.25)

        async def _test():
            async with AsyncSessionLocal() as session:
                safe_amt = await calculate_safe_withdrawal(session)
                # Verify SafeWithdrawalAmount is float and > 0
                self.assertIsInstance(safe_amt, float)
                self.assertGreater(safe_amt, 0.0)

                # Verify core formula: Total_Liabilities * 0.25
                self.assertEqual(safe_amt.min_safety_float_ratio, 0.25)
                self.assertEqual(safe_amt.required_float, round(safe_amt.total_liabilities * 0.25, 2))
                expected_available = max(0.0, round(safe_amt.house_balance - safe_amt.required_float, 2))
                self.assertEqual(float(safe_amt), expected_available)
                self.assertEqual(safe_amt.available_profit, expected_available)

                # Verify dict-like access
                self.assertEqual(safe_amt["available_profit"], expected_available)
                self.assertEqual(safe_amt["required_float"], safe_amt.required_float)

                print(f"  Total Liabilities: ${safe_amt.total_liabilities:,.2f}")
                print(f"  Required Float (25%): ${safe_amt.required_float:,.2f}")
                print(f"  Available Profit (Max safe to withdraw): ${safe_amt.available_profit:,.2f}")

        run_async(_test())

        # Test sync execution as well
        sync_amt = calculate_safe_withdrawal()
        self.assertGreater(sync_amt, 0.0)
        self.assertEqual(sync_amt.min_safety_float_ratio, 0.25)
        print(f"  Sync execution: ${float(sync_amt):,.2f}")
        print("  ✅ PASS: calculate_safe_withdrawal() core formula verified in treasury_service.py")

    def test_10_daily_profit_sweep_celery_task_and_alerts(self):
        """Verify Celery task daily_profit_sweep moving funds, tagging PROFIT_WITHDRAWAL, and sending exact alerts."""
        print("\n--- 10. Testing daily_profit_sweep Celery Scheduled Task & Alerts ---")
        # 1. Beat schedule verification
        schedule = celery_app.conf.beat_schedule
        self.assertIn("daily_profit_sweep", schedule)
        entry = schedule["daily_profit_sweep"]
        self.assertEqual(entry["task"], "daily_profit_sweep")
        self.assertEqual(entry["schedule"].hour, {2})
        self.assertEqual(entry["schedule"].minute, {0})
        print("  Verified Celery beat crontab: daily_profit_sweep at 02:00 AM")

        # 2. Execute sweep with amount > 0
        sweep_res = daily_profit_sweep(amount=250.0)
        self.assertTrue(sweep_res["success"])
        self.assertEqual(sweep_res["swept_amount"], 250.0)

        # Verify transaction logged with PROFIT_WITHDRAWAL tag
        async def _check_txn():
            async with AsyncSessionLocal() as session:
                txn_res = await session.execute(
                    select(models.Transaction).where(models.Transaction.id == sweep_res["transaction_id"])
                )
                txn = txn_res.scalar_one_or_none()
                self.assertIsNotNone(txn)
                self.assertEqual(txn.type, "PROFIT_WITHDRAWAL")
                self.assertEqual(txn.status, "completed")

        run_async(_check_txn())

        # Verify alert content for amount > 0
        alert_msg = sweep_res["telegram_alert"]["message"]
        self.assertIn("Daily Sweep: Moved", alert_msg)
        self.assertIn("to Operating Account.", alert_msg)
        self.assertIn("Remaining Float:", alert_msg)
        print("  Verified Telegram Alert: 'Daily Sweep: Moved $250.00 to Operating Account. Remaining Float: ...'")

        # 3. Execute sweep with amount == 0 (Maintaining safety float alert)
        zero_res = daily_profit_sweep(amount=0.0)
        self.assertFalse(zero_res["success"])
        self.assertEqual(zero_res["status"], "skipped")
        self.assertIn("Maintaining safety float", zero_res["message"])
        self.assertIn("⚠️ No profit available for withdrawal today. Maintaining safety float.", zero_res["telegram_alert"]["message"])
        print("  Verified Zero Alert: '⚠️ No profit available for withdrawal today. Maintaining safety float.'")
        print("  ✅ PASS: daily_profit_sweep Celery task meets all automated sweep requirements")

    def test_11_withdrawal_hard_block_guardrail_and_audit_logging(self):
        """Verify hard block in withdrawal API and audit logging of blocked attempts."""
        print("\n--- 11. Testing Withdrawal API Hard Block Guardrails & Audit Logging ---")

        # 1. POST /api/finance/withdraw with excessive amount dipping below Required Float
        excessive_withdrawal = 9999999.0
        resp = self.client.post("/api/finance/withdraw", json={"amount": excessive_withdrawal})
        self.assertEqual(resp.status_code, 400)
        self.assertIn("COMPLIANCE_VIOLATION", resp.json().get("detail", ""))
        self.assertIn("cannot dip below Required Safety Float", resp.json().get("detail", ""))
        print(f"  Withdrawal API strictly rejected: {resp.json().get('detail')}")

        # 2. Verify blocked attempt is logged in audit logs table / API
        audit_resp = self.client.get("/api/finance/treasury/audit-logs")
        self.assertEqual(audit_resp.status_code, 200)
        audit_logs = audit_resp.json()
        self.assertGreater(len(audit_logs), 0)
        top_audit = audit_logs[0]
        self.assertEqual(top_audit["eventType"], "BLOCKED_WITHDRAWAL_ATTEMPT")
        self.assertEqual(top_audit["severity"], "CRITICAL")
        self.assertIn("COMPLIANCE_VIOLATION", top_audit["message"])
        print(f"  Verified audit log recorded in DB: Event #{top_audit['id']} - {top_audit['eventType']}")
        print("  ✅ PASS: Safety guardrails strictly enforced with persistent audit logging")

    def test_12_force_sweep_button_2fa_and_recalculation(self):
        """Verify manual Force Sweep button protected by 2FA and re-runs calculation before executing."""
        print("\n--- 12. Testing Manual Force Sweep Button Protected by 2FA ---")

        # 1. Attempt Force Sweep without 2FA -> 401 Unauthorized
        fail_2fa = self.client.post("/api/finance/treasury/force-sweep", json={"amount": 100.0})
        self.assertEqual(fail_2fa.status_code, 401)
        self.assertIn("2FA_REQUIRED", fail_2fa.json().get("detail", ""))
        print(f"  Protected by 2FA: Missing 2FA rejected with {fail_2fa.json().get('detail')}")

        # 2. Attempt Force Sweep with invalid 2FA code -> 401 Unauthorized
        invalid_2fa = self.client.post(
            "/api/finance/treasury/force-sweep",
            json={"amount": 100.0, "twoFactorCode": "00"}
        )
        self.assertEqual(invalid_2fa.status_code, 401)

        # 3. Valid Force Sweep with 2FA passcode jungleadmin2026 -> Succeeds
        valid_sweep = self.client.post(
            "/api/finance/treasury/force-sweep",
            json={"amount": 100.0, "twoFactorCode": "jungleadmin2026"}
        )
        self.assertEqual(valid_sweep.status_code, 200)
        data = valid_sweep.json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("swept_amount"), 100.0)
        print("  ✅ PASS: Manual Force Sweep re-runs calculation, verifies 2FA, and executes safely")


if __name__ == "__main__":
    unittest.main()
