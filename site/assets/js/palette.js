// ⌘K command palette: jump to any project, report, run or page.

import { $, h, icon, fmtRelative, statusDot, typeIcon } from "./util.js";
import { store, runStatus } from "./store.js";
import { routes } from "./router.js";

let dialog, input, list, items = [], results = [], selected = 0;

export function initPalette() {
  dialog = $("#palette");
  input = $("#palette-input");
  list = $("#palette-list");
  input.addEventListener("input", () => { selected = 0; update(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { selected = Math.min(results.length - 1, selected + 1); paint(); }
    else if (e.key === "ArrowUp") { selected = Math.max(0, selected - 1); paint(); }
    else if (e.key === "Enter") { choose(results[selected]); }
    else return;
    e.preventDefault();
  });
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
}

function buildItems() {
  const out = [
    { label: "Dashboard", sub: "Overview", icon: "grid", href: routes.dashboard() },
    { label: "Activity", sub: "All runs", icon: "activity", href: routes.activity() },
  ];
  for (const project of store.projects) {
    out.push({ label: project.title, sub: "Project trends", icon: "folder", href: routes.project(project.id) });
    for (const report of project.reports) {
      out.push({ label: `${project.title} / ${report.title}`, sub: `Latest ${report.type} report`, icon: typeIcon(report.type), href: routes.report(project.id, report.id) });
      for (const run of report.runs.slice(0, 15)) {
        if (!run.path) continue;
        out.push({
          label: `${project.title} / ${report.title} ${run.label}`,
          sub: [run.git?.branch, run.git?.message, fmtRelative(run.createdAt)].filter(Boolean).join(" · "),
          lead: statusDot(runStatus(run)),
          href: routes.report(project.id, report.id, run.id),
          extra: `${run.git?.commit ?? ""} ${run.git?.pr ? `pr ${run.git.pr}` : ""}`,
          weight: -1,
        });
      }
    }
  }
  for (const group of store.navGroups) {
    for (const item of group.items) {
      out.push(item.type === "link"
        ? { label: item.title, sub: item.href, icon: "external", href: item.href, external: true }
        : { label: item.title, sub: group.title || item.type, icon: item.icon ?? typeIcon(item.type), href: routes.page(item.id) });
    }
  }
  return out;
}

// Every query word must appear; earlier / word-start matches rank higher.
function score(item, words) {
  const hay = `${item.label} ${item.sub ?? ""} ${item.extra ?? ""}`.toLowerCase();
  let total = item.weight ?? 0;
  for (const w of words) {
    const i = hay.indexOf(w);
    if (i < 0) return -Infinity;
    total += 10 - Math.min(i, 40) / 4 + (i === 0 || /[\s/·#-]/.test(hay[i - 1]) ? 6 : 0);
  }
  return total;
}

function update() {
  const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
  results = words.length
    ? items.map((it) => [it, score(it, words)]).filter(([, s]) => s > -Infinity).sort((a, b) => b[1] - a[1]).map(([it]) => it).slice(0, 40)
    : items.filter((it) => it.weight !== -1).slice(0, 40);
  paint();
}

function paint() {
  list.replaceChildren(...(results.length ? results.map((it, i) => h("li", {
    class: `palette-item${i === selected ? " selected" : ""}`, role: "option", "aria-selected": String(i === selected),
    onClick: () => choose(it), onMousemove: () => { if (selected !== i) { selected = i; paint(); } },
  }, it.lead ? h("span", { class: "palette-lead" }, it.lead) : icon(it.icon), h("span", { class: "palette-text" }, h("span", { class: "palette-label" }, it.label), it.sub ? h("span", { class: "palette-sub" }, it.sub) : null), it.external ? icon("external", "muted") : null))
    : [h("li", { class: "palette-empty" }, "No matches")]));
  list.querySelector(".selected")?.scrollIntoView({ block: "nearest" });
}

function choose(item) {
  if (!item) return;
  dialog.close();
  if (item.external) window.open(item.href, "_blank", "noopener");
  else location.hash = item.href;
}

export function openPalette() {
  if (!dialog || dialog.open) return;
  items = buildItems();
  input.value = "";
  selected = 0;
  update();
  dialog.showModal();
  input.focus();
}
