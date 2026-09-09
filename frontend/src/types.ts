export type ProjectStatus = "queued" | "running" | "ready" | "failed";

export interface Project {
  id: string;
  name: string;
  source_type: string;
  source_url: string | null;
  status: ProjectStatus;
  stage: string;
  error: string | null;
  log: string;
  loc: number;
  file_count: number;
  node_count: number;
  edge_count: number;
  languages: Record<string, number>;
  created_at: string | null;
}

export interface GraphNode {
  id: string;
  kind: string;
  name: string;
  qualified_name: string;
  path: string;
  language: string;
  start_line: number | null;
  end_line: number | null;
  loc: number;
  pagerank: number;
  community_id: number | null;
  in_degree: number;
  out_degree: number;
  dependents: number;
  distance?: number;
  is_seed?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  confidence: string;
  weight?: number;
}

export interface Briefing {
  summary: string;
  stats: {
    files: number;
    functions: number;
    classes: number;
    externals: number;
    nodes: number;
    edges: number;
    loc: number;
    languages: Record<string, number>;
    clusters: number;
  };
  languages: { name: string; files: number }[];
  clusters: { id: number; label: string; file_count: number; files: string[] }[];
  god_nodes: GraphNode[];
  entry_points: GraphNode[];
  reading_path: GraphNode[];
  high_coupling: { id: string; path: string; name: string; degree: number; dependents: number }[];
  structure: StructureNode[];
  external_deps: { id: string; name: string; used_by: number; files: string[] }[];
  continue_guide: {
    start_here: string[];
    read_next: string[];
    change_carefully: string[];
    install_or_know: string[];
  };
  warnings: string[];
}

export interface StructureNode {
  kind: "dir" | "file";
  name: string;
  path?: string;
  id?: string;
  language?: string;
  children: StructureNode[];
}

export interface ImpactResult {
  seed: { id: string; name: string; kind: string; path: string; qualified_name: string };
  depth: number;
  summary: {
    affected_nodes: number;
    affected_files: number;
    affected_communities: number;
    risk?: string;
    note?: string;
  };
  affected: Array<GraphNode & { distance: number; relation?: string; confidence?: string }>;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Sample {
  id: string;
  name: string;
  blurb: string;
}
