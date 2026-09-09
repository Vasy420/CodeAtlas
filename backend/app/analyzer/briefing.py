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
        "warnings": warnings[:40],
    }


def _narrative(langs: Counter, loc: int, gods: list, clusters: list, entries: list) -> str:
    lang_bits = ", ".join(f"{n} ({c} files)" for n, c in langs.most_common()) or "unknown languages"
    cluster_bits = ", ".join(c["label"] for c in clusters[:5]) or "a single core"
    god = gods[0]["path"] if gods else "the entry module"
    entry = entries[0]["path"] if entries else god
    return (
        f"This repository is about {loc:,} lines across {lang_bits}. "
        f"ORION grouped it into clusters: {cluster_bits}. "
        f"Start at {entry}. The highest-leverage file is {god} — "
        f"many other modules depend on it, so changes there have a wide blast radius."
    )
