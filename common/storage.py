"""Object storage → local disk. Single-node offline deployment has no use for an
S3-compatible service; swap for MinIO/S3 if this ever goes multi-node."""
import os
from pathlib import Path


def _base(cfg) -> Path:
    return Path(cfg.data_dir)


def raw_path(cfg, clip_id: str, ext: str) -> str:
    p = _base(cfg) / "raw" / f"{clip_id}{ext}"
    p.parent.mkdir(parents=True, exist_ok=True)
    return str(p)


def work_path(cfg, clip_id: str, name: str) -> str:
    p = _base(cfg) / "work" / clip_id / name
    p.parent.mkdir(parents=True, exist_ok=True)
    return str(p)


def export_path(cfg, clip_id: str, name: str) -> str:
    p = _base(cfg) / "exports" / clip_id / name
    p.parent.mkdir(parents=True, exist_ok=True)
    return str(p)


def delete_clip_files(cfg, clip_id: str):
    import shutil
    for sub in ("raw", "work", "exports"):
        d = _base(cfg) / sub
        for f in d.glob(f"{clip_id}*"):
            f.unlink(missing_ok=True)
        cd = d / clip_id
        if cd.is_dir():
            shutil.rmtree(cd, ignore_errors=True)
