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
  const demoStarted = useRef(false);

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
    api.projects().then((r) => setRecent(r.projects.slice(0, 6))).catch(() => undefined);
  }, []);

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

  const onZip = (file: File | undefined) => {
    if (!file) return;
    void go(() => api.zip(file));
  };

  return (
    <div className="content product">
      {busy && <LoadingScreen label="Opening the repository…" />}

      <header className="topbar">
        <Brand to="/app" />
        <nav className="top-links">
          <Link to="/">Product</Link>
        </nav>
      </header>

      <section className="hero" id="map">
        <div className="kicker">The instrument</div>
        <h2 className="product-h2">Point at a repository</h2>
        <div className="ingest">
          <form className="panel" onSubmit={onGit}>
            <h2>Public Git URL</h2>
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
