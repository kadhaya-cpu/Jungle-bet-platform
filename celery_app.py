import os
from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

load_dotenv()

redis_url = (
    os.getenv("REDIS_URL")
    or os.getenv("REDIS_PRIVATE_URL")
    or os.getenv("REDIS_PUBLIC_URL")
    or os.getenv("CELERY_BROKER_URL")
    or "redis://localhost:6379/0"
)

celery_app = Celery(
  "traffic_racer_worker",

  broker=redis_url,
  backend=redis_url
)

celery_app.conf.update(
  task_serializer="json",
  accept_content=["json"],
  result_serializer="json",
  timezone="UTC",
  enable_utc=True,
  task_acks_late=True, 
  worker_prefetch_multiplier=1,
  include=["tasks"],
  beat_schedule={
    "daily_settlement_11_59_pm": {
      "task": "daily_settlement_task",
      "schedule": crontab(hour=23, minute=59),
    },
    "daily_treasury_sweep_2_am": {
      "task": "daily_treasury_sweep_task",
      "schedule": crontab(hour=2, minute=0),
    },
    "daily_profit_sweep": {
      "task": "daily_profit_sweep",
      "schedule": crontab(hour=2, minute=0),
    },
  },
)

