from __future__ import annotations

import re
import subprocess
from pathlib import Path

SHA_RE = re.compile(r"^[0-9a-f]{7,40}$", re.I)
STATUS_LABEL = {
    "A": "added",
    "M": "modified",
    "D": "deleted",
    "R": "renamed",
    "C": "copied",
    "T": "typechange",
}


def is_git_repo(root: Path) -> bool:
    return (root / ".git").exists()


def list_commits(root: Path, limit: int = 40) -> dict:
    if not is_git_repo(root):
        return {
            "available": False,
            "reason": "This map was not cloned from Git, so there is no commit history.",
            "commits": [],
        }
    raw = _run(
        root,
        ["git", "log", f"-n{limit}", "--date=short", "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s"],
    )
    commits = []
    for line in raw.splitlines():
        parts = line.split("\x1f")
        if len(parts) < 5:
            continue
        sha, short, author, date, subject = parts[0], parts[1], parts[2], parts[3], parts[4]
        commits.append(
            {
                "sha": sha,
                "short": short,
                "author": author,
                "date": date,
                "subject": subject,
            }
        )
    return {"available": True, "reason": None, "commits": commits}


def commit_changes(root: Path, sha: str) -> dict:
    sha = _clean_sha(sha)
    if not is_git_repo(root):
        return {"available": False, "sha": sha, "files": [], "stats": _empty_stats()}
    files = _parse_name_status(
        _run(root, ["git", "diff-tree", "--no-commit-id", "--name-status", "-r", "--root", sha])
    )
    # re-fetch this commit's message
    pretty = _run(root, ["git", "log", "-n1", "--date=short", "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s", sha])
    parts = pretty.split("\x1f")
    commit = {
        "sha": parts[0] if len(parts) > 0 else sha,
        "short": parts[1] if len(parts) > 1 else sha[:7],
        "author": parts[2] if len(parts) > 2 else "",
        "date": parts[3] if len(parts) > 3 else "",
        "subject": parts[4] if len(parts) > 4 else "",
    }
    return {
        "available": True,
        "commit": commit,
        "files": files,
        "stats": _stats(files),
    }


def compare_commits(root: Path, base: str, head: str) -> dict:
    base = _clean_sha(base)
    head = _clean_sha(head)
    if not is_git_repo(root):
        return {"available": False, "base": base, "head": head, "files": [], "stats": _empty_stats()}
    files = _parse_name_status(_run(root, ["git", "diff", "--name-status", f"{base}...{head}"]))
    return {
        "available": True,
        "base": base,
        "head": head,
        "files": files,
        "stats": _stats(files),
    }


def _clean_sha(value: str) -> str:
    value = (value or "").strip().lower()
    if not SHA_RE.match(value):
        raise ValueError("Invalid commit id")
    return value


def _parse_name_status(raw: str) -> list[dict]:
    files = []
    for line in raw.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        status = parts[0][0] if parts else "M"
        path = parts[-1] if parts else ""
        if not path:
            continue
        files.append(
            {
                "path": path.replace("\\", "/"),
                "status": status,
                "label": STATUS_LABEL.get(status, status),
                "node_id": f"file:{path.replace('\\', '/')}",
            }
        )
    return files


def _stats(files: list[dict]) -> dict:
    counts = {"added": 0, "modified": 0, "deleted": 0, "renamed": 0, "other": 0}
    for row in files:
        key = row["label"] if row["label"] in counts else "other"
        counts[key] += 1
    counts["total"] = len(files)
    return counts


def _empty_stats() -> dict:
    return {"added": 0, "modified": 0, "deleted": 0, "renamed": 0, "other": 0, "total": 0}


def _run(root: Path, args: list[str]) -> str:
    try:
        proc = subprocess.run(
            args,
            cwd=root,
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        return ""
    return proc.stdout or ""
