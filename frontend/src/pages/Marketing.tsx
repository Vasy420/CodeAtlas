import { useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";

export function Marketing() {
  const [menu, setMenu] = useState(false);

  return (
    <div className="content marketing">
      <header className="topbar">
        <Brand />
        <button
          className="menu-btn"
          type="button"
          aria-expanded={menu}
          aria-label="Menu"
          onClick={() => setMenu((v) => !v)}
        >
          <span />
          <span />
        </button>
        <nav className={`top-links ${menu ? "open" : ""}`}>
          <a href="#product" onClick={() => setMenu(false)}>
            Product
          </a>
          <a href="#how" onClick={() => setMenu(false)}>
            How it works
          </a>
          <Link className="btn" to="/app" onClick={() => setMenu(false)}>
            Open app
          </Link>
        </nav>
      </header>

      <section className="m-hero">
        <p className="kicker">Code intelligence</p>
        <h1>Understand a codebase before you touch it.</h1>
        <p className="lede">
          CodeAtlas maps architecture, dependencies, and change impact across a
          full repository — so onboarding and refactors start from evidence, not
          guesswork.
        </p>
        <div className="hero-actions">
          <Link className="btn" to="/app">
            Open CodeAtlas
          </Link>
          <Link className="btn ghost" to="/app?demo=northstar">
            Run the demo
          </Link>
        </div>
      </section>

      <section className="m-schematic-wrap" aria-hidden="true">
        <Schematic />
      </section>

      <section className="band" id="product">
        <p className="kicker">What you get</p>
        <h2 className="product-h2">A working model of the repository</h2>
        <div className="m-rows">
          <article>
            <span>01</span>
            <div>
              <h3>Architecture overview</h3>
              <p>
                Clusters, entry points, and high-fan-in files in one briefing.
                New contributors get a reading order instead of a folder tree.
              </p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <h3>Dependency map</h3>
              <p>
                Imports, calls, and inheritance as a directed graph. Every edge
                is tagged extracted, inferred, or unresolved.
              </p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <h3>Change impact</h3>
              <p>
                Select a file and see the blast radius: who imports it, how far
                the dependency walks, which clusters move.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="band" id="how">
        <p className="kicker">Workflow</p>
        <h2 className="product-h2">From clone to blast radius</h2>
        <ol className="m-steps">
          <li>
            <strong>Load</strong>
            Public Git URL, zip upload, or the bundled Northstar sample.
          </li>
          <li>
            <strong>Parse</strong>
            Python and JavaScript/TypeScript become files, symbols, and edges.
          </li>
          <li>
            <strong>Rank</strong>
            PageRank and clustering surface god files and module groups.
          </li>
          <li>
            <strong>Trace</strong>
            Reverse-walk the graph before you edit a hot path.
          </li>
        </ol>
      </section>

      <section className="m-cta">
        <h2>Map a repository in the app</h2>
        <p>The analyzer lives on its own workspace — not on this page.</p>
        <Link className="btn" to="/app">
          Go to workspace
        </Link>
      </section>

      <footer className="site-foot">
        <Brand compact />
        <a href="https://github.com/Vasy420/CodeAtlas">GitHub</a>
      </footer>
    </div>
  );
}

function Schematic() {
  return (
    <svg className="schematic" viewBox="0 0 720 280" role="img" aria-label="Sample architecture graph">
      <text x="86" y="38" className="sch-label">
        app.py
      </text>
      <text x="300" y="38" className="sch-label">
        auth
      </text>
      <text x="500" y="38" className="sch-label">
        orders
      </text>
      <text x="86" y="168" className="sch-label">
        db.py
      </text>
      <text x="300" y="252" className="sch-label">
        catalog
      </text>
      <line x1="120" y1="56" x2="330" y2="56" className="sch-edge" />
      <line x1="360" y1="56" x2="530" y2="56" className="sch-edge" />
      <line x1="120" y1="70" x2="120" y2="150" className="sch-edge" />
      <line x1="330" y1="70" x2="120" y2="150" className="sch-edge dim" />
      <line x1="330" y1="70" x2="530" y2="70" className="sch-edge gold" />
      <line x1="330" y1="70" x2="330" y2="230" className="sch-edge dim" />
      <line x1="530" y1="70" x2="330" y2="230" className="sch-edge" />
      <circle cx="120" cy="56" r="7" className="sch-node" />
      <circle cx="330" cy="56" r="9" className="sch-node gold" />
      <circle cx="530" cy="56" r="7" className="sch-node" />
      <circle cx="120" cy="160" r="7" className="sch-node gold" />
      <circle cx="330" cy="236" r="7" className="sch-node" />
    </svg>
  );
}
