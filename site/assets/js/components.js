// Reusable pieces shared by the views.

import { h, icon, fmtDuration, fmtRelative, fmtDate, fmtPct, shortSha, statusPill, typeIcon } from "./util.js";
import { commitUrl, passRate, prUrl, runStatus } from "./store.js";
import { routes } from "./router.js";

export function pageHeader(title, subtitle, ...actions) {
  return h("header", { class: "page-head" },
    h("div", { class: "page-head-text" }, h("h1", null, title), subtitle ? h("p", { class: "subtle" }, subtitle) : null),
    actions.length ? h("div", { class: "page-head-actions" }, actions) : null);
}

export function emptyState(title, body, ...actions) {
  return h("div", { class: "empty card" },
    icon("layers", "empty-icon"),
    h("h2", null, title),
    body ? h("div", { class: "subtle" }, body) : null,
    actions.length ? h("div", { class: "row gap" }, actions) : null);
}

export function button(label, { href, onClick, iconName, variant = "ghost", title, external, trailing = false } = {}) {
  const ic = iconName ? icon(iconName) : null;
  const text = label ? h("span", null, label) : null;
  const children = trailing ? [text, ic] : [ic, text];
  const cls = `btn btn-${variant}${label ? "" : " btn-icon"}`;
  if (href) {
    return h("a", { class: cls, href, title, "aria-label": label ? null : title, target: external ? "_blank" : null, rel: external ? "noopener" : null }, children);
  }
  return h("button", { class: cls, type: "button", title, "aria-label": label ? null : title, onClick }, children);
}

export function select(label, value, options, onChange) {
  const sel = h("select", { class: "select", "aria-label": label, onChange: (e) => onChange(e.target.value) },
    options.map((o) => h("option", { value: o.value, selected: o.value === value, disabled: o.disabled }, o.label)));
  return h("label", { class: "field" }, h("span", { class: "field-label" }, label), sel);
}

// Signed change vs. the previous run, coloured by whether the direction is good.
export function delta(curr, prev, { better = "higher", unit = "", digits = 1, suffix = "vs previous" } = {}) {
  if (curr == null || prev == null || !Number.isFinite(curr - prev)) return null;
  const d = curr - prev;
  if (Math.abs(d) < 10 ** -digits / 2) return h("span", { class: "delta flat" }, `No change ${suffix}`);
  const good = better === "neutral" ? null : better === "higher" ? d > 0 : d < 0;
  const cls = good == null ? "flat" : good ? "good" : "bad";
  const text = unit === "ms" ? fmtDuration(Math.abs(d)) : `${Math.abs(d).toFixed(digits)}${unit}`;
  return h("span", { class: `delta ${cls}` }, `${d > 0 ? "▲" : "▼"} ${text} ${suffix}`);
}

export function tile({ label, value, sub, deltaEl, spark, iconName, tone }) {
  return h("div", { class: `tile card${tone ? ` tone-${tone}` : ""}` },
    h("div", { class: "tile-label" }, iconName ? icon(iconName) : null, label),
    h("div", { class: "tile-row" }, h("div", { class: "tile-value" }, value), spark ?? null),
    deltaEl ?? null,
    sub ? h("div", { class: "tile-sub" }, sub) : null);
}

export function statsInline(stats) {
  if (!stats) return null;
  const parts = [["passed", stats.passed], ["failed", stats.failed], ["broken", stats.broken], ["skipped", stats.skipped]]
    .filter(([, v]) => v);
  if (!parts.length) parts.push(["total", stats.total ?? 0]);
  return h("span", { class: "stats-inline" }, parts.map(([k, v]) =>
    h("span", { class: `stat st-${k}` }, h("span", { class: "dot" }), h("b", null, String(v)), ` ${k}`)));
}

export function runMeta(run, { compact = false } = {}) {
  const items = [];
  if (run.git?.branch) items.push(h("span", { class: "meta", title: "Branch" }, icon("branch"), h("span", { class: "mono" }, run.git.branch)));
  if (run.git?.pr) {
    const url = prUrl(run);
    items.push(url ? h("a", { class: "meta link", href: url, target: "_blank", rel: "noopener", title: "Pull request" }, `PR #${run.git.pr}`) : h("span", { class: "meta" }, `PR #${run.git.pr}`));
  }
  if (run.git?.commit) {
    const url = commitUrl(run);
    const sha = h("span", { class: "mono" }, shortSha(run.git.commit));
    items.push(url
      ? h("a", { class: "meta link", href: url, target: "_blank", rel: "noopener", title: run.git.message ?? "Commit" }, icon("commit"), sha)
      : h("span", { class: "meta", title: run.git.message ?? "Commit" }, icon("commit"), sha));
  }
  if (!compact && run.durationMs != null) items.push(h("span", { class: "meta", title: "Duration" }, icon("clock"), fmtDuration(run.durationMs)));
  items.push(h("time", { class: "meta", datetime: run.createdAt, title: fmtDate(run.createdAt) }, fmtRelative(run.createdAt)));
  if (!compact && run.ci?.runUrl) items.push(h("a", { class: "meta link", href: run.ci.runUrl, target: "_blank", rel: "noopener" }, "CI run", icon("external")));
  return h("span", { class: "meta-row" }, items);
}

// Table of runs. `columns` picks which groups to show; rows link to the viewer.
export function runsTable(rows, { showReport = false, metricCols = [], limit = Infinity, onMore } = {}) {
  const hasStats = rows.some((r) => r.run.stats);
  const head = h("tr", null,
    h("th", null, "Run"),
    showReport ? h("th", null, "Report") : null,
    h("th", null, "Status"),
    hasStats ? [h("th", { class: "num" }, "Passed"), h("th", { class: "num" }, "Failed"), h("th", { class: "num" }, "Broken"), h("th", { class: "num" }, "Skipped"), h("th", { class: "num" }, "Pass rate"), h("th", { class: "num" }, "Duration")] : null,
    metricCols.map((m) => h("th", { class: "num" }, m.title)),
    h("th", null, "Branch"),
    h("th", null, "Commit"),
    h("th", null, "When"));

  const body = rows.slice(0, limit).map(({ project, report, run }) => {
    const target = routes.report(project.id, report.id, run.id);
    const s = run.stats ?? {};
    const num = (v, cls = "") => h("td", { class: `num ${cls}` }, v ? String(v) : h("span", { class: "muted" }, "0"));
    const commit = run.git?.commit ? (commitUrl(run)
      ? h("a", { href: commitUrl(run), target: "_blank", rel: "noopener", class: "mono link", title: run.git.message ?? "" }, shortSha(run.git.commit))
      : h("span", { class: "mono", title: run.git.message ?? "" }, shortSha(run.git.commit))) : h("span", { class: "muted" }, "—");
    return h("tr", { class: run.pruned ? "is-pruned" : "" },
      h("td", null, run.pruned
        ? h("span", { class: "run-label", title: "Report files were pruned; stats are kept for trends" }, icon("archive"), run.label)
        : h("a", { class: "run-label link", href: target }, run.label)),
      showReport ? h("td", null, h("a", { href: routes.report(project.id, report.id), class: "report-cell" }, icon(typeIcon(report.type)), h("span", null, `${project.title} / ${report.title}`))) : null,
      h("td", null, statusPill(runStatus(run))),
      hasStats ? (run.stats
        ? [num(s.passed), num(s.failed, s.failed ? "bad" : ""), num(s.broken, s.broken ? "warn" : ""), num(s.skipped),
            h("td", { class: "num" }, fmtPct(passRate(run))), h("td", { class: "num" }, fmtDuration(run.durationMs))]
        : Array.from({ length: 6 }, () => h("td", { class: "num muted" }, "—"))) : null,
      metricCols.map((m) => h("td", { class: "num" }, m.format(run.metrics?.[m.key]))),
      h("td", null, run.git?.branch ? h("span", { class: "mono branch", title: run.git.branch }, run.git.branch) : h("span", { class: "muted" }, "—")),
      h("td", null, commit),
      h("td", null, h("time", { datetime: run.createdAt, title: fmtDate(run.createdAt) }, fmtRelative(run.createdAt))));
  });

  const table = h("div", { class: "table-wrap" }, h("table", { class: "table" }, h("thead", null, head), h("tbody", null, body)));
  if (rows.length > limit && onMore) {
    return h("div", null, table, h("div", { class: "table-more" }, button(`Show all ${rows.length} runs`, { onClick: onMore, iconName: "chevron-down" })));
  }
  return table;
}

export function loading(text = "Loading…") {
  return h("div", { class: "loading" }, h("span", { class: "spinner", "aria-hidden": "true" }), text);
}

export function errorBox(title, detail) {
  return h("div", { class: "card error-box" }, icon("alert"), h("div", null, h("strong", null, title), detail ? h("div", { class: "subtle" }, detail) : null));
}
