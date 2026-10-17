
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, Boolean, update as sqlalchemy_update
from sqlalchemy.orm import relationship, synonym
from sqlalchemy.dialects.postgresql import JSONB
from database import Base
import datetime

import enum

class BetStatus(str, enum.Enum):
  PENDING = "pending"
  WON = "won"
  LOST = "lost"

  VOID = "void"

class TransactionType(str, enum.Enum):
  DEPOSIT = "deposit"
  WITHDRAWAL = "withdrawal"
  BET_PLACED = "bet_placed"
  BET_WON = "bet_won"

class BetType(str, enum.Enum):
  COUNT_PREDICTION = "count_prediction"
  TIME_PREDICTION = "time_prediction"
  EVENT_TRIGGER = "event_trigger"

class User(Base):
  __tablename__ = "users"
  id = Column(Integer, primary_key=True, index=True)
  username = Column(String, unique=True, index=True, nullable=False)
  hashed_password = Column(String, nullable=True)
  phone = Column(String, unique=True, index=True, nullable=True)
  provider = Column(String, default="credentials", nullable=False)
  providerAccountId = Column(String, nullable=True, index=True)
  balance_usd = Column(Float, default=0.0)
  v_coins = synonym("balance_usd")
  preferred_currency = Column(String, default="UGX")
  location = Column(String, nullable=True)
  is_flagged = Column(Boolean, default=False)
  flag_reason = Column(String, nullable=True)
  is_banned = Column(Boolean, default=False)

  bets = relationship("Bet", back_populates="owner")
  transactions = relationship("Transaction", back_populates="owner")
  wallets = relationship("Wallet", back_populates="user")

class WalletType(str, enum.Enum):
  PLAYER = "PLAYER"
  HOUSE_REVENUE = "HOUSE_REVENUE"
  OPERATOR_BANK = "OPERATOR_BANK"
  OPERATOR_OPERATING = "OPERATOR_OPERATING"
  ESCROW = "ESCROW"
  LIQUIDITY_POOL = "LIQUIDITY_POOL"

class Wallet(Base):
  __tablename__ = "wallets"
  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
  type = Column(String, nullable=False, index=True)  # 'PLAYER' or 'HOUSE_REVENUE'
  currency = Column(String, default="USD", nullable=False)
  balance = Column(Float, default=0.0, nullable=False)
  locked_balance = Column(Float, default=0.0, nullable=False)
  status = Column(String, default="active", nullable=False)
  created_at = Column(DateTime, default=datetime.datetime.utcnow)
  updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

  user = relationship("User", back_populates="wallets")

class FraudAlert(Base):
  __tablename__ = "fraud_alerts"
  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
  username = Column(String, nullable=True)
  alert_type = Column(String, nullable=False)
  reason = Column(String, nullable=False)
  amount = Column(Float, nullable=True)
  recent_bets_count = Column(Integer, nullable=True)
  severity = Column(String, default="warning")
  created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Bet(Base):
  __tablename__ = "bets"
  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(Integer, ForeignKey("users.id"))
  bet_type = Column(Enum(BetType), nullable=False)
  criteria = Column(JSONB, nullable=False)
  amount = Column(Float, nullable=False)
  status = Column(String, default=BetStatus.PENDING)
  resolution_data = Column(JSONB, nullable=True)
  created_at = Column(DateTime, default=datetime.datetime.utcnow)
  resolved_at = Column(DateTime, nullable=True)

  owner = relationship("User", back_populates="bets")

class Transaction(Base):
  __tablename__ = "transactions"
  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
  amount = Column(Float, nullable=False)  # USD amount for deposits/withdrawals
  usd_credited = synonym("amount")
  local_currency_amount = Column(Float, nullable=True)
  local_in = synonym("local_currency_amount")
  exchange_rate_used = Column(Float, nullable=True)
  spread_profit_captured = Column(Float, nullable=True)
  spread_profit_kept = synonym("spread_profit_captured")
  type = Column(String, nullable=False)  # 'deposit', 'bet', 'win', 'withdrawal'
  source_wallet_id = Column(Integer, ForeignKey("wallets.id"), nullable=True)
  dest_wallet_id = Column(Integer, ForeignKey("wallets.id"), nullable=True)
  timestamp = Column(DateTime, default=datetime.datetime.utcnow)
  status = Column(String, default="completed")
  reference_id = Column(String, nullable=True)
  description = Column(String, nullable=True)
  created_at = Column(DateTime, default=datetime.datetime.utcnow)

  owner = relationship("User", back_populates="transactions")
  source_wallet = relationship("Wallet", foreign_keys=[source_wallet_id])
  dest_wallet = relationship("Wallet", foreign_keys=[dest_wallet_id])

class Settlement(Base):
  __tablename__ = "settlements"
  id = Column(Integer, primary_key=True, index=True)
  settlement_date = Column(DateTime, unique=True, nullable=False)
  total_turnover = Column(Float, default=0.0, nullable=False)
  total_payouts = Column(Float, default=0.0, nullable=False)
  total_losses = Column(Float, default=0.0, nullable=False)
  net_profit = Column(Float, default=0.0, nullable=False)
  operator_bank_account = Column(String, default="Stanbic Bank - IBAN GB29JUNGLE8839210", nullable=False)
  status = Column(String, default="PREPARED_FOR_TRANSFER", nullable=False)
  transfer_reference = Column(String, nullable=True)
  prepared_at = Column(DateTime, default=datetime.datetime.utcnow)
  settled_at = Column(DateTime, nullable=True)
  metadata_info = Column("metadata", JSONB, nullable=True)

class AlertNotification(Base):
  __tablename__ = "alert_notifications"
  id = Column(Integer, primary_key=True, index=True)
  alert_type = Column(String, nullable=False, index=True)
  title = Column(String, nullable=False)
  message = Column(String, nullable=False)
  channel = Column(String, default="telegram", nullable=False)
  status = Column(String, default="sent", nullable=False)
  payload = Column(JSONB, nullable=True)
  created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AuditLog(Base):
  __tablename__ = "audit_logs"
  id = Column(Integer, primary_key=True, index=True)
  event_type = Column(String, nullable=False, index=True)
  severity = Column(String, default="WARNING")
  details = Column(JSONB, nullable=True)
  message = Column(String, nullable=False)
  created_at = Column(DateTime, default=datetime.datetime.utcnow)

class CameraFeed(Base):
  __tablename__ = "camera_feeds"
  id = Column(Integer, primary_key=True, index=True)
  name = Column(String, nullable=False)
  location = Column(String, nullable=False)
  rtsp_url = Column(String, nullable=False)
  country_code = Column(String, nullable=False)
  status = Column(String, default="active")
  lane_mask = Column(JSONB, nullable=True)
  created_at = Column(DateTime, default=datetime.datetime.utcnow)
  updated_at = Column(DateTime, default=datetime.datetime.utcnow)
