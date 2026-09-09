from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from .briefing import build_briefing
from .graph_build import annotate_metrics, build_graph
from .js_extract import extract_js
from .python_extract import extract_python
from .walk import iter_code_files

LogFn = Callable[[str, str], None]


def analyze_tree(root: Path, log: LogFn | None = None) -> dict[str, Any]:
    def emit(stage: str, message: str) -> None:
        if log:
            log(stage, message)

    emit("walk", "Scanning repository for source files")
    files = iter_code_files(root)
    emit("walk", f"Found {len(files)} source files")

    emit("extract", "Parsing Python")
    py = extract_python(root, files)
    emit("extract", f"Python: {len(py.nodes)} nodes, {len(py.edges)} edges")

    emit("extract", "Parsing JavaScript / TypeScript")
    js = extract_js(root, files)
    emit("extract", f"JS/TS: {len(js.nodes)} nodes, {len(js.edges)} edges")

    extraction = py.merge(js)
    emit("graph", "Building dependency graph")
    graph = build_graph(extraction)
    metrics = annotate_metrics(graph)
    emit("graph", f"Graph: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges")

    emit("briefing", "Writing onboarding briefing")
    briefing = build_briefing(graph, metrics, extraction.warnings)

    nodes = []
    for nid, data in graph.nodes(data=True):
        row = dict(data)
        row["id"] = nid
        nodes.append(row)
    edges = []
    for src, dst, data in graph.edges(data=True):
        row = dict(data)
        row["source"] = src
        row["target"] = dst
        edges.append(row)

    return {
        "graph": graph,
        "nodes": nodes,
        "edges": edges,
        "metrics": metrics,
        "briefing": briefing,
        "warnings": extraction.warnings,
    }
