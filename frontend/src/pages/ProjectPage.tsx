import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Map, Orbit, Radar, X } from "lucide-react";
import { api } from "../api";
import { Brand } from "../components/Brand";
import { GraphCanvas } from "../components/GraphCanvas";
import { LoadingScreen } from "../components/LoadingScreen";
import type { Briefing, GraphEdge, GraphNode, ImpactResult, Project } from "../types";

const TABS = [
  { id: "briefing", label: "Overview", icon: Orbit },
  { id: "map", label: "Map", icon: Map },
  { id: "impact", label: "Impact", icon: Radar },
] as const;

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
          Back to workspace
        </button>
      </div>
    );
  }

  if (!project) {
    return <LoadingScreen label="Loading project…" />;
  }

  const ready = project.status === "ready";

  return (
    <div className="content project-shell">
      <header className="topbar">
        <Brand to="/app" />
        <div className="crumb">
          <Link to="/app">Workspace</Link>
          <span aria-hidden="true">/</span>
          <strong>{project.name}</strong>
        </div>
        <span className={`badge ${project.status === "failed" ? "rose" : ready ? "ok" : "cyan"}`}>
          {project.status}
        </span>
      </header>

      <nav className="tabs" aria-label="Project sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "active" : ""}
            onClick={() => setParams({ tab: item.id })}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </nav>

      <main className="page">
        {!ready && <ProgressView project={project} />}
        {project.status === "failed" && <p className="error">{project.error || "Analysis failed"}</p>}
        {ready && tab === "briefing" && briefing && (
          <BriefingView
            project={project}
            briefing={briefing}
            onOpen={(seed) => setParams({ tab: "impact", seed })}
            onMap={() => setParams({ tab: "map" })}
          />
        )}
        {ready && tab === "map" && <MapView projectId={id} />}
        {ready && tab === "impact" && (
          <ImpactView
            projectId={id}
            initialSeed={params.get("seed")}
            suggestions={briefing?.god_nodes ?? []}
          />
        )}
      </main>
    </div>
  );
}

function ProgressView({ project }: { project: Project }) {
  return (
    <div className="progress-page">
      <p className="kicker">Analysis</p>
      <h2 className="product-h2">Mapping {project.name}</h2>
      <div className="stage-pills">
        {["ingest", "walk", "extract", "graph", "briefing", "ready"].map((s) => (
          <span key={s} className={`pill ${project.stage === s ? "on" : ""}`}>
            {s}
          </span>
        ))}
      </div>
      <div className="log">
        <pre>{project.log || "Waiting for the first log line…"}</pre>
      </div>
    </div>
  );
}

function BriefingView({
  project,
  briefing,
  onOpen,
  onMap,
}: {
  project: Project;
  briefing: Briefing;
  onOpen: (seed: string) => void;
  onMap: () => void;
}) {
  return (
    <div className="overview">
      <div className="overview-head">
        <div>
          <p className="kicker">Overview</p>
          <h1>{project.name}</h1>
          <p className="lede">{briefing.summary}</p>
        </div>
        <button className="btn ghost" type="button" onClick={onMap}>
          Open map
        </button>
      </div>
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
          <h2>Start here</h2>
          <ul className="list">
            {briefing.reading_path.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => onOpen(n.id)}>
                  <div className="path">{n.path}</div>
                  <div className="meta">
                    {n.language} · {n.dependents ?? 0} dependents · trace impact
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
      <div className="panel">
        <h2>High fan-in files</h2>
        <p className="hint">Changes here tend to spread. Tap a row to run impact.</p>
        <div className="table-wrap">
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
        </div>
      </div>
    </div>
  );
}

function MapView({ projectId }: { projectId: string }) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.node>> | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("file");

  useEffect(() => {
    api
      .graph(projectId, kind)
      .then((g) => {
        const capped = [...g.nodes].sort((a, b) => b.pagerank - a.pagerank).slice(0, 400);
        const keys = new Set(capped.map((n) => n.id));
        setNodes(capped);
        setEdges(g.edges.filter((e) => keys.has(e.source) && keys.has(e.target)));
      })
      .catch(() => undefined);
  }, [projectId, kind]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    api.node(projectId, selected).then(setDetail).catch(() => setDetail(null));
  }, [projectId, selected]);

  const filteredHighlight = useMemo(() => {
    if (!q.trim()) return undefined;
    const needle = q.toLowerCase();
    return new Set(
      nodes
        .filter((n) => n.path.toLowerCase().includes(needle) || n.name.toLowerCase().includes(needle))
        .map((n) => n.id),
    );
  }, [q, nodes]);

  return (
    <div>
      <div className="view-head">
        <div>
          <p className="kicker">Map</p>
          <h1>Architecture</h1>
          <p className="hint">Drag to pan, scroll to zoom, tap a node for details.</p>
        </div>
      </div>
      <div className="map-wrap">
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
            onSelect={setSelected}
          />
        </div>
        <aside className={`inspector ${detail ? "open" : ""}`}>
          <div className="inspector-head">
            <h2>Inspector</h2>
            {detail && (
              <button className="icon-btn" type="button" aria-label="Close inspector" onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            )}
          </div>
          {!detail && <p className="empty">Select a node on the map.</p>}
          {detail && (
            <>
              <span className="badge cyan">{detail.node.kind}</span>
              <h3 className="path">{detail.node.path || detail.node.qualified_name}</h3>
              <p className="meta">
                {detail.node.language} · {detail.node.dependents} dependents · {detail.node.loc} loc
              </p>
              {detail.snippet && <pre className="snippet">{detail.snippet.text}</pre>}
              <h2>Uses</h2>
              <ul className="list">
                {detail.outgoing
                  .filter((e) => e.relation !== "contains")
                  .map((e, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => setSelected(e.target)}>
                        <span className="badge">{e.relation}</span> {e.target}
                      </button>
                    </li>
                  ))}
              </ul>
              <h2>Used by</h2>
              <ul className="list">
                {detail.incoming
                  .filter((e) => e.relation !== "contains")
                  .map((e, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => setSelected(e.source)}>
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

function ImpactView({
  projectId,
  initialSeed,
  suggestions,
}: {
  projectId: string;
  initialSeed: string | null;
  suggestions: GraphNode[];
}) {
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
      setQuery(r.seed.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impact failed");
    } finally {
      setBusy(false);
    }
  };

  const pick = (id: string, path: string) => {
    setSeed(id);
    setQuery(path);
    setHits([]);
    void run(id, depth);
  };

  const highlight = useMemo(() => {
    if (!result) return undefined;
    return new Set(result.nodes.map((n) => n.id));
  }, [result]);

  return (
    <div>
      <div className="view-head">
        <div>
          <p className="kicker">Impact</p>
          <h1>Blast radius</h1>
          <p className="lede">Choose a file. The walk follows reverse imports and calls.</p>
        </div>
      </div>
      <div className="impact-head">
        <div className="search-box">
          <input
            className="field"
            value={query}
            onChange={(e) => void search(e.target.value)}
            placeholder="Search a file path"
            aria-label="Search seed file"
          />
          {hits.length > 0 && (
            <ul className="list suggest">
              {hits.slice(0, 8).map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => pick(n.id, n.path)}>
                    <span className="path">{n.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="depth-seg" role="group" aria-label="Walk depth">
          {[1, 2, 3, 4].map((d) => (
            <button key={d} type="button" className={depth === d ? "on" : ""} onClick={() => setDepth(d)}>
              {d}
            </button>
          ))}
        </div>
        <button className="btn" disabled={!seed || busy} onClick={() => void run(seed, depth)}>
          {busy ? "Tracing…" : "Trace"}
        </button>
      </div>
      {suggestions.length > 0 && !result && (
        <div className="chips">
          <span className="meta">Suggested</span>
          {suggestions.slice(0, 6).map((n) => (
            <button key={n.id} type="button" className="chip" onClick={() => pick(n.id, n.path)}>
              {n.path}
            </button>
          ))}
        </div>
      )}
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
          </div>
          <div className="map-wrap">
            <div className="graph-stage">
              <GraphCanvas
                nodes={result.nodes.filter((n) => n.kind !== "external")}
                edges={result.edges}
                selected={result.seed.id}
                highlight={highlight}
                onSelect={(id) => {
                  const node = result.nodes.find((n) => n.id === id);
                  if (node) pick(id, node.path);
                }}
              />
            </div>
            <aside className="inspector open">
              <h2>Affected files</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Dist</th>
                      <th>Path</th>
                      <th>Via</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.affected
                      .filter((n) => n.kind === "file")
                      .map((n) => (
                        <tr key={n.id} onClick={() => pick(n.id, n.path)}>
                          <td>{n.distance}</td>
                          <td className="path">{n.path}</td>
                          <td>
                            <span className="badge">{n.relation || "dep"}</span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
