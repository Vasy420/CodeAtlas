from __future__ import annotations

from collections import deque
from typing import Any

import networkx as nx


IMPACT_RELATIONS = {"imports", "calls", "inherits"}


def compute_impact(
    graph: nx.DiGraph,
    seed: str,
    depth: int = 3,
    include_callees: bool = False,
) -> dict[str, Any]:
    if seed not in graph:
        raise KeyError(seed)

    dep = nx.DiGraph()
    for node, data in graph.nodes(data=True):
        dep.add_node(node, **data)
    for src, dst, data in graph.edges(data=True):
        if data.get("relation") in IMPACT_RELATIONS:
            dep.add_edge(src, dst, **data)

    seeds = [seed]
    seed_data = graph.nodes[seed]
    if seed_data.get("kind") == "file":
        for _src, dst, data in graph.out_edges(seed, data=True):
            if data.get("relation") == "contains" and dst not in seeds:
                seeds.append(dst)
    elif seed_data.get("kind") in {"function", "class"}:
        # include the owning file so importers of the module show up
        for src, _dst, data in graph.in_edges(seed, data=True):
            if data.get("relation") == "contains" and src not in seeds:
                seeds.append(src)

    reverse = dep.reverse(copy=False)

    distance: dict[str, int] = {s: 0 for s in seeds if s in reverse or s in dep}
    parent_edge: dict[str, dict[str, Any]] = {}
    queue: deque[tuple[str, int]] = deque((s, 0) for s in seeds)

    while queue:
        node, dist = queue.popleft()
        if dist >= depth:
            continue
        neighbors = list(reverse.neighbors(node)) if node in reverse else []
        if include_callees and node in dep:
            neighbors += list(dep.neighbors(node))
        for nbr in neighbors:
            if nbr in distance:
                continue
            distance[nbr] = dist + 1
            # pick an edge record
            edge_data = {}
            if reverse.has_edge(node, nbr):
                edge_data = dict(reverse[node][nbr])
                parent_edge[nbr] = {
                    "from": nbr,
                    "to": node,
                    "relation": edge_data.get("relation"),
                    "confidence": edge_data.get("confidence"),
                }
            elif dep.has_edge(node, nbr):
                edge_data = dict(dep[node][nbr])
                parent_edge[nbr] = {
                    "from": node,
                    "to": nbr,
                    "relation": edge_data.get("relation"),
                    "confidence": edge_data.get("confidence"),
                }
            queue.append((nbr, dist + 1))

    affected = []
    files = set()
    communities = set()
    for nid, dist in sorted(distance.items(), key=lambda kv: (kv[1], graph.nodes[kv[0]].get("path") or "")):
        data = graph.nodes[nid]
        if nid in seeds and dist == 0:
            continue
        item = {
            "id": nid,
            "name": data.get("name"),
            "qualified_name": data.get("qualified_name"),
            "kind": data.get("kind"),
            "path": data.get("path"),
            "language": data.get("language"),
            "distance": dist,
            "relation": parent_edge.get(nid, {}).get("relation"),
            "confidence": parent_edge.get(nid, {}).get("confidence"),
            "community_id": data.get("community_id"),
        }
        affected.append(item)
        if data.get("kind") == "file" and data.get("path"):
            files.add(data["path"])
        if data.get("community_id") is not None:
            communities.add(data["community_id"])

    subgraph_nodes = set(distance.keys())
    subgraph_edges = []
    for src, dst, data in dep.edges(data=True):
        if src in subgraph_nodes and dst in subgraph_nodes:
            subgraph_edges.append(
                {
                    "source": src,
                    "target": dst,
                    "relation": data.get("relation"),
                    "confidence": data.get("confidence"),
                }
            )

    return {
        "seed": {
            "id": seed,
            "name": seed_data.get("name"),
            "kind": seed_data.get("kind"),
            "path": seed_data.get("path"),
            "qualified_name": seed_data.get("qualified_name"),
        },
        "depth": depth,
        "include_callees": include_callees,
        "summary": {
            "affected_nodes": len(affected),
            "affected_files": len(files),
            "affected_communities": len(communities),
        },
        "affected": affected,
        "nodes": [
            {
                "id": nid,
                **{k: v for k, v in graph.nodes[nid].items() if k != "extra"},
                "distance": distance.get(nid, 0),
                "is_seed": nid in seeds,
            }
            for nid in subgraph_nodes
        ],
        "edges": subgraph_edges,
    }
