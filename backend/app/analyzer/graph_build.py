from __future__ import annotations

from collections import defaultdict
from typing import Any

import networkx as nx
from networkx.algorithms.community import louvain_communities

from .model import Extraction

ENTRY_HINTS = {
    "app.py",
    "main.py",
    "wsgi.py",
    "asgi.py",
    "manage.py",
    "index.js",
    "index.ts",
    "index.tsx",
    "main.js",
    "main.ts",
    "main.tsx",
    "cli.py",
    "server.py",
    "server.js",
}


def build_graph(extraction: Extraction) -> nx.DiGraph:
    graph = nx.DiGraph()
    for node in extraction.nodes:
        graph.add_node(node.id, **node.to_dict())
    for edge in extraction.edges:
        if edge.source not in graph:
            continue
        if edge.target not in graph:
            continue
        if graph.has_edge(edge.source, edge.target):
            existing = graph[edge.source][edge.target]
            if edge.relation != "contains" and existing.get("relation") == "contains":
                graph[edge.source][edge.target].update(edge.to_dict())
            continue
        graph.add_edge(edge.source, edge.target, **edge.to_dict())
    return graph


def annotate_metrics(graph: nx.DiGraph) -> dict[str, Any]:
    if graph.number_of_nodes() == 0:
        return {
            "pagerank": {},
            "communities": {},
            "community_labels": {},
            "god_nodes": [],
            "entry_points": [],
        }

    # PageRank on the full graph can be dominated by contains-edges.
    # Rank using dependency relations so "god" means "many dependents".
    dep = _dependency_graph(graph)
    if dep.number_of_edges() == 0:
        pagerank = {n: 1.0 / graph.number_of_nodes() for n in graph.nodes}
    else:
        pagerank = _pagerank(dep)

    for node, score in pagerank.items():
        if node in graph:
            graph.nodes[node]["pagerank"] = score
    for node in graph.nodes:
        graph.nodes[node].setdefault("pagerank", 0.0)
        graph.nodes[node]["in_degree"] = int(dep.in_degree(node)) if node in dep else 0
        graph.nodes[node]["out_degree"] = int(dep.out_degree(node)) if node in dep else 0
        graph.nodes[node]["dependents"] = int(dep.in_degree(node)) if node in dep else 0

    undirected = dep.to_undirected() if dep.number_of_nodes() else graph.to_undirected()
    communities_raw = []
    if undirected.number_of_nodes():
        try:
            communities_raw = list(louvain_communities(undirected, seed=42))
        except Exception:
            communities_raw = [set(undirected.nodes())]

    community_of: dict[str, int] = {}
    community_labels: dict[int, str] = {}
    for idx, members in enumerate(communities_raw):
        community_of.update({n: idx for n in members})
        community_labels[idx] = _label_community(graph, members)

    for node in graph.nodes:
        cid = community_of.get(node)
        graph.nodes[node]["community_id"] = cid

    files = [
        n
        for n, data in graph.nodes(data=True)
        if data.get("kind") == "file"
    ]
    files_sorted = sorted(files, key=lambda n: graph.nodes[n].get("pagerank", 0.0), reverse=True)
    god_nodes = []
    for nid in files_sorted[:12]:
        data = graph.nodes[nid]
        god_nodes.append(
            {
                "id": nid,
                "name": data.get("name"),
                "path": data.get("path"),
                "pagerank": data.get("pagerank", 0),
                "dependents": data.get("dependents", 0),
                "language": data.get("language"),
                "loc": data.get("loc", 0),
            }
        )

    entry_points = []
    for nid in files:
        data = graph.nodes[nid]
        name = (data.get("name") or "").lower()
        path = (data.get("path") or "").lower()
        if name in ENTRY_HINTS or path.endswith("/" + name) and name in ENTRY_HINTS:
            entry_points.append(
                {
                    "id": nid,
                    "name": data.get("name"),
                    "path": data.get("path"),
                    "language": data.get("language"),
                }
            )
    if not entry_points:
        entry_points = [
            {"id": n, "name": graph.nodes[n].get("name"), "path": graph.nodes[n].get("path"), "language": graph.nodes[n].get("language")}
            for n in files_sorted[:3]
        ]

    return {
        "pagerank": pagerank,
        "communities": {str(k): sorted(v) for k, v in enumerate(communities_raw)},
        "community_labels": {str(k): v for k, v in community_labels.items()},
        "god_nodes": god_nodes,
        "entry_points": entry_points,
    }


def _pagerank(graph: nx.DiGraph, alpha: float = 0.85, iters: int = 40) -> dict[str, float]:
    """Pure-Python PageRank so ORION does not require SciPy/NumPy."""
    nodes = list(graph.nodes())
    n = len(nodes)
    if n == 0:
        return {}
    rank = {node: 1.0 / n for node in nodes}
    dangling = [node for node in nodes if graph.out_degree(node) == 0]
    for _ in range(iters):
        dangling_sum = alpha * sum(rank[node] for node in dangling) / n
        nxt = {node: (1.0 - alpha) / n + dangling_sum for node in nodes}
        for src, dst in graph.edges():
            out = graph.out_degree(src)
            if out:
                nxt[dst] += alpha * rank[src] / out
        rank = nxt
    total = sum(rank.values()) or 1.0
    return {node: value / total for node, value in rank.items()}


def _dependency_graph(graph: nx.DiGraph) -> nx.DiGraph:
    dep = nx.DiGraph()
    for node, data in graph.nodes(data=True):
        dep.add_node(node, **data)
    for src, dst, data in graph.edges(data=True):
        if data.get("relation") in {"imports", "calls", "inherits"}:
            dep.add_edge(src, dst, **data)
    return dep


def _label_community(graph: nx.DiGraph, members: set[str]) -> str:
    prefixes: dict[str, int] = defaultdict(int)
    for nid in members:
        data = graph.nodes[nid]
        if data.get("kind") != "file":
            continue
        path = data.get("path") or ""
        parts = path.split("/")
        if len(parts) >= 2:
            prefixes[parts[0]] += 1
        else:
            prefixes[parts[0].rsplit(".", 1)[0]] += 1
    if not prefixes:
        kinds = [graph.nodes[n].get("kind") for n in members]
        if kinds.count("external") == len(kinds):
            return "External libraries"
        return "Core"
    top = max(prefixes.items(), key=lambda kv: kv[1])[0]
    pretty = top.replace("_", " ").replace("-", " ").strip() or "Core"
    return pretty.title()
