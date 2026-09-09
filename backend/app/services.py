from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.analyzer.impact import compute_impact
from app.analyzer.ingest import IngestError, ingest_git, ingest_path, ingest_sample, ingest_zip
from app.analyzer.pipeline import analyze_tree
from app.config import SAMPLES_DIR, WORKSPACES_DIR
from app.models import GraphEdge, GraphNode, Project

_lock = threading.Lock()
_jobs: dict[str, threading.Thread] = {}


def list_samples() -> list[dict]:
    samples = []
    if not SAMPLES_DIR.exists():
        return samples
    for path in sorted(SAMPLES_DIR.iterdir()):
        if path.is_dir():
            readme = path / "README.md"
            blurb = ""
            if readme.exists():
                text = readme.read_text(encoding="utf-8", errors="replace")
                lines = [ln.strip() for ln in text.splitlines() if ln.strip() and not ln.startswith("#")]
                blurb = lines[0] if lines else path.name
            samples.append({"id": path.name, "name": path.name.title(), "blurb": blurb})
    return samples


def create_project(
    db: Session,
    *,
    name: str | None,
    source_type: str,
    source_url: str | None = None,
    sample_id: str | None = None,
    zip_path: Path | None = None,
    local_path: Path | None = None,
) -> Project:
    project_id = uuid.uuid4().hex[:16]
    workspace = WORKSPACES_DIR / project_id
    display = name or sample_id or (source_url.split("/")[-1].replace(".git", "") if source_url else None) or "untitled"
    project = Project(
        id=project_id,
        name=display,
        source_type=source_type,
        source_url=source_url or sample_id,
        status="queued",
        stage="queued",
        workspace_path=str(workspace),
        log="",
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    def run() -> None:
        _analyze(project_id, source_type, source_url, sample_id, zip_path, local_path)

    thread = threading.Thread(target=run, name=f"orion-{project_id}", daemon=True)
    with _lock:
        _jobs[project_id] = thread
    thread.start()
    return project


def _append_log(project_id: str, stage: str, message: str) -> None:
    from app.db import SessionLocal

    db = SessionLocal()
    try:
        project = db.get(Project, project_id)
        if not project:
            return
        stamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
        line = f"[{stamp}] {stage}: {message}"
        project.log = (project.log + "\n" if project.log else "") + line
        project.stage = stage
        if stage == "ready":
            project.status = "ready"
        elif stage == "failed":
            project.status = "failed"
        elif project.status not in {"ready", "failed"}:
            project.status = "running"
        db.commit()
    finally:
        db.close()


def _analyze(
    project_id: str,
    source_type: str,
    source_url: str | None,
    sample_id: str | None,
    zip_path: Path | None,
    local_path: Path | None,
) -> None:
    from app.db import SessionLocal

    def log(stage: str, message: str) -> None:
        _append_log(project_id, stage, message)

    def fail(exc: Exception) -> None:
        db = SessionLocal()
        try:
            project = db.get(Project, project_id)
            if project:
                project.status = "failed"
                project.stage = "failed"
                project.error = str(exc)[:800]
                db.commit()
        finally:
            db.close()
        log("failed", str(exc)[:400])

    db = SessionLocal()
    try:
        project = db.get(Project, project_id)
        if not project:
            return
        workspace = Path(project.workspace_path)
        WORKSPACES_DIR.mkdir(parents=True, exist_ok=True)
        project.status = "running"
        project.stage = "ingest"
        db.commit()
    except Exception as exc:
        fail(exc)
        with _lock:
            _jobs.pop(project_id, None)
        return
    finally:
        db.close()

    try:
        log("ingest", "Collecting source")
        if source_type == "sample":
            ingest_sample(workspace, sample_id or "northstar")
        elif source_type == "git":
            ingest_git(workspace, source_url or "")
        elif source_type == "zip":
            if not zip_path:
                raise IngestError("Missing zip file")
            ingest_zip(workspace, zip_path)
        elif source_type == "path":
            if not local_path:
                raise IngestError("Missing path")
            ingest_path(workspace, local_path)
        else:
            raise IngestError(f"Unknown source type {source_type}")
        log("ingest", "Source ready")
        result = analyze_tree(workspace, log=log)
    except Exception as exc:
        fail(exc)
        with _lock:
            _jobs.pop(project_id, None)
        return

    db = SessionLocal()
    try:
        project = db.get(Project, project_id)
        if not project:
            return
        db.query(GraphNode).filter(GraphNode.project_id == project_id).delete()
        db.query(GraphEdge).filter(GraphEdge.project_id == project_id).delete()
        for node in result["nodes"]:
            db.add(
                GraphNode(
                    project_id=project_id,
                    node_key=node["id"],
                    kind=node.get("kind") or "file",
                    name=str(node.get("name") or "")[:200],
                    qualified_name=str(node.get("qualified_name") or "")[:400],
                    path=str(node.get("path") or "")[:400],
                    language=str(node.get("language") or "")[:40],
                    start_line=node.get("start_line"),
                    end_line=node.get("end_line"),
                    loc=int(node.get("loc") or 0),
                    pagerank=float(node.get("pagerank") or 0),
                    community_id=node.get("community_id"),
                    in_degree=int(node.get("in_degree") or 0),
                    out_degree=int(node.get("out_degree") or 0),
                    dependents=int(node.get("dependents") or 0),
                )
            )
        for edge in result["edges"]:
            db.add(
                GraphEdge(
                    project_id=project_id,
                    source_key=edge["source"],
                    target_key=edge["target"],
                    relation=str(edge.get("relation") or "imports"),
                    confidence=str(edge.get("confidence") or "extracted"),
                    weight=float(edge.get("weight") or 1),
                )
            )
        briefing = result["briefing"]
        project.briefing_json = json.dumps(briefing)
        project.language_stats = json.dumps(briefing.get("stats", {}).get("languages", {}))
        project.loc = int(briefing.get("stats", {}).get("loc") or 0)
        project.file_count = int(briefing.get("stats", {}).get("files") or 0)
        project.node_count = int(briefing.get("stats", {}).get("nodes") or 0)
        project.edge_count = int(briefing.get("stats", {}).get("edges") or 0)
        project.status = "ready"
        project.stage = "ready"
        project.error = None
        db.commit()
        log("ready", "Analysis complete")
    except Exception as exc:
        db.rollback()
        fail(exc)
    finally:
        db.close()
        with _lock:
            _jobs.pop(project_id, None)


def project_to_dict(project: Project) -> dict:
    stats = {}
    try:
        stats = json.loads(project.language_stats or "{}")
    except json.JSONDecodeError:
        stats = {}
    return {
        "id": project.id,
        "name": project.name,
        "source_type": project.source_type,
        "source_url": project.source_url,
        "status": project.status,
        "stage": project.stage,
        "error": project.error,
        "log": project.log,
        "loc": project.loc,
        "file_count": project.file_count,
        "node_count": project.node_count,
        "edge_count": project.edge_count,
        "languages": stats,
        "created_at": project.created_at.isoformat() if project.created_at else None,
    }


def load_networkx(db: Session, project_id: str):
    import networkx as nx

    nodes = db.query(GraphNode).filter(GraphNode.project_id == project_id).all()
    edges = db.query(GraphEdge).filter(GraphEdge.project_id == project_id).all()
    graph = nx.DiGraph()
    for node in nodes:
        graph.add_node(
            node.node_key,
            id=node.node_key,
            kind=node.kind,
            name=node.name,
            qualified_name=node.qualified_name,
            path=node.path,
            language=node.language,
            start_line=node.start_line,
            end_line=node.end_line,
            loc=node.loc,
            pagerank=node.pagerank,
            community_id=node.community_id,
            in_degree=node.in_degree,
            out_degree=node.out_degree,
            dependents=node.dependents,
        )
    for edge in edges:
        graph.add_edge(
            edge.source_key,
            edge.target_key,
            relation=edge.relation,
            confidence=edge.confidence,
            weight=edge.weight,
        )
    return graph


def serialize_node(node: GraphNode) -> dict:
    return {
        "id": node.node_key,
        "kind": node.kind,
        "name": node.name,
        "qualified_name": node.qualified_name,
        "path": node.path,
        "language": node.language,
        "start_line": node.start_line,
        "end_line": node.end_line,
        "loc": node.loc,
        "pagerank": node.pagerank,
        "community_id": node.community_id,
        "in_degree": node.in_degree,
        "out_degree": node.out_degree,
        "dependents": node.dependents,
    }


def serialize_edge(edge: GraphEdge) -> dict:
    return {
        "source": edge.source_key,
        "target": edge.target_key,
        "relation": edge.relation,
        "confidence": edge.confidence,
        "weight": edge.weight,
    }


def impact_for(db: Session, project_id: str, seed: str, depth: int, include_callees: bool) -> dict:
    graph = load_networkx(db, project_id)
    return compute_impact(graph, seed, depth=depth, include_callees=include_callees)
