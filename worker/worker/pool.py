"""Warm, load-once model pool. Cold-constructing pyannote/whisper per job would dominate
the latency budget — this is built once at worker startup and reused for every clip."""
import time
from pathlib import Path

import numpy as np
import torch

from .ctx import SR


def resolve_device(cfg) -> str:
    if cfg.device in ("cpu", "cuda"):
        return cfg.device
    return "cuda" if torch.cuda.is_available() else "cpu"


def verify_models(model_dir: str) -> dict:
    import yaml
    reg = yaml.safe_load((Path(__file__).resolve().parents[1] / "models" / "REGISTRY.yaml").read_text())
    versions = {}
    for name, spec in reg["models"].items():
        d = Path(spec["local_dir"])
        if not d.exists() or not any(d.iterdir()):
            raise RuntimeError(f"model {name} missing at {d} — run models/prefetch.py at build time")
        versions[name] = f"{spec['id']}@{spec.get('revision', 'main')}"
    return versions


class ModelPool:
    def __init__(self, cfg):
        self.cfg = cfg
        self.device = resolve_device(cfg)
        self.versions = verify_models(cfg.model_dir)

    async def load(self):
        t0 = time.perf_counter()
        from faster_whisper import WhisperModel
        from pyannote.audio import Pipeline
        from speechbrain.inference import EncoderClassifier
        from sentence_transformers import SentenceTransformer

        md = Path(self.cfg.model_dir)
        self.asr = WhisperModel(
            str(md / "asr" / self.cfg.asr_model), device=self.device,
            compute_type=self.cfg.precision if self.device == "cuda" else "int8",
            local_files_only=True, num_workers=1)

        from silero_vad import load_silero_vad  # weights bundled in the wheel — no download
        self.vad = load_silero_vad()

        self.diar = Pipeline.from_pretrained(str(md / "diar" / self.cfg.diar_model / "config.yaml"))
        self.diar.to(torch.device(self.device))

        embed_dir = str(md / "embed" / self.cfg.embed_model)
        self.embedder = EncoderClassifier.from_hparams(
            source=embed_dir, savedir=embed_dir, run_opts={"device": self.device})

        self.text_embedder = SentenceTransformer(
            str(md / "text" / self.cfg.text_embed_model), device=self.device)

        await self.warmup()
        return int((time.perf_counter() - t0) * 1000)

    async def warmup(self):
        dummy = np.zeros(SR, dtype=np.float32)
        dummy[::100] = 0.01
        list(self.asr.transcribe(dummy, beam_size=1)[0])
        self.diar({"waveform": torch.from_numpy(dummy).unsqueeze(0), "sample_rate": SR}, num_speakers=1)
        self.embedder.encode_batch(torch.from_numpy(dummy).unsqueeze(0))
        self.text_embedder.encode(["warmup"])
