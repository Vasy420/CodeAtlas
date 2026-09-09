import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GitBranch, Map, Radar } from "lucide-react";
import { api } from "../api";
import { Brand } from "../components/Brand";
import { LoadingScreen } from "../components/LoadingScreen";
import type { Project, Sample } from "../types";

export function Home() {
  const nav = useNavigate();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [recent, setRecent] = useState<Project[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

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
    <div className="content product">
      {busy && <LoadingScreen label="Opening the repository…" />}

      <header className="topbar">
        <Brand />
        <button
          className="menu-btn"
          type="button"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav className={`top-links ${menuOpen ? "open" : ""}`}>
          <a href="#product" onClick={() => setMenuOpen(false)}>
            Product
          </a>
          <a href="#how" onClick={() => setMenuOpen(false)}>
            How it works
          </a>
          <a href="#map" className="btn" onClick={() => setMenuOpen(false)}>
            Map a repo
          </a>
        </nav>
      </header>

      <section className="hero product-hero">
        <div className="hero-copy">
          <div className="kicker">Repository cartography</div>
          <h1>
            See the whole system.
            <br />
            <em>Know what a change will touch.</em>
          </h1>
          <p className="lede">
            CodeAtlas reads a complete software repository, draws its architecture
            and dependencies, and shows the blast radius of a change — so you can
            onboard, maintain, and inherit a codebase without guessing.
          </p>
          <div className="hero-actions">
            <a className="btn" href="#map">
              Open the instrument
            </a>
            <button
              className="btn ghost"
              type="button"
              disabled={busy}
              onClick={() => void go(() => api.sample(samples[0]?.id || "northstar"))}
            >
              Try Northstar
            </button>
          </div>
        </div>
        <figure className="hero-art">
          <img src="/hero.jpg" alt="Architecture constellation of a software repository" />
        </figure>
      </section>

      <section className="band" id="product">
        <h2 className="section-title">The product</h2>
        <p className="lede">
          Three views that belong together: structure, relationships, and impact.
        </p>
        <div className="feature-grid">
          <article className="panel feature">
            <Map size={22} />
            <h3>Architecture map</h3>
            <p>
              Files, modules, and clusters laid out as a star chart. God nodes
              glow first — the files everything else depends on.
            </p>
          </article>
          <article className="panel feature">
            <GitBranch size={22} />
            <h3>Dependency graph</h3>
            <p>
              Imports, calls, and inheritance, tagged extracted, inferred, or
              unresolved. You always know what was found versus guessed.
            </p>
          </article>
          <article className="panel feature">
            <Radar size={22} />
            <h3>Change impact</h3>
            <p>
              Pick a file. CodeAtlas walks reverse dependencies and reports the
              blast radius — files, symbols, and clusters that would feel it.
            </p>
          </article>
        </div>
      </section>

      <section className="band" id="how">
        <h2 className="section-title">How it works</h2>
        <ol className="steps">
          <li>
            <span>01</span>
            <div>
              <strong>Ingest</strong>
              <p>Paste a public Git URL, drop a zip, or open the Northstar demo.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Extract</strong>
              <p>Python and JavaScript/TypeScript are parsed into a directed graph.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Chart</strong>
              <p>Louvain clusters and PageRank surface the atlas and the god files.</p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <strong>Trace</strong>
              <p>Simulate a change and read who is in the blast radius before you edit.</p>
            </div>
          </li>
        </ol>
      </section>

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

      <footer className="site-foot">
        <Brand compact />
        <p>See the whole repository. Know what a change will touch.</p>
      </footer>
    </div>
  );
}
