from celery_app import celery_app
import time
import random
import asyncio
import datetime
from database import AsyncSessionLocal
from models import Bet, User, Transaction, BetStatus
from sqlalchemy import select
from resolver import resolve_bet

@celery_app.task(bind=True, name="process_video_blurring", max_retries=3)
def process_video_blurring(self, bet_id: int):
  print(f"[Worker {self.request.id}] Starting Analysis for Bet ID: {bet_id}...")

  try:
     delay = random.uniform(2.0, 5.0)
     time.sleep(delay)

     detected_cars = random.randint(3, 10)
     green_time = round(random.uniform(5.0, 45.0), 1)

     cv_output = {
       "detected_count": detected_cars,
       "green_light_duration": green_time,
       "video_url": f"https://cdn.trafficracer.com/videos/bet_{bet_id}_resolved.mp4",
       "processing_time_ms": int(delay * 1000)

     }

     print(f"[Worker {self.request.id}] Analysis Complete. Cars: {detected_cars}, Green Light: {green_time}s")

     loop = asyncio.new_event_loop()
     asyncio.set_event_loop(loop)
     try:
        loop.run_until_complete(update_database_with_result(bet_id, cv_output))
     finally:

        loop.close()

     return {"status": "completed", "bet_id": bet_id, "result_summary": cv_output}


  except Exception as exc:
     print(f"[Worker {self.request.id}] Error occurred: {exc}. Retrying...")
     raise self.retry(exc=exc, countdown=5)

async def update_database_with_result(bet_id: int, cv_output: dict):
  async with AsyncSessionLocal() as session:
    result = await session.execute(select(Bet).where(Bet.id == bet_id))
    bet = result.scalar_one_or_none()

    if not bet:
       print(f"[DB] Warning: Bet #{bet_id} not found!")
       return

    status, multiplier = resolve_bet(bet.criteria, cv_output, bet.bet_type.value)

    bet.status = status
    bet.resolution_data = cv_output
    bet.resolved_at = datetime.datetime.utcnow()

    if status == BetStatus.WON:
       payout_amount = bet.amount * multiplier

       user_res = await session.execute(select(User).where(User.id == bet.user_id))
       user = user_res.scalar_one_or_none()

       if user:
          user.v_coins += payout_amount

          txn = Transaction(
            user_id=bet.user_id,
            amount=payout_amount,
            type="bet_won",
            description=f"WON {payout_amount:.2f} V-Coins on Bet #{bet.id}"
          )
          session.add(txn)
          print(f"[DB] 🎉 WINNER! User '{user.username}' won {payout_amount:.2f} coins.")

     elif status == BetStatus.LOST:     
        print(f"[DB] 😞 Loss recorded for Bet #{bet_id}.")

     await session.commit()
