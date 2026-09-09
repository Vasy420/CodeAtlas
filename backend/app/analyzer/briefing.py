from __future__ import annotations

from collections import Counter
from typing import Any

import networkx as nx


def build_briefing(graph: nx.DiGraph, metrics: dict[str, Any], warnings: list[str]) -> dict[str, Any]:
    files = [n for n, d in graph.nodes(data=True) if d.get("kind") == "file"]
    functions = [n for n, d in graph.nodes(data=True) if d.get("kind") == "function"]
    classes = [n for n, d in graph.nodes(data=True) if d.get("kind") == "class"]
    externals = [n for n, d in graph.nodes(data=True) if d.get("kind") == "external"]

    lang_counter: Counter[str] = Counter()
    loc_total = 0
    for nid in files:
        data = graph.nodes[nid]
        lang_counter[data.get("language") or "unknown"] += 1
        loc_total += int(data.get("loc") or 0)

    labels = metrics.get("community_labels") or {}
    clusters = []
    members_by = {}
    for nid, data in graph.nodes(data=True):
        cid = data.get("community_id")
        if cid is None or data.get("kind") != "file":
            continue
        members_by.setdefault(cid, []).append(nid)
    for cid, members in sorted(members_by.items(), key=lambda kv: -len(kv[1])):
        if len(members) < 2:
            continue
        clusters.append(
            {
                "id": cid,
                "label": labels.get(str(cid), f"Cluster {cid}"),
                "file_count": len(members),
                "files": [
                    graph.nodes[n].get("path")
                    for n in sorted(members, key=lambda x: graph.nodes[x].get("pagerank", 0), reverse=True)[:8]
                ],
            }
        )

    god_nodes = metrics.get("god_nodes") or []
    entry_points = metrics.get("entry_points") or []

    reading_path = []
    seen = set()
    for item in entry_points + god_nodes:
        path = item.get("path")
        if not path or path in seen:
            continue
        seen.add(path)
        reading_path.append(item)
        if len(reading_path) >= 8:
            break

    # Coupling: files with high in+out dependency degree
    coupled = []
    for nid in files:
        data = graph.nodes[nid]
        score = int(data.get("in_degree") or 0) + int(data.get("out_degree") or 0)
        if score >= 2:
            coupled.append(
                {
                    "id": nid,
                    "path": data.get("path"),
                    "name": data.get("name"),
                    "degree": score,
                    "dependents": data.get("dependents", 0),
                }
            )
    coupled.sort(key=lambda x: x["degree"], reverse=True)

    summary = _narrative(lang_counter, loc_total, god_nodes, clusters, entry_points)
    file_rows = [
        {
            "id": nid,
            "path": graph.nodes[nid].get("path"),
            "name": graph.nodes[nid].get("name"),
            "language": graph.nodes[nid].get("language"),
        }
        for nid in files
        if graph.nodes[nid].get("path")
    ]
    structure = _folder_tree(file_rows)
    external_deps = _external_deps(graph)

    continue_guide = {
        "start_here": [e.get("path") for e in entry_points if e.get("path")][:5],
        "read_next": [r.get("path") for r in reading_path if r.get("path")][:6],
        "change_carefully": [g.get("path") for g in god_nodes if g.get("path")][:6],
        "install_or_know": [e["name"] for e in external_deps[:12]],
    }

    return {
        "summary": summary,
        "stats": {
            "files": len(files),
            "functions": len(functions),
            "classes": len(classes),
            "externals": len(externals),
            "nodes": graph.number_of_nodes(),
            "edges": graph.number_of_edges(),
            "loc": loc_total,
            "languages": dict(lang_counter),
            "clusters": len(clusters),
        },
        "languages": [{"name": k, "files": v} for k, v in lang_counter.most_common()],
        "clusters": clusters,
        "god_nodes": god_nodes,
        "entry_points": entry_points,
        "reading_path": reading_path,
        "high_coupling": coupled[:10],
        "structure": structure,
        "external_deps": external_deps,
        "continue_guide": continue_guide,
        "warnings": warnings[:40],
    }


def _folder_tree(files: list[dict]) -> list[dict]:
    root: dict = {"dirs": {}, "files": []}
    for row in sorted(files, key=lambda r: r["path"]):
        parts = [p for p in row["path"].split("/") if p]
        if not parts:
            continue
        cursor = root
        for folder in parts[:-1]:
            cursor = cursor["dirs"].setdefault(folder, {"dirs": {}, "files": []})
        cursor["files"].append(row)

    def emit(node: dict) -> list[dict]:
        children: list[dict] = []
        for name, child in node["dirs"].items():
            children.append({"kind": "dir", "name": name, "children": emit(child)})
        for row in node["files"]:
            children.append(
                {
                    "kind": "file",
                    "name": row["name"],
                    "path": row["path"],
                    "id": row["id"],
                    "language": row.get("language"),
                    "children": [],
                }
            )
        return children

    return emit(root)


def _external_deps(graph: nx.DiGraph) -> list[dict]:
    rows = []
    for nid, data in graph.nodes(data=True):
        if data.get("kind") != "external":
            continue
        used_by = []
        for src, _dst, edge in graph.in_edges(nid, data=True):
            if edge.get("relation") != "imports":
                continue
            path = graph.nodes[src].get("path")
            if path:
                used_by.append(path)
        rows.append(
            {
                "id": nid,
                "name": data.get("name") or nid,
                "used_by": len(set(used_by)),
                "files": sorted(set(used_by))[:8],
            }
        )
    rows.sort(key=lambda r: (-r["used_by"], r["name"]))
    return rows


def _narrative(langs: Counter, loc: int, gods: list, clusters: list, entries: list) -> str:
    lang_bits = ", ".join(f"{n} ({c} files)" for n, c in langs.most_common()) or "unknown languages"
    cluster_bits = ", ".join(c["label"] for c in clusters[:5]) or "a single core"
    god = gods[0]["path"] if gods else "the entry module"
    entry = entries[0]["path"] if entries else god
    return (
        f"This repository is about {loc:,} lines across {lang_bits}. "
        f"CodeAtlas grouped it into clusters: {cluster_bits}. "
        f"Start at {entry}. The highest-leverage file is {god} — "
        f"many other modules depend on it, so changes there have a wide blast radius."
    )
