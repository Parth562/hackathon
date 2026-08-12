import numpy as np

from common import db, storage
from ..ctx import SR
from ..audio.decode import decode_to_array, write_wav
from ..audio.enhance import highpass, loudness_normalize, denoise, spectral_flatness
from ..audio.vad import detect_vad
from ..audio.quality import compute_quality
from ..errors import RejectError


async def run(ctx):
    audio = decode_to_array(ctx.raw_path, SR)
    audio = audio - float(np.mean(audio))          # DC removal
    audio = highpass(audio, SR, ctx.cfg.highpass_hz)

    audio, input_lufs = loudness_normalize(audio, SR, ctx.cfg.target_lufs)
    ctx.audio_norm = audio.copy()                  # fork: faithful copy for embeddings

    clean = denoise(audio, SR, ctx.cfg)
    ctx.audio_clean = clean                         # denoised copy for ASR/diarization

    clip_ratio = float(np.mean(np.abs(ctx.audio_norm) >= ctx.cfg.clipping_threshold))

    ctx.vad = detect_vad(ctx.audio_clean, SR, ctx.pool.vad, ctx.cfg)
    ctx.speech_s = sum(e - s for s, e in ctx.vad)

    if ctx.speech_s < ctx.cfg.min_total_speech_s:
        flat = spectral_flatness(ctx.audio_norm)
        code = "NO_SPEECH_DETECTED" if flat < 0.4 else "INSUFFICIENT_SPEECH"
        raise RejectError(code, f"only {ctx.speech_s:.2f}s of speech detected")

    ctx.quality = compute_quality(ctx.audio_norm, ctx.vad, SR, clip_ratio, input_lufs, ctx.cfg)
    if ctx.quality["grade"] == "poor":
        ctx.warn("POOR_AUDIO_QUALITY", snr_db=ctx.quality["snr_db"],
                  clipping_ratio=ctx.quality["clipping_ratio"], bandwidth_hz=ctx.quality["bandwidth_hz"])

    work_wav = storage.work_path(ctx.cfg, ctx.clip_id, "clean.wav")
    write_wav(work_wav, ctx.audio_clean, SR)
    await db.execute("UPDATE clips SET work_path=$2 WHERE id=$1", ctx.clip_id, work_wav)

    q = ctx.quality
    await db.execute(
        """INSERT INTO quality_metrics (clip_id, snr_db, clipping_ratio, silence_ratio,
               speech_duration_s, bandwidth_hz, dc_offset, input_lufs, grade)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)""",
        ctx.clip_id, q["snr_db"], q["clipping_ratio"], q["silence_ratio"],
        q["speech_duration_s"], q["bandwidth_hz"], q["dc_offset"], q["input_lufs"], q["grade"])
    for i, (s, e) in enumerate(ctx.vad):
        await db.insert("vad_regions", {"clip_id": ctx.clip_id, "idx": i, "start_s": s, "end_s": e})
