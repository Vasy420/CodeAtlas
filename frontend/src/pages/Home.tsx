import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import type { Project, Sample } from "../types";

export function Home() {
  const nav = useNavigate();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [recent, setRecent] = useState<Project[]>([]);

  useEffect(() => {
    api.samples().then((r) => setSamples(r.samples)).catch(() => undefined);
    api.projects().then((r) => setRecent(r.projects.slice(0, 6))).catch(() => undefined);
  }, []);

  const go = async (fn: () => Promise<Project>) => {
    setBusy(true);
    setError(null);
    try {
      const project = await fn();
      nav(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start analysis");
    } finally {
      setBusy(false);
    }
  };

  const onGit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!url.trim()) return;
    void go(() => api.git(url.trim()));
  };

  const onZip = (file: File | undefined) => {
    if (!file) return;
    void go(() => api.zip(file));
  };

  return (
    <div className="content">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">ORION</span>
          <span className="brand-sub">cartography</span>
        </a>
      </header>

      <section className="hero">
        <div className="kicker">Repository cartography</div>
        <h1>
          See the whole system.
          <br />
          <em>Know what a change will touch.</em>
        </h1>
        <p className="lede">
          ORION reads a software repository, maps architecture and dependencies, and
          shows the blast radius of a change — so you can onboard, maintain, and
          inherit a codebase without guessing.
        </p>

        <div className="ingest">
          <form className="panel" onSubmit={onGit}>
            <h2>Point at a repository</h2>
            <div className="row">
              <input
                className="field"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
                aria-label="Git repository URL"
              />
              <button className="btn" type="submit" disabled={busy}>
                Map it
              </button>
            </div>
            <p className="hint">
              Public Git URL, or drop a zip of the source tree.
              {import.meta.env.VITE_API_URL
                ? " First request may take ~30s while the API wakes up."
                : ""}
            </p>
            <div className="row" style={{ marginTop: 12 }}>
              <label className="btn ghost">
                Upload zip
                <input
                  type="file"
                  accept=".zip"
                  hidden
                  onChange={(e) => onZip(e.target.files?.[0])}
                />
              </label>
            </div>
            {error && <p className="error">{error}</p>}
          </form>

          <div className="panel sample-card">
            <div>
              <h2>Try a known sky</h2>
              <p>
                {samples[0]?.blurb ||
                  "Northstar is a tiny shop backend. Session is a god module — change it and watch orders light up."}
              </p>
            </div>
            <button
              className="btn amber"
              disabled={busy}
              onClick={() => void go(() => api.sample(samples[0]?.id || "northstar"))}
            >
              Analyze Northstar
            </button>
          </div>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="recent">
          <h2 className="section-title">Recent maps</h2>
          <div className="recent-list">
            {recent.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`}>
                <strong>{p.name}</strong>
                <div className="meta">
                  {p.status} · {p.file_count} files · {p.loc} loc
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
