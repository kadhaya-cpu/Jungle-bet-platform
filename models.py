
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
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
  hashed_password = Column(String, nullable=False)
  v_coins = Column(Float, default=100.0)

  bets = relationship("Bet", back_populates="owner")
  transactions = relationship("Transaction", back_populates="owner")

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
  user_id = Column(Integer, ForeignKey("users.id"))
  amount = Column(Float, nullable=False)
  type = Column(String, nullable=False)
  description = Column(String, nullable=True)
  created_at = Column(DateTime, default=datetime.datetime.utcnow)
  owner = relationship("User", back_populates="transactions")
