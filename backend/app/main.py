from __future__ import annotations

import json
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import DATA_DIR, WORKSPACES_DIR, cors_origins
from app.db import get_db, init_db
from app.models import GraphEdge, GraphNode, Project
from app.services import (
    create_project,
    impact_for,
    list_samples,
    project_to_dict,
    serialize_edge,
    serialize_node,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    WORKSPACES_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="ORION", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GitIn(BaseModel):
    url: str
    name: str | None = None


class SampleIn(BaseModel):
    sample_id: str = "northstar"
    name: str | None = None


class ImpactIn(BaseModel):
    seed: str
    depth: int = Field(default=3, ge=1, le=8)
    include_callees: bool = False


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "name": "ORION"}


@app.get("/api/samples")
def samples() -> dict:
    return {"samples": list_samples()}


@app.get("/api/projects")
def list_projects(db: Session = Depends(get_db)) -> dict:
    rows = db.query(Project).order_by(Project.created_at.desc()).all()
    return {"projects": [project_to_dict(p) for p in rows]}


@app.post("/api/projects/git")
def create_from_git(body: GitIn, db: Session = Depends(get_db)) -> dict:
    project = create_project(db, name=body.name, source_type="git", source_url=body.url)
    return project_to_dict(project)


@app.post("/api/projects/sample")
def create_from_sample(body: SampleIn, db: Session = Depends(get_db)) -> dict:
    project = create_project(db, name=body.name, source_type="sample", sample_id=body.sample_id)
    return project_to_dict(project)


@app.post("/api/projects/zip")
async def create_from_zip(
    file: UploadFile = File(...),
    name: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> dict:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    uploads = DATA_DIR / "uploads"
    uploads.mkdir(exist_ok=True)
    suffix = Path(file.filename or "repo.zip").suffix or ".zip"
    dest = uploads / f"upload-{file.filename or 'repo'}{suffix}"
    # unique-ish
    dest = uploads / f"{Path(file.filename or 'repo').stem}-{id(file)}{suffix}"
    content = await file.read()
    dest.write_bytes(content)
    project = create_project(db, name=name or Path(file.filename or "upload").stem, source_type="zip", zip_path=dest)
    return project_to_dict(project)


@app.get("/api/projects/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db)) -> dict:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project_to_dict(project)


@app.get("/api/projects/{project_id}/briefing")
def get_briefing(project_id: str, db: Session = Depends(get_db)) -> dict:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if project.status != "ready":
        raise HTTPException(409, "Analysis is not ready")
    try:
        briefing = json.loads(project.briefing_json or "{}")
    except json.JSONDecodeError:
        briefing = {}
    return {"project": project_to_dict(project), "briefing": briefing}


@app.get("/api/projects/{project_id}/graph")
def get_graph(
    project_id: str,
    kinds: str = Query(default="file"),
    include_external: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> dict:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if project.status != "ready":
        raise HTTPException(409, "Analysis is not ready")
    kind_set = {k.strip() for k in kinds.split(",") if k.strip()}
    nodes_q = db.query(GraphNode).filter(GraphNode.project_id == project_id)
    if kind_set:
        nodes_q = nodes_q.filter(GraphNode.kind.in_(kind_set))
    if not include_external:
        nodes_q = nodes_q.filter(GraphNode.kind != "external")
    nodes = nodes_q.all()
    keys = {n.node_key for n in nodes}
    edges = (
        db.query(GraphEdge)
        .filter(GraphEdge.project_id == project_id)
        .all()
    )
    edge_payload = [
        serialize_edge(e)
        for e in edges
        if e.source_key in keys and e.target_key in keys
    ]
    communities = {}
    for node in nodes:
        if node.community_id is None:
            continue
        communities.setdefault(node.community_id, 0)
        communities[node.community_id] += 1
    return {
        "nodes": [serialize_node(n) for n in nodes],
        "edges": edge_payload,
        "communities": communities,
    }


@app.get("/api/projects/{project_id}/nodes")
def search_nodes(
    project_id: str,
    q: str = Query(default=""),
    kind: str | None = None,
    limit: int = Query(default=40, le=200),
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(GraphNode).filter(GraphNode.project_id == project_id)
    if kind:
        query = query.filter(GraphNode.kind == kind)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (GraphNode.name.ilike(like))
            | (GraphNode.path.ilike(like))
            | (GraphNode.qualified_name.ilike(like))
        )
    rows = query.order_by(GraphNode.pagerank.desc()).limit(limit).all()
    return {"nodes": [serialize_node(n) for n in rows]}


@app.get("/api/projects/{project_id}/node")
def get_node(project_id: str, key: str, db: Session = Depends(get_db)) -> dict:
    node = (
        db.query(GraphNode)
        .filter(GraphNode.project_id == project_id, GraphNode.node_key == key)
        .first()
    )
    if not node:
        raise HTTPException(404, "Node not found")
    incoming = (
        db.query(GraphEdge)
        .filter(GraphEdge.project_id == project_id, GraphEdge.target_key == node_key)
        .all()
    )
    outgoing = (
        db.query(GraphEdge)
        .filter(GraphEdge.project_id == project_id, GraphEdge.source_key == node_key)
        .all()
    )
    snippet = _read_snippet(db, project_id, node)
    return {
        "node": serialize_node(node),
        "incoming": [serialize_edge(e) for e in incoming],
        "outgoing": [serialize_edge(e) for e in outgoing],
        "snippet": snippet,
    }


@app.post("/api/projects/{project_id}/impact")
def post_impact(project_id: str, body: ImpactIn, db: Session = Depends(get_db)) -> dict:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if project.status != "ready":
        raise HTTPException(409, "Analysis is not ready")
    try:
        return impact_for(db, project_id, body.seed, body.depth, body.include_callees)
    except KeyError:
        raise HTTPException(404, "Seed node not found") from None


@app.get("/api/projects/{project_id}/source")
def get_source(
    project_id: str,
    path: str,
    start: int | None = None,
    end: int | None = None,
    db: Session = Depends(get_db),
) -> dict:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    root = Path(project.workspace_path).resolve()
    target = (root / path).resolve()
    if root not in target.parents and target != root:
        raise HTTPException(400, "Invalid path")
    if not target.is_file():
        raise HTTPException(404, "File not found")
    text = target.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    s = max(1, start or 1)
    e = min(len(lines), end or len(lines))
    return {
        "path": path,
        "start": s,
        "end": e,
        "text": "\n".join(lines[s - 1 : e]),
        "total_lines": len(lines),
    }


def _read_snippet(db: Session, project_id: str, node: GraphNode) -> dict | None:
    project = db.get(Project, project_id)
    if not project or not node.path:
        return None
    root = Path(project.workspace_path)
    target = root / node.path
    if not target.is_file():
        return None
    lines = target.read_text(encoding="utf-8", errors="replace").splitlines()
    start = node.start_line or 1
    end = node.end_line or min(len(lines), start + 40)
    start = max(1, start)
    end = min(len(lines), max(start, end))
    return {"path": node.path, "start": start, "end": end, "text": "\n".join(lines[start - 1 : end])}
