"""Distributed Redis rate limiter ensuring compliance with Codeforces API limits."""
import asyncio
import time
import redis
import redis.asyncio as aioredis
from app.core.config import settings


class RedisRateLimiter:
    """Distributed rate limiter ensuring minimum interval between outbound API calls."""

    def __init__(self, key: str = "cf_api_rate_limiter", min_interval: float = 2.0):
        self.key = key
        self.min_interval = min_interval
        self._async_redis: aioredis.Redis | None = None
        self._sync_redis: redis.Redis | None = None

    def _get_async_redis(self) -> aioredis.Redis:
        if self._async_redis is None:
            self._async_redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._async_redis

    def _get_sync_redis(self) -> redis.Redis:
        if self._sync_redis is None:
            self._sync_redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._sync_redis

    async def acquire_async(self) -> None:
        """Asynchronously wait until the rate limit interval has elapsed."""
        r = self._get_async_redis()
        while True:
            now = time.time()
            # Atomically get last timestamp
            last_time_str = await r.get(self.key)
            last_time = float(last_time_str) if last_time_str else 0.0
            elapsed = now - last_time

            if elapsed >= self.min_interval:
                # Attempt to atomically claim the current time slot
                # Set with short TTL (e.g. 60 seconds)
                await r.set(self.key, str(now), ex=60)
                return
            else:
                sleep_time = self.min_interval - elapsed
                await asyncio.sleep(sleep_time)

    def acquire_sync(self) -> None:
        """Synchronously wait until the rate limit interval has elapsed (for Celery workers)."""
        r = self._get_sync_redis()
        while True:
            now = time.time()
            last_time_str = r.get(self.key)
            last_time = float(last_time_str) if last_time_str else 0.0
            elapsed = now - last_time

            if elapsed >= self.min_interval:
                r.set(self.key, str(now), ex=60)
                return
            else:
                sleep_time = self.min_interval - elapsed
                time.sleep(sleep_time)


# Singleton instance configured with settings.CF_RATE_LIMIT_DELAY (default 2.0s)
cf_rate_limiter = RedisRateLimiter(
    key="cf_api_rate_limiter",
    min_interval=settings.CF_RATE_LIMIT_DELAY
)
