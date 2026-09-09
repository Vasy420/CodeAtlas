from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    source_type: Mapped[str] = mapped_column(String(20))
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")
    stage: Mapped[str] = mapped_column(String(40), default="queued")
    log: Mapped[str] = mapped_column(Text, default="")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    workspace_path: Mapped[str] = mapped_column(String(500))
    language_stats: Mapped[str] = mapped_column(Text, default="{}")
    briefing_json: Mapped[str] = mapped_column(Text, default="{}")
    loc: Mapped[int] = mapped_column(Integer, default=0)
    file_count: Mapped[int] = mapped_column(Integer, default=0)
    node_count: Mapped[int] = mapped_column(Integer, default=0)
    edge_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    nodes: Mapped[list["GraphNode"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    edges: Mapped[list["GraphEdge"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class GraphNode(Base):
    __tablename__ = "graph_nodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    node_key: Mapped[str] = mapped_column(String(400), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(200))
    qualified_name: Mapped[str] = mapped_column(String(400), default="")
    path: Mapped[str] = mapped_column(String(400), default="")
    language: Mapped[str] = mapped_column(String(40), default="")
    start_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    loc: Mapped[int] = mapped_column(Integer, default=0)
    pagerank: Mapped[float] = mapped_column(Float, default=0.0)
    community_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    in_degree: Mapped[int] = mapped_column(Integer, default=0)
    out_degree: Mapped[int] = mapped_column(Integer, default=0)
    dependents: Mapped[int] = mapped_column(Integer, default=0)

    project: Mapped[Project] = relationship(back_populates="nodes")


class GraphEdge(Base):
    __tablename__ = "graph_edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    source_key: Mapped[str] = mapped_column(String(400), index=True)
    target_key: Mapped[str] = mapped_column(String(400), index=True)
    relation: Mapped[str] = mapped_column(String(20))
    confidence: Mapped[str] = mapped_column(String(20))
    weight: Mapped[float] = mapped_column(Float, default=1.0)

    project: Mapped[Project] = relationship(back_populates="edges")
