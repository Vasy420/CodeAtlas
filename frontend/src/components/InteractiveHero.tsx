import { useState } from "react";
import { Link } from "react-router-dom";

type Spot = {
  id: string;
  label: string;
  role: string;
  x: number;
  y: number;
  s: number;
};

const SPOTS: Spot[] = [
  {
    id: "catalog",
    label: "catalog / inventory",
    role: "Product and stock modules. Orders pull from here when a sale is placed.",
    x: 22,
    y: 42,
    s: 28,
  },
  {
    id: "auth",
    label: "auth cluster",
    role: "Login, permissions, and session helpers sitting above the rest of the shop.",
    x: 52,
    y: 18,
    s: 22,
  },
  {
    id: "orders",
    label: "orders cluster",
    role: "Order placement and payments. Depends on session and inventory.",
    x: 78,
    y: 36,
    s: 30,
  },
  {
    id: "core",
    label: "session.py — god node",
    role: "High fan-in file. Changing it ripples through auth and orders.",
    x: 50.5,
    y: 67,
    s: 16,
  },
];

export function InteractiveHero() {
  const [focus, setFocus] = useState<Spot | null>(null);

  return (
    <figure className="hero-art hero-hotspots">
      <div className="hero-stage">
        <img src="/hero.jpg" alt="Architecture map of a software repository" />
        {SPOTS.map((spot) => (
          <button
            key={spot.id}
            type="button"
            className="hotspot"
            style={{
              left: `${spot.x}%`,
              top: `${spot.y}%`,
              width: `${spot.s}%`,
            }}
            aria-label={spot.label}
            onMouseEnter={() => setFocus(spot)}
            onMouseLeave={() => setFocus(null)}
            onFocus={() => setFocus(spot)}
            onBlur={() => setFocus(null)}
            onClick={() => setFocus(spot)}
          />
        ))}
      </div>
      <figcaption className="hero-caption">
        {focus ? (
          <p>
            <strong>{focus.label}</strong>
            {focus.role}{" "}
            <Link to="/app?demo=northstar">Open in the app</Link>
          </p>
        ) : (
          <p>Hover a cluster in the image to inspect it.</p>
        )}
      </figcaption>
    </figure>
  );
}
