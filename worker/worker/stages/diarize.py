from common import db
from ..ctx import SR
from ..errors import RejectError


def merge_adjacent(turns, max_gap):
    out = []
    for t in turns:
        if out and out[-1]["label"] == t["label"] and t["start"] - out[-1]["end"] <= max_gap:
            out[-1]["end"] = max(out[-1]["end"], t["end"])
        else:
            out.append(dict(t))
    return out


def annotate_overlaps(turns):
    for t in turns:
        t["is_overlap"] = False
    for i, a in enumerate(turns):
        for b in turns[i + 1:]:
            if b["start"] >= a["end"]:
                break
            if b["label"] != a["label"] and min(a["end"], b["end"]) > max(a["start"], b["start"]):
                a["is_overlap"] = b["is_overlap"] = True
    return turns


def snap_to_vad(turns, vad, tol):
    edges = sorted({e for r in vad for e in r})

    def nearest(x):
        if not edges:
            return x, False
        c = min(edges, key=lambda e: abs(e - x))
        return (c, True) if abs(c - x) <= tol else (x, False)

    for t in turns:
        t["start"], s1 = nearest(t["start"])
        t["end"], s2 = nearest(t["end"])
        t["snapped"] = s1 or s2
        if t["end"] <= t["start"]:
            t["end"] = t["start"] + 0.05
    return turns


def clean_turns(raw, vad, cfg):
    t = sorted(raw, key=lambda x: x["start"])
    t = [x for x in t if x["end"] - x["start"] >= cfg.min_turn_s]
    t = merge_adjacent(t, cfg.merge_gap_s)
    t = annotate_overlaps(t)
    t = snap_to_vad(t, vad, cfg.vad_snap_tol_s)
    t = [x for x in t if x["end"] - x["start"] >= cfg.min_turn_s]
    for i, x in enumerate(t):
        x["idx"] = i
    return t


async def run(ctx):
    import torch
    kwargs = {"min_speakers": ctx.cfg.diar_min_speakers, "max_speakers": ctx.cfg.diar_max_speakers}
    ann = ctx.pool.diar(
        {"waveform": torch.from_numpy(ctx.audio_clean).unsqueeze(0), "sample_rate": SR}, **kwargs)

    raw = [{"start": seg.start, "end": seg.end, "label": lbl}
           for seg, _, lbl in ann.itertracks(yield_label=True)]

    turns = clean_turns(raw, ctx.vad, ctx.cfg)
    if not turns:
        raise RejectError("NO_SPEAKER_TURNS", "diarization produced no usable turns")

    ctx.turns = turns
    labels = {t["label"] for t in turns}

    overlap_s = sum(t["end"] - t["start"] for t in turns if t["is_overlap"])
    if ctx.speech_s and overlap_s / ctx.speech_s > ctx.cfg.overlap_warn_ratio:
        ctx.warn("HIGH_OVERLAP", ratio=overlap_s / ctx.speech_s)
    if len(labels) == ctx.cfg.diar_max_speakers:
        ctx.warn("SPEAKER_COUNT_AT_CEILING", n=len(labels))

    for t in turns:
        await db.execute(
            """INSERT INTO speaker_turns (clip_id, idx, local_label, start_s, end_s, is_overlap, snapped)
               VALUES ($1,$2,$3,$4,$5,$6,$7)""",
            ctx.clip_id, t["idx"], t["label"], t["start"], t["end"], t["is_overlap"], t["snapped"])
