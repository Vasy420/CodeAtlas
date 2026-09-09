import { useEffect, useMemo, useRef } from "react";
import type { GraphEdge, GraphNode } from "../types";

const PALETTE = ["#7dd3f0", "#e8b86d", "#c4b5fd", "#86c5a6", "#f9a8d4", "#93c5fd", "#fdba74", "#a5b4fc"];

type SimNode = GraphNode & { x: number; y: number; vx: number; vy: number };

export function GraphCanvas({
  nodes,
  edges,
  selected,
  highlight,
  onSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selected?: string | null;
  highlight?: Set<string>;
  onSelect: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef<SimNode[]>([]);
  const camera = useRef({ x: 0, y: 0, k: 1, drag: false, lastX: 0, lastY: 0, grabbed: null as SimNode | null });
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const highlightRef = useRef(highlight);
  highlightRef.current = highlight;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const nodeKey = useMemo(() => nodes.map((n) => n.id).join("|"), [nodes]);

  useEffect(() => {
    sim.current = nodes.map((n, i) => {
      const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
      const radius = 120 + (n.community_id || 0) * 36;
      return {
        ...n,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });
  }, [nodeKey, nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let running = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const byId = () => new Map(sim.current.map((n) => [n.id, n]));

    const tick = () => {
      const rect = canvas.getBoundingClientRect();
      const { k, x: cx, y: cy } = camera.current;
      const body = sim.current;
      const lookup = byId();
      if (!reduce && body.length) {
        const n = body.length;
        for (let i = 0; i < n; i++) {
          const a = body[i];
          for (let j = i + 1; j < n; j++) {
            const b = body[j];
            let dx = a.x - b.x;
            let dy = a.y - b.y;
            const dist2 = dx * dx + dy * dy || 0.01;
            const same = a.community_id === b.community_id ? 0.65 : 1.2;
            const force = (3800 * same) / dist2;
            const dist = Math.sqrt(dist2);
            dx /= dist;
            dy /= dist;
            a.vx += dx * force;
            a.vy += dy * force;
            b.vx -= dx * force;
            b.vy -= dy * force;
          }
        }
        for (const edge of edgesRef.current) {
          const a = lookup.get(edge.source);
          const b = lookup.get(edge.target);
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          a.vx += dx * 0.01;
          a.vy += dy * 0.01;
          b.vx -= dx * 0.01;
          b.vy -= dy * 0.01;
        }
        for (const node of body) {
          node.vx += -node.x * 0.005;
          node.vy += -node.y * 0.005;
          node.vx *= 0.84;
          node.vy *= 0.84;
          if (camera.current.grabbed?.id !== node.id) {
            node.x += node.vx;
            node.y += node.vy;
          }
        }
      }

      const hi = highlightRef.current;
      const sel = selectedRef.current;
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.save();
      ctx.translate(rect.width / 2 + cx, rect.height / 2 + cy);
      ctx.scale(k, k);

      for (const edge of edgesRef.current) {
        const a = lookup.get(edge.source);
        const b = lookup.get(edge.target);
        if (!a || !b) continue;
        const active = !hi || hi.has(a.id) || hi.has(b.id);
        ctx.strokeStyle = active ? "rgba(125, 211, 240, 0.38)" : "rgba(143, 151, 168, 0.08)";
        ctx.lineWidth = edge.relation === "imports" ? 1.4 : 0.8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      for (const node of body) {
        const active = !hi || hi.has(node.id) || node.id === sel;
        const color = PALETTE[(node.community_id || 0) % PALETTE.length];
        const r = 5 + Math.min(14, (node.pagerank || 0) * 140 + Math.log2((node.dependents || 0) + 1));
        ctx.beginPath();
        ctx.fillStyle = active ? color : "rgba(143,151,168,0.25)";
        ctx.shadowColor = active ? color : "transparent";
        ctx.shadowBlur = node.id === sel ? 18 : 8;
        ctx.arc(node.x, node.y, node.id === sel ? r + 2 : r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (k > 0.7 && active) {
          ctx.fillStyle = "#f1ede4";
          ctx.font = "11px JetBrains Mono, monospace";
          ctx.fillText(node.name, node.x + r + 4, node.y + 4);
        }
      }
      ctx.restore();
      if (running) raf = requestAnimationFrame(tick);
    };
    tick();

    const toWorld = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const { k, x: cx, y: cy } = camera.current;
      return {
        x: (ev.clientX - rect.left - rect.width / 2 - cx) / k,
        y: (ev.clientY - rect.top - rect.height / 2 - cy) / k,
      };
    };

    const onDown = (ev: PointerEvent) => {
      const p = toWorld(ev);
      const hit = [...sim.current].reverse().find((n) => {
        const r = 12 + Math.min(14, (n.pagerank || 0) * 120);
        const dx = n.x - p.x;
        const dy = n.y - p.y;
        return dx * dx + dy * dy < r * r;
      });
      if (hit) {
        camera.current.grabbed = hit;
        selectRef.current(hit.id);
      } else {
        camera.current.drag = true;
      }
      camera.current.lastX = ev.clientX;
      camera.current.lastY = ev.clientY;
      canvas.setPointerCapture(ev.pointerId);
    };
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - camera.current.lastX;
      const dy = ev.clientY - camera.current.lastY;
      camera.current.lastX = ev.clientX;
      camera.current.lastY = ev.clientY;
      if (camera.current.grabbed) {
        const p = toWorld(ev);
        camera.current.grabbed.x = p.x;
        camera.current.grabbed.y = p.y;
        camera.current.grabbed.vx = 0;
        camera.current.grabbed.vy = 0;
      } else if (camera.current.drag) {
        camera.current.x += dx;
        camera.current.y += dy;
      }
    };
    const onUp = () => {
      camera.current.drag = false;
      camera.current.grabbed = null;
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const factor = ev.deltaY > 0 ? 0.92 : 1.08;
      camera.current.k = Math.min(3, Math.max(0.35, camera.current.k * factor));
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [nodeKey]);

  return <canvas ref={canvasRef} role="img" aria-label="Repository architecture map" />;
}
