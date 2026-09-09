import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("ORION_DATA_DIR", ROOT / "data"))
SAMPLES_DIR = Path(os.environ.get("ORION_SAMPLES_DIR", ROOT / "samples"))
DATABASE_PATH = DATA_DIR / "orion.db"
WORKSPACES_DIR = DATA_DIR / "workspaces"

MAX_FILES = 5000
MAX_FILE_BYTES = 512_000
CLONE_TIMEOUT_SEC = int(os.environ.get("ORION_CLONE_TIMEOUT", "180"))

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]


def cors_origins() -> list[str]:
    extra = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
    return [*DEFAULT_CORS_ORIGINS, *extra]

IGNORE_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "env",
    "dist",
    "build",
    "__pycache__",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
    ".next",
    "coverage",
    "vendor",
    ".idea",
    ".vscode",
    "target",
    "out",
}

CODE_EXTENSIONS = {".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}
SKIP_SUFFIXES = {".min.js", ".min.mjs", ".min.cjs", ".d.ts"}
