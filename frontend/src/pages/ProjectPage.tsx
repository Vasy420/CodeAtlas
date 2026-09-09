import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Map, Orbit, Radar } from "lucide-react";
import { api } from "../api";
import { Brand } from "../components/Brand";
import { GraphCanvas } from "../components/GraphCanvas";
import { LoadingScreen } from "../components/LoadingScreen";
import type { Briefing, GraphEdge, GraphNode, ImpactResult, Project, StructureNode } from "../types";

const STAGES = ["ingest", "walk", "extract", "graph", "briefing", "ready"];

export function ProjectPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "briefing";
  const nav = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const p = await api.project(id);
        if (cancelled) return;
        setProject(p);
        if (p.status === "ready") {
          const b = await api.briefing(id);
          if (!cancelled) setBriefing(b.briefing);
        } else if (p.status === "queued" || p.status === "running") {
          timer = window.setTimeout(poll, 700);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load project");
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [id]);

  if (error) {
    return (
      <div className="content page">
        <p className="error">{error}</p>
        <button className="btn ghost" onClick={() => nav("/app")}>
          Back
        </button>
      </div>
    );
  }

  if (!project) {
    return <LoadingScreen label="Acquiring target…" />;
  }

  const ready = project.status === "ready";

  return (
    <div className="content">
      <header className="topbar">
        <Brand to="/" />
        <nav className="topbar-actions">
          <Link to="/">Product</Link>
          <Link to="/app">App</Link>
          <span className={`badge ${project.status === "failed" ? "rose" : ready ? "ok" : "cyan"}`}>
            {project.status}
          </span>
        </nav>
      </header>
      <div className="project-layout">
        <aside className="sidenav">
          <h1 className="proj-name">{project.name}</h1>
          <div className="meta">{project.source_type}</div>
          <nav className="nav-links">
            <NavLink className={tab === "briefing" ? "active" : ""} to={`?tab=briefing`}>
              <Orbit size={16} /> Briefing
            </NavLink>
            <NavLink className={tab === "map" ? "active" : ""} to={`?tab=map`}>
              <Map size={16} /> Map
            </NavLink>
            <NavLink className={tab === "impact" ? "active" : ""} to={`?tab=impact`}>
              <Radar size={16} /> Impact
            </NavLink>
          </nav>
        </aside>
        <main className="page">
          {!ready && <ProgressView project={project} />}
          {project.status === "failed" && (
            <p className="error">{project.error || "Analysis failed"}</p>
          )}
          {ready && tab === "briefing" && briefing && (
            <BriefingView project={project} briefing={briefing} onOpen={(seed) => {
              setParams({ tab: "impact", seed });
            }} />
          )}
          {ready && tab === "map" && <MapView projectId={id} briefing={briefing} />}
          {ready && tab === "impact" && (
            <ImpactView projectId={id} initialSeed={params.get("seed")} />
          )}
        </main>
      </div>
    </div>
  );
}

function ProgressView({ project }: { project: Project }) {
  return (
    <div className="progress-page">
      <div className="splash-mark" style={{ width: 96, height: 96, marginBottom: 16 }}>
        <span className="splash-ring" aria-hidden="true" />
        <img src="/logo.svg" alt="" width={72} height={72} style={{ width: 72, height: 72, borderRadius: 16 }} />
      </div>
      <div className="kicker">Pipeline</div>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 40, margin: "8px 0 12px" }}>
        Charting {project.name}
      </h2>
      <div className="stage-pills">
        {STAGES.map((s) => (
          <span key={s} className={`pill ${project.stage === s || (project.stage === "ready" && s === "ready") ? "on" : ""}`}>
            {s}
          </span>
        ))}
      </div>
      <div className="log">
        <pre>{project.log || "Waiting for the first instrument reading…"}</pre>
      </div>
    </div>
  );
}

function BriefingView({
  project,
  briefing,
  onOpen,
}: {
  project: Project;
  briefing: Briefing;
  onOpen: (seed: string) => void;
}) {
  return (
    <div>
      <div className="kicker">Onboarding briefing</div>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 42, margin: "8px 0 12px" }}>
        Where to start
      </h2>
      <p className="lede">{briefing.summary}</p>
      <div className="stats">
        <div className="stat">
          <b>{briefing.stats.files}</b>
          <span>files</span>
        </div>
        <div className="stat">
          <b>{briefing.stats.loc.toLocaleString()}</b>
          <span>lines</span>
        </div>
        <div className="stat">
          <b>{briefing.stats.clusters}</b>
          <span>clusters</span>
        </div>
        <div className="stat">
          <b>{briefing.stats.edges}</b>
          <span>edges</span>
        </div>
      </div>
      <div className="grid-2">
        <div className="panel">
          <h2>Read these first</h2>
          <ul className="list">
            {briefing.reading_path.map((n) => (
              <li key={n.id}>
                <button onClick={() => onOpen(n.id)}>
                  <div className="path">{n.path}</div>
                  <div className="meta">
                    {n.language} · {n.dependents ?? 0} dependents
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel">
          <h2>Clusters</h2>
          <ul className="list">
            {briefing.clusters.map((c) => (
              <li key={c.id}>
                <strong>{c.label}</strong>
                <div className="meta">{c.file_count} files</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <h2>God nodes — high fan-in, change with care</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Path</th>
              <th>Dependents</th>
              <th>LOC</th>
            </tr>
          </thead>
          <tbody>
            {briefing.god_nodes.map((n) => (
              <tr key={n.id} onClick={() => onOpen(n.id)}>
                <td className="path">{n.path}</td>
                <td>{n.dependents}</td>
                <td>{n.loc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">
          {project.file_count} files analysed · click a row to simulate impact
        </p>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="panel">
          <h2>Repository structure</h2>
          <ul className="tree">
            {(briefing.structure || []).map((node) => (
              <TreeNode key={node.path || node.name} node={node} onOpen={onOpen} />
            ))}
          </ul>
        </div>
        <div className="panel">
          <h2>Continue this project</h2>
          <p className="hint">Use this when taking over or maintaining the repo.</p>
          <p className="meta">Entry points</p>
          <ul className="list">
            {(briefing.continue_guide?.start_here || []).map((path) => (
              <li key={path} className="path">{path}</li>
            ))}
          </ul>
          <p className="meta">Change carefully</p>
          <ul className="list">
            {(briefing.continue_guide?.change_carefully || []).map((path) => (
              <li key={path} className="path">{path}</li>
            ))}
          </ul>
          <p className="meta">External packages</p>
          <ul className="list">
            {(briefing.external_deps || []).slice(0, 10).map((dep) => (
              <li key={dep.id}>
                <strong>{dep.name}</strong>
                <div className="meta">imported by {dep.used_by} file{dep.used_by === 1 ? "" : "s"}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {(briefing.high_coupling || []).length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h2>Tightly coupled files</h2>
          <p className="hint">High in + out degree. Refactors here tend to ripple.</p>
          <table className="table">
            <thead>
              <tr>
                <th>Path</th>
                <th>Degree</th>
                <th>Dependents</th>
              </tr>
            </thead>
            <tbody>
              {briefing.high_coupling.map((n) => (
                <tr key={n.id} onClick={() => onOpen(n.id)}>
                  <td className="path">{n.path}</td>
                  <td>{n.degree}</td>
                  <td>{n.dependents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TreeNode({
  node,
  onOpen,
}: {
  node: StructureNode;
  onOpen: (seed: string) => void;
}) {
  if (node.kind === "dir") {
    return (
      <li>
        <div className="tree-dir">{node.name}/</div>
        <ul className="tree">
          {node.children.map((child) => (
            <TreeNode key={child.path || `${node.name}/${child.name}`} node={child} onOpen={onOpen} />
          ))}
        </ul>
      </li>
    );
  }
  return (
    <li>
      {node.id ? (
        <button type="button" onClick={() => onOpen(node.id!)}>
          <span className="path">{node.name}</span>
        </button>
      ) : (
        <span className="path">{node.name}</span>
      )}
    </li>
  );
}

function MapView({ projectId, briefing }: { projectId: string; briefing: Briefing | null }) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.node>> | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("file");
  const clusterLabels = useMemo(() => {
    const labels: Record<number, string> = {};
    for (const c of briefing?.clusters || []) labels[c.id] = c.label;
    return labels;
  }, [briefing]);

  useEffect(() => {
    api.graph(projectId, kind).then((g) => {
      const capped = [...g.nodes].sort((a, b) => b.pagerank - a.pagerank).slice(0, 400);
      const keys = new Set(capped.map((n) => n.id));
      setNodes(capped);
      setEdges(g.edges.filter((e) => keys.has(e.source) && keys.has(e.target)));
    }).catch(() => undefined);
  }, [projectId, kind]);

  useEffect(() => {
    if (!selected) return;
    api.node(projectId, selected).then(setDetail).catch(() => setDetail(null));
  }, [projectId, selected]);

  const filteredHighlight = useMemo(() => {
    if (!q.trim()) return undefined;
    const needle = q.toLowerCase();
    return new Set(nodes.filter((n) => n.path.toLowerCase().includes(needle) || n.name.toLowerCase().includes(needle)).map((n) => n.id));
  }, [q, nodes]);

  return (
    <div>
      <div className="kicker">Architecture map</div>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 36, margin: "8px 0 16px" }}>
        Structure and clusters
      </h2>
      <div className="map-wrap map-wrap-arch">
        <aside className="arch-pane">
          <h2>Clusters</h2>
          <ul className="list">
            {(briefing?.clusters || []).map((c) => (
              <li key={c.id}>
                <strong>{c.label}</strong>
                <div className="meta">{c.file_count} files · {c.files.slice(0, 3).join(", ")}</div>
              </li>
            ))}
            {(briefing?.clusters || []).length === 0 && (
              <li className="empty">No clusters yet. Re-run analysis if this is an old map.</li>
            )}
          </ul>
          <h2>Folders</h2>
          <ul className="tree">
            {(briefing?.structure || []).map((node) => (
              <TreeNode
                key={node.path || node.name}
                node={node}
                onOpen={(id) => setSelected(id)}
              />
            ))}
          </ul>
        </aside>
        <div className="graph-stage">
          <div className="toolbar">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter files"
              aria-label="Filter graph"
            />
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Node kind">
              <option value="file">Files</option>
              <option value="file,function">Files + functions</option>
              <option value="file,class,function">All symbols</option>
            </select>
          </div>
          <GraphCanvas
            nodes={nodes}
            edges={edges.filter((e) => e.relation !== "contains" || kind !== "file")}
            selected={selected}
            highlight={filteredHighlight}
            clusterLabels={clusterLabels}
            onSelect={setSelected}
          />
        </div>
        <aside className="inspector">
          {!detail && <p className="empty">Select a file in the tree or on the map.</p>}
          {detail && (
            <>
              <span className="badge cyan">{detail.node.kind}</span>
              <h3 className="path">{detail.node.path || detail.node.qualified_name}</h3>
              <p className="meta">
                {detail.node.language} · {detail.node.dependents} dependents · loc {detail.node.loc}
              </p>
              {detail.snippet && <pre className="snippet">{detail.snippet.text}</pre>}
              <h2 style={{ marginTop: 16 }}>Imports / uses</h2>
              <ul className="list">
                {detail.outgoing.filter((e) => e.relation !== "contains").map((e, i) => (
                  <li key={i}>
                    <button onClick={() => setSelected(e.target)}>
                      <span className="badge">{e.relation}</span> {e.target}
                    </button>
                  </li>
                ))}
              </ul>
              <h2>Dependents</h2>
              <ul className="list">
                {detail.incoming.filter((e) => e.relation !== "contains").map((e, i) => (
                  <li key={i}>
                    <button onClick={() => setSelected(e.source)}>
                      <span className="badge">{e.relation}</span> {e.source}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function ImpactView({ projectId, initialSeed }: { projectId: string; initialSeed: string | null }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GraphNode[]>([]);
  const [seed, setSeed] = useState(initialSeed || "");
  const [depth, setDepth] = useState(3);
  const [result, setResult] = useState<ImpactResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialSeed) {
      setSeed(initialSeed);
      void run(initialSeed, depth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSeed]);

  const search = async (value: string) => {
    setQuery(value);
    if (value.length < 1) {
      setHits([]);
      return;
    }
    const r = await api.nodes(projectId, value, "file");
    setHits(r.nodes);
  };

  const run = async (seedId: string, d: number) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.impact(projectId, seedId, d);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impact failed");
    } finally {
      setBusy(false);
    }
  };

  const highlight = useMemo(() => {
    if (!result) return undefined;
    return new Set(result.nodes.map((n) => n.id));
  }, [result]);

  return (
    <div>
      <div className="kicker">Change impact</div>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 36, margin: "8px 0 8px" }}>
        Blast radius
      </h2>
      <p className="lede">Pick a file. CodeAtlas walks reverse dependencies to show what would feel the change.</p>
      <div className="impact-head">
        <div style={{ flex: 1, minWidth: 220 }}>
          <input
            className="field"
            value={query}
            onChange={(e) => void search(e.target.value)}
            placeholder="Search files — try session.py"
            aria-label="Search seed file"
          />
          {hits.length > 0 && (
            <ul className="list">
              {hits.slice(0, 8).map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => {
                      setSeed(n.id);
                      setQuery(n.path);
                      setHits([]);
                      void run(n.id, depth);
                    }}
                  >
                    <span className="path">{n.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="meta">
          Depth
          <input
            className="field"
            type="number"
            min={1}
            max={8}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            style={{ width: 80, marginLeft: 8 }}
          />
        </label>
        <button className="btn" disabled={!seed || busy} onClick={() => void run(seed, depth)}>
          Trace impact
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {result && (
        <>
          <div className="stats">
            <div className="stat">
              <b>{result.summary.affected_files}</b>
              <span>files</span>
            </div>
            <div className="stat">
              <b>{result.summary.affected_nodes}</b>
              <span>symbols</span>
            </div>
            <div className="stat">
              <b>{result.summary.affected_communities}</b>
              <span>clusters</span>
            </div>
            <div className="stat">
              <b>{result.summary.risk || "—"}</b>
              <span>risk</span>
            </div>
          </div>
          {result.summary.note && <p className="lede">{result.summary.note}</p>}
          <div className="map-wrap">
            <div className="graph-stage">
              <GraphCanvas
                nodes={result.nodes.filter((n) => n.kind !== "external")}
                edges={result.edges}
                selected={result.seed.id}
                highlight={highlight}
                onSelect={(id) => {
                  setSeed(id);
                  void run(id, depth);
                }}
              />
            </div>
            <aside className="inspector">
              <h2>Affected</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Dist</th>
                    <th>Symbol</th>
                    <th>Via</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {result.affected
                    .filter((n) => n.kind === "file")
                    .map((n) => (
                      <tr key={n.id} onClick={() => void run(n.id, depth)}>
                        <td>{n.distance}</td>
                        <td className="path">{n.path}</td>
                        <td>
                          <span className="badge">{n.relation || "dep"}</span>
                        </td>
                        <td className="meta">{n.confidence || "extracted"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
