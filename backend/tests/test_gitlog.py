from pathlib import Path
import subprocess

from app.analyzer.gitlog import commit_changes, compare_commits, list_commits


def _git(cwd: Path, *args: str) -> None:
    subprocess.run(["git", "-c", "commit.gpgsign=false", *args], cwd=cwd, check=True, capture_output=True)


def test_commit_history_and_compare(tmp_path: Path):
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "config", "user.email", "test@example.com")
    _git(repo, "config", "user.name", "Test")
    (repo / "app.py").write_text("print(1)\n", encoding="utf-8")
    _git(repo, "add", "app.py")
    _git(repo, "commit", "-m", "first")
    (repo / "app.py").write_text("print(2)\n", encoding="utf-8")
    (repo / "util.py").write_text("x = 1\n", encoding="utf-8")
    _git(repo, "add", ".")
    _git(repo, "commit", "-m", "second")

    listed = list_commits(repo)
    assert listed["available"] is True
    assert len(listed["commits"]) == 2
    head = listed["commits"][0]
    base = listed["commits"][1]
    assert "second" in head["subject"]

    detail = commit_changes(repo, head["sha"])
    paths = {f["path"] for f in detail["files"]}
    assert "app.py" in paths
    assert "util.py" in paths

    diff = compare_commits(repo, base["sha"], head["sha"])
    assert diff["stats"]["total"] >= 1
