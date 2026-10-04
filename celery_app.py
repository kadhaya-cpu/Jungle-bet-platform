from celery import Celery

celery_app = Celery(
  "traffic_racer_worker",

  broker="redis://localhost:6379/0",
  backend="redis://localhost:6379/0"
)

celery_app.conf.update(
  task_serializer="json",
  accept_content=["json"],
  result_serializer="json",
  timezone="UTC",
  enable_utc=True,
  task_acks_late=True, 
  worker_prefetch_multiplier=1,
)
