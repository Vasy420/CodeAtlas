from __future__ import annotations

from pathlib import Path

from app.config import (
    CODE_EXTENSIONS,
    IGNORE_DIRS,
    MAX_FILE_BYTES,
    MAX_FILES,
    SKIP_SUFFIXES,
)

LANGUAGE_BY_EXT = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
}


def iter_code_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in IGNORE_DIRS for part in path.parts):
            continue
        suffix = path.suffix.lower()
        name = path.name.lower()
        if suffix not in CODE_EXTENSIONS:
            continue
        if any(name.endswith(s) for s in SKIP_SUFFIXES):
            continue
        try:
            size = path.stat().st_size
            if size > MAX_FILE_BYTES:
                continue
            if path.name == "__init__.py" and size < 80:
                continue
        except OSError:
            continue
        files.append(path)
        if len(files) >= MAX_FILES:
            break
    return sorted(files)


def language_for(path: Path) -> str:
    return LANGUAGE_BY_EXT.get(path.suffix.lower(), "unknown")


def rel_posix(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()
