import { useEffect, useMemo, useRef } from "react";
import type { GraphEdge, GraphNode } from "../types";

const PALETTE = ["#7dd3f0", "#e8b86d", "#c4b5fd", "#86c5a6", "#f9a8d4", "#93c5fd", "#fdba74", "#a5b4fc"];

type SimNode = GraphNode & { x: number; y: number; vx: number; vy: number };

function seedLayout(nodes: GraphNode[]): SimNode[] {
  const groups = new Map<number, GraphNode[]>();
  for (const node of nodes) {
    const cid = node.community_id ?? -1;
    const list = groups.get(cid) ?? [];
    list.push(node);
    groups.set(cid, list);
  }
  const keys = [...groups.keys()].sort((a, b) => a - b);
  const count = Math.max(keys.length, 1);
  const laid: SimNode[] = [];
  keys.forEach((cid, gi) => {
    const members = groups.get(cid) ?? [];
    const gx = Math.cos((gi / count) * Math.PI * 2) * (160 + count * 20);
    const gy = Math.sin((gi / count) * Math.PI * 2) * (120 + count * 16);
    const ring = 40 + Math.sqrt(members.length) * 18;
    members.forEach((node, i) => {
      const angle = members.length === 1 ? 0 : (i / members.length) * Math.PI * 2;
      laid.push({
        ...node,
        x: gx + Math.cos(angle) * ring,
        y: gy + Math.sin(angle) * ring,
        vx: 0,
        vy: 0,
      });
    });
  });
  return laid;
}

function radiusOf(node: SimNode, selected: string | null | undefined) {
  const r = 6 + Math.min(10, Math.log2((node.dependents || 0) + 1) * 2);
  return node.id === selected ? r + 2 : r;
}

export function GraphCanvas({
  nodes,
  edges,
  selected,
  highlight,
  clusterLabels,
  onSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selected?: string | null;
  highlight?: Set<string>;
  clusterLabels?: Record<number, string>;
  onSelect: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef<SimNode[]>([]);
  const camera = useRef({ x: 0, y: 0, k: 1, pan: false, lastX: 0, lastY: 0, grabbed: null as SimNode | null });
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const highlightRef = useRef(highlight);
  highlightRef.current = highlight;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const labelsRef = useRef(clusterLabels);
  labelsRef.current = clusterLabels;

  const nodeKey = useMemo(
    () =>
      nodes
        .map((n) => n.id)
        .sort()
        .join("|"),
    [nodes],
  );

  useEffect(() => {
    const prev = new Map(sim.current.map((n) => [n.id, n]));
    const next = seedLayout(nodes);
    sim.current = next.map((n) => {
      const old = prev.get(n.id);
      return old ? { ...n, x: old.x, y: old.y, vx: old.vx, vy: old.vy } : n;
    });
    if (prev.size === 0) {
      camera.current = { x: 0, y: 0, k: 1, pan: false, lastX: 0, lastY: 0, grabbed: null };
    }
  }, [nodeKey, nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(rect.width * dpr);
      const h = Math.floor(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    };

    const step = () => {
      const body = sim.current;
      const n = body.length;
      if (!n) return;
      const grabbed = camera.current.grabbed?.id;
      for (let i = 0; i < n; i++) {
        const a = body[i];
        for (let j = i + 1; j < n; j++) {
          const b = body[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          const dist = Math.max(Math.hypot(dx, dy), 18);
          dx /= dist;
          dy /= dist;
          const same = a.community_id === b.community_id ? 0.55 : 1;
          const force = Math.min(12, (1400 * same) / (dist * dist));
          a.vx += dx * force;
          a.vy += dy * force;
          b.vx -= dx * force;
          b.vy -= dy * force;
        }
      }
      const byId = new Map(body.map((node) => [node.id, node]));
      for (const edge of edgesRef.current) {
        const a = byId.get(edge.source);
        const b = byId.get(edge.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const pull = (dist - 90) * 0.012;
        const fx = (dx / dist) * pull;
        const fy = (dy / dist) * pull;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
      for (const node of body) {
        node.vx += -node.x * 0.006;
        node.vy += -node.y * 0.006;
        node.vx *= 0.82;
        node.vy *= 0.82;
        if (grabbed !== node.id) {
          node.x += node.vx;
          node.y += node.vy;
        } else {
          node.vx = 0;
          node.vy = 0;
        }
      }
    };

    const paint = () => {
      const rect = canvas.getBoundingClientRect();
      if (!resize()) return;
      ctx.clearRect(0, 0, rect.width, rect.height);
      const { k, x: cx, y: cy } = camera.current;
      const body = sim.current;
      const byId = new Map(body.map((n) => [n.id, n]));
      const hi = highlightRef.current;
      const sel = selectedRef.current;
      const labels = labelsRef.current || {};

      ctx.save();
      ctx.translate(rect.width / 2 + cx, rect.height / 2 + cy);
      ctx.scale(k, k);

      const groups = new Map<number, SimNode[]>();
      for (const node of body) {
        const cid = node.community_id ?? -1;
        const list = groups.get(cid) ?? [];
        list.push(node);
        groups.set(cid, list);
      }
      for (const [cid, members] of groups) {
        if (!members.length) continue;
        const mx = members.reduce((s, n) => s + n.x, 0) / members.length;
        const my = members.reduce((s, n) => s + n.y, 0) / members.length;
        const radius = Math.max(...members.map((n) => Math.hypot(n.x - mx, n.y - my)), 24) + 26;
        const color = PALETTE[Math.abs(cid) % PALETTE.length];
        ctx.beginPath();
        ctx.fillStyle = `${color}18`;
        ctx.strokeStyle = `${color}55`;
        ctx.lineWidth = 1;
        ctx.arc(mx, my, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#f1ede4";
        ctx.font = "12px IBM Plex Sans, sans-serif";
        ctx.fillText(labels[cid] || `Cluster ${cid}`, mx - 28, my - radius - 6);
      }

      for (const edge of edgesRef.current) {
        const a = byId.get(edge.source);
        const b = byId.get(edge.target);
        if (!a || !b) continue;
        const active = !hi || hi.has(a.id) || hi.has(b.id);
        ctx.strokeStyle = active ? "rgba(125, 211, 240, 0.45)" : "rgba(143, 151, 168, 0.12)";
        ctx.lineWidth = edge.relation === "imports" ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      for (const node of body) {
        const active = !hi || hi.has(node.id) || node.id === sel;
        const color = PALETTE[Math.abs(node.community_id ?? 0) % PALETTE.length];
        const r = radiusOf(node, sel);
        ctx.beginPath();
        ctx.fillStyle = active ? color : "rgba(143,151,168,0.35)";
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (k > 0.55) {
          ctx.fillStyle = active ? "#f1ede4" : "#8f97a8";
          ctx.font = "11px IBM Plex Mono, monospace";
          ctx.fillText(node.name, node.x + r + 4, node.y + 4);
        }
      }
      ctx.restore();
    };

    const tick = () => {
      if (!running) return;
      if (!reduce) step();
      paint();
      raf = requestAnimationFrame(tick);
    };
    tick();

    const ro = new ResizeObserver(() => paint());
    ro.observe(canvas);

    const toWorld = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const { k, x: cx, y: cy } = camera.current;
      return {
        x: (ev.clientX - rect.left - rect.width / 2 - cx) / k,
        y: (ev.clientY - rect.top - rect.height / 2 - cy) / k,
      };
    };

    const hitTest = (ev: PointerEvent) => {
      const p = toWorld(ev);
      return [...sim.current].reverse().find((n) => {
        const r = radiusOf(n, selectedRef.current) + 8;
        return (n.x - p.x) ** 2 + (n.y - p.y) ** 2 < r * r;
      });
    };

    const onDown = (ev: PointerEvent) => {
      const hit = hitTest(ev);
      if (hit) {
        camera.current.grabbed = hit;
        camera.current.pan = false;
        hit.vx = 0;
        hit.vy = 0;
        selectRef.current(hit.id);
        canvas.style.cursor = "grabbing";
      } else {
        camera.current.grabbed = null;
        camera.current.pan = true;
        canvas.style.cursor = "grabbing";
      }
      camera.current.lastX = ev.clientX;
      camera.current.lastY = ev.clientY;
      canvas.setPointerCapture(ev.pointerId);
    };
    const onMove = (ev: PointerEvent) => {
      const cam = camera.current;
      if (cam.grabbed) {
        const p = toWorld(ev);
        cam.grabbed.x = p.x;
        cam.grabbed.y = p.y;
        cam.grabbed.vx = 0;
        cam.grabbed.vy = 0;
      } else if (cam.pan) {
        cam.x += ev.clientX - cam.lastX;
        cam.y += ev.clientY - cam.lastY;
      } else {
        canvas.style.cursor = hitTest(ev) ? "grab" : "default";
      }
      cam.lastX = ev.clientX;
      cam.lastY = ev.clientY;
    };
    const onUp = () => {
      camera.current.pan = false;
      camera.current.grabbed = null;
      canvas.style.cursor = "default";
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      camera.current.k = Math.min(2.8, Math.max(0.4, camera.current.k * (ev.deltaY > 0 ? 0.92 : 1.08)));
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [nodeKey]);

  return <canvas ref={canvasRef} role="img" aria-label="Repository architecture map" />;
}
