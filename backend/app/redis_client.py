import redis
import json
from app.config import config
from typing import Optional, Any

class RedisClient:
    def __init__(self):
        self.client = redis.from_url(config.REDIS_URL, decode_responses=True)

    def get(self, key: str) -> Optional[Any]:
        try:
            value = self.client.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            print(f"Redis GET error: {e}")
        return None

    def set(self, key: str, value: Any, ttl: int = None):
        try:
            ttl = ttl or config.CACHE_TTL
            self.client.setex(key, ttl, json.dumps(value, default=str))
        except Exception as e:
            print(f"Redis SET error: {e}")

    def delete(self, key: str):
        try:
            self.client.delete(key)
        except Exception as e:
            print(f"Redis DELETE error: {e}")

    def exists(self, key: str) -> bool:
        return self.client.exists(key) > 0

redis_client = RedisClient()
