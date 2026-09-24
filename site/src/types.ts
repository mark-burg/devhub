// Shapes of the files the hub reads. data/manifest.json is written by scripts/hub.mjs;
// hub.config.json is hand-written. Keep in sync with the publisher.

export type Status = "passed" | "failed" | "broken" | "skipped" | "unknown" | "neutral";

export interface Stats {
  total: number;
  passed?: number;
  failed?: number;
  broken?: number;
  skipped?: number;
  unknown?: number;
  flaky?: number;
  retries?: number;
}

export interface RunGit {
  branch?: string;
  commit?: string;
  message?: string;
  pr?: number;
  author?: string;
}

export interface RunCi {
  runUrl?: string;
  runNumber?: number;
  workflow?: string;
  event?: string;
  repo?: string;
}

export interface Run {
  id: string;
  label: string;
  createdAt: string;
  /** Folder of the report files, relative to the site root. Absent once pruned. */
  path?: string;
  /** Page inside `path` to open (e.g. "awesome/"). */
  entry?: string;
  pruned?: boolean;
  status?: Status;
  stats?: Stats;
  durationMs?: number;
  metrics?: Record<string, number>;
  git?: RunGit;
  ci?: RunCi;
}

export interface Manifest {
  schema?: number;
  generatedAt?: string;
  projects?: Array<{
    id: string;
    title?: string;
    reports?: Array<{ id: string; title?: string; type?: string; runs?: Run[] }>;
  }>;
}

export type Better = "higher" | "lower" | "neutral";

export interface MetricConfig {
  title?: string;
  unit?: string;
  better?: Better;
  digits?: number;
  min?: number | null;
  max?: number | null;
}

export interface ProjectConfig {
  title?: string;
  description?: string;
  repo?: string;
  defaultBranch?: string;
  hidden?: boolean;
  reports?: Record<string, { title?: string }>;
}

export type OpenApiRenderer = "swagger" | "redoc" | "scalar";

export interface NavItem {
  id: string;
  title: string;
  /** markdown | openapi | benchmark | vega | embed | html | link */
  type: string;
  src?: string;
  href?: string;
  icon?: string;
  description?: string;
  renderer?: OpenApiRenderer;
  tryItOut?: boolean;
  zero?: boolean;
  spec?: unknown;
}

export interface HubConfig {
  title?: string;
  tagline?: string;
  projects?: Record<string, ProjectConfig>;
  metrics?: Record<string, MetricConfig>;
  nav?: Array<{ group?: string; title?: string; items?: Array<Partial<NavItem>> }>;
}

// ───────────── normalized, in-memory model ─────────────

export interface Project {
  id: string;
  title: string;
  description: string;
  repo: string | null;
  defaultBranch: string | null;
  reports: Report[];
}

export interface Report {
  id: string;
  type: string;
  title: string;
  project: Project;
  /** Newest first. */
  runs: Run[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface Hub {
  config: HubConfig;
  generatedAt: string | null;
  hasManifest: boolean;
  projects: Project[];
  navGroups: NavGroup[];
  /** Nav items rendered inside the hub (everything except links). */
  pages: NavItem[];
}

export interface RunRef {
  project: Project;
  report: Report;
  run: Run;
}

export interface MetricInfo {
  key: string;
  title: string;
  unit: string;
  better: Better;
  digits: number;
  min: number | null;
  max: number | null;
  format: (v: number | null | undefined) => string;
}

export interface Headline {
  key: string;
  value: number | null;
  info: MetricInfo;
}
