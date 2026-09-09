import type { Briefing, ImpactResult, Project, Sample, GraphEdge, GraphNode } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new Error(
      "Cannot reach the ORION API. On Render's free plan the first request can take ~30s while the service wakes — wait and retry.",
    );
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>("/api/health"),
  samples: () => request<{ samples: Sample[] }>("/api/samples"),
  projects: () => request<{ projects: Project[] }>("/api/projects"),
  project: (id: string) => request<Project>(`/api/projects/${id}`),
  sample: (sample_id: string) =>
    request<Project>("/api/projects/sample", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sample_id }),
    }),
  git: (url: string) =>
    request<Project>("/api/projects/git", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }),
  zip: async (file: File) => {
    const data = new FormData();
    data.append("file", file);
    data.append("name", file.name.replace(/\.zip$/i, ""));
    return request<Project>("/api/projects/zip", { method: "POST", body: data });
  },
  briefing: (id: string) =>
    request<{ project: Project; briefing: Briefing }>(`/api/projects/${id}/briefing`),
  graph: (id: string, kinds = "file") =>
    request<{ nodes: GraphNode[]; edges: GraphEdge[] }>(
      `/api/projects/${id}/graph?kinds=${encodeURIComponent(kinds)}`,
    ),
  nodes: (id: string, q: string, kind?: string) =>
    request<{ nodes: GraphNode[] }>(
      `/api/projects/${id}/nodes?q=${encodeURIComponent(q)}${kind ? `&kind=${kind}` : ""}`,
    ),
  node: (id: string, key: string) =>
    request<{
      node: GraphNode;
      incoming: GraphEdge[];
      outgoing: GraphEdge[];
      snippet: { path: string; start: number; end: number; text: string } | null;
    }>(`/api/projects/${id}/node?key=${encodeURIComponent(key)}`),
  impact: (id: string, seed: string, depth: number, include_callees = false) =>
    request<ImpactResult>(`/api/projects/${id}/impact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed, depth, include_callees }),
    }),
};
