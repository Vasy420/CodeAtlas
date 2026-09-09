from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class ExtractedNode:
    id: str
    kind: str  # file | class | function | external
    name: str
    qualified_name: str
    path: str
    language: str
    start_line: int | None = None
    end_line: int | None = None
    loc: int = 0
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        extra = data.pop("extra") or {}
        data.update(extra)
        return data


@dataclass
class ExtractedEdge:
    source: str
    target: str
    relation: str  # contains | imports | calls | inherits
    confidence: str  # extracted | inferred | unresolved
    weight: float = 1.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Extraction:
    nodes: list[ExtractedNode] = field(default_factory=list)
    edges: list[ExtractedEdge] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def merge(self, other: "Extraction") -> "Extraction":
        return Extraction(
            nodes=self.nodes + other.nodes,
            edges=self.edges + other.edges,
            warnings=self.warnings + other.warnings,
        )
