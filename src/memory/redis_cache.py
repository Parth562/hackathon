import os
import json
import logging
from typing import Any, Callable, TypeVar, Optional
from functools import wraps

# Setup logging
logger = logging.getLogger(__name__)

# Redis Connection setup
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")

# Setup async client
try:
    import redis.asyncio as async_redis
    async_redis_client = async_redis.from_url(REDIS_URL, decode_responses=True)
except ImportError:
    async_redis_client = None

# Setup sync client
try:
    import redis as sync_redis
    sync_redis_client = sync_redis.from_url(REDIS_URL, decode_responses=True)
except ImportError:
    sync_redis_client = None

T = TypeVar("T")

async def aget_cache(key: str) -> Optional[Any]:
    if not async_redis_client: return None
    try:
        val = await async_redis_client.get(key)
        if val:
            return json.loads(val)
    except Exception as e:
        logger.warning(f"Redis get error for {key}: {e}")
    return None

async def aset_cache(key: str, value: Any, ttl_seconds: int = 3600):
    if not async_redis_client: return
    try:
        await async_redis_client.setex(key, ttl_seconds, json.dumps(value))
    except Exception as e:
        logger.warning(f"Redis set error for {key}: {e}")

def alru_cache(ttl_seconds: int = 3600):
    """
    Async LRU cache decorator using Redis.
    """
    def decorator(func: Callable[..., Any]):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not async_redis_client:
                return await func(*args, **kwargs)
                
            key_parts = [func.__name__]
            key_parts.extend([str(a) for a in args])
            key_parts.extend([f"{k}:{v}" for k, v in kwargs.items()])
            cache_key = "cache:" + ":".join(key_parts)
            
            cached_result = await aget_cache(cache_key)
            if cached_result is not None:
                return cached_result
                
            result = await func(*args, **kwargs)
            
            if result is not None and not (isinstance(result, dict) and "error" in result) and not (isinstance(result, str) and "error" in result.lower()):
                await aset_cache(cache_key, result, ttl_seconds)
                
            return result
        return wrapper
    return decorator

def sync_cache(ttl_seconds: int = 3600):
    """
    Sync cache decorator using Redis for non-async tools.
    """
    def decorator(func: Callable[..., Any]):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not sync_redis_client:
                return func(*args, **kwargs)
                
            key_parts = [func.__name__]
            key_parts.extend([str(a) for a in args])
            key_parts.extend([f"{k}:{v}" for k, v in kwargs.items()])
            cache_key = "cache:" + ":".join(key_parts)
            
            try:
                val = sync_redis_client.get(cache_key)
                if val:
                    return json.loads(val)
            except Exception as e:
                logger.warning(f"Sync Redis get error: {e}")
                
            result = func(*args, **kwargs)
            
            try:
                if result is not None and not (isinstance(result, dict) and "error" in result) and not (isinstance(result, str) and "error" in result.lower()):
                    sync_redis_client.setex(cache_key, ttl_seconds, json.dumps(result))
            except Exception as e:
                logger.warning(f"Sync Redis set error: {e}")
                
            return result
        return wrapper
    return decorator
