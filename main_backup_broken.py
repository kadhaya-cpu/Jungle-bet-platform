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

async def init_db():
   async with engine.begin() as conn:
     await conn.run_sync(Base.metadata.create_all)

app = FastAPI(title="TrafficRacer API", on_startup=[init_db])

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"], 
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)









limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)




pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "your-super-secret-key-change-in-production"
ALGORITHM = "HS256"
security = HTTPBearer()


def verify_password(plain_password, hashed_password):
  return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
  return pwd_context.hash(password[:72])

def create_access_token(data: dict):
  to_encode = data.copy()

  expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=60) 
  to_encode.update({"exp": expire})

  return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(
  credentials: HTTPAuthorizationCredentials = Depends(security),
  db: AsyncSession = Depends(get_db)
) -> models.User:
  token = credentials.credentials
  try:
     payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

     user_id: int = payload.get("user_id")
     if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

  except JWTError:
     raise HTTPException(status_code=401, detail="Invalid or expired token")

  result = await db.execute(select(models.User).where(models.User.id == user_id))
  user = result.scalar_one_or_none()
  if user is None:
     raise HTTPException(status_code=404, detail="User not found")
  return user

class UserRegister(BaseModel):
  username: str
  password: str

class UserLogin(BaseModel):
  username: str
  password: str


# ==========================================

# REAL-TIME EVENT STREAMING (SSE)

# ==========================================
active_streams = []

@app.get("/events/stream")
async def stream_events(request: Request):
   """Server-Sent Events endpoint for RUSH HOUR BET Live Feed."""
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
  message = {"type": event_type, "payload": payload}s
  for q in list(active_streams):
    try:
       q.put_nowait(message)
    except Exception:
       pass 

@app.post("/register")
@limiter.limit("3/minute")
async def register(request: Request, user_data: UserRegister, db: AsyncSession = Depends(get_db)):
  result = await db.execute(select(models.User).where(models.User.username == user_data.username))
  if result.scalar_one_or_none():
     raise HTTPException(status_code=400, detail="Username already registered")


  hashed_pw = get_password_hash(user_data.password)
  new_user = models.User(username=user_data.username, hashed_password=hashed_pw, v_coins=100.0)

  db.add(new_user)
  await db.flush()

  new_txn = models.Transaction(user_id=new_user.id, amount=100.0, type="deposit", description="Signup Bonus")

  db.add(new_txn)

  await db.commit() 
  await db.refresh(new_user)
 
  return {"message": "User registered successfully", "v_coins": new_user.v_coins}

@app.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, credentials: UserLogin, db: AsyncSession = Depends(get_db)):
  result = await db.execute(select(models.User).where(models.User.username == credentials.username))
  user = result.scalar_one_or_none()


  if not user or not verify_password(credentials.password, user.hashed_password):
     raise HTTPException(status_code=401, detail="Invalid username or password")

  token = create_access_token(data={"sub": user.username, "user_id": user.id})
  return {"access_token": token, "token_type": "bearer"}

@app.get("/me/balance")
@limiter.limit("60/minute")

async def get_balance(request: Request, current_user: models.User = Depends(get_current_user)):
  return {"username": current_user.username, "v_coins": current_user.v_coins}

@app.post("/bet/place")
@limiter.limit("20/minute")
async def place_bet(
  request: Request,
  current_user: models.User = Depends(get_current_user), 
  db: AsyncSession = Depends(get_db)
):
  body = await request.json()

  bet_type_str = body.get("bet_type")
  criteria = body.get("criteria")
  amount = float(body.get("amount"))

  if not bet_type_str or not criteria or not amount:

     raise HTTPException(status_code=400, detail="Missing required fields")

  if current_user.v_coins < amount:
     raise HTTPException(status_code=400, detail="Insufficient V-Coins")

  current_user.v_coins -= amount

  try:
     bet_enum = models.BetType(bet_type_str)

  except ValueError:
     raise HTTPException(status_code=400, detail=f"Invalid bet_type: {bet_type_str}")

  new_bet = models.Bet(
     user_id=current_user.id,
     bet_type=bet_enum, 
     criteria=criteria,
     amount=amount,

     status=models.BetStatus.PENDING
 
  )

  txn = models.Transaction(
     user_id=current_user.id,
     amount=amount,
     type="bet_placed",
     description=f"Placed {bet_type_str} bet"
  )

  db.add(new_bet)
  db.add(txn)
  await db.commit() 
  await db.refresh(new_bet)

  process_video_blurring.delay(new_bet.id)

  return {
    "message": "Bet placed successfully! Waiting for traffic analysis...", 
    "bet_id": new_bet.id,
    "remaining_balance": current_user.v_coins 
  }

@app.get("/bets/history")
@limiter.limit("30/minute")
async def get_bet_history(
  request: Request,
  current_user: models.User = Depends(get_current_user),
  db: AsyncSession = Depends(get_db)
):
  result = await db.execute(

    select(models.Bet)
    .where(models.Bet.user_id == current_user.id)
    .order_by(desc(models.Bet.created_at))
    .limit(20)
  )
  bets = result.scalars().all()

  history = []
  for bet in bets:
     history.append({

       "id": bet.id,

       "type": bet.bet_type.value,
 
       "criteria": bet.criteria,
       "amount": bet.amount,

       "status": bet.status,
       "resolution_data": bet.resolution_data,
       "created_at": bet.created_at.isoformat(),
       "resolved_at": bet.resolved_at.isoformat() if bet.resolved_at else None
     })  

  return {"history": history}



@app.get("/debug/simulate-cars")
async def simulate_cars():
  """Sends CAR_DETECTED events every 1.5 seconds for testing."""
  import asyncio
  async def generator():
    count = 0
    while True:
      await asyncio.sleep(1.5)
      count += 1
      msg = {"type": "CAR_DETECTED", "payload": {"count": count}}
      yield f"data: {json.dumps(msg)}\n\n"

  return StreamingResponse(generator(), media_type="text/event-stream")

