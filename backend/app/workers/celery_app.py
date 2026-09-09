"""Celery application configuration for asynchronous background tasks."""
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "cf_tracker_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,        # Max 5 minutes per task
    task_soft_time_limit=240,   # Soft limit 4 minutes
    result_expires=86400,       # 24 hours
    worker_prefetch_multiplier=1,
)
