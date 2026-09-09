import time

from fastapi.testclient import TestClient

from app.db import init_db
from app.main import app

init_db()
client = TestClient(app)


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_sample_analysis_and_impact():
    created = client.post("/api/projects/sample", json={"sample_id": "northstar"})
    assert created.status_code == 200
    project_id = created.json()["id"]

    deadline = time.time() + 30
    status = "queued"
    while time.time() < deadline:
        status = client.get(f"/api/projects/{project_id}").json()["status"]
        if status in {"ready", "failed"}:
            break
        time.sleep(0.2)
    assert status == "ready", client.get(f"/api/projects/{project_id}").json()

    briefing = client.get(f"/api/projects/{project_id}/briefing").json()
    assert briefing["briefing"]["stats"]["files"] >= 12

    graph = client.get(f"/api/projects/{project_id}/graph?kinds=file").json()
    session = next(n for n in graph["nodes"] if n["path"] == "auth/session.py")
    impact = client.post(
        f"/api/projects/{project_id}/impact",
        json={"seed": session["id"], "depth": 3},
    ).json()
    paths = {n["path"] for n in impact["affected"] if n.get("kind") == "file"}
    assert "orders/service.py" in paths
