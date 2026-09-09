import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Brand } from "../components/Brand";
import { LoadingScreen } from "../components/LoadingScreen";
import type { Project, Sample } from "../types";

export function AppHome() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [recent, setRecent] = useState<Project[]>([]);

  const go = async (fn: () => Promise<Project>) => {
    setBusy(true);
    setError(null);
    try {
      const project = await fn();
      nav(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start analysis");
      setBusy(false);
    }
  };

  useEffect(() => {
    api.samples().then((r) => setSamples(r.samples)).catch(() => undefined);
    api.projects().then((r) => setRecent(r.projects)).catch(() => undefined);
  }, []);

  const demoStarted = useRef(false);
  useEffect(() => {
    if (params.get("demo") === "northstar" && !demoStarted.current) {
      demoStarted.current = true;
      void go(() => api.sample("northstar"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const onGit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!url.trim()) return;
    void go(() => api.git(url.trim()));
  };

  return (
    <div className="content app-home">
      {busy && <LoadingScreen label="Starting analysis…" />}
      <header className="topbar">
        <Brand to="/app" />
        <nav className="top-links">
          <Link to="/">Product</Link>
        </nav>
      </header>

      <main className="workspace">
        <header className="workspace-head">
          <p className="kicker">Workspace</p>
          <h1>New map</h1>
          <p className="lede">
            Paste a public Git URL. Analysis runs on the server and opens the
            overview when it is ready.
          </p>
        </header>

        <form className="ingest-form" onSubmit={onGit}>
          <label className="sr-only" htmlFor="repo-url">
            Git repository URL
          </label>
          <input
            id="repo-url"
            className="field field-lg"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/org/repo"
            autoComplete="off"
            inputMode="url"
          />
          <div className="ingest-actions">
            <button className="btn" type="submit" disabled={busy || !url.trim()}>
              Analyze
            </button>
            <label className="btn ghost">
              Upload zip
              <input
                type="file"
                accept=".zip"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void go(() => api.zip(file));
                }}
              />
            </label>
            <button
              className="btn ghost"
              type="button"
              disabled={busy}
              onClick={() => void go(() => api.sample(samples[0]?.id || "northstar"))}
            >
              Run Northstar demo
            </button>
          </div>
          <p className="hint">
            Public repos only. Large clones may take a minute.
            {import.meta.env.VITE_API_URL ? " A sleeping API can take ~30s to wake." : ""}
          </p>
          {error && <p className="error">{error}</p>}
        </form>

        <section className="recent-block">
          <div className="row-head">
            <h2>Recent</h2>
            <span className="meta">{recent.length} maps</span>
          </div>
          {recent.length === 0 ? (
            <p className="empty">No maps yet. Analyze a repository to see it here.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Files</th>
                    <th>LOC</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((p) => (
                    <tr key={p.id} onClick={() => nav(`/projects/${p.id}`)}>
                      <td>
                        <strong>{p.name}</strong>
                        <div className="meta">{p.source_type}</div>
                      </td>
                      <td>
                        <span className={`badge ${p.status === "ready" ? "ok" : p.status === "failed" ? "rose" : "cyan"}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>{p.file_count || "—"}</td>
                      <td>{p.loc ? p.loc.toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
