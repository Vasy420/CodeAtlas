from __future__ import annotations

import ast
from pathlib import Path

from .model import ExtractedEdge, ExtractedNode, Extraction
from .walk import language_for, rel_posix

CALL_SKIP = {
    "print",
    "len",
    "range",
    "int",
    "str",
    "float",
    "bool",
    "list",
    "dict",
    "set",
    "tuple",
    "type",
    "super",
    "isinstance",
    "issubclass",
    "enumerate",
    "zip",
    "map",
    "filter",
    "sorted",
    "min",
    "max",
    "sum",
    "open",
    "iter",
    "next",
    "abs",
    "any",
    "all",
    "getattr",
    "setattr",
    "hasattr",
    "repr",
    "format",
    "id",
    "hash",
    "hex",
    "oct",
    "bin",
    "ord",
    "chr",
    "round",
    "input",
    "property",
    "staticmethod",
    "classmethod",
    "classmethod",
}


def _module_name(root: Path, path: Path) -> str:
    rel = path.relative_to(root)
    parts = list(rel.parts)
    if parts[-1] == "__init__.py":
        parts = parts[:-1]
    else:
        parts[-1] = Path(parts[-1]).stem
    return ".".join(parts)


def _is_package(path: Path) -> bool:
    return path.name == "__init__.py"


def _parent_package(mod: str, is_package: bool) -> str:
    if is_package:
        return mod
    if "." not in mod:
        return ""
    return mod.rsplit(".", 1)[0]


def _resolve_from(current_mod: str, is_package: bool, module: str | None, level: int) -> str | None:
    if level == 0:
        return module or ""
    pkg = current_mod if is_package else _parent_package(current_mod, False)
    parts = pkg.split(".") if pkg else []
    up = level - 1
    if up > len(parts):
        return None
    base = parts[: len(parts) - up]
    if module:
        base.extend(module.split("."))
    return ".".join(p for p in base if p)


def _file_id(rel: str) -> str:
    return f"file:{rel}"


def _fn_id(qname: str) -> str:
    return f"fn:{qname}"


def _class_id(qname: str) -> str:
    return f"class:{qname}"


def _ext_id(name: str) -> str:
    return f"ext:{name}"


def _count_loc(source: str) -> int:
    return sum(1 for line in source.splitlines() if line.strip() and not line.strip().startswith("#"))


class _Collector(ast.NodeVisitor):
    def __init__(self, rel: str, mod: str) -> None:
        self.rel = rel
        self.mod = mod
        self.classes: list[ast.ClassDef] = []
        self.functions: list[tuple[str, ast.AST]] = []  # qualified name, node
        self.imports: list[ast.AST] = []
        self.class_stack: list[str] = []

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        qname = f"{self.mod}.{'.'.join(self.class_stack + [node.name])}" if self.mod else node.name
        self.classes.append(node)
        self.class_stack.append(node.name)
        self.generic_visit(node)
        self.class_stack.pop()
        # stash qname on the node for later
        node._orion_qname = qname  # type: ignore[attr-defined]

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._visit_fn(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self._visit_fn(node)

    def _visit_fn(self, node: ast.AST) -> None:
        name = getattr(node, "name", "")
        if self.class_stack:
            qname = f"{self.mod}.{'.'.join(self.class_stack)}.{name}" if self.mod else f"{'.'.join(self.class_stack)}.{name}"
        else:
            qname = f"{self.mod}.{name}" if self.mod else name
        self.functions.append((qname, node))
        node._orion_qname = qname  # type: ignore[attr-defined]
        self.generic_visit(node)

    def visit_Import(self, node: ast.Import) -> None:
        self.imports.append(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        self.imports.append(node)


def extract_python(root: Path, files: list[Path]) -> Extraction:
    py_files = [p for p in files if p.suffix == ".py"]
    module_to_rel: dict[str, str] = {}
    for path in py_files:
        rel = rel_posix(root, path)
        mod = _module_name(root, path)
        if mod:
            module_to_rel[mod] = rel

    nodes: dict[str, ExtractedNode] = {}
    edges: list[ExtractedEdge] = []
    warnings: list[str] = []

    def add_node(node: ExtractedNode) -> None:
        if node.id not in nodes:
            nodes[node.id] = node

    def lookup_module(name: str) -> str | None:
        if name in module_to_rel:
            return module_to_rel[name]
        # longest prefix match for `package.sub` when only package/__init__ exists
        return None

    parsed: list[tuple[Path, str, str, ast.AST, _Collector, str]] = []

    for path in py_files:
        rel = rel_posix(root, path)
        try:
            source = path.read_text(encoding="utf-8", errors="replace")
            tree = ast.parse(source, filename=rel)
        except SyntaxError as exc:
            warnings.append(f"{rel}: syntax error ({exc.msg})")
            continue
        except OSError as exc:
            warnings.append(f"{rel}: {exc}")
            continue

        mod = _module_name(root, path)
        loc = _count_loc(source)
        file_node = ExtractedNode(
            id=_file_id(rel),
            kind="file",
            name=path.name,
            qualified_name=mod or rel,
            path=rel,
            language="python",
            start_line=1,
            end_line=source.count("\n") + 1,
            loc=loc,
        )
        add_node(file_node)

        collector = _Collector(rel, mod)
        collector.visit(tree)
        parsed.append((path, rel, mod, tree, collector, source))

        for cls in collector.classes:
            qname = getattr(cls, "_orion_qname", f"{mod}.{cls.name}")
            cid = _class_id(qname)
            add_node(
                ExtractedNode(
                    id=cid,
                    kind="class",
                    name=cls.name,
                    qualified_name=qname,
                    path=rel,
                    language="python",
                    start_line=cls.lineno,
                    end_line=getattr(cls, "end_lineno", cls.lineno),
                    loc=max(1, (getattr(cls, "end_lineno", cls.lineno) or cls.lineno) - cls.lineno + 1),
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
            for base in cls.bases:
                base_name = _name_from_expr(base)
                if not base_name or base_name in {"object", "Exception", "BaseException"}:
                    continue
                # resolved later once aliases known; stash as attribute
                cls._orion_bases = getattr(cls, "_orion_bases", []) + [base_name]  # type: ignore[attr-defined]

        for qname, fn in collector.functions:
            fid = _fn_id(qname)
            add_node(
                ExtractedNode(
                    id=fid,
                    kind="function",
                    name=getattr(fn, "name", qname.split(".")[-1]),
                    qualified_name=qname,
                    path=rel,
                    language="python",
                    start_line=getattr(fn, "lineno", None),
                    end_line=getattr(fn, "end_lineno", None),
                    loc=max(
                        1,
                        (getattr(fn, "end_lineno", None) or getattr(fn, "lineno", 1))
                        - getattr(fn, "lineno", 1)
                        + 1,
                    ),
                )
            )
            # contain from class if method, else from file
            parent_class = qname.rsplit(".", 1)[0] if qname.count(".") >= 2 else None
            class_id = None
            if parent_class:
                maybe = _class_id(parent_class)
                # only if we actually created that class
                class_id = maybe
            if class_id and class_id in { _class_id(getattr(c, "_orion_qname", "")) for c in collector.classes }:
                edges.append(
                    ExtractedEdge(
                        source=class_id,
                        target=fid,
                        relation="contains",
                        confidence="extracted",
                    )
                )
            else:
                edges.append(
                    ExtractedEdge(
                        source=_file_id(rel),
                        target=fid,
                        relation="contains",
                        confidence="extracted",
                    )
                )

    # Second pass: imports, inheritance, calls (need the full module index)
    qname_to_fn = {n.qualified_name: n.id for n in nodes.values() if n.kind == "function"}
    qname_to_class = {n.qualified_name: n.id for n in nodes.values() if n.kind == "class"}
    simple_fn_index: dict[str, list[str]] = {}
    for qname, nid in qname_to_fn.items():
        simple_fn_index.setdefault(qname.split(".")[-1], []).append(nid)

    for path, rel, mod, tree, collector, _source in parsed:
        is_pkg = _is_package(path)
        aliases: dict[str, str] = {}  # local name -> module or module.symbol
        imported_modules: list[tuple[str, str]] = []  # (module_name, confidence)

        for node in collector.imports:
            if isinstance(node, ast.Import):
                for alias in node.names:
                    local = alias.asname or alias.name.split(".")[0]
                    aliases[local] = alias.name
                    imported_modules.append((alias.name, "extracted"))
            elif isinstance(node, ast.ImportFrom):
                resolved = _resolve_from(mod, is_pkg, node.module, node.level or 0)
                if resolved is None:
                    continue
                imported_modules.append((resolved, "extracted"))
                for alias in node.names:
                    if alias.name == "*":
                        aliases["*"] = resolved
                        continue
                    local = alias.asname or alias.name
                    aliases[local] = f"{resolved}.{alias.name}" if resolved else alias.name

        for module_name, conf in imported_modules:
            target_rel = lookup_module(module_name)
            if target_rel is None and "." in module_name:
                # try parent package
                target_rel = lookup_module(module_name.rsplit(".", 1)[0])
            if target_rel is None:
                # third-party / stdlib
                top = module_name.split(".")[0]
                ext = _ext_id(top)
                add_node(
                    ExtractedNode(
                        id=ext,
                        kind="external",
                        name=top,
                        qualified_name=top,
                        path="",
                        language="python",
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
            else:
                if target_rel != rel:
                    edges.append(
                        ExtractedEdge(
                            source=_file_id(rel),
                            target=_file_id(target_rel),
                            relation="imports",
                            confidence=conf,
                        )
                    )

        # inheritance
        for cls in collector.classes:
            qname = getattr(cls, "_orion_qname", f"{mod}.{cls.name}")
            for base_name in getattr(cls, "_orion_bases", []):
                target = _resolve_symbol(base_name, aliases, qname_to_class, mod)
                if target:
                    edges.append(
                        ExtractedEdge(
                            source=_class_id(qname),
                            target=target,
                            relation="inherits",
                            confidence="extracted",
                        )
                    )
                else:
                    # maybe imported alias
                    mapped = aliases.get(base_name.split(".")[0], base_name)
                    target = qname_to_class.get(mapped)
                    if target:
                        edges.append(
                            ExtractedEdge(
                                source=_class_id(qname),
                                target=target,
                                relation="inherits",
                                confidence="inferred",
                            )
                        )

        local_fns = {getattr(fn, "name"): qname for qname, fn in collector.functions if "." + getattr(fn, "name", "") in f".{qname}" and qname.rsplit(".", 1)[0] in {mod, *{getattr(c, "_orion_qname", "") for c in collector.classes}}}
        # simpler local map: unqualified name -> qname for functions defined in this file
        local_by_name: dict[str, str] = {}
        methods_by_class: dict[str, dict[str, str]] = {}
        for qname, fn in collector.functions:
            short = getattr(fn, "name", qname.split(".")[-1])
            parent = qname.rsplit(".", 1)[0]
            if parent == mod:
                local_by_name[short] = qname
            else:
                methods_by_class.setdefault(parent, {})[short] = qname

        for qname, fn in collector.functions:
            for call in ast.walk(fn):
                if not isinstance(call, ast.Call):
                    continue
                callee = call.func
                target_id = None
                confidence = "extracted"
                if isinstance(callee, ast.Name):
                    if callee.id in CALL_SKIP:
                        continue
                    if callee.id in local_by_name:
                        target_id = _fn_id(local_by_name[callee.id])
                    elif callee.id in aliases:
                        mapped = aliases[callee.id]
                        target_id = qname_to_fn.get(mapped) or qname_to_class.get(mapped)
                        if target_id is None:
                            # imported symbol — if it maps to a module file, infer a call to that file via fn name
                            mod_name = mapped.rsplit(".", 1)[0] if "." in mapped else mapped
                            trel = lookup_module(mod_name)
                            if trel:
                                # try module.symbol
                                target_id = qname_to_fn.get(mapped)
                                if target_id is None:
                                    confidence = "inferred"
                                    # still try file-level as last resort below
                    if target_id is None and callee.id in simple_fn_index and len(simple_fn_index[callee.id]) == 1:
                        target_id = simple_fn_index[callee.id][0]
                        confidence = "inferred"
                elif isinstance(callee, ast.Attribute):
                    attr = callee.attr
                    if isinstance(callee.value, ast.Name):
                        head = callee.value.id
                        if head == "self":
                            parent = qname.rsplit(".", 1)[0]
                            method_q = methods_by_class.get(parent, {}).get(attr)
                            if method_q:
                                target_id = _fn_id(method_q)
                        elif head in aliases:
                            mapped = aliases[head]
                            # mapped may be a module
                            candidate = f"{mapped}.{attr}"
                            target_id = qname_to_fn.get(candidate)
                            if target_id is None:
                                trel = lookup_module(mapped)
                                if trel:
                                    # function defined in that module
                                    candidate2 = f"{_module_name(root, root / trel) if False else mapped}.{attr}"
                                    target_id = qname_to_fn.get(candidate2)
                                    if target_id is None:
                                        # file-level inferred
                                        edges.append(
                                            ExtractedEdge(
                                                source=_fn_id(qname),
                                                target=_file_id(trel),
                                                relation="calls",
                                                confidence="inferred",
                                            )
                                        )
                                        continue
                        elif f"{mod}.{head}" in qname_to_class:
                            method_q = methods_by_class.get(f"{mod}.{head}", {}).get(attr)
                            if method_q:
                                target_id = _fn_id(method_q)
                if target_id and target_id != _fn_id(qname):
                    edges.append(
                        ExtractedEdge(
                            source=_fn_id(qname),
                            target=target_id,
                            relation="calls",
                            confidence=confidence,
                        )
                    )

        del local_fns  # unused except to keep structure honest

    return Extraction(nodes=list(nodes.values()), edges=_dedupe_edges(edges), warnings=warnings)


def _name_from_expr(expr: ast.AST) -> str | None:
    if isinstance(expr, ast.Name):
        return expr.id
    if isinstance(expr, ast.Attribute):
        left = _name_from_expr(expr.value)
        return f"{left}.{expr.attr}" if left else expr.attr
    return None


def _resolve_symbol(
    name: str,
    aliases: dict[str, str],
    qname_to_class: dict[str, str],
    mod: str,
) -> str | None:
    if name in qname_to_class:
        return qname_to_class[name]
    local = f"{mod}.{name}"
    if local in qname_to_class:
        return qname_to_class[local]
    head = name.split(".")[0]
    if head in aliases:
        mapped = aliases[head]
        rest = name.split(".", 1)[1] if "." in name else ""
        full = f"{mapped}.{rest}" if rest else mapped
        if full in qname_to_class:
            return qname_to_class[full]
    return None


def _dedupe_edges(edges: list[ExtractedEdge]) -> list[ExtractedEdge]:
    seen: set[tuple[str, str, str]] = set()
    out: list[ExtractedEdge] = []
    for edge in edges:
        key = (edge.source, edge.target, edge.relation)
        if key in seen:
            continue
        seen.add(key)
        out.append(edge)
    return out
