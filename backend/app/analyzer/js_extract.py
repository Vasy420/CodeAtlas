from __future__ import annotations

import re
from pathlib import Path

from .model import ExtractedEdge, ExtractedNode, Extraction
from .walk import language_for, rel_posix

JS_EXTS = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}

IMPORT_FROM_RE = re.compile(
    r"""(?:import|export)\s+(?:type\s+)?(?:[\w*\s{},$]+)\s+from\s+['"]([^'"]+)['"]""",
    re.MULTILINE,
)
IMPORT_BARE_RE = re.compile(r"""import\s+['"]([^'"]+)['"]""", re.MULTILINE)
REQUIRE_RE = re.compile(r"""require\(\s*['"]([^'"]+)['"]\s*\)""")
DYNAMIC_IMPORT_RE = re.compile(r"""import\(\s*['"]([^'"]+)['"]\s*\)""")

FUNCTION_RE = re.compile(
    r"""(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(""",
)
EXPORTED_FN_RE = re.compile(
    r"""export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(""",
)
CLASS_RE = re.compile(
    r"""(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)""",
)
ARROW_RE = re.compile(
    r"""(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>""",
)
METHOD_RE = re.compile(
    r"""^\s+(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{""",
    re.MULTILINE,
)

CALL_RE = re.compile(r"""\b([A-Za-z_$][\w$]*)\s*\(""")
IMPORT_NAMES_RE = re.compile(
    r"""import\s+(?:type\s+)?(?:([A-Za-z_$][\w$]*)(?:\s*,\s*)?)?(?:\{([^}]+)\})?\s+from\s+['"]([^'"]+)['"]"""
)

KEYWORDS = {
    "if",
    "for",
    "while",
    "switch",
    "catch",
    "function",
    "return",
    "new",
    "await",
    "void",
    "typeof",
    "delete",
    "class",
    "super",
    "this",
    "console",
    "Promise",
    "JSON",
    "Math",
    "Date",
    "Object",
    "Array",
    "Number",
    "String",
    "Boolean",
    "Error",
    "Map",
    "Set",
    "parseInt",
    "parseFloat",
    "isNaN",
    "setTimeout",
    "setInterval",
    "clearTimeout",
    "fetch",
    "require",
    "import",
}


def _strip_comments(source: str) -> str:
    source = re.sub(r"/\*[\s\S]*?\*/", lambda m: "\n" * m.group(0).count("\n"), source)
    source = re.sub(r"//[^\n]*", "", source)
    return source


def _file_id(rel: str) -> str:
    return f"file:{rel}"


def _fn_id(qname: str) -> str:
    return f"fn:{qname}"


def _class_id(qname: str) -> str:
    return f"class:{qname}"


def _ext_id(name: str) -> str:
    return f"ext:{name}"


def _count_loc(source: str) -> int:
    return sum(1 for line in source.splitlines() if line.strip() and not line.strip().startswith("//"))


def _spec_to_rel(root: Path, current: Path, spec: str, index: dict[str, str]) -> str | None:
    if spec.startswith("."):
        base = (current.parent / spec).resolve()
        candidates = []
        if base.suffix:
            candidates.append(base)
        else:
            for ext in (".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"):
                candidates.append(Path(str(base) + ext))
            candidates.append(base / "index.js")
            candidates.append(base / "index.ts")
            candidates.append(base / "index.tsx")
            candidates.append(base / "index.jsx")
        for cand in candidates:
            try:
                rel = cand.relative_to(root.resolve()).as_posix()
            except ValueError:
                continue
            if rel in index:
                return rel
        return None
    return None  # package import — external


def extract_js(root: Path, files: list[Path]) -> Extraction:
    js_files = [p for p in files if p.suffix.lower() in JS_EXTS]
    index: dict[str, str] = {}
    for path in js_files:
        rel = rel_posix(root, path)
        index[rel] = rel

    nodes: dict[str, ExtractedNode] = {}
    edges: list[ExtractedEdge] = []
    warnings: list[str] = []

    def add_node(node: ExtractedNode) -> None:
        nodes.setdefault(node.id, node)

    file_fns: dict[str, dict[str, str]] = {}  # rel -> name -> fn id

    for path in js_files:
        rel = rel_posix(root, path)
        lang = language_for(path)
        try:
            raw = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            warnings.append(f"{rel}: {exc}")
            continue
        source = _strip_comments(raw)
        loc = _count_loc(raw)
        add_node(
            ExtractedNode(
                id=_file_id(rel),
                kind="file",
                name=path.name,
                qualified_name=rel,
                path=rel,
                language=lang,
                start_line=1,
                end_line=raw.count("\n") + 1,
                loc=loc,
            )
        )
        qprefix = rel.rsplit(".", 1)[0].replace("/", ".")
        fns: dict[str, str] = {}
        for match in list(FUNCTION_RE.finditer(source)) + list(ARROW_RE.finditer(source)):
            name = match.group(1)
            qname = f"{qprefix}.{name}"
            fid = _fn_id(qname)
            line = source[: match.start()].count("\n") + 1
            add_node(
                ExtractedNode(
                    id=fid,
                    kind="function",
                    name=name,
                    qualified_name=qname,
                    path=rel,
                    language=lang,
                    start_line=line,
                    end_line=line,
                    loc=1,
                )
            )
            edges.append(
                ExtractedEdge(
                    source=_file_id(rel),
                    target=fid,
                    relation="contains",
                    confidence="extracted",
                )
            )
            fns[name] = fid
        for match in CLASS_RE.finditer(source):
            name = match.group(1)
            qname = f"{qprefix}.{name}"
            cid = _class_id(qname)
            line = source[: match.start()].count("\n") + 1
            add_node(
                ExtractedNode(
                    id=cid,
                    kind="class",
                    name=name,
                    qualified_name=qname,
                    path=rel,
                    language=lang,
                    start_line=line,
                    end_line=line,
                    loc=1,
                )
            )
            edges.append(
                ExtractedEdge(
                    source=_file_id(rel),
                    target=cid,
                    relation="contains",
                    confidence="extracted",
                )
            )
        file_fns[rel] = fns

    for path in js_files:
        rel = rel_posix(root, path)
        try:
            source = _strip_comments(path.read_text(encoding="utf-8", errors="replace"))
        except OSError:
            continue
        specs: list[str] = []
        specs += IMPORT_FROM_RE.findall(source)
        specs += IMPORT_BARE_RE.findall(source)
        specs += REQUIRE_RE.findall(source)
        specs += DYNAMIC_IMPORT_RE.findall(source)

        imported_names: dict[str, str] = {}  # local name -> spec
        for match in IMPORT_NAMES_RE.finditer(source):
            default, named, spec = match.group(1), match.group(2), match.group(3)
            if default:
                imported_names[default] = spec
            if named:
                for part in named.split(","):
                    part = part.strip()
                    if not part or part.startswith("type "):
                        continue
                    if " as " in part:
                        local = part.split(" as ")[-1].strip()
                    else:
                        local = part.strip()
                    imported_names[local] = spec

        seen_specs = set()
        for spec in specs:
            if spec in seen_specs:
                continue
            seen_specs.add(spec)
            target_rel = _spec_to_rel(root, path, spec, index)
            if target_rel and target_rel != rel:
                edges.append(
                    ExtractedEdge(
                        source=_file_id(rel),
                        target=_file_id(target_rel),
                        relation="imports",
                        confidence="extracted",
                    )
                )
            elif not spec.startswith("."):
                top = spec.split("/")[0]
                if top.startswith("@"):
                    bits = spec.split("/")
                    top = "/".join(bits[:2]) if len(bits) > 1 else top
                ext = _ext_id(top)
                add_node(
                    ExtractedNode(
                        id=ext,
                        kind="external",
                        name=top,
                        qualified_name=top,
                        path="",
                        language="javascript",
                    )
                )
                edges.append(
                    ExtractedEdge(
                        source=_file_id(rel),
                        target=ext,
                        relation="imports",
                        confidence="unresolved",
                    )
                )

        local_fns = file_fns.get(rel, {})
        for match in CALL_RE.finditer(source):
            name = match.group(1)
            if name in KEYWORDS:
                continue
            if name in local_fns:
                # find enclosing function roughly by nearest previous fn start — skip, just file-level caller
                # We attribute calls to the file's matching function if the call sits after its decl.
                caller = None
                call_pos = match.start()
                best = -1
                for fmatch in FUNCTION_RE.finditer(source):
                    if fmatch.start() < call_pos and fmatch.start() > best:
                        best = fmatch.start()
                        caller = fmatch.group(1)
                for fmatch in ARROW_RE.finditer(source):
                    if fmatch.start() < call_pos and fmatch.start() > best:
                        best = fmatch.start()
                        caller = fmatch.group(1)
                if caller and caller in local_fns and caller != name:
                    edges.append(
                        ExtractedEdge(
                            source=local_fns[caller],
                            target=local_fns[name],
                            relation="calls",
                            confidence="inferred",
                        )
                    )
            elif name in imported_names:
                spec = imported_names[name]
                target_rel = _spec_to_rel(root, path, spec, index)
                if target_rel:
                    target_fns = file_fns.get(target_rel, {})
                    target = target_fns.get(name) or _file_id(target_rel)
                    caller = None
                    call_pos = match.start()
                    best = -1
                    for fmatch in list(FUNCTION_RE.finditer(source)) + list(ARROW_RE.finditer(source)):
                        if fmatch.start() < call_pos and fmatch.start() > best:
                            best = fmatch.start()
                            caller = fmatch.group(1)
                    source_id = local_fns.get(caller) if caller else _file_id(rel)
                    if source_id:
                        edges.append(
                            ExtractedEdge(
                                source=source_id,
                                target=target,
                                relation="calls",
                                confidence="inferred",
                            )
                        )

    seen: set[tuple[str, str, str]] = set()
    deduped: list[ExtractedEdge] = []
    for edge in edges:
        key = (edge.source, edge.target, edge.relation)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(edge)
    return Extraction(nodes=list(nodes.values()), edges=deduped, warnings=warnings)
