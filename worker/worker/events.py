import json
import time
import redis.asyncio as redis

_redis: "redis.Redis | None" = None


async def init_events(redis_url: str):
    global _redis
    _redis = redis.from_url(redis_url)


async def emit(clip_id: str, stage: str, state: str, **kw):
    if _redis is None:
        return
    await _redis.publish(f"job:{clip_id}",
                          json.dumps({"type": "stage", "stage": stage, "state": state, "t": time.time(), **kw}))
