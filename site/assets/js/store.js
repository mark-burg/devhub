// Loads hub.config.json (hand-written) and data/manifest.json (written by scripts/hub.mjs)
// and exposes a normalized, read-only view of projects, report channels, runs and pages.

import { slugify, titleize } from "./util.js";

export const store = {
  config: {},
  generatedAt: null,
  projects: [],
  navGroups: [],
  pages: [],
  hasManifest: false,
};

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function load() {
  const [config, manifest] = await Promise.all([fetchJSON("hub.config.json"), fetchJSON("data/manifest.json")]);
  applyConfig(config ?? {});
  applyManifest(manifest);
}

// Re-reads the manifest; resolves true when it changed.
export async function refreshManifest() {
  const manifest = await fetchJSON("data/manifest.json");
  if (!manifest || manifest.generatedAt === store.generatedAt) return false;
  applyManifest(manifest);
  return true;
}

function applyConfig(config) {
  store.config = config;
  store.navGroups = (config.nav ?? []).map((group) => ({
    title: group.group ?? group.title ?? "",
    items: (group.items ?? []).map((item) => ({
      ...item,
      id: item.id ?? slugify(item.title ?? item.src ?? item.href ?? "page"),
      type: item.type ?? (item.href ? "link" : "markdown"),
    })),
  }));
  store.pages = store.navGroups.flatMap((g) => g.items).filter((i) => i.type !== "link");
}

function applyManifest(manifest) {
  store.hasManifest = !!manifest;
  store.generatedAt = manifest?.generatedAt ?? null;
  const meta = store.config.projects ?? {};
  const order = Object.keys(meta);

  store.projects = (manifest?.projects ?? [])
    .map((p) => {
      const m = meta[p.id] ?? {};
      const project = {
        id: p.id,
        title: m.title ?? p.title ?? titleize(p.id),
        description: m.description ?? "",
        repo: m.repo ?? null,
        defaultBranch: m.defaultBranch ?? null,
        hidden: !!m.hidden,
        reports: [],
      };
      project.reports = (p.reports ?? []).map((r) => ({
        id: r.id,
        type: r.type ?? "html",
        title: m.reports?.[r.id]?.title ?? r.title ?? titleize(r.id),
        project,
        runs: [...(r.runs ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
      }));
      return project;
    })
    .filter((p) => !p.hidden && p.reports.length)
    .sort((a, b) => {
      const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
      if (ia !== ib) return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib);
      return a.title.localeCompare(b.title);
    });
}

// ───────────── lookups ─────────────

export const getProject = (id) => store.projects.find((p) => p.id === id);
export const getReport = (pid, rid) => getProject(pid)?.reports.find((r) => r.id === rid);
export const getPage = (id) => store.pages.find((p) => p.id === id);

// "Latest" prefers the project's default branch so PR runs don't flip the dashboard status.
export function latestRun(report) {
  const branch = report.project.defaultBranch;
  if (branch) {
    const onDefault = report.runs.find((r) => r.git?.branch === branch);
    if (onDefault) return onDefault;
  }
  return report.runs[0] ?? null;
}

export function findRun(report, runId) {
  if (!runId || runId === "latest") return latestRun(report);
  return report.runs.find((r) => r.id === runId) ?? null;
}

export function allRuns() {
  return store.projects
    .flatMap((project) => project.reports.flatMap((report) => report.runs.map((run) => ({ project, report, run }))))
    .sort((a, b) => Date.parse(b.run.createdAt) - Date.parse(a.run.createdAt));
}

export function runStatus(run) {
  if (!run) return "neutral";
  if (run.status) return run.status;
  return "neutral";
}

// passed ÷ executed (skipped tests don't count against the rate).
export function passRate(run) {
  const s = run?.stats;
  if (!s) return null;
  const executed = (s.total ?? 0) - (s.skipped ?? 0);
  return executed > 0 ? (100 * (s.passed ?? 0)) / executed : null;
}

export function reportKind(report) {
  if (report.runs.some((r) => r.stats)) return "tests";
  if (report.runs.some((r) => r.metrics && Object.keys(r.metrics).length)) return "metrics";
  return "plain";
}

export function metricKeys(runs) {
  const keys = new Set();
  for (const r of runs) for (const k of Object.keys(r.metrics ?? {})) keys.add(k);
  const rank = (k) => (k === "coverage" ? 0 : k.startsWith("coverage") ? 1 : k.startsWith("lighthouse") ? 2 : 3);
  return [...keys].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

// The single number that best summarizes a run: pass rate for tests, else the lead metric.
export function headline(report, run) {
  if (!run) return null;
  if (run.stats) return { key: "passRate", value: passRate(run), info: metricInfo("passRate") };
  const key = metricKeys([run])[0];
  if (key) return { key, value: run.metrics[key], info: metricInfo(key) };
  return null;
}

export function headlineSeries(report, runs) {
  const first = headline(report, runs[0]);
  if (!first) return null;
  return runs.map((r) => (first.key === "passRate" ? passRate(r) : r.metrics?.[first.key] ?? null));
}

const METRIC_TITLES = {
  passRate: "Pass rate",
  coverage: "Coverage",
  "coverage.statements": "Statement coverage",
  "coverage.branches": "Branch coverage",
  "coverage.functions": "Function coverage",
  "coverage.instructions": "Instruction coverage",
  "lighthouse.performance": "Performance",
  "lighthouse.accessibility": "Accessibility",
  "lighthouse.best-practices": "Best practices",
  "lighthouse.seo": "SEO",
};

// How to title, format and judge a metric. hub.config.json "metrics" entries override the defaults:
//   "metrics": { "bundle.size": { "title": "Bundle size", "unit": "kB", "better": "lower", "digits": 0 } }
export function metricInfo(key) {
  const custom = store.config.metrics?.[key] ?? {};
  const isPct = key === "passRate" || /^coverage|rate$|percent|pct/i.test(key);
  const isScore = /^lighthouse\./.test(key);
  const lowerIsBetter = /size|bytes|kb|mb|time|duration|latency|ms$|p9\d|error|memory/i.test(key);
  const info = {
    key,
    title: METRIC_TITLES[key] ?? titleize(key.split(".").pop()),
    unit: isPct ? "%" : "",
    better: isPct || isScore ? "higher" : lowerIsBetter ? "lower" : "neutral",
    digits: isScore ? 0 : 1,
    min: isPct || isScore ? 0 : null,
    max: isPct || isScore ? 100 : null,
    ...custom,
  };
  info.format = (v) => {
    if (v == null || !Number.isFinite(v)) return "—";
    const n = Math.abs(v) >= 10000 ? new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(v)
      : v.toFixed(Number.isInteger(v) && info.unit !== "%" ? 0 : info.digits);
    return info.unit === "%" ? `${n}%` : info.unit ? `${n} ${info.unit}` : n;
  };
  return info;
}

export function branchesOf(runs) {
  const counts = new Map();
  for (const r of runs) if (r.git?.branch) counts.set(r.git.branch, (counts.get(r.git.branch) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);
}

export const runHref = (run) => (run?.path ? `${run.path}${run.entry ?? ""}` : null);

export function commitUrl(run) {
  const repo = run?.ci?.repo;
  if (!repo || !run.git?.commit) return null;
  const server = run.ci.runUrl ? new URL(run.ci.runUrl).origin : "https://github.com";
  return `${server}/${repo}/commit/${run.git.commit}`;
}

export function prUrl(run) {
  const repo = run?.ci?.repo;
  if (!repo || !run.git?.pr) return null;
  const server = run.ci.runUrl ? new URL(run.ci.runUrl).origin : "https://github.com";
  return `${server}/${repo}/pull/${run.git.pr}`;
}
