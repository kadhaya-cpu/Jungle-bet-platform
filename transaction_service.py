"""
transaction_service.py - Jungle Bet Strict Financial Core & Money Movement Engine

Rules:
1. Strict segregation of PLAYER and HOUSE_REVENUE wallets.
2. NO direct SQL balance updates allowed; all operations set session context 'junglebet.transaction_service = active'.
3. Complete double-entry ledger in 'transactions' table (source_wallet_id, dest_wallet_id, amount, status).
4. processBet implementation: locks stake, resolves loss to HOUSE_REVENUE, resolves win from HOUSE_REVENUE to PLAYER.
5. daily_settlement job calculating net profit and preparing external operator bank transfer.
"""

import os
import time
import logging
import datetime
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy import select, text, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

import models
from notifications import notification_service

logger = logging.getLogger("transaction_service")
logger.setLevel(logging.INFO)

OPERATOR_BANK_DEFAULT = os.getenv("OPERATOR_BANK_ACCOUNT", "Stanbic Bank - IBAN GB29JUNGLE8839210")
MIN_SAFETY_FLOAT_RATIO: float = 0.25
MIN_SAFETY_FLOAT_PERCENTAGE: float = MIN_SAFETY_FLOAT_RATIO


class ComplianceViolationError(Exception):
    """Raised when an operation would violate regulatory or treasury safety float compliance."""
    pass


class TransactionService:
    @staticmethod
    async def _authorize_session(session: AsyncSession):
        """Enable bypass trigger for strict transaction service update authorization."""
        await session.execute(text("SET LOCAL junglebet.transaction_service = 'active'"))

    async def get_or_create_player_wallet(
        self, session: AsyncSession, user_id: int, currency: str = "USD"
    ) -> models.Wallet:
        """Fetch or initialize the user's segregated PLAYER wallet."""
        res = await session.execute(
            select(models.Wallet).where(
                and_(
                    models.Wallet.user_id == user_id,
                    models.Wallet.type == models.WalletType.PLAYER.value,
                )
            )
        )
        wallet = res.scalars().first()
        if not wallet:
            # Sync initial balance with user's v_coins if present
            user_res = await session.execute(select(models.User).where(models.User.id == user_id))
            user = user_res.scalar_one_or_none()
            init_balance = user.v_coins if user and user.v_coins is not None else 100.0

            await self._authorize_session(session)
            wallet = models.Wallet(
                user_id=user_id,
                type=models.WalletType.PLAYER.value,
                currency=currency,
                balance=init_balance,
                locked_balance=0.0,
                status="active",
            )
            session.add(wallet)
            await session.flush()
        return wallet

    async def get_house_wallet(
        self, session: AsyncSession, currency: str = "USD"
    ) -> models.Wallet:
        """Fetch or initialize the central HOUSE_REVENUE wallet."""
        res = await session.execute(
            select(models.Wallet).where(
                models.Wallet.type == models.WalletType.HOUSE_REVENUE.value
            )
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

    async def get_operator_bank_wallet(
        self, session: AsyncSession, currency: str = "USD"
    ) -> models.Wallet:
        """Fetch or initialize the external OPERATOR_BANK settlement wallet."""
        res = await session.execute(
            select(models.Wallet).where(
                models.Wallet.type == models.WalletType.OPERATOR_BANK.value
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

    async def deposit(
        self,
        session: AsyncSession,
        user_id: int,
        amount: float,
        reference_id: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Tuple[models.Wallet, models.Transaction]:
        """Deposit funds into a user's PLAYER wallet."""
        if amount <= 0:
            raise ValueError("Deposit amount must be strictly greater than 0")

        await self._authorize_session(session)
        player_wallet = await self.get_or_create_player_wallet(session, user_id)
        player_wallet.balance += amount

        # Sync user.v_coins for backwards-compatibility
        user_res = await session.execute(select(models.User).where(models.User.id == user_id))
        user = user_res.scalar_one_or_none()
        if user:
            user.v_coins = player_wallet.balance

        txn = models.Transaction(
            user_id=user_id,
            amount=amount,
            type="deposit",
            source_wallet_id=None,
            dest_wallet_id=player_wallet.id,
            status="completed",
            reference_id=reference_id,
            description=description or f"Deposit of ${amount:.2f} to Player Wallet",
            created_at=datetime.datetime.utcnow(),
            timestamp=datetime.datetime.utcnow(),
        )
        session.add(txn)
        await session.flush()

        logger.info("[FinancialCore] Deposit of $%.2f to User %s (Wallet #%s)", amount, user_id, player_wallet.id)
        return player_wallet, txn

    async def withdraw(
        self,
        session: AsyncSession,
        user_id: int,
        amount: float,
        reference_id: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Tuple[models.Wallet, models.Transaction]:
        """Withdraw funds from a user's PLAYER wallet."""
        if amount <= 0:
            raise ValueError("Withdrawal amount must be strictly greater than 0")

        await self._authorize_session(session)
        player_wallet = await self.get_or_create_player_wallet(session, user_id)
        if player_wallet.balance < amount:
            raise ValueError("Insufficient balance for withdrawal")

        player_wallet.balance -= amount

        user_res = await session.execute(select(models.User).where(models.User.id == user_id))
        user = user_res.scalar_one_or_none()
        if user:
            user.v_coins = player_wallet.balance

        txn = models.Transaction(
            user_id=user_id,
            amount=amount,
            type="withdrawal",
            source_wallet_id=player_wallet.id,
            dest_wallet_id=None,
            status="completed",
            reference_id=reference_id,
            description=description or f"Withdrawal of ${amount:.2f} from Player Wallet",
            created_at=datetime.datetime.utcnow(),
            timestamp=datetime.datetime.utcnow(),
        )
        session.add(txn)
        await session.flush()

        logger.info("[FinancialCore] Withdrawal of $%.2f from User %s", amount, user_id)
        return player_wallet, txn

    async def lock_stake(
        self,
        session: AsyncSession,
        user_id: int,
        amount: float,
        bet_id: Optional[int] = None,
    ) -> Tuple[models.Wallet, models.Transaction]:
        """
        Step a: Locks user stake from PLAYER wallet.
        Moves funds from balance to locked_balance and creates a pending bet transaction.
        """
        if amount <= 0:
            raise ValueError("Stake amount must be strictly positive")

        await self._authorize_session(session)
        player_wallet = await self.get_or_create_player_wallet(session, user_id)

        if player_wallet.balance < amount:
            raise ValueError(f"Insufficient funds: Balance ${player_wallet.balance:.2f} < Stake ${amount:.2f}")

        # Atomically lock stake
        player_wallet.balance -= amount
        player_wallet.locked_balance += amount

        # Sync user.v_coins
        user_res = await session.execute(select(models.User).where(models.User.id == user_id))
        user = user_res.scalar_one_or_none()
        if user:
            user.v_coins = player_wallet.balance

        txn = models.Transaction(
            user_id=user_id,
            amount=amount,
            type="bet",
            source_wallet_id=player_wallet.id,
            dest_wallet_id=None,
            status="locked",
            reference_id=str(bet_id) if bet_id else None,
            description=f"Locked stake ${amount:.2f} for Bet #{bet_id or 'PENDING'}",
            created_at=datetime.datetime.utcnow(),
            timestamp=datetime.datetime.utcnow(),
        )
        session.add(txn)
        await session.flush()

        logger.info("[FinancialCore] Locked stake $%.2f for User %s on Bet #%s", amount, user_id, bet_id)
        return player_wallet, txn

    async def process_bet_loss(
        self,
        session: AsyncSession,
        user_id: int,
        stake: float,
        bet_id: Optional[int] = None,
    ) -> Tuple[models.Wallet, models.Wallet, models.Transaction]:
        """
        Step b: If user loses: Moves stake from PLAYER locked_balance to HOUSE_REVENUE wallet.
        """
        await self._authorize_session(session)
        player_wallet = await self.get_or_create_player_wallet(session, user_id)
        house_wallet = await self.get_house_wallet(session)

        # Release locked stake and transfer to HOUSE_REVENUE
        player_wallet.locked_balance = max(0.0, player_wallet.locked_balance - stake)
        house_wallet.balance += stake

        txn = models.Transaction(
            user_id=user_id,
            amount=stake,
            type="bet",
            source_wallet_id=player_wallet.id,
            dest_wallet_id=house_wallet.id,
            status="completed",
            reference_id=str(bet_id) if bet_id else None,
            description=f"House Revenue collected: Bet #{bet_id or 'N/A'} lost (Stake: ${stake:.2f})",
            created_at=datetime.datetime.utcnow(),
            timestamp=datetime.datetime.utcnow(),
        )
        session.add(txn)
        await session.flush()

        # Check if daily profit target hit
        await self._check_profit_target_alert(session)

        logger.info("[FinancialCore] Bet #%s LOST: Moved $%.2f to HOUSE_REVENUE (Bankroll: $%.2f)",
                    bet_id, stake, house_wallet.balance)
        return player_wallet, house_wallet, txn

    async def process_bet_win(
        self,
        session: AsyncSession,
        user_id: int,
        stake: float,
        odds: float,
        bet_id: Optional[int] = None,
        username: Optional[str] = None,
    ) -> Tuple[models.Wallet, models.Wallet, models.Transaction]:
        """
        Step c: If user wins: Releases stake lock and moves (stake * odds) from HOUSE_REVENUE to PLAYER wallet.
        """
        await self._authorize_session(session)
        player_wallet = await self.get_or_create_player_wallet(session, user_id)
        house_wallet = await self.get_house_wallet(session)

        payout = stake * odds
        if payout <= 0:
            raise ValueError("Payout must be positive")

        # Unlock user stake
        player_wallet.locked_balance = max(0.0, player_wallet.locked_balance - stake)

        # Move payout from HOUSE_REVENUE to PLAYER wallet
        house_wallet.balance -= payout
        player_wallet.balance += payout

        # Sync user.v_coins
        user_res = await session.execute(select(models.User).where(models.User.id == user_id))
        user = user_res.scalar_one_or_none()
        if user:
            user.v_coins = player_wallet.balance
            if not username:
                username = user.username

        txn = models.Transaction(
            user_id=user_id,
            amount=payout,
            type="win",
            source_wallet_id=house_wallet.id,
            dest_wallet_id=player_wallet.id,
            status="completed",
            reference_id=str(bet_id) if bet_id else None,
            description=f"Player Win payout: Bet #{bet_id or 'N/A'} won ${payout:.2f} (Stake: ${stake:.2f}, Odds: {odds:.2f}x)",
            created_at=datetime.datetime.utcnow(),
            timestamp=datetime.datetime.utcnow(),
        )
        session.add(txn)
        await session.flush()

        logger.info("[FinancialCore] Bet #%s WON: Transferred $%.2f from HOUSE_REVENUE to User %s (Odds: %.2fx)",
                    bet_id, payout, user_id, odds)

        # REAL-TIME ALERT: Alert admin phone if user wins > $1,000
        if payout > 1000.0:
            try:
                await notification_service.alert_high_win(
                    username=username or f"User_{user_id}",
                    user_id=user_id,
                    win_amount=payout,
                    bet_id=bet_id or 0,
                    odds=odds,
                    session=session,
                )
            except Exception as e:
                logger.error("[Alert] Failed to dispatch high-win alert: %s", e)

        return player_wallet, house_wallet, txn

    async def processBet(
        self,
        session: AsyncSession,
        user_id: int,
        stake: float,
        odds: float = 1.0,
        outcome: Optional[str] = None,  # "lock" | "loss" | "win" | "void" | "validate"
        bet_id: Optional[int] = None,
        username: Optional[str] = None,
        duration_seconds: Optional[float] = None,
        predicted_count: Optional[int] = None,
        actual_count: Optional[int] = None,
        crossings: Optional[List[Any]] = None,
        counts_per_second: Optional[List[Dict[str, Any]]] = None,
        operator: str = "exact",
    ) -> Dict[str, Any]:
        """
        Unified money movement service 'processBet':
        a. Locks user stake from PLAYER wallet (outcome="lock").
        b. If user loses: Moves stake to HOUSE_REVENUE wallet (outcome="loss").
        c. If user wins: Moves (stake * odds) from HOUSE_REVENUE to PLAYER wallet (outcome="win").
        d. Time Window Validation: If duration_seconds or predicted_count is provided, validates
           cars crossing specifically between T=0 and T=UserSeconds (7s-15s), resolves win/loss,
           and executes double-entry wallet balance adjustments.
        """
        # Check if caller requested time-window validation
        has_validation_params = (
            predicted_count is not None
            or duration_seconds is not None
            or outcome == "validate"
            or (actual_count is not None and outcome not in ("lock", "loss", "lost", "win", "won", "void"))
            or (crossings is not None and outcome not in ("lock", "loss", "lost", "win", "won", "void"))
            or (counts_per_second is not None and outcome not in ("lock", "loss", "lost", "win", "won", "void"))
        )

        if has_validation_params and outcome not in ("lock", "loss", "lost", "win", "won", "void"):
            user_sec = float(duration_seconds) if duration_seconds is not None else 10.0
            pred_target = predicted_count

            if pred_target is None and bet_id is not None:
                bet_res = await session.execute(select(models.Bet).where(models.Bet.id == bet_id))
                bet_rec = bet_res.scalar_one_or_none()
                if bet_rec and bet_rec.criteria:
                    pred_target = (
                        bet_rec.criteria.get("predicted_count")
                        if bet_rec.criteria.get("predicted_count") is not None
                        else (
                            bet_rec.criteria.get("target_count")
                            if bet_rec.criteria.get("target_count") is not None
                            else bet_rec.criteria.get("target")
                        )
                    )
                    if duration_seconds is None:
                        user_sec = float(bet_rec.criteria.get("duration_seconds") or bet_rec.criteria.get("duration") or 10.0)

            if pred_target is None:
                pred_target = 0

            # Count vehicles crossing specifically between T=0 and T=UserSeconds
            window_count = None
            if crossings:
                def _get_ts(c):
                    if isinstance(c, (int, float)):
                        return float(c)
                    if isinstance(c, dict):
                        return float(c.get("timestamp", c.get("t", c.get("time", 0.0))))
                    return 0.0
                window_count = len([c for c in crossings if 0.0 <= _get_ts(c) <= user_sec])
            elif counts_per_second:
                window_count = sum(
                    int(s.get("count", 0))
                    for s in counts_per_second
                    if float(s.get("second", s.get("t", 0))) <= user_sec
                )
            elif actual_count is not None:
                window_count = int(actual_count)
            elif bet_id is not None:
                bet_res = await session.execute(select(models.Bet).where(models.Bet.id == bet_id))
                bet_rec = bet_res.scalar_one_or_none()
                if bet_rec and bet_rec.resolution_data:
                    res_data = bet_rec.resolution_data
                    if "crossings" in res_data:
                        window_count = len([c for c in res_data["crossings"] if 0.0 <= float(c.get("timestamp", 0)) <= user_sec])
                    elif "counts_per_second" in res_data:
                        window_count = sum(int(s.get("count", 0)) for s in res_data["counts_per_second"] if float(s.get("second", 0)) <= user_sec)
                    else:
                        window_count = res_data.get("window_count") or res_data.get("detected_count", 0)

            if window_count is None:
                window_count = 0

            # Validate prediction within the chosen time window
            if operator == "exact":
                is_win = (window_count == pred_target)
            elif operator == "over":
                is_win = (window_count > pred_target)
            elif operator == "under":
                is_win = (window_count < pred_target)
            else:
                is_win = (window_count == pred_target)

            # Ensure player stake is locked first if not locked already
            pw = await self.get_or_create_player_wallet(session, user_id)
            if pw.locked_balance < stake and pw.balance >= stake:
                await self.lock_stake(session, user_id, stake, bet_id=bet_id)

            if is_win:
                pw, hw, txn = await self.process_bet_win(
                    session, user_id, stake, odds, bet_id=bet_id, username=username
                )
                return {
                    "step": "win_resolved",
                    "status": "completed",
                    "outcome": "win",
                    "is_win": True,
                    "user_id": user_id,
                    "bet_id": bet_id,
                    "duration_seconds": user_sec,
                    "user_seconds": user_sec,
                    "predicted_count": pred_target,
                    "actual_count_in_window": window_count,
                    "window_count": window_count,
                    "stake": stake,
                    "odds": odds,
                    "payout": stake * odds,
                    "player_balance": pw.balance,
                    "house_bankroll": hw.balance,
                    "transaction_id": txn.id,
                }
            else:
                pw, hw, txn = await self.process_bet_loss(session, user_id, stake, bet_id=bet_id)
                return {
                    "step": "loss_resolved",
                    "status": "completed",
                    "outcome": "loss",
                    "is_win": False,
                    "user_id": user_id,
                    "bet_id": bet_id,
                    "duration_seconds": user_sec,
                    "user_seconds": user_sec,
                    "predicted_count": pred_target,
                    "actual_count_in_window": window_count,
                    "window_count": window_count,
                    "stake": stake,
                    "odds": odds,
                    "payout": 0.0,
                    "house_revenue_transferred": stake,
                    "player_balance": pw.balance,
                    "house_bankroll": hw.balance,
                    "transaction_id": txn.id,
                }

        if outcome == "lock" or outcome is None:
            wallet, txn = await self.lock_stake(session, user_id, stake, bet_id=bet_id)
            return {
                "step": "locked",
                "user_id": user_id,
                "stake": stake,
                "player_balance": wallet.balance,
                "locked_balance": wallet.locked_balance,
                "transaction_id": txn.id,
                "status": "locked",
            }
        elif outcome in ("loss", "lost", False):
            pw, hw, txn = await self.process_bet_loss(session, user_id, stake, bet_id=bet_id)
            return {
                "step": "loss_resolved",
                "user_id": user_id,
                "stake": stake,
                "house_revenue_transferred": stake,
                "player_balance": pw.balance,
                "house_bankroll": hw.balance,
                "transaction_id": txn.id,
                "status": "completed",
            }
        elif outcome in ("win", "won", True):
            pw, hw, txn = await self.process_bet_win(
                session, user_id, stake, odds, bet_id=bet_id, username=username
            )
            return {
                "step": "win_resolved",
                "user_id": user_id,
                "stake": stake,
                "odds": odds,
                "payout": stake * odds,
                "player_balance": pw.balance,
                "house_bankroll": hw.balance,
                "transaction_id": txn.id,
                "status": "completed",
            }
        elif outcome == "void":
            # Refund locked stake back to balance
            await self._authorize_session(session)
            pw = await self.get_or_create_player_wallet(session, user_id)
            pw.locked_balance = max(0.0, pw.locked_balance - stake)
            pw.balance += stake

            user_res = await session.execute(select(models.User).where(models.User.id == user_id))
            user = user_res.scalar_one_or_none()
            if user:
                user.v_coins = pw.balance

            txn = models.Transaction(
                user_id=user_id,
                amount=stake,
                type="refund",
                source_wallet_id=None,
                dest_wallet_id=pw.id,
                status="completed",
                reference_id=str(bet_id) if bet_id else None,
                description=f"Refund of ${stake:.2f} for voided Bet #{bet_id}",
                created_at=datetime.datetime.utcnow(),
                timestamp=datetime.datetime.utcnow(),
            )
            session.add(txn)
            await session.flush()
            return {
                "step": "void_refunded",
                "user_id": user_id,
                "refunded": stake,
                "player_balance": pw.balance,
                "status": "refunded",
            }
        else:
            raise ValueError(f"Unknown bet outcome: {outcome}")

    async def _check_profit_target_alert(self, session: AsyncSession):
        """Internal hook to trigger daily profit target notification."""
        try:
            metrics = await self.get_financial_metrics(session)
            daily_profit = metrics.get("today_net_profit", 0.0)
            target = notification_service.profit_target
            if daily_profit >= target:
                await notification_service.check_and_alert_profit_target(
                    daily_profit=daily_profit,
                    active_players=metrics.get("active_players", 0),
                    house_bankroll=metrics.get("house_bankroll", 0.0),
                    target=target,
                    session=session,
                )
        except Exception as e:
            logger.warning("[Alert] Profit target check skipped: %s", e)

    async def daily_settlement(
        self,
        session: AsyncSession,
        settlement_date: Optional[datetime.date] = None,
        operator_bank_account: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Daily settlement job:
        1. Calculates today's net profit (House stakes collected from losses - Player payouts won).
        2. Prepares settlement record for transfer to operator's external bank account.
        3. Sends 11:59 PM summary report via Telegram / Email.
        """
        if not settlement_date:
            settlement_date = datetime.date.today()

        bank_account = operator_bank_account or OPERATOR_BANK_DEFAULT

        # Define time range for the day (00:00:00 to 23:59:59.999 UTC)
        start_dt = datetime.datetime.combine(settlement_date, datetime.time.min)
        end_dt = datetime.datetime.combine(settlement_date, datetime.time.max)

        # 1. Total Turnover (all bets placed today)
        bets_res = await session.execute(
            select(models.Bet).where(
                and_(models.Bet.created_at >= start_dt, models.Bet.created_at <= end_dt)
            )
        )
        today_bets = bets_res.scalars().all()
        total_turnover = sum(b.amount for b in today_bets)

        # 2. Total House Losses Collected (revenue to HOUSE_REVENUE)
        house_wallet = await self.get_house_wallet(session)
        loss_txns_res = await session.execute(
            select(models.Transaction).where(
                and_(
                    models.Transaction.dest_wallet_id == house_wallet.id,
                    models.Transaction.type == "bet",
                    models.Transaction.status == "completed",
                    models.Transaction.timestamp >= start_dt,
                    models.Transaction.timestamp <= end_dt,
                )
            )
        )
        loss_txns = loss_txns_res.scalars().all()
        total_losses = sum(t.amount for t in loss_txns)

        # 3. Total Player Payouts Won (payouts from HOUSE_REVENUE)
        win_txns_res = await session.execute(
            select(models.Transaction).where(
                and_(
                    models.Transaction.source_wallet_id == house_wallet.id,
                    models.Transaction.type == "win",
                    models.Transaction.status == "completed",
                    models.Transaction.timestamp >= start_dt,
                    models.Transaction.timestamp <= end_dt,
                )
            )
        )
        win_txns = win_txns_res.scalars().all()
        total_payouts = sum(t.amount for t in win_txns)

        # Net Profit = Revenue collected - Payouts paid
        net_profit = total_losses - total_payouts

        # Active Players count today
        active_player_ids = set()
        for b in today_bets:
            if b.user_id:
                active_player_ids.add(b.user_id)
        for t in loss_txns:
            if t.user_id:
                active_player_ids.add(t.user_id)
        for t in win_txns:
            if t.user_id:
                active_player_ids.add(t.user_id)
        active_players_count = len(active_player_ids)

        # Total Liability (all player wallet balances + locked balances)
        player_wallets_res = await session.execute(
            select(models.Wallet).where(models.Wallet.type == models.WalletType.PLAYER.value)
        )
        player_wallets = player_wallets_res.scalars().all()
        total_liability = sum(w.balance + w.locked_balance for w in player_wallets)

        # Unique transfer reference
        transfer_ref = f"SETTLE-{settlement_date.strftime('%Y%m%d')}-{int(time.time())}"

        # Insert or update in settlements table
        settle_dt = datetime.datetime.combine(settlement_date, datetime.time.min)
        settle_query = await session.execute(
            select(models.Settlement).where(models.Settlement.settlement_date == settle_dt)
        )
        settlement = settle_query.scalar_one_or_none()

        await self._authorize_session(session)
        if not settlement:
            settlement = models.Settlement(
                settlement_date=settle_dt,
                total_turnover=total_turnover,
                total_payouts=total_payouts,
                total_losses=total_losses,
                net_profit=net_profit,
                operator_bank_account=bank_account,
                status="PREPARED_FOR_TRANSFER",
                transfer_reference=transfer_ref,
                prepared_at=datetime.datetime.utcnow(),
            )
            session.add(settlement)
        else:
            settlement.total_turnover = total_turnover
            settlement.total_payouts = total_payouts
            settlement.total_losses = total_losses
            settlement.net_profit = net_profit
            settlement.operator_bank_account = bank_account
            settlement.status = "PREPARED_FOR_TRANSFER"
            settlement.transfer_reference = transfer_ref

        await session.flush()

        settlement_report = {
            "settlement_id": settlement.id,
            "settlement_date": settlement_date.isoformat(),
            "total_turnover": total_turnover,
            "total_payouts": total_payouts,
            "total_losses": total_losses,
            "net_profit": net_profit,
            "house_bankroll": house_wallet.balance,
            "total_liability": total_liability,
            "active_players": active_players_count,
            "operator_bank_account": bank_account,
            "transfer_reference": transfer_ref,
            "status": settlement.status,
            "prepared_at": datetime.datetime.utcnow().isoformat(),
        }

        # Send daily summary report via Telegram / Email
        try:
            await notification_service.send_daily_summary_report(settlement_report, session=session)
        except Exception as e:
            logger.error("[Alert] Failed to send 11:59 PM daily summary report: %s", e)

        logger.info(
            "[DailySettlement] Date: %s | Turnover: $%.2f | Payouts: $%.2f | Net Profit: $%.2f | Status: %s",
            settlement_date, total_turnover, total_payouts, net_profit, settlement.status
        )
        return settlement_report

    async def get_financial_metrics(self, session: AsyncSession) -> Dict[str, Any]:
        """
        Mobile Admin Dashboard Key Metrics:
        - Today's Net Profit
        - Active Players
        - Total Liability (Money owed to players)
        - House Bankroll
        - Recent High-Value Transactions
        """
        today = datetime.date.today()
        start_dt = datetime.datetime.combine(today, datetime.time.min)
        end_dt = datetime.datetime.combine(today, datetime.time.max)

        house_wallet = await self.get_house_wallet(session)

        # 1. House bankroll
        house_bankroll = house_wallet.balance

        # 2. Total Liability (sum of all player balances + locked balances)
        p_res = await session.execute(
            select(
                func.coalesce(func.sum(models.Wallet.balance), 0.0),
                func.coalesce(func.sum(models.Wallet.locked_balance), 0.0),
            ).where(models.Wallet.type == models.WalletType.PLAYER.value)
        )
        player_bal, player_locked = p_res.first()
        total_liability = float(player_bal) + float(player_locked)

        # 3. Today's Net Profit:
        # Losses collected by house - Payouts won by players
        loss_res = await session.execute(
            select(func.coalesce(func.sum(models.Transaction.amount), 0.0)).where(
                and_(
                    models.Transaction.dest_wallet_id == house_wallet.id,
                    models.Transaction.type == "bet",
                    models.Transaction.status == "completed",
                    models.Transaction.timestamp >= start_dt,
                    models.Transaction.timestamp <= end_dt,
                )
            )
        )
        total_losses = float(loss_res.scalar() or 0.0)

        win_res = await session.execute(
            select(func.coalesce(func.sum(models.Transaction.amount), 0.0)).where(
                and_(
                    models.Transaction.source_wallet_id == house_wallet.id,
                    models.Transaction.type == "win",
                    models.Transaction.status == "completed",
                    models.Transaction.timestamp >= start_dt,
                    models.Transaction.timestamp <= end_dt,
                )
            )
        )
        total_payouts = float(win_res.scalar() or 0.0)
        today_net_profit = total_losses - total_payouts

        # 4. Active players today
        players_res = await session.execute(
            select(func.count(func.distinct(models.Transaction.user_id))).where(
                and_(
                    models.Transaction.user_id.isnot(None),
                    models.Transaction.timestamp >= start_dt,
                    models.Transaction.timestamp <= end_dt,
                )
            )
        )
        active_players = int(players_res.scalar() or 0)
        if active_players == 0:
            # Fallback to count users who registered or wagered
            user_count_res = await session.execute(
                select(func.count(models.User.id)).where(models.User.is_banned.is_(False))
            )
            total_users = int(user_count_res.scalar() or 0)
            active_players = min(total_users, max(1, len(notification_service.get_recent_alerts())))

        # 5. Live Feed: Recent high-value transactions (> $100 or recent 25)
        recent_txns_res = await session.execute(
            select(models.Transaction)
            .order_by(desc(models.Transaction.id))
            .limit(30)
        )
        recent_txns = recent_txns_res.scalars().all()

        formatted_txns = []
        for t in recent_txns:
            user_name = "System"
            if t.user_id:
                u_res = await session.execute(select(models.User.username).where(models.User.id == t.user_id))
                u_name = u_res.scalar_one_or_none()
                user_name = u_name or f"User #{t.user_id}"

            is_high_value = t.amount >= 100.0 or t.type == "win"

            formatted_txns.append({
                "id": t.id,
                "amount": t.amount,
                "type": t.type,
                "status": t.status,
                "userId": t.user_id,
                "username": user_name,
                "sourceWalletId": t.source_wallet_id,
                "destWalletId": t.dest_wallet_id,
                "referenceId": t.reference_id,
                "description": t.description,
                "isHighValue": is_high_value,
                "timestamp": t.timestamp.isoformat() if t.timestamp else datetime.datetime.utcnow().isoformat(),
            })

        treasury = await self.calculate_withdrawable_profit(session)

        return {
            "today_net_profit": today_net_profit,
            "active_players": active_players,
            "total_liability": total_liability,
            "house_bankroll": house_bankroll,
            "today_total_turnover": total_losses + total_payouts,
            "recent_transactions": formatted_txns,
            "treasury": treasury,
            "house_balance": treasury["house_balance"],
            "required_safety_float": treasury["required_safety_float"],
            "safe_to_withdraw": treasury["withdrawable_amount"],
            "min_safety_float_percentage": treasury["min_safety_float_percentage"],
            "min_safety_float_ratio": MIN_SAFETY_FLOAT_RATIO,
        }

    async def calculate_withdrawable_profit(self, session: AsyncSession) -> Dict[str, Any]:
        """
        TREASURY LOGIC:
        1. Fetch Total House Revenue Balance.
        2. Fetch Total Active Player Liabilities (sum of all user balances).
        3. Calculate Required Float = Total Liabilities * MIN_SAFETY_FLOAT_PERCENTAGE.
        4. Withdrawable Amount = Max(0, House Revenue Balance - Required Float).
        """
        # 1. Total House Revenue Balance
        house_wallet = await self.get_house_wallet(session)
        house_balance = float(house_wallet.balance)

        # 2. Total Active Player Liabilities (sum of all user balances)
        p_res = await session.execute(
            select(
                func.coalesce(func.sum(models.Wallet.balance), 0.0),
                func.coalesce(func.sum(models.Wallet.locked_balance), 0.0),
            ).where(models.Wallet.type == models.WalletType.PLAYER.value)
        )
        player_bal, player_locked = p_res.first()
        player_wallet_liabilities = float(player_bal) + float(player_locked)

        # Also account for active unbanned user v_coins if any player wallets not yet initialized
        user_res = await session.execute(
            select(func.coalesce(func.sum(models.User.v_coins), 0.0)).where(
                models.User.is_banned.is_(False)
            )
        )
        user_vcoins_sum = float(user_res.scalar() or 0.0)
        total_liabilities = max(player_wallet_liabilities, user_vcoins_sum)

        # 3. Calculate Required Float = Total Liabilities * MIN_SAFETY_FLOAT_PERCENTAGE
        required_safety_float = round(total_liabilities * MIN_SAFETY_FLOAT_PERCENTAGE, 2)

        # 4. Withdrawable Amount = Max(0, House Revenue Balance - Required Float)
        withdrawable_amount = max(0.0, round(house_balance - required_safety_float, 2))

        return {
            "house_balance": house_balance,
            "total_liabilities": total_liabilities,
            "min_safety_float_percentage": MIN_SAFETY_FLOAT_PERCENTAGE,
            "min_safety_float_ratio": MIN_SAFETY_FLOAT_RATIO,
            "required_safety_float": required_safety_float,
            "required_float": required_safety_float,
            "withdrawable_amount": withdrawable_amount,
            "safe_to_withdraw": withdrawable_amount,
            "available_profit": withdrawable_amount,
            "is_sweep_eligible": withdrawable_amount > 0,
            "operator_bank_account": OPERATOR_BANK_DEFAULT,
        }

    async def validate_safe_withdrawal(self, session: AsyncSession, amount: float) -> Dict[str, Any]:
        """
        COMPLIANCE CHECK:
        Ensure the system blocks any withdrawal attempt that would dip the House Balance
        below the Required Safety Float.
        """
        if amount <= 0:
            raise ValueError("Withdrawal amount must be strictly greater than 0")

        treasury = await self.calculate_withdrawable_profit(session)
        house_balance = treasury["house_balance"]
        required_safety_float = treasury["required_safety_float"]
        withdrawable_amount = treasury["withdrawable_amount"]

        if round(house_balance - amount, 2) < round(required_safety_float, 2):
            err_msg = (
                f"COMPLIANCE_VIOLATION: Withdrawal of ${amount:,.2f} rejected. "
                f"House Balance (${house_balance:,.2f}) cannot dip below Required Safety Float (${required_safety_float:,.2f}). "
                f"Maximum safe withdrawable profit: ${withdrawable_amount:,.2f}."
            )
            logger.error("[Compliance] %s", err_msg)
            try:
                from treasury_service import treasury_service as ts
                await ts.log_blocked_attempt_audit(
                    session=session,
                    amount=amount,
                    house_balance=house_balance,
                    required_float=required_safety_float,
                    reason=err_msg,
                )
            except Exception as e:
                logger.warning("[Compliance Audit Log] Error writing audit log: %s", e)
            raise ComplianceViolationError(err_msg)

        return treasury

    async def execute_sweep(
        self,
        session: AsyncSession,
        amount: Optional[float] = None,
        operator_bank_account: Optional[str] = None,
        is_manual: bool = False,
    ) -> Dict[str, Any]:
        """
        Treasury Sweep Job (Automated or Manual):
        - Calculates withdrawable profit.
        - If Withdrawable Amount > 0:
          * Strict compliance check ensures House Balance stays >= Required Safety Float.
          * Moves funds from House Revenue Wallet to Operator External Account.
          * Logs transaction as 'OPERATING_PROFIT_WITHDRAWAL'.
          * Sends Telegram alert: 'Daily Sweep Complete: Moved [amount] to Operating Account.'
        """
        treasury = await self.calculate_withdrawable_profit(session)
        house_balance = treasury["house_balance"]
        required_safety_float = treasury["required_safety_float"]
        withdrawable_amount = treasury["withdrawable_amount"]

        sweep_amount = amount if amount is not None else withdrawable_amount

        if sweep_amount <= 0:
            logger.info(
                "[Treasury] Sweep skipped: Withdrawable amount is $0.00 (House: $%.2f, Float: $%.2f)",
                house_balance, required_safety_float
            )
            return {
                "status": "skipped",
                "success": False,
                "reason": "ZERO_WITHDRAWABLE_PROFIT",
                "message": "Treasury sweep skipped: No withdrawable profit above Required Safety Float.",
                "swept_amount": 0.0,
                "treasury": treasury,
            }

        # Strict compliance enforcement: block any withdrawal dipping below safety float
        await self.validate_safe_withdrawal(session, sweep_amount)

        bank_account = operator_bank_account or OPERATOR_BANK_DEFAULT

        await self._authorize_session(session)
        house_wallet = await self.get_house_wallet(session)
        operator_wallet = await self.get_operator_bank_wallet(session)

        # Move funds from House Revenue Wallet to Operator External Account
        house_wallet.balance -= sweep_amount
        operator_wallet.balance += sweep_amount

        sweep_ref = f"SWEEP-{datetime.date.today().strftime('%Y%m%d')}-{int(time.time())}"
        desc = (
            f"Manual Treasury Sweep of ${sweep_amount:,.2f} to Operating Account ({bank_account})"
            if is_manual
            else f"Automated Daily Sweep of ${sweep_amount:,.2f} to Operating Account ({bank_account})"
        )

        # Log transaction as 'OPERATING_PROFIT_WITHDRAWAL'
        txn = models.Transaction(
            user_id=None,
            amount=sweep_amount,
            type="OPERATING_PROFIT_WITHDRAWAL",
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

        # Send Telegram alert: 'Daily Sweep Complete: Moved [amount] to Operating Account.'
        telegram_alert = await notification_service.alert_treasury_sweep(
            amount=sweep_amount,
            house_balance=house_wallet.balance,
            required_float=required_safety_float,
            operator_account=bank_account,
            reference_id=sweep_ref,
            session=session,
        )

        updated_treasury = await self.calculate_withdrawable_profit(session)

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
            "treasury": updated_treasury,
        }


# Global singleton
transaction_service = TransactionService()


async def calculate_withdrawable_profit(session: AsyncSession) -> Dict[str, Any]:
    """Standalone module-level helper function for calculating withdrawable profit."""
    return await transaction_service.calculate_withdrawable_profit(session)


def calculate_safe_withdrawal(session: Optional[AsyncSession] = None):
    """Standalone module-level helper function for calculating safe withdrawal."""
    from treasury_service import calculate_safe_withdrawal as csw
    return csw(session)
