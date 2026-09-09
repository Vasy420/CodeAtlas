import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

type HeroNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
  cluster: string;
  role: string;
};

const NODES: HeroNode[] = [
  { id: "app", label: "app.py", x: 88, y: 72, r: 11, cluster: "core", role: "Application entry point" },
  { id: "session", label: "session.py", x: 270, y: 78, r: 14, cluster: "auth", role: "God node — login state used across the shop" },
  { id: "permissions", label: "permissions.py", x: 400, y: 58, r: 10, cluster: "auth", role: "Role checks built on the session" },
  { id: "authRoutes", label: "auth/routes.py", x: 390, y: 150, r: 10, cluster: "auth", role: "Login and logout HTTP routes" },
  { id: "db", label: "db.py", x: 88, y: 200, r: 12, cluster: "core", role: "Shared database helper" },
  { id: "orders", label: "orders/service.py", x: 270, y: 210, r: 11, cluster: "orders", role: "Places orders using session, stock, and payments" },
  { id: "payments", label: "payments.py", x: 410, y: 250, r: 9, cluster: "orders", role: "Charges a customer" },
  { id: "catalog", label: "inventory.py", x: 150, y: 300, r: 10, cluster: "catalog", role: "Stock mutations for orders" },
];

const EDGES: [string, string][] = [
  ["app", "session"],
  ["app", "authRoutes"],
  ["app", "orders"],
  ["permissions", "session"],
  ["authRoutes", "session"],
  ["orders", "session"],
  ["session", "db"],
  ["orders", "catalog"],
  ["orders", "payments"],
  ["catalog", "db"],
];

const CLUSTER_COLOR: Record<string, string> = {
  core: "#7dd3f0",
  auth: "#e8b86d",
  orders: "#c4b5fd",
  catalog: "#86c5a6",
};

function neighbors(id: string) {
  const out = new Set<string>([id]);
  for (const [a, b] of EDGES) {
    if (a === id) out.add(b);
    if (b === id) out.add(a);
  }
  return out;
}

function dependents(id: string) {
  const out = new Set<string>();
  for (const [a, b] of EDGES) {
    if (b === id) out.add(a);
  }
  return out;
}

export function InteractiveHero() {
  const [hover, setHover] = useState<string | null>(null);
  const [active, setActive] = useState<string>("session");
  const focus = hover || active;
  const node = NODES.find((n) => n.id === focus) || NODES[1];
  const linked = useMemo(() => neighbors(focus), [focus]);
  const blast = useMemo(() => dependents(active), [active]);
  const byId = useMemo(() => new Map(NODES.map((n) => [n.id, n])), []);

  return (
    <figure className="hero-art hero-interactive">
      <svg viewBox="0 0 480 360" role="img" aria-label="Interactive Northstar architecture. Click a file to see its blast radius.">
        {EDGES.map(([a, b]) => {
          const from = byId.get(a);
          const to = byId.get(b);
          if (!from || !to) return null;
          const lit = linked.has(a) && linked.has(b);
          const impact = blast.has(a) && b === active;
          return (
            <line
              key={`${a}-${b}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={`hero-edge${lit ? " on" : ""}${impact ? " blast" : ""}`}
            />
          );
        })}
        {NODES.map((n) => {
          const color = CLUSTER_COLOR[n.cluster];
          const isActive = n.id === active;
          const isHover = n.id === hover;
          const inBlast = blast.has(n.id);
          const dim = hover && !linked.has(n.id);
          return (
            <g
              key={n.id}
              className="hero-node"
              tabIndex={0}
              role="button"
              aria-pressed={isActive}
              aria-label={`${n.label}. ${n.role}`}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(n.id)}
              onBlur={() => setHover(null)}
              onClick={() => setActive(n.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActive(n.id);
                }
              }}
            >
              {(isActive || inBlast) && (
                <circle cx={n.x} cy={n.y} r={n.r + 10} className={isActive ? "hero-ring" : "hero-ring blast"} />
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r={isHover || isActive ? n.r + 2 : n.r}
                fill={color}
                opacity={dim ? 0.28 : 1}
              />
              <text x={n.x + n.r + 8} y={n.y + 4} className="hero-label" opacity={dim ? 0.35 : 1}>
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="hero-caption">
        <div>
          <strong>{node.label}</strong>
          <span>{node.role}</span>
        </div>
        <p>
          {blast.size
            ? `Impact of ${NODES.find((n) => n.id === active)?.label}: ${blast.size} dependent file${blast.size === 1 ? "" : "s"}.`
            : "Click a file to see who depends on it."}{" "}
          <Link to="/app?demo=northstar">Open this demo</Link>
        </p>
      </figcaption>
    </figure>
  );
}
