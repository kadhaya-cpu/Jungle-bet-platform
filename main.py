from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import models
from database import engine, get_db, Base
from passlib.context import CryptContext
from jose import jwt, JWTError
import datetime
from tasks import process_video_blurring
from fastapi.responses import StreamingResponse
import asyncio
import json

# ==========================================
# APP INITIALIZATION & SECURITY
# ==========================================
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Jungle Bet API", version="2.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# WIDE OPEN CORS FOR DEVELOPMENT
app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# ==========================================
# DATABASE INITIALIZATION
# ==========================================
async def init_db():
  async with engine.begin() as conn:
    await conn.run_sync(Base.metadata.create_all)

@app.on_event("startup")
async def startup_event():
  await init_db()

# ==========================================
# REAL-TIME EVENT STREAMING (SSE) - CLEAN VERSION
# ==========================================
active_streams = [] 

@app.get("/events/stream")
async def stream_events(request: Request):
  """Server-Sent Events endpoint for Jungle Bet Live Feed."""
  q = asyncio.Queue()
  active_streams.append(q)

  try:
     while True:
      if await request.is_disconnected():
         break

      try:
         data = await asyncio.wait_for(q.get(), timeout=5.0)
         yield f"data: {json.dumps(data)}\n\n"
      except asyncio.TimeoutError:
         yield ": ping\n\n"

  finally: 
    if q in active_streams:
       active_streams.remove(q)

def broadcast_event(event_type: str, payload: dict):
  """Helper called by Celery tasks to push updates to all connected clients."""
  message = {"type": event_type, "payload": payload}
  for q in list(active_streams):
    try:
       q.put_nowait(message)
    except Exception:
       pass

# ==========================================
# AUTH HELPERS
# ==========================================
def verify_password(plain_password, hashed_password):
  return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
  return pwd_context.hash(password)

def create_access_token(data: dict):
  to_encode = data.copy()
  expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES) 
  to_encode.update({"exp": expire})
  encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
  return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme), db: AsyncSession = Depends(get_db)):
  token = credentials.credentials
  try:
     payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
     username: str = payload.get("sub")
     if username is None:
        raise HTTPException(status_code=401, detail="Invalid token")
  except JWTError:
     raise HTTPException(status_code=401, detail="Invalid token")

  result = await db.execute(select(models.User).where(models.User.username == username))
  user = result.scalar_one_or_none()
  if user is None:
     raise HTTPException(status_code=401, detail="User not found")
  return user

# ==========================================
# SCHEMAS
# ==========================================
class UserCreate(BaseModel):
  username: str
  password: str

class UserLogin(BaseModel):
  username: str
  password: str

class BetPlace(BaseModel):
  bet_type: str
  criteria: dict
  amount: float

# ==========================================
# ROUTES
# ==========================================
@app.post("/register", response_model=dict)
@limiter.limit("5/minute")
async def register(user_data: UserCreate, request: Request, db: AsyncSession = Depends(get_db)):
  existing = await db.execute(select(models.User).where(models.User.username == user_data.username))
  if existing.scalar_one_or_none():
     raise HTTPException(status_code=400, detail="Username already exists")

  new_user = models.User(
     username=user_data.username,
     hashed_password=get_password_hash(user_data.password),
     v_coins=100.0
  )
  db.add(new_user)
  await db.commit()
  await db.refresh(new_user)
  return {"message": "User registered successfully", "v_coins": new_user.v_coins}

@app.post("/login", response_model=dict)
@limiter.limit("10/minute")
async def login(user_data: UserLogin, request: Request, db: AsyncSession = Depends(get_db)):
  result = await db.execute(select(models.User).where(models.User.username == user_data.username))
  user = result.scalar_one_or_none()

  if not user or not verify_password(user_data.password, user.hashed_password):
     raise HTTPException(status_code=401, detail="Invalid credentials")

  access_token = create_access_token(data={"sub": user.username})
  return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me/balance", response_model=dict)
async def get_balance(current_user: models.User = Depends(get_current_user)):
  return {"username": current_user.username, "v_coins": current_user.v_coins}

@app.post("/bet/place", response_model=dict)
@limiter.limit("20/minute")
async def place_bet(bet_data: BetPlace, request: Request, current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
  if current_user.v_coins < bet_data.amount:
     raise HTTPException(status_code=400, detail="Insufficient balance")

  # Deduct balance atomically
  stmt = models.sqlalchemy_update(models.User).where(models.User.id == current_user.id).values(v_coins=models.User.v_coins - bet_data.amount)
  await db.execute(stmt)

  # Create bet record
  new_bet = models.Bet(
    user_id=current_user.id,
    bet_type=bet_data.bet_type,
    criteria=bet_data.criteria,
    amount=bet_data.amount,
    status="pending"
  )
  db.add(new_bet)
  await db.commit()
  await db.refresh(new_bet)

  # Dispatch async worker task
  process_video_blurring.delay(new_bet.id)

  # Broadcast initial placement event
  broadcast_event("BET_PLACED", {"bet_id": new_bet.id, "user": current_user.username})

  return {"message": "Bet placed successfully! Waiting for traffic analysis...", "bet_id": new_bet.id, "remaining_balance": current_user.v_coins - bet_data.amount}
  
@app.get("/bets/history", response_model=list)  
async def get_history(current_user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
  result = await db.execute(select(models.Bet).where(models.Bet.user_id == current_user.id).order_by(desc(models.Bet.created_at)))
  bets = result.scalars().all()
  return [{ 
    "id": b.id,
    "type": b.bet_type.value if hasattr(b.bet_type, 'value') else str(b.bet_type),
    "criteria": b.criteria,
    "amount": b.amount,
    "status": b.status,
    "resolution_data": b.resolution_data,
    "created_at": b.created_at.isoformat() if b.created_at else None,
    "resolved_at": b.resolved_at.isoformat() if b.resolved_at else None
 } for b in bets]  

# ==========================================
# DEBUG SIMULATOR (Remove in Production!)
# ==========================================
@app.get("/debug/simulate-cars")
async def simulate_cars():
  """Sends CAR_DETECTED events every 1.5 seconds for testing."""
  async def generator():
    count = 0
    while True:
      await asyncio.sleep(1.5)
      count += 1
      msg = {"type": "CAR_DETECTED", "payload": {"count": count}}
      yield f"data: {json.dumps(msg)}\n\n"

  return StreamingResponse(generator(), media_type="text/event-stream") 
