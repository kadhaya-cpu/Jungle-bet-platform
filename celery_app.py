import os
from celery import Celery
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
)
