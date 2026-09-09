import { useState } from "react";
import { Link } from "react-router-dom";
import { GitBranch, Map, Radar } from "lucide-react";
import { Brand } from "../components/Brand";

export function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="content product">
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
          <Link className="btn" to="/app" onClick={() => setMenuOpen(false)}>
            Map a repo
          </Link>
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
            <Link className="btn" to="/app">
              Open the app
            </Link>
            <Link className="btn ghost" to="/app?demo=northstar">
              Try Northstar
            </Link>
          </div>
        </div>
        <figure className="hero-art">
          <img src="/hero.jpg" alt="Architecture map of a software repository" />
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

      <footer className="site-foot">
        <Brand compact />
        <p>See the whole repository. Know what a change will touch.</p>
      </footer>
    </div>
  );
}
