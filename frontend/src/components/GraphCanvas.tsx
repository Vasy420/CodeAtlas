import { useEffect, useMemo, useRef } from "react";
import type { GraphEdge, GraphNode } from "../types";

const PALETTE = ["#7dd3f0", "#e8b86d", "#c4b5fd", "#86c5a6", "#f9a8d4", "#93c5fd", "#fdba74", "#a5b4fc"];

type LaidOut = GraphNode & { x: number; y: number };

function layoutNodes(nodes: GraphNode[]): LaidOut[] {
  const groups = new Map<number, GraphNode[]>();
  for (const node of nodes) {
    const cid = node.community_id ?? -1;
    const list = groups.get(cid) ?? [];
    list.push(node);
    groups.set(cid, list);
  }
  const keys = [...groups.keys()].sort((a, b) => a - b);
  const count = Math.max(keys.length, 1);
  const laid: LaidOut[] = [];
  keys.forEach((cid, gi) => {
    const members = groups.get(cid) ?? [];
    const gx = Math.cos((gi / count) * Math.PI * 2) * (140 + count * 18);
    const gy = Math.sin((gi / count) * Math.PI * 2) * (110 + count * 14);
    const ring = 36 + Math.sqrt(members.length) * 16;
    members.forEach((node, i) => {
      const angle = members.length === 1 ? 0 : (i / members.length) * Math.PI * 2;
      laid.push({
        ...node,
        x: gx + Math.cos(angle) * ring,
        y: gy + Math.sin(angle) * ring,
      });
    });
  });
  return laid;
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
  const laid = useRef<LaidOut[]>([]);
  const camera = useRef({ x: 0, y: 0, k: 1, drag: false, lastX: 0, lastY: 0 });
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
  const paintRef = useRef<() => void>(() => undefined);

  const nodeKey = useMemo(
    () =>
      nodes
        .map((n) => n.id)
        .sort()
        .join("|"),
    [nodes],
  );

  useEffect(() => {
    const prev = new Map(laid.current.map((n) => [n.id, n]));
    const next = layoutNodes(nodes);
    laid.current = next.map((n) => {
      const old = prev.get(n.id);
      return old ? { ...n, x: old.x, y: old.y } : n;
    });
    if (prev.size === 0) {
      camera.current = { x: 0, y: 0, k: 1, drag: false, lastX: 0, lastY: 0 };
    }
  }, [nodeKey, nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let alive = true;

    const paint = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(rect.width * dpr);
      const h = Math.floor(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const { k, x: cx, y: cy } = camera.current;
      const body = laid.current;
      const byId = new Map(body.map((n) => [n.id, n]));
      const hi = highlightRef.current;
      const sel = selectedRef.current;
      const labels = labelsRef.current || {};

      ctx.save();
      ctx.translate(rect.width / 2 + cx, rect.height / 2 + cy);
      ctx.scale(k, k);

      const groups = new Map<number, LaidOut[]>();
      for (const node of body) {
        const cid = node.community_id ?? -1;
        const list = groups.get(cid) ?? [];
        list.push(node);
        groups.set(cid, list);
      }
      for (const [cid, members] of groups) {
        if (members.length === 0) continue;
        const mx = members.reduce((s, n) => s + n.x, 0) / members.length;
        const my = members.reduce((s, n) => s + n.y, 0) / members.length;
        const radius =
          Math.max(
            ...members.map((n) => Math.hypot(n.x - mx, n.y - my)),
            28,
          ) + 22;
        const color = PALETTE[Math.abs(cid) % PALETTE.length];
        ctx.beginPath();
        ctx.fillStyle = color + "22";
        ctx.strokeStyle = color + "66";
        ctx.lineWidth = 1;
        ctx.arc(mx, my, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#f1ede4";
        ctx.font = "12px IBM Plex Sans, sans-serif";
        ctx.fillText(labels[cid] || `Cluster ${cid}`, mx - 24, my - radius - 6);
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
        const r = 6 + Math.min(10, Math.log2((node.dependents || 0) + 1) * 2);
        ctx.beginPath();
        ctx.fillStyle = active ? color : "rgba(143,151,168,0.35)";
        ctx.arc(node.x, node.y, node.id === sel ? r + 2 : r, 0, Math.PI * 2);
        ctx.fill();
        if (k > 0.55) {
          ctx.fillStyle = active ? "#f1ede4" : "#8f97a8";
          ctx.font = "11px IBM Plex Mono, monospace";
          ctx.fillText(node.name, node.x + r + 4, node.y + 4);
        }
      }
      ctx.restore();
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(paint);
    };
    paintRef.current = schedule;

    const ro = new ResizeObserver(() => schedule());
    ro.observe(canvas);
    schedule();

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
      const hit = [...laid.current].reverse().find((n) => {
        const r = 14 + Math.min(10, Math.log2((n.dependents || 0) + 1) * 2);
        return (n.x - p.x) ** 2 + (n.y - p.y) ** 2 < r * r;
      });
      if (hit) selectRef.current(hit.id);
      camera.current.drag = !hit;
      camera.current.lastX = ev.clientX;
      camera.current.lastY = ev.clientY;
      canvas.setPointerCapture(ev.pointerId);
    };
    const onMove = (ev: PointerEvent) => {
      if (!camera.current.drag) return;
      camera.current.x += ev.clientX - camera.current.lastX;
      camera.current.y += ev.clientY - camera.current.lastY;
      camera.current.lastX = ev.clientX;
      camera.current.lastY = ev.clientY;
      schedule();
    };
    const onUp = () => {
      camera.current.drag = false;
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      camera.current.k = Math.min(2.8, Math.max(0.4, camera.current.k * (ev.deltaY > 0 ? 0.92 : 1.08)));
      schedule();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      void alive;
    };
  }, [nodeKey]);

  useEffect(() => {
    paintRef.current();
  }, [selected, highlight, nodeKey]);

  return <canvas ref={canvasRef} role="img" aria-label="Repository architecture map" />;
}
