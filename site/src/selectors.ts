// Pure functions over the hub data. No signals or DOM here, so everything is unit-testable.

import type {
  Headline, Hub, HubConfig, Manifest, MetricConfig, MetricInfo, NavGroup, NavItem, Project, Report, Run, RunRef, Status,
} from "./types";
import { fmtCompact, slugify, titleize } from "./lib/format";

type MetricsConfig = HubConfig["metrics"];

// ───────────── normalization ─────────────

export function normalize(config: HubConfig, manifest: Manifest | null): Hub {
  const navGroups: NavGroup[] = (config.nav ?? []).map((group) => ({
    title: group.group ?? group.title ?? "",
    items: (group.items ?? []).map((item): NavItem => ({
      ...item,
      id: item.id ?? slugify(item.title ?? item.src ?? item.href ?? "page"),
      title: item.title ?? item.id ?? "Untitled",
      type: item.type ?? (item.href ? "link" : "markdown"),
    })),
  }));

  const meta = config.projects ?? {};
  const order = Object.keys(meta);
  const rank = (id: string) => { const i = order.indexOf(id); return i < 0 ? Infinity : i; };

  const projects = (manifest?.projects ?? [])
    .filter((p) => !meta[p.id]?.hidden)
    .map((p) => {
      const m = meta[p.id] ?? {};
      const project: Project = {
        id: p.id,
        title: m.title ?? p.title ?? titleize(p.id),
        description: m.description ?? "",
        repo: m.repo ?? null,
        defaultBranch: m.defaultBranch ?? null,
        reports: [],
      };
      project.reports = (p.reports ?? []).map((r): Report => ({
        id: r.id,
        type: r.type ?? "html",
        title: m.reports?.[r.id]?.title ?? r.title ?? titleize(r.id),
        project,
        runs: [...(r.runs ?? [])].sort(byNewest),
      }));
      return project;
    })
    .filter((p) => p.reports.length)
    .sort((a, b) => rank(a.id) - rank(b.id) || a.title.localeCompare(b.title));

  return {
    config,
    generatedAt: manifest?.generatedAt ?? null,
    hasManifest: !!manifest,
    projects,
    navGroups,
    pages: navGroups.flatMap((g) => g.items).filter((i) => i.type !== "link"),
  };
}

const byNewest = (a: Run, b: Run) => Date.parse(b.createdAt) - Date.parse(a.createdAt);

// ───────────── lookups ─────────────

export const getProject = (hub: Hub, id?: string) => hub.projects.find((p) => p.id === id);
export const getReport = (hub: Hub, pid?: string, rid?: string) => getProject(hub, pid)?.reports.find((r) => r.id === rid);
export const getPage = (hub: Hub, id?: string) => hub.pages.find((p) => p.id === id);
export const navGroupOf = (hub: Hub, page: NavItem) => hub.navGroups.find((g) => g.items.includes(page));

// "Latest" prefers the project's default branch so PR runs don't flip the dashboard status.
export function latestRun(report: Report): Run | null {
  const branch = report.project.defaultBranch;
  if (branch) {
    const onDefault = report.runs.find((r) => r.git?.branch === branch);
    if (onDefault) return onDefault;
  }
  return report.runs[0] ?? null;
}

export function findRun(report: Report, runId?: string): Run | null {
  if (!runId || runId === "latest") return latestRun(report);
  return report.runs.find((r) => r.id === runId) ?? null;
}

export function previousRun(report: Report, run: Run | null): Run | undefined {
  if (!run) return undefined;
  return report.runs[report.runs.indexOf(run) + 1];
}

export function allRuns(hub: Hub): RunRef[] {
  return hub.projects
    .flatMap((project) => project.reports.flatMap((report) => report.runs.map((run) => ({ project, report, run }))))
    .sort((a, b) => byNewest(a.run, b.run));
}

export function runStatus(run: Run | null | undefined): Status {
  return run?.status ?? "neutral";
}

export const isFailing = (run: Run | null | undefined) => {
  const s = runStatus(run);
  return s === "failed" || s === "broken";
};

/** passed ÷ executed — skipped tests don't count against the rate. */
export function passRate(run: Run | null | undefined): number | null {
  const s = run?.stats;
  if (!s) return null;
  const executed = (s.total ?? 0) - (s.skipped ?? 0);
  return executed > 0 ? (100 * (s.passed ?? 0)) / executed : null;
}

/** Pass rate across several runs, weighted by executed tests. */
export function aggregatePassRate(runs: Array<Run | null | undefined>): number | null {
  let passed = 0;
  let executed = 0;
  for (const r of runs) {
    if (!r?.stats) continue;
    passed += r.stats.passed ?? 0;
    executed += (r.stats.total ?? 0) - (r.stats.skipped ?? 0);
  }
  return executed ? (100 * passed) / executed : null;
}

export const failedCount = (run: Run | null | undefined) => (run?.stats?.failed ?? 0) + (run?.stats?.broken ?? 0);

export type ReportKind = "tests" | "metrics" | "plain";

export function reportKind(report: Report): ReportKind {
  if (report.runs.some((r) => r.stats)) return "tests";
  if (report.runs.some((r) => r.metrics && Object.keys(r.metrics).length)) return "metrics";
  return "plain";
}

export function metricKeys(runs: Run[]): string[] {
  const keys = new Set<string>();
  for (const r of runs) for (const k of Object.keys(r.metrics ?? {})) keys.add(k);
  const rank = (k: string) => (k === "coverage" ? 0 : k.startsWith("coverage") ? 1 : k.startsWith("lighthouse") ? 2 : 3);
  return [...keys].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** The single number that best summarizes a run: pass rate for tests, else the lead metric. */
export function headline(run: Run | null | undefined, metrics?: MetricsConfig): Headline | null {
  if (!run) return null;
  if (run.stats) return { key: "passRate", value: passRate(run), info: metricInfo("passRate", metrics) };
  const key = metricKeys([run])[0];
  if (key) return { key, value: run.metrics?.[key] ?? null, info: metricInfo(key, metrics) };
  return null;
}

/** Values of the headline metric of `runs[0]` across `runs` (same order). */
export function headlineSeries(runs: Run[], metrics?: MetricsConfig): Array<number | null> | null {
  const first = headline(runs[0], metrics);
  if (!first) return null;
  return runs.map((r) => (first.key === "passRate" ? passRate(r) : r.metrics?.[first.key] ?? null));
}

const METRIC_TITLES: Record<string, string> = {
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

/**
 * How to title, format and judge a metric. hub.config.json "metrics" entries override the defaults:
 *   "metrics": { "bundle.size": { "title": "Bundle size", "unit": "kB", "better": "lower", "digits": 0 } }
 */
export function metricInfo(key: string, metrics?: MetricsConfig): MetricInfo {
  const custom: MetricConfig = metrics?.[key] ?? {};
  const isPct = key === "passRate" || /^coverage|rate$|percent|pct/i.test(key);
  const isScore = /^lighthouse\./.test(key);
  const lowerIsBetter = /size|bytes|kb|mb|time|duration|latency|ms$|p9\d|error|memory/i.test(key);
  const info: MetricInfo = {
    key,
    title: custom.title ?? METRIC_TITLES[key] ?? titleize(key.split(".").pop() ?? key),
    unit: custom.unit ?? (isPct ? "%" : ""),
    better: custom.better ?? (isPct || isScore ? "higher" : lowerIsBetter ? "lower" : "neutral"),
    digits: custom.digits ?? (isScore ? 0 : 1),
    min: custom.min !== undefined ? custom.min : isPct || isScore ? 0 : null,
    max: custom.max !== undefined ? custom.max : isPct || isScore ? 100 : null,
    format: () => "",
  };
  info.format = (v) => {
    if (v == null || !Number.isFinite(v)) return "—";
    const n = Math.abs(v) >= 10000 ? fmtCompact(v) : v.toFixed(Number.isInteger(v) && info.unit !== "%" ? 0 : info.digits);
    return info.unit === "%" ? `${n}%` : info.unit ? `${n} ${info.unit}` : n;
  };
  return info;
}

/** Branches seen in `runs`, most frequent first. */
export function branchesOf(runs: Run[]): string[] {
  const counts = new Map<string, number>();
  for (const r of runs) if (r.git?.branch) counts.set(r.git.branch, (counts.get(r.git.branch) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);
}

export const runHref = (run: Run | null | undefined): string | null => (run?.path ? `${run.path}${run.entry ?? ""}` : null);

function repoUrl(run: Run): string | null {
  if (!run.ci?.repo) return null;
  let server = "https://github.com";
  try { if (run.ci.runUrl) server = new URL(run.ci.runUrl).origin; } catch { /* keep default */ }
  return `${server}/${run.ci.repo}`;
}

export function commitUrl(run: Run): string | null {
  const repo = repoUrl(run);
  return repo && run.git?.commit ? `${repo}/commit/${run.git.commit}` : null;
}

export function prUrl(run: Run): string | null {
  const repo = repoUrl(run);
  return repo && run.git?.pr ? `${repo}/pull/${run.git.pr}` : null;
}
