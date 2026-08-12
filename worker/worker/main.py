import asyncio

import structlog
from arq.connections import RedisSettings

from common.config import get_settings, get_effective_settings
from common import db
from .pool import ModelPool
from .pipeline import process_clip
from .events import init_events

log = structlog.get_logger()


async def startup(ctx):
    cfg = get_settings()
    ctx["cfg"] = cfg
    await db.init_pool(cfg)
    await init_events(cfg.redis_url)
    ctx["pool"] = ModelPool(cfg)
    load_ms = await ctx["pool"].load()
    ctx["gpu_sem"] = asyncio.Semaphore(cfg.worker_concurrency)
    log.info("worker_ready", device=ctx["pool"].device, models=ctx["pool"].versions, load_ms=load_ms)


async def shutdown(ctx):
    await db.close_pool()


async def process_clip_job(ctx, clip_id: str):
    async with ctx["gpu_sem"]:
        try:
            # fresh per job (not the startup-cached ctx["cfg"]) so Settings-page edits to
            # TUNABLE_FIELDS apply to the next job without a worker restart
            cfg = await get_effective_settings()
            await process_clip(clip_id, ctx["pool"], cfg)
        except Exception:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            raise


class WorkerSettings:
    functions = [process_clip_job]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
    max_jobs = get_settings().worker_concurrency
    job_timeout = get_settings().job_timeout_s
    max_tries = get_settings().job_max_attempts
    retry_delay = 5
    keep_result = 3600
