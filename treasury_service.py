"""
treasury_service.py - Jungle Bet Treasury Management and Safe Withdrawal System

TREASURY LOGIC CORE:
- MIN_SAFETY_FLOAT_RATIO = 0.25 (25% safety float)
- calculate_safe_withdrawal():
  * Total_Liabilities = Sum of all active user wallet balances
  * Required_Float = Total_Liabilities * MIN_SAFETY_FLOAT_RATIO
  * Available_Profit = Max(0, House_Revenue_Wallet_Balance - Required_Float)
  * Returns Available_Profit as maximum safe amount to withdraw
- Hard block in withdrawal API: Rejects any withdrawal request where House_Revenue_Wallet < Required_Float
- Logs all blocked attempts for audit purposes
"""

import os
import sys
import time
import logging
import datetime
import asyncio
from typing import Dict, Any, Optional, Tuple, Union
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from database import AsyncSessionLocal
import models
from notifications import notification_service

logger = logging.getLogger("treasury_service")
logger.setLevel(logging.INFO)

# Global constants
MIN_SAFETY_FLOAT_RATIO: float = 0.25
MIN_SAFETY_FLOAT_PERCENTAGE: float = MIN_SAFETY_FLOAT_RATIO
OPERATOR_BANK_DEFAULT: str = os.getenv("OPERATOR_BANK_ACCOUNT", "Stanbic Bank - IBAN GB29JUNGLE8839210")


class ComplianceViolationError(Exception):
    """Raised when an operation would violate regulatory or treasury safety float compliance."""
    pass


class SafeWithdrawalAmount(float):
    """
    Subclass of float representing the calculated Available_Profit.
    Acts as a float for all numerical comparisons (e.g. `amount > 0`, `amount == 0`),
    and provides dictionary and attribute access for all treasury fields.
    """
    def __new__(
        cls,
        available_profit: float,
        total_liabilities: float = 0.0,
        required_float: float = 0.0,
        house_balance: float = 0.0,
        details: Optional[Dict[str, Any]] = None,
    ):
        obj = super().__new__(cls, float(available_profit))
        obj.available_profit = float(available_profit)
        obj.total_liabilities = float(total_liabilities)
        obj.required_float = float(required_float)
        obj.required_safety_float = float(required_float)
        obj.house_balance = float(house_balance)
        obj.house_revenue_wallet_balance = float(house_balance)
        obj.safe_to_withdraw = float(available_profit)
        obj.withdrawable_amount = float(available_profit)
        obj.min_safety_float_ratio = MIN_SAFETY_FLOAT_RATIO
        obj.min_safety_float_percentage = MIN_SAFETY_FLOAT_RATIO
        obj.is_sweep_eligible = available_profit > 0

        data = {
            "available_profit": float(available_profit),
            "safe_to_withdraw": float(available_profit),
            "withdrawable_amount": float(available_profit),
            "total_liabilities": float(total_liabilities),
            "required_float": float(required_float),
            "required_safety_float": float(required_float),
            "house_balance": float(house_balance),
            "house_revenue_wallet_balance": float(house_balance),
            "min_safety_float_ratio": MIN_SAFETY_FLOAT_RATIO,
            "min_safety_float_percentage": MIN_SAFETY_FLOAT_RATIO,
            "is_sweep_eligible": available_profit > 0,
            "operator_bank_account": OPERATOR_BANK_DEFAULT,
        }
        if details:
            data.update(details)
        obj._data = data
        return obj

    def __getitem__(self, item: str) -> Any:
        return self._data[item]

    def get(self, item: str, default: Any = None) -> Any:
        return self._data.get(item, default)

    def to_dict(self) -> Dict[str, Any]:
        return dict(self._data)

    def __repr__(self) -> str:
        return f"<SafeWithdrawalAmount: ${float(self):,.2f} (Liabilities: ${self.total_liabilities:,.2f}, Float: ${self.required_float:,.2f}, House: ${self.house_balance:,.2f})>"

    def __await__(self):
        async def _self():
            return self
        return _self().__await__()


class SafeWithdrawalAwaitable(float):
    """
    Lazy callable wrapper that supports both:
    1. `res = await calculate_safe_withdrawal(session)`
    2. `res = calculate_safe_withdrawal()` (synchronous evaluation)
    """
    def __new__(cls, coro_func, session=None):
        obj = super().__new__(cls, 0.0)
        obj._coro_func = coro_func
        obj._session = session
        obj._cached = None
        return obj

    def _get_sync(self) -> SafeWithdrawalAmount:
        if self._cached is None:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as pool:
                        self._cached = pool.submit(asyncio.run, self._coro_func(self._session)).result()
                else:
                    self._cached = loop.run_until_complete(self._coro_func(self._session))
            except RuntimeError:
                self._cached = asyncio.run(self._coro_func(self._session))
        return self._cached

    def __float__(self) -> float:
        return float(self._get_sync())

    def __gt__(self, other) -> bool:
        return float(self._get_sync()) > other

    def __ge__(self, other) -> bool:
        return float(self._get_sync()) >= other

    def __lt__(self, other) -> bool:
        return float(self._get_sync()) < other

    def __le__(self, other) -> bool:
        return float(self._get_sync()) <= other

    def __eq__(self, other) -> bool:
        return float(self._get_sync()) == other

    def __getitem__(self, item: str) -> Any:
        return self._get_sync()[item]

    def get(self, item: str, default: Any = None) -> Any:
        return self._get_sync().get(item, default)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._get_sync(), name)

    def to_dict(self) -> Dict[str, Any]:
        return self._get_sync().to_dict()

    def __repr__(self) -> str:
        return repr(self._get_sync())

    def __await__(self):
        return self._coro_func(self._session).__await__()


class TreasuryService:
    """
    Core Treasury Management Service:
    - Calculates required safety float and safe withdrawable profit
    - Enforces hard block guardrails against withdrawals below float
    - Logs all blocked withdrawal attempts for audit purposes
    - Executes automated and manual daily profit sweeps
    """

    async def _authorize_session(self, session: AsyncSession) -> None:
        """Authorize balance updates through the financial core trigger."""
        await session.execute(text("SET LOCAL junglebet.transaction_service = 'active'"))

    async def get_house_revenue_wallet(self, session: AsyncSession, currency: str = "USD") -> models.Wallet:
        """Fetch or initialize the central HOUSE_REVENUE bankroll wallet."""
        res = await session.execute(
            select(models.Wallet).where(models.Wallet.type == models.WalletType.HOUSE_REVENUE.value)
        )
        wallet = res.scalars().first()
        if not wallet:
            await self._authorize_session(session)
            wallet = models.Wallet(
                id=1,
                user_id=None,
                type=models.WalletType.HOUSE_REVENUE.value,
                currency=currency,
                balance=100000.0,
                locked_balance=0.0,
                status="active",
            )
            session.add(wallet)
            await session.flush()
        return wallet

    # Alias
    get_house_wallet = get_house_revenue_wallet

    async def get_operator_operating_wallet(self, session: AsyncSession, currency: str = "USD") -> models.Wallet:
        """Fetch or initialize the OPERATOR_OPERATING / OPERATOR_BANK settlement wallet."""
        res = await session.execute(
            select(models.Wallet).where(
                models.Wallet.type.in_([
                    models.WalletType.OPERATOR_BANK.value,
                    getattr(models.WalletType, "OPERATOR_OPERATING", models.WalletType.OPERATOR_BANK).value,
                ])
            )
        )
        wallet = res.scalars().first()
        if not wallet:
            await self._authorize_session(session)
            wallet = models.Wallet(
                id=2,
                user_id=None,
                type=models.WalletType.OPERATOR_BANK.value,
                currency=currency,
                balance=0.0,
                locked_balance=0.0,
                status="active",
            )
            session.add(wallet)
            await session.flush()
        return wallet

    # Alias
    get_operator_bank_wallet = get_operator_operating_wallet

    async def _calc_safe_withdrawal_internal(self, session: Optional[AsyncSession] = None) -> SafeWithdrawalAmount:
        """
        Internal calculation logic:
        * Calculate 'Total_Liabilities' = Sum of all active user wallet balances.
        * Calculate 'Required_Float' = Total_Liabilities * MIN_SAFETY_FLOAT_RATIO.
        * Calculate 'Available_Profit' = Max(0, House_Revenue_Wallet_Balance - Required_Float).
        * Return 'Available_Profit' as the maximum safe amount to withdraw.
        """
        if session is None:
            async with AsyncSessionLocal() as local_session:
                return await self._calc_safe_withdrawal_internal(local_session)

        # 1. Calculate Total_Liabilities = Sum of all active user wallet balances
        p_res = await session.execute(
            select(
                func.coalesce(func.sum(models.Wallet.balance), 0.0),
                func.coalesce(func.sum(models.Wallet.locked_balance), 0.0),
            ).where(
                models.Wallet.type == models.WalletType.PLAYER.value,
                models.Wallet.status == "active",
            )
        )
        player_bal, player_locked = p_res.first()
        player_wallet_liabilities = float(player_bal) + float(player_locked)

        # Also account for active unbanned user accounts
        user_res = await session.execute(
            select(func.coalesce(func.sum(models.User.v_coins), 0.0)).where(
                models.User.is_banned.is_(False)
            )
        )
        user_vcoins_sum = float(user_res.scalar() or 0.0)
        total_liabilities = max(player_wallet_liabilities, user_vcoins_sum)

        # 2. House_Revenue_Wallet_Balance
        house_wallet = await self.get_house_revenue_wallet(session)
        house_revenue_wallet_balance = float(house_wallet.balance)

        # 3. Calculate Required_Float = Total_Liabilities * MIN_SAFETY_FLOAT_RATIO
        required_float = round(total_liabilities * MIN_SAFETY_FLOAT_RATIO, 2)

        # 4. Calculate Available_Profit = Max(0, House_Revenue_Wallet_Balance - Required_Float)
        available_profit = max(0.0, round(house_revenue_wallet_balance - required_float, 2))

        return SafeWithdrawalAmount(
            available_profit=available_profit,
            total_liabilities=total_liabilities,
            required_float=required_float,
            house_balance=house_revenue_wallet_balance,
        )

    def calculate_safe_withdrawal(self, session: Optional[AsyncSession] = None):
        """
        Public calculation entry point.
        Returns a SafeWithdrawalAwaitable that:
        - can be awaited: `amount = await calculate_safe_withdrawal(session)`
        - can be used synchronously: `if calculate_safe_withdrawal() > 0:`
        """
        return SafeWithdrawalAwaitable(self._calc_safe_withdrawal_internal, session)

    async def log_blocked_attempt_audit(
        self,
        session: AsyncSession,
        amount: float,
        house_balance: float,
        required_float: float,
        reason: str,
        user_id: Optional[int] = None,
        source_wallet_id: Optional[int] = None,
    ) -> None:
        """
        Audit Guardrail: Log all blocked withdrawal attempts for audit purposes:
        1. Insert record into audit_logs table
        2. Insert record into alert_notifications table
        3. Insert record into transactions table with status 'BLOCKED'
        4. Log with logger.error / logger.warning
        5. Dispatch simulated Telegram alert to Admin
        """
        timestamp = datetime.datetime.now(datetime.timezone.utc)
        audit_msg = (
            f"[Compliance Audit] BLOCKED WITHDRAWAL ATTEMPT: Amount ${amount:,.2f} rejected. "
            f"House Revenue Wallet (${house_balance:,.2f}) cannot dip below Required Safety Float (${required_float:,.2f}). "
            f"Reason: {reason}"
        )
        logger.error(audit_msg)

        # 1. audit_logs table
        try:
            audit_entry = models.AuditLog(
                event_type="BLOCKED_WITHDRAWAL_ATTEMPT",
                severity="CRITICAL",
                message=audit_msg,
                details={
                    "amount": amount,
                    "house_balance": house_balance,
                    "required_float": required_float,
                    "reason": reason,
                    "user_id": user_id,
                    "timestamp": timestamp.isoformat(),
                },
                created_at=datetime.datetime.utcnow(),
            )
            session.add(audit_entry)
        except Exception as e:
            logger.warning("[Audit] Could not write to audit_logs table: %s", e)

        # 2. alert_notifications table & Telegram alert
        try:
            await notification_service.alert_blocked_withdrawal(
                amount=amount,
                house_balance=house_balance,
                required_float=required_float,
                reason=reason,
                session=session,
            )
        except Exception as e:
            logger.warning("[Audit] Could not write alert_notification: %s", e)

        # 3. transactions table with status 'BLOCKED'
        try:
            blocked_txn = models.Transaction(
                user_id=user_id,
                amount=amount,
                type="PROFIT_WITHDRAWAL",
                source_wallet_id=source_wallet_id,
                dest_wallet_id=None,
                status="BLOCKED",
                reference_id=f"BLOCKED-{int(time.time())}",
                description=audit_msg[:255],
                created_at=datetime.datetime.utcnow(),
                timestamp=datetime.datetime.utcnow(),
            )
            session.add(blocked_txn)
        except Exception as e:
            logger.warning("[Audit] Could not record blocked transaction: %s", e)

        await session.flush()

    async def validate_safe_withdrawal(self, session: AsyncSession, amount: float, user_id: Optional[int] = None) -> SafeWithdrawalAmount:
        """
        SAFETY GUARDRAIL HARD BLOCK:
        Reject any manual or automated withdrawal request that would cause
        House_Revenue_Wallet < Required_Float.
        Logs all blocked attempts for audit purposes.
        """
        if amount <= 0:
            raise ValueError("Withdrawal amount must be strictly greater than 0")

        safe_calc = await self._calc_safe_withdrawal_internal(session)
        house_balance = safe_calc.house_balance
        required_float = safe_calc.required_float
        available_profit = safe_calc.available_profit

        # Hard block check
        if round(house_balance - amount, 2) < round(required_float, 2):
            err_msg = (
                f"COMPLIANCE_VIOLATION: Withdrawal of ${amount:,.2f} rejected. "
                f"House Balance (${house_balance:,.2f}) cannot dip below Required Safety Float (${required_float:,.2f}). "
                f"Maximum safe withdrawable profit: ${available_profit:,.2f}."
            )
            house_wallet = await self.get_house_revenue_wallet(session)
            await self.log_blocked_attempt_audit(
                session=session,
                amount=amount,
                house_balance=house_balance,
                required_float=required_float,
                reason=err_msg,
                user_id=user_id,
                source_wallet_id=house_wallet.id,
            )
            raise ComplianceViolationError(err_msg)

        return safe_calc

    async def execute_profit_sweep(
        self,
        session: AsyncSession,
        amount: Optional[float] = None,
        operator_bank_account: Optional[str] = None,
        is_manual: bool = False,
        transaction_type: str = "PROFIT_WITHDRAWAL",
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute safe profit sweep:
        1. Call calculate_safe_withdrawal()
        2. If amount > 0:
           - Enforce hard block compliance guard
           - Move funds from House_Revenue_Wallet to Operator_Operating_Wallet
           - Tag transaction type as 'PROFIT_WITHDRAWAL' (or 'OPERATING_PROFIT_WITHDRAWAL')
           - Trigger Telegram alert to Admin:
             'Daily Sweep: Moved {amount} to Operating Account. Remaining Float: {float}.'
        3. If amount == 0:
           - Send alert: '⚠️ No profit available for withdrawal today. Maintaining safety float.'
        """
        safe_calc = await self._calc_safe_withdrawal_internal(session)
        available_profit = safe_calc.available_profit
        house_balance = safe_calc.house_balance
        required_float = safe_calc.required_float

        sweep_amount = amount if amount is not None else available_profit

        # If amount == 0: Skip and send alert
        if sweep_amount <= 0:
            logger.info(
                "[Treasury] Sweep skipped: No profit available (House: $%.2f, Required Float: $%.2f)",
                house_balance, required_float
            )
            # Trigger Telegram alert when amount == 0
            alert = await notification_service.alert_no_profit_available(
                house_balance=house_balance,
                required_float=required_float,
                session=session,
            )
            return {
                "status": "skipped",
                "success": False,
                "reason": "ZERO_WITHDRAWABLE_PROFIT",
                "message": "⚠️ No profit available for withdrawal today. Maintaining safety float.",
                "swept_amount": 0.0,
                "telegram_alert": alert,
                "treasury": safe_calc.to_dict(),
            }

        # Hard block check if amount > 0
        await self.validate_safe_withdrawal(session, sweep_amount)

        bank_account = operator_bank_account or OPERATOR_BANK_DEFAULT

        await self._authorize_session(session)
        house_wallet = await self.get_house_revenue_wallet(session)
        operator_wallet = await self.get_operator_operating_wallet(session)

        # Move funds from House_Revenue_Wallet to Operator_Operating_Wallet
        house_wallet.balance -= sweep_amount
        operator_wallet.balance += sweep_amount

        sweep_ref = f"SWEEP-{datetime.date.today().strftime('%Y%m%d')}-{int(time.time())}"
        desc = (
            description
            or (
                f"Manual Force Sweep of ${sweep_amount:,.2f} to Operating Account ({bank_account})"
                if is_manual
                else f"Automated Daily Sweep of ${sweep_amount:,.2f} to Operating Account ({bank_account})"
            )
        )

        # Tag transaction type as 'PROFIT_WITHDRAWAL' (or caller specified)
        txn = models.Transaction(
            user_id=None,
            amount=sweep_amount,
            type=transaction_type,
            source_wallet_id=house_wallet.id,
            dest_wallet_id=operator_wallet.id,
            status="completed",
            reference_id=sweep_ref,
            description=desc,
            created_at=datetime.datetime.utcnow(),
            timestamp=datetime.datetime.utcnow(),
        )
        session.add(txn)
        await session.flush()

        # Trigger Telegram alert to Admin:
        # 'Daily Sweep: Moved {amount} to Operating Account. Remaining Float: {float}.'
        telegram_alert = await notification_service.alert_treasury_sweep(
            amount=sweep_amount,
            house_balance=house_wallet.balance,
            required_float=required_float,
            operator_account=bank_account,
            reference_id=sweep_ref,
            session=session,
        )

        updated_treasury = await self._calc_safe_withdrawal_internal(session)

        logger.info(
            "[Treasury] Daily Sweep Complete: Moved $%.2f to Operating Account %s (Txn #%s)",
            sweep_amount, bank_account, txn.id
        )

        return {
            "status": "completed",
            "success": True,
            "swept_amount": sweep_amount,
            "transaction_id": txn.id,
            "reference_id": sweep_ref,
            "operator_bank_account": bank_account,
            "message": f"Daily Sweep Complete: Moved ${sweep_amount:,.2f} to Operating Account.",
            "telegram_alert": telegram_alert,
            "treasury": updated_treasury.to_dict(),
        }


# Global singleton service
treasury_service = TreasuryService()


def calculate_safe_withdrawal(session: Optional[AsyncSession] = None):
    """
    Global standalone function 'calculate_safe_withdrawal()':
    * Calculate 'Total_Liabilities' = Sum of all active user wallet balances.
    * Calculate 'Required_Float' = Total_Liabilities * MIN_SAFETY_FLOAT_RATIO.
    * Calculate 'Available_Profit' = Max(0, House_Revenue_Wallet_Balance - Required_Float).
    * Return 'Available_Profit' as the maximum safe amount to withdraw.
    """
    return treasury_service.calculate_safe_withdrawal(session)
