from pathlib import Path

from app.analyzer.impact import compute_impact
from app.analyzer.pipeline import analyze_tree

ROOT = Path(__file__).resolve().parents[2]
NORTHSTAR = ROOT / "samples" / "northstar"


def test_northstar_extracts_python_and_js():
    result = analyze_tree(NORTHSTAR)
    briefing = result["briefing"]
    assert briefing["stats"]["files"] >= 12
    langs = briefing["stats"]["languages"]
    assert langs.get("python", 0) >= 10
    assert langs.get("javascript", 0) >= 3


def test_session_is_imported_by_orders_and_auth():
    result = analyze_tree(NORTHSTAR)
    edges = {(e["source"], e["target"], e["relation"]) for e in result["edges"]}
    assert (
        "file:orders/service.py",
        "file:auth/session.py",
        "imports",
    ) in edges
    assert (
        "file:auth/permissions.py",
        "file:auth/session.py",
        "imports",
    ) in edges
    assert (
        "file:auth/routes.py",
        "file:auth/session.py",
        "imports",
    ) in edges


def test_js_relative_imports():
    result = analyze_tree(NORTHSTAR)
    edges = {(e["source"], e["target"], e["relation"]) for e in result["edges"]}
    assert (
        "file:web/src/auth.js",
        "file:web/src/api.js",
        "imports",
    ) in edges
    assert (
        "file:web/src/cart.js",
        "file:web/src/auth.js",
        "imports",
    ) in edges


def test_changing_session_hits_orders():
    result = analyze_tree(NORTHSTAR)
    impact = compute_impact(result["graph"], "file:auth/session.py", depth=3)
    paths = {item["path"] for item in impact["affected"] if item.get("path")}
    assert "orders/service.py" in paths
    assert "auth/permissions.py" in paths
    assert "auth/routes.py" in paths
    # payments should not depend on session
    assert "orders/payments.py" not in paths


def test_god_nodes_include_session_or_db():
    result = analyze_tree(NORTHSTAR)
    gods = [g["path"] for g in result["metrics"]["god_nodes"]]
    assert "auth/session.py" in gods or "db.py" in gods
