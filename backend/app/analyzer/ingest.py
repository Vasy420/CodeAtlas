from __future__ import annotations

import shutil
import subprocess
import zipfile
from pathlib import Path
from urllib.parse import urlparse

from app.config import CLONE_TIMEOUT_SEC, SAMPLES_DIR


class IngestError(ValueError):
    pass


def ingest_sample(dest: Path, sample_id: str) -> Path:
    src = SAMPLES_DIR / sample_id
    if not src.is_dir():
        raise IngestError(f"Unknown sample '{sample_id}'")
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src, dest)
    return dest


def ingest_zip(dest: Path, zip_path: Path) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(dest)
    return _unwrap_single_root(dest)


def ingest_git(dest: Path, url: str) -> Path:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https", "git"}:
        raise IngestError("Git URL must be http(s)")
    if dest.exists():
        shutil.rmtree(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            ["git", "clone", "--depth", "50", "--single-branch", url, str(dest)],
            check=True,
            capture_output=True,
            text=True,
            timeout=CLONE_TIMEOUT_SEC,
        )
    except subprocess.TimeoutExpired as exc:
        raise IngestError("Clone timed out") from exc
    except subprocess.CalledProcessError as exc:
        err = (exc.stderr or exc.stdout or "git clone failed").strip()
        raise IngestError(err[:400]) from exc
    except FileNotFoundError as exc:
        raise IngestError("git is not installed on this machine") from exc
    return dest


def ingest_path(dest: Path, src: Path) -> Path:
    src = src.resolve()
    if not src.is_dir():
        raise IngestError("Path is not a directory")
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src, dest, ignore=shutil.ignore_patterns(".git", "node_modules", ".venv", "venv"))
    return dest


def _unwrap_single_root(dest: Path) -> Path:
    children = [p for p in dest.iterdir() if p.name not in {".", ".."}]
    if len(children) == 1 and children[0].is_dir():
        inner = children[0]
        tmp = dest.parent / f"{dest.name}__unwrap"
        if tmp.exists():
            shutil.rmtree(tmp)
        shutil.move(str(inner), str(tmp))
        shutil.rmtree(dest)
        shutil.move(str(tmp), str(dest))
    return dest
