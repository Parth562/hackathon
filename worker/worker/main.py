import asyncio
import os

import structlog
from arq.connections import RedisSettings

import numpy as np

from common.config import get_settings, get_effective_settings
from common import db, storage
from .ctx import SR
from .audio.decode import decode_to_array
from .audio.enhance import highpass, loudness_normalize
from .pool import ModelPool
from .pipeline import process_clip
from .events import init_events, emit_live
from .stages.transcribe import compression_ratio, BOILERPLATE

log = structlog.get_logger()

# how often (in chunks) a locked live session re-opens language detection instead of
# forcing the pinned language — lets genuine code-switching catch up within ~40s
# (6 chunks * 7s) instead of being stuck on whatever chunk 0 happened to detect
LIVE_LANG_RECHECK_EVERY = 6


async def startup(ctx):
    cfg = get_settings()
    ctx["cfg"] = cfg
    await db.init_pool(cfg)
    await init_events(cfg.redis_url)
    ctx["pool"] = ModelPool(cfg)
    load_ms = await ctx["pool"].load()
    ctx["gpu_sem"] = asyncio.Semaphore(cfg.worker_concurrency)
    # CPU-only whisper/pyannote calls already saturate every core by themselves — running
    # two concurrently doesn't parallelize, it thrashes (each ~2-4x slower), which is fatal
    # for live chunks where a growing backlog means falling further behind in real time.
    # One dedicated lane keeps each chunk fast so the queue actually drains.
    ctx["live_sem"] = asyncio.Semaphore(1 if ctx["pool"].device == "cpu" else cfg.worker_concurrency)
    # per-session language lock + periodic recheck state (see LIVE_LANG_RECHECK_EVERY) —
    # a fresh chunk re-guessing language from scratch every time is unstable on that little audio
    ctx["live_lang"] = {}
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


def _precondition(audio: np.ndarray, cfg) -> np.ndarray:
    # matches the batch pipeline's cheap (non-model) preprocessing step-for-step, minus
    # denoise (noisereduce) — that one alone was ~260ms/s of audio in the batch run, too
    # much of the chunk budget for what raw mic input needs to become intelligible
    audio = audio - float(np.mean(audio))
    audio = highpass(audio, SR, cfg.highpass_hz)
    audio, _ = loudness_normalize(audio, SR, cfg.target_lufs)
    return audio


def _is_hallucination(text: str, avg_logprob: float, no_speech_prob: float) -> bool:
    # same heuristics the batch pipeline uses to drop dead air/repetition/boilerplate —
    # a live chunk with no real speech in it should render as nothing, not ghost text
    t = text.lower().strip()
    if no_speech_prob > 0.85 and avg_logprob < -0.9:
        return True
    if len(t) > 12 and compression_ratio(t) > 2.4:
        return True
    return t in BOILERPLATE


async def transcribe_live_chunk_job(ctx, session_id: str, chunk_rel_path: str, seq: int):
    # deliberately skips denoise/VAD/diarization — a fast, standalone ASR pass per
    # chunk is what keeps this "near-live" instead of adding another 20-40s of lag
    cfg = get_settings()
    path = storage.resolve(cfg, chunk_rel_path)
    text, error = "", None

    pinned = None if cfg.asr_language == "auto" else cfg.asr_language
    lang_state = None
    lang_arg = pinned
    if pinned is None:
        lang_state = ctx["live_lang"].setdefault(session_id, {"lang": None, "n": 0})
        lang_state["n"] += 1
        # re-open detection on chunk 1 (nothing locked yet) and periodically after —
        # otherwise force the locked language for decode stability on typical short chunks
        recheck = lang_state["lang"] is None or lang_state["n"] % LIVE_LANG_RECHECK_EVERY == 0
        lang_arg = None if recheck else lang_state["lang"]

    try:
        async with ctx["live_sem"]:
            audio = await asyncio.to_thread(decode_to_array, path, SR)
            audio = await asyncio.to_thread(_precondition, audio, cfg)
            segments, info = await asyncio.to_thread(
                ctx["pool"].asr.transcribe, audio, language=lang_arg, beam_size=cfg.asr_beam_size,
                word_timestamps=False, condition_on_previous_text=False,
                temperature=[0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
                compression_ratio_threshold=2.4, log_prob_threshold=-1.0,
                no_speech_threshold=0.6, vad_filter=True)
            segs = [{"text": s.text.strip(), "avg_logprob": s.avg_logprob, "no_speech_prob": s.no_speech_prob}
                    for s in segments]
            text = " ".join(s["text"] for s in segs
                             if not _is_hallucination(s["text"], s["avg_logprob"], s["no_speech_prob"])).strip()
            if lang_state is not None and info.language_probability > 0.6:
                lang_state["lang"] = info.language
    except ValueError as e:
        # vad_filter drops 100% of a pure-silence chunk and faster-whisper's internal
        # duration calc does max() on the (now empty) speech-chunk list — not a real error
        if "empty sequence" not in str(e):
            error = str(e)[:200]
            log.warning("live_chunk_failed", session_id=session_id, seq=seq, error=error)
    except Exception as e:
        error = str(e)[:200]
        log.warning("live_chunk_failed", session_id=session_id, seq=seq, error=error)
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
    await emit_live(session_id, seq, text, error)


class WorkerSettings:
    functions = [process_clip_job, transcribe_live_chunk_job]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
    max_jobs = get_settings().worker_concurrency
    job_timeout = get_settings().job_timeout_s
    max_tries = get_settings().job_max_attempts
    retry_delay = 5
    keep_result = 3600
