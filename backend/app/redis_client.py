import json
import logging
from typing import Any, Optional

import redis

from app.config import config

logger = logging.getLogger(__name__)


class RedisClient:
    def __init__(self) -> None:
        self.client = redis.from_url(config.REDIS_URL, decode_responses=True)

    def get(self, key: str) -> Optional[Any]:
        try:
            value = self.client.get(key)
            if value:
                return json.loads(value)
        except json.JSONDecodeError as exc:
            logger.error("Corrupt cache value for key %s: %s", key, exc)
        except redis.RedisError as exc:
            logger.warning("Redis GET error for key %s: %s", key, exc)
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        try:
            effective_ttl = ttl or config.CACHE_TTL
            self.client.setex(key, effective_ttl, json.dumps(value, default=str))
        except redis.RedisError as exc:
            logger.warning("Redis SET error for key %s: %s", key, exc)

    def delete(self, key: str) -> None:
        try:
            self.client.delete(key)
        except redis.RedisError as exc:
            logger.warning("Redis DELETE error for key %s: %s", key, exc)

    def exists(self, key: str) -> bool:
        try:
            return self.client.exists(key) > 0
        except redis.RedisError:
            return False


redis_client = RedisClient()
