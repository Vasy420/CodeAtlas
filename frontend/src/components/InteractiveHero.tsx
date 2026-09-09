import { useState } from "react";
import { Link } from "react-router-dom";

type Spot = {
  id: string;
  label: string;
  role: string;
  x: number;
  y: number;
  s: number;
  links: string[];
};

const SPOTS: Spot[] = [
  {
    id: "catalog",
    label: "catalog / inventory",
    role: "Product and stock modules. Orders pull from here when a sale is placed.",
    x: 22,
    y: 42,
    s: 28,
    links: ["core", "orders"],
  },
  {
    id: "auth",
    label: "auth cluster",
    role: "Login, permissions, and session helpers sitting above the rest of the shop.",
    x: 52,
    y: 18,
    s: 22,
    links: ["core"],
  },
  {
    id: "orders",
    label: "orders cluster",
    role: "Order placement and payments. Depends on session and inventory.",
    x: 78,
    y: 36,
    s: 30,
    links: ["core", "catalog"],
  },
  {
    id: "core",
    label: "session.py — god node",
    role: "High fan-in file. Changing it ripples through auth and orders — the rings are the blast radius.",
    x: 50.5,
    y: 67,
    s: 16,
    links: ["auth", "orders", "catalog"],
  },
];

export function InteractiveHero() {
  const [hover, setHover] = useState<string | null>(null);
  const [active, setActive] = useState<string>("core");
  const focus = SPOTS.find((s) => s.id === (hover || active)) || SPOTS[3];
  const lit = new Set([focus.id, ...focus.links]);

  return (
    <figure className="hero-art hero-hotspots">
      <div className="hero-stage">
        <img src="/hero.jpg" alt="Architecture map of a software repository" />
        {SPOTS.map((spot) => {
          const on = spot.id === focus.id;
          const related = !on && lit.has(spot.id);
          return (
            <button
              key={spot.id}
              type="button"
              className={`hotspot${on ? " on" : ""}${related ? " related" : ""}`}
              style={{
                left: `${spot.x}%`,
                top: `${spot.y}%`,
                width: `${spot.s}%`,
              }}
              aria-pressed={active === spot.id}
              aria-label={spot.label}
              onMouseEnter={() => setHover(spot.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(spot.id)}
              onBlur={() => setHover(null)}
              onClick={() => setActive(spot.id)}
            />
          );
        })}
        <div
          className="hero-tip"
          style={{ left: `${Math.min(Math.max(focus.x, 18), 82)}%`, top: `${Math.max(focus.y - focus.s / 2 - 2, 8)}%` }}
        >
          <strong>{focus.label}</strong>
          <span>{focus.role}</span>
        </div>
      </div>
      <figcaption className="hero-caption">
        <p>
          Hover or click a cluster in the image.{" "}
          <Link to="/app?demo=northstar">Open this architecture in the app</Link>
        </p>
      </figcaption>
    </figure>
  );
}
