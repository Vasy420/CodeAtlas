import { useCallback, useEffect, useRef, useState } from "react";

export function InteractiveHero() {
  const stageRef = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<number>(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const [spot, setSpot] = useState({ x: 50, y: 42 });
  const [over, setOver] = useState(false);
  const [flash, setFlash] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      window.clearTimeout(flashTimer.current);
    };
  }, []);

  const track = useCallback(
    (clientX: number, clientY: number) => {
      const el = stageRef.current;
      if (!el || reduce) return;
      const box = el.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
      const py = Math.min(1, Math.max(0, (clientY - box.top) / box.height));
      setTilt({ x: (0.5 - py) * 18, y: (px - 0.5) * 20 });
      setShift({ x: (px - 0.5) * 10, y: (py - 0.5) * 10 });
      setSpot({ x: px * 100, y: py * 100 });
    },
    [reduce],
  );

  const reset = () => {
    setOver(false);
    setTilt({ x: 0, y: 0 });
    setShift({ x: 0, y: 0 });
    setSpot({ x: 50, y: 42 });
  };

  const shutter = () => {
    if (reduce) return;
    setFlash(true);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(false), 520);
  };

  return (
    <figure className="hero-art">
      <div
        ref={stageRef}
        className="hero-track"
        role="img"
        aria-label="Architecture map of a software repository. Move over it to inspect. Click to lock a view."
        tabIndex={0}
        onMouseEnter={() => setOver(true)}
        onMouseMove={(e) => {
          setOver(true);
          track(e.clientX, e.clientY);
        }}
        onMouseLeave={reset}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) {
            setOver(true);
            track(t.clientX, t.clientY);
          }
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) track(t.clientX, t.clientY);
        }}
        onTouchEnd={reset}
        onClick={shutter}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            shutter();
          }
        }}
      >
        <div
          className="hero-track-inner"
          style={{
            transform: reduce ? undefined : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: over ? "transform 80ms linear" : "transform 500ms ease",
          }}
        >
          <img
            src="/hero.jpg"
            alt=""
            draggable={false}
            style={{
              transform: reduce
                ? undefined
                : `translate3d(${shift.x * 0.35}px, ${shift.y * 0.35}px, 18px)`,
              transition: over ? "transform 80ms linear" : "transform 500ms ease",
            }}
          />
          {!reduce && over && (
            <>
              <span
                className="hero-spot"
                style={{
                  background: `radial-gradient(circle at ${spot.x}% ${spot.y}%, rgba(255,255,255,0.22), transparent 42%)`,
                }}
              />
              <span
                className="hero-bead"
                style={{
                  transform: `translate(${shift.x}px, ${shift.y}px)`,
                  transition: "transform 70ms linear",
                }}
              />
            </>
          )}
          <span className={`hero-shutter${flash ? " on" : ""}`} />
        </div>
      </div>
    </figure>
  );
}
