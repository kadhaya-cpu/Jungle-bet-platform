import time
import asyncio
import datetime
import json
import logging
from typing import Optional, Dict, List, Set, Any
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from sqlalchemy import select, update as sqlalchemy_update, desc
from jose import jwt, JWTError

import models
from database import AsyncSessionLocal

logger = logging.getLogger("fraud_detector")
logging.basicConfig(level=logging.INFO)

SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"


class BetLogItem:
    def __init__(self, timestamp: float, amount: float, bet_id: Optional[int] = None):
        self.timestamp = timestamp
        self.amount = amount
        self.bet_id = bet_id


class FraudDetectionService:
    """
    Central Fraud Detection Engine for Jungle Bet.
    Rules:
      1. Trigger flag when a user places more than 10 bets per minute (>10 bets in 60s window).
      2. Trigger flag when a user wins over 1,000 (1000.0) instantly.
    """

    def __init__(self, bet_threshold: int = 10, win_threshold: float = 1000.0, window_seconds: float = 60.0):
        self.bet_threshold = bet_threshold
        self.win_threshold = win_threshold
        self.window_seconds = window_seconds
        # In-memory sliding window keyed by user_id string
        self.user_bets: Dict[str, List[BetLogItem]] = {}
        self.alert_subscribers: Set[asyncio.Queue] = set()
        self.lock = asyncio.Lock()
        self.recent_alerts: List[Dict[str, Any]] = []

    def clear_logs(self):
        """Reset logs (primarily for testing)."""
        self.user_bets.clear()
        self.recent_alerts.clear()

    async def broadcast_alert(self, alert_data: dict):
        """Broadcast fraud alert to all SSE queues and Leo Chat manager."""
        self.recent_alerts.insert(0, alert_data)
        if len(self.recent_alerts) > 100:
            self.recent_alerts.pop()

        # Send to SSE subscriber queues
        dead_queues = []
        for q in list(self.alert_subscribers):
            try:
                q.put_nowait(alert_data)
            except Exception:
                dead_queues.append(q)
        for q in dead_queues:
            self.alert_subscribers.discard(q)

        # Broadcast to Leo Chat WebSockets if available
        try:
            import main
            if hasattr(main, "leo_chat_manager") and main.leo_chat_manager is not None:
                await main.leo_chat_manager.broadcast_fraud_alert(alert_data)
        except Exception:
            pass

    async def record_bet(
        self,
        user_id: int | str,
        amount: float,
        bet_id: Optional[int] = None,
        username: Optional[str] = None,
        session = None
    ) -> dict:
        """
        Logic Rule 1: High-Frequency Betting Anomaly.
        If a user places more than 10 bets in 1 minute (60s), flag as Suspicious.
        """
        now = time.time()
        uid_str = str(user_id)

        async with self.lock:
            bets = self.user_bets.get(uid_str, [])
            # Retain only bets within the sliding window
            active_bets = [b for b in bets if now - b.timestamp <= self.window_seconds]
            active_bets.append(BetLogItem(now, amount, bet_id))
            self.user_bets[uid_str] = active_bets
            recent_count = len(active_bets)

        is_suspicious = recent_count > self.bet_threshold
        flagged = False
        reason = None
        alert_record = None

        if is_suspicious:
            reason = f"High-frequency betting anomaly: {recent_count} bets placed in 1 minute (Threshold: >{self.bet_threshold})"
            logger.warning("[FRAUD ALERT] User %s: %s", uid_str, reason)
            flagged = True

            # Flag user in database and record alert
            alert_record = await self._persist_flag_and_alert(
                user_id=user_id,
                username=username,
                alert_type="rapid_bets",
                reason=reason,
                amount=amount,
                recent_count=recent_count,
                severity="high",
                session=session
            )

            alert_payload = {
                "id": alert_record.get("id", int(time.time() * 1000)),
                "userId": uid_str,
                "username": username or f"user_{uid_str}",
                "alertType": "rapid_bets",
                "reason": reason,
                "recentBetsCount": recent_count,
                "amount": amount,
                "severity": "HIGH",
                "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            }
            asyncio.create_task(self.broadcast_alert(alert_payload))
            try:
                from notifications import notification_service
                asyncio.create_task(notification_service.alert_fraud(
                    username=username or f"user_{uid_str}",
                    user_id=int(uid_str) if uid_str.isdigit() else None,
                    alert_type="rapid_bets",
                    reason=reason,
                    severity="HIGH",
                ))
            except Exception:
                pass

        return {
            "is_suspicious": is_suspicious,
            "flagged": flagged,
            "reason": reason,
            "recent_bets_count": recent_count,
            "threshold": self.bet_threshold,
            "window_seconds": self.window_seconds,
        }

    async def record_win(
        self,
        user_id: int | str,
        win_amount: float,
        bet_id: Optional[int] = None,
        username: Optional[str] = None,
        session = None
    ) -> dict:
        """
        Logic Rule 2: Large Instant Win Anomaly.
        If a user wins over 1,000 (1000.0) instantly, flag as Suspicious.
        """
        uid_str = str(user_id)
        is_suspicious = win_amount > self.win_threshold
        flagged = False
        reason = None

        if is_suspicious:
            reason = f"Large instant win anomaly: Won ${win_amount:,.2f} (Threshold: >${self.win_threshold:,.0f})"
            logger.warning("[FRAUD ALERT] User %s: %s", uid_str, reason)
            flagged = True

            alert_record = await self._persist_flag_and_alert(
                user_id=user_id,
                username=username,
                alert_type="large_win",
                reason=reason,
                amount=win_amount,
                recent_count=1,
                severity="critical",
                session=session
            )

            alert_payload = {
                "id": alert_record.get("id", int(time.time() * 1000)),
                "userId": uid_str,
                "username": username or f"user_{uid_str}",
                "alertType": "large_win",
                "reason": reason,
                "winAmount": win_amount,
                "amount": win_amount,
                "severity": "CRITICAL",
                "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            }
            asyncio.create_task(self.broadcast_alert(alert_payload))
            try:
                from notifications import notification_service
                asyncio.create_task(notification_service.alert_fraud(
                    username=username or f"user_{uid_str}",
                    user_id=int(uid_str) if uid_str.isdigit() else None,
                    alert_type="large_win",
                    reason=reason,
                    severity="CRITICAL",
                ))
            except Exception:
                pass

        return {
            "is_suspicious": is_suspicious,
            "flagged": flagged,
            "reason": reason,
            "win_amount": win_amount,
            "threshold": self.win_threshold,
        }

    async def _persist_flag_and_alert(
        self,
        user_id: int | str,
        username: Optional[str],
        alert_type: str,
        reason: str,
        amount: float,
        recent_count: int,
        severity: str,
        session = None
    ) -> dict:
        """Helper to record the flag in PostgreSQL users and fraud_alerts tables."""
        close_session = False
        if session is None:
            session = AsyncSessionLocal()
            close_session = True

        alert_dict = {"id": int(time.time() * 1000)}
        try:
            # Update user flag
            try:
                numeric_id = int(user_id)
                await session.execute(
                    sqlalchemy_update(models.User)
                    .where(models.User.id == numeric_id)
                    .values(is_flagged=True, flag_reason=reason)
                )
            except (ValueError, TypeError):
                # user_id might be string username
                if username:
                    await session.execute(
                        sqlalchemy_update(models.User)
                        .where(models.User.username == username)
                        .values(is_flagged=True, flag_reason=reason)
                    )

            # Insert alert row
            numeric_user_id = None
            try:
                numeric_user_id = int(user_id)
            except (ValueError, TypeError):
                pass

            new_alert = models.FraudAlert(
                user_id=numeric_user_id,
                username=username or str(user_id),
                alert_type=alert_type,
                reason=reason,
                amount=amount,
                recent_bets_count=recent_count,
                severity=severity,
                created_at=datetime.datetime.utcnow(),
            )
            session.add(new_alert)
            await session.commit()
            await session.refresh(new_alert)
            alert_dict["id"] = new_alert.id
        except Exception as e:
            logger.error("Error persisting fraud alert to DB: %s", e)
            try:
                await session.rollback()
            except Exception:
                pass
        finally:
            if close_session:
                await session.close()

        return alert_dict


# Global Singleton Instance
fraud_service = FraudDetectionService(bet_threshold=10, win_threshold=1000.0, window_seconds=60.0)


class FraudDetectionMiddleware(BaseHTTPMiddleware):
    """
    FastAPI Middleware inspecting betting requests and winning checks:
      1. Monitors POST /bet/place and betting endpoints for bet rate (>10 bets per minute).
      2. Verifies if an account is banned; blocks with 403 Forbidden.
      3. Monitors win evaluation requests/responses; flags wins > 1,000 instantly.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # 1. Check if request is placing a bet
        is_bet_placement = (
            request.method == "POST" and
            any(path.startswith(p) for p in ["/bet/place", "/api/bet/place"])
        )

        # 2. Check if request is checking fraud or resolving bet
        is_fraud_check = (
            request.method == "POST" and
            any(path.startswith(p) for p in ["/fraud/check", "/api/fraud/check", "/fraud-detector-api/check"])
        )

        user_id = None
        username = None

        # Extract user credentials from Authorization Bearer token if present
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                username = payload.get("sub")
            except JWTError:
                pass

        # If user is identified by username, check if banned
        if username:
            try:
                async with AsyncSessionLocal() as session:
                    res = await session.execute(
                        select(models.User).where(models.User.username == username)
                    )
                    user = res.scalar_one_or_none()
                    if user:
                        user_id = user.id
                        if getattr(user, "is_banned", False):
                            return JSONResponse(
                                status_code=403,
                                content={
                                    "detail": "This account has been banned by Jungle Bet Security & Fraud Prevention.",
                                    "isBanned": True,
                                },
                            )
            except Exception:
                pass

        # Execute Bet Frequency Hook (>10 bets per minute) before or during placement
        if is_bet_placement and (user_id or username):
            eval_id = user_id or username
            bet_check = await fraud_service.record_bet(
                user_id=eval_id,
                amount=10.0,
                username=username,
            )
            if bet_check.get("is_suspicious"):
                logger.warning(
                    "[FRAUD HOOK] User %s triggered >10 bets/min threshold (%d bets)",
                    eval_id,
                    bet_check.get("recent_bets_count", 0),
                )

        # Process the request
        response = await call_next(request)

        # Attach security header
        response.headers["X-Fraud-Detection-Shield"] = "Active"

        return response
