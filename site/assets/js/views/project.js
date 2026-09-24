import { h, icon, fmtDuration, fmtNumber, fmtPct, statusPill, typeIcon } from "../util.js";
import { branchesOf, getProject, latestRun, metricInfo, metricKeys, passRate, reportKind, runStatus } from "../store.js";
import { go, routes } from "../router.js";
import { STATUS_SERIES, runChart } from "../charts.js";
import { button, delta, emptyState, pageHeader, runMeta, runsTable, select, tile } from "../components.js";

const RANGES = [["10", "Last 10 runs"], ["20", "Last 20 runs"], ["50", "Last 50 runs"], ["all", "All runs"]];

export function projectView(ctx) {
  const project = getProject(ctx.route.parts[1]);
  if (!project) return null;
  const q = ctx.route.query;
  const branch = q.get("branch") ?? "";
  const range = q.get("n") ?? "20";
  const setQuery = (patch) => go(["p", project.id], { branch, n: range === "20" ? null : range, ...patch });

  const allRuns = project.reports.flatMap((r) => r.runs);
  const branches = branchesOf(allRuns);
  const filters = h("div", { class: "filters" },
    select("Branch", branch, [{ value: "", label: "All branches" }, ...branches.map((b) => ({ value: b, label: b }))], (v) => setQuery({ branch: v || null })),
    select("Range", range, RANGES.map(([value, label]) => ({ value, label })), (v) => setQuery({ n: v === "20" ? null : v })));

  const sections = project.reports.map((report) => {
    let runs = report.runs.filter((r) => !branch || r.git?.branch === branch);
    if (range !== "all") runs = runs.slice(0, Number(range));
    return reportSection(ctx, project, report, runs, branch);
  });

  const actions = [project.repo ? button("Repository", { href: project.repo, iconName: "external", external: true }) : null].filter(Boolean);
  return {
    title: project.title,
    crumbs: [{ label: "Projects" }, { label: project.title }],
    el: h("div", { class: "page" },
      pageHeader(project.title, project.description || `${project.reports.length} report${project.reports.length === 1 ? "" : "s"} · ${allRuns.length} runs`, ...actions),
      filters,
      sections),
  };
}

function reportSection(ctx, project, report, runs, branch) {
  const latest = runs[0] ?? null;
  const kind = reportKind(report);
  const chrono = [...runs].reverse();
  const labels = chrono.map((r) => r.label);
  const openRun = (i) => { const r = chrono[i]; if (r && !r.pruned) go(["r", project.id, report.id, r.id]); };
  const tipFoot = (i) => [chrono[i].git?.branch, chrono[i].git?.message].filter(Boolean).join(" · ");

  const head = h("div", { class: "report-head" },
    h("div", { class: "report-title" },
      icon(typeIcon(report.type)),
      h("h2", null, report.title),
      h("span", { class: "tag" }, report.type),
      latest ? statusPill(runStatus(latest)) : null),
    latestRun(report)?.path ? button("Open latest", { href: routes.report(project.id, report.id), iconName: "chevron-right", variant: "primary", trailing: true }) : null);

  if (!runs.length) {
    return h("section", { class: "card report-section" }, head,
      emptyState("No runs match", branch ? `No runs on branch “${branch}”.` : "Nothing published yet."));
  }

  const blocks = [];
  if (kind === "tests") {
    const prev = runs[1];
    blocks.push(h("div", { class: "kpis compact" },
      tile({ label: "Pass rate", value: fmtPct(passRate(latest)), deltaEl: delta(passRate(latest), passRate(prev), { unit: " pts" }) }),
      tile({ label: "Tests", value: fmtNumber(latest.stats?.total), deltaEl: delta(latest.stats?.total, prev?.stats?.total, { better: "neutral", digits: 0 }) }),
      tile({ label: "Failed + broken", value: String((latest.stats?.failed ?? 0) + (latest.stats?.broken ?? 0)),
        tone: (latest.stats?.failed ?? 0) + (latest.stats?.broken ?? 0) ? "bad" : null,
        deltaEl: prev?.stats ? delta((latest.stats?.failed ?? 0) + (latest.stats?.broken ?? 0), (prev.stats.failed ?? 0) + (prev.stats.broken ?? 0), { better: "lower", digits: 0 }) : null }),
      tile({ label: "Duration", value: fmtDuration(latest.durationMs), deltaEl: delta(latest.durationMs, prev?.durationMs, { better: "lower", unit: "ms" }) }),
    ));

    const statusSeries = STATUS_SERIES
      .map((st) => ({ ...st, values: chrono.map((r) => r.stats?.[st.key] ?? null) }))
      .filter((se) => se.values.some((v) => v));
    const results = h("div");
    const duration = h("div");
    blocks.push(h("div", { class: "chart-grid" },
      h("figure", { class: "chart-card" }, h("figcaption", null, "Results by run"), results),
      h("figure", { class: "chart-card" }, h("figcaption", null, "Duration"), duration)));
    ctx.track(runChart(results, {
      kind: "stack", labels, series: statusSeries, height: 200, yFormat: (v) => fmtNumber(v),
      ariaLabel: `${report.title}: test results per run`, tipTitle: (i) => tipTitle(chrono[i]), tipFoot, onSelect: openRun,
    }));
    ctx.track(runChart(duration, {
      kind: "line", labels, height: 200, min: 0, yFormat: (v) => fmtDuration(v),
      series: [{ key: "duration", name: "Duration", color: "var(--series-1)", values: chrono.map((r) => r.durationMs ?? null) }],
      ariaLabel: `${report.title}: duration per run`, tipTitle: (i) => tipTitle(chrono[i]), tipFoot, onSelect: openRun,
    }));
  }

  const keys = metricKeys(runs);
  const metricCols = keys.slice(0, 4).map(metricInfo);
  if (keys.length) {
    const grid = h("div", { class: "chart-grid" });
    for (const key of keys) {
      const info = metricInfo(key);
      const el = h("div");
      const latestVal = latest.metrics?.[key];
      const prevVal = runs.slice(1).find((r) => r.metrics?.[key] != null)?.metrics[key];
      grid.append(h("figure", { class: "chart-card" },
        h("figcaption", null, h("span", null, info.title), h("span", { class: "figure-value" }, info.format(latestVal)),
          delta(latestVal, prevVal, { better: info.better, unit: info.unit === "%" ? " pts" : "", digits: info.digits })),
        el));
      ctx.track(runChart(el, {
        kind: "line", labels, height: 170, min: info.min, max: info.max, yFormat: info.format,
        series: [{ key, name: info.title, color: "var(--series-1)", values: chrono.map((r) => r.metrics?.[key] ?? null) }],
        ariaLabel: `${report.title}: ${info.title} per run`, tipTitle: (i) => tipTitle(chrono[i]), tipFoot, onSelect: openRun,
      }));
    }
    blocks.push(grid);
  }

  const rows = runs.map((run) => ({ project, report, run }));
  const tableSlot = h("div", { class: "report-table" });
  const renderTable = (limit) => tableSlot.replaceChildren(runsTable(rows, { metricCols, limit, onMore: () => renderTable(Infinity) }));
  renderTable(10);

  return h("section", { class: "card report-section", id: `report-${report.id}` },
    head,
    h("div", { class: "report-latest subtle" }, "Latest ", h("strong", null, latest.label), " · ", runMeta(latest)),
    blocks,
    h("h3", { class: "table-title" }, "Runs"),
    tableSlot);
}

function tipTitle(run) {
  return `${run.label} · ${new Date(run.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
}
