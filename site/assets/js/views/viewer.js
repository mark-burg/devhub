// Report viewer: the published report in a same-origin iframe, with run navigation around it.
// The iframe's own location (e.g. an Allure test page) is mirrored into ?at= so deep links work.

import { h, icon, copyText, fmtRelative, statusLabel, statusPill, typeIcon } from "../util.js";
import { findRun, getReport, runHref, runStatus } from "../store.js";
import { go, replace, routes } from "../router.js";
import { button, emptyState, runMeta, statsInline } from "../components.js";

export function viewerView(ctx) {
  const [, pid, rid, runParam] = ctx.route.parts;
  const report = getReport(pid, rid);
  if (!report) return null;
  const project = report.project;
  const run = findRun(report, runParam);
  const crumbs = [{ label: project.title, href: routes.project(project.id) }, { label: report.title }];

  if (!run) {
    return { title: report.title, crumbs, el: h("div", { class: "page" }, emptyState("Run not found", `There is no run “${runParam}” in ${project.title} / ${report.title}.`, button("Latest run", { href: routes.report(pid, rid), variant: "primary" }))) };
  }
  crumbs.push({ label: run.label });

  const idx = report.runs.indexOf(run);
  const older = report.runs[idx + 1];
  const newer = report.runs[idx - 1];
  const at = ctx.route.query.get("at") ?? "";
  const base = runHref(run);
  const src = base ? `${base}${at ? `#${at}` : ""}` : null;

  const runSelect = h("select", {
    class: "select run-select", "aria-label": "Run",
    onChange: (e) => go(["r", pid, rid, e.target.value]),
  }, report.runs.map((r) => h("option", { value: r.id, selected: r === run, disabled: !r.path && r !== run },
    [r.label, r.git?.branch, fmtRelative(r.createdAt), r.stats ? statusLabel(runStatus(r)) : null, r.pruned ? "archived" : null].filter(Boolean).join(" · "))));

  const navBtn = (target, dir) => target
    ? button("", { href: routes.report(pid, rid, target.id), iconName: dir === "older" ? "chevron-left" : "chevron-right", title: `${dir === "older" ? "Older" : "Newer"} run ${target.label} (${dir === "older" ? "[" : "]"})` })
    : h("span", { class: "btn btn-ghost btn-icon is-disabled", "aria-hidden": "true" }, icon(dir === "older" ? "chevron-left" : "chevron-right"));

  const currentUrl = () => {
    const inner = frame ? innerHash() : at;
    return new URL(routes.report(pid, rid, run.id, { at: inner || null }), location.href).href;
  };
  const copyBtn = button("", {
    iconName: "link", title: "Copy link to this run",
    onClick: async (e) => {
      const ok = await copyText(currentUrl());
      ctx.app.toast(ok ? "Link copied" : "Could not copy — use the address bar");
      e.currentTarget.blur();
    },
  });
  const openBtn = src ? h("a", { class: "btn btn-ghost btn-icon", href: src, target: "_blank", rel: "noopener", title: "Open report in a new tab" }, icon("external")) : null;
  const focusBtn = button("", { iconName: ctx.app.isFocus() ? "minimize" : "maximize", title: "Focus mode (f)", onClick: () => ctx.app.toggleFocus() });

  const toolbar = h("div", { class: "viewer-bar" },
    h("div", { class: "viewer-nav" }, icon(typeIcon(report.type), "muted"), navBtn(older, "older"), runSelect, navBtn(newer, "newer")),
    h("div", { class: "viewer-meta" }, statusPill(runStatus(run)), statsInline(run.stats), runMeta(run)),
    h("div", { class: "viewer-actions" }, copyBtn, openBtn, focusBtn));

  let frame = null;
  let body;
  let poll = 0;
  let lastInner = at;
  if (src) {
    const loader = h("div", { class: "viewer-loading" }, h("span", { class: "spinner" }), "Loading report…");
    frame = h("iframe", { class: "viewer-frame", src, title: `${project.title} / ${report.title} ${run.label}` });
    frame.addEventListener("load", () => {
      loader.remove();
      attachInner();
    });
    body = h("div", { class: "viewer-body" }, loader, frame);
  } else {
    body = h("div", { class: "viewer-body" }, h("div", { class: "page" }, emptyState("This run was archived",
      "Its report files were pruned to keep the Pages branch small. Stats and metrics are still part of the trend charts.",
      button("Open latest run", { href: routes.report(pid, rid), variant: "primary" }),
      button("Project trends", { href: routes.project(pid) }))));
  }

  function innerHash() {
    try { return frame.contentWindow.location.hash.replace(/^#/, ""); } catch { return ""; }
  }
  function sync() {
    const inner = innerHash();
    if (inner === lastInner) return;
    lastInner = inner;
    replace(["r", pid, rid, inner ? run.id : runParam], { at: inner || null });
  }
  function attachInner() {
    let win;
    try { win = frame.contentWindow; void win.location.href; } catch { return; } // cross-origin: nothing to sync
    for (const ev of ["hashchange", "popstate", "pushState", "replaceState"]) win.addEventListener(ev, () => setTimeout(sync));
    win.document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); ctx.app.openPalette(); }
    });
    clearInterval(poll);
    poll = setInterval(sync, 1000);
    sync();
  }

  const onKey = (e) => {
    if (e.target.closest?.("input, select, textarea")) return;
    if (e.key === "[" && older) go(["r", pid, rid, older.id]);
    else if (e.key === "]" && newer) go(["r", pid, rid, newer.id]);
  };
  document.addEventListener("keydown", onKey);

  return {
    title: `${report.title} ${run.label}`,
    crumbs,
    full: true,
    el: h("div", { class: "viewer" }, toolbar, body),
    cleanup: () => { clearInterval(poll); document.removeEventListener("keydown", onKey); },
    onTheme: (theme) => {
      // Allure 3 reads the same "theme" key on load; flip the live document too.
      try {
        const doc = frame?.contentDocument;
        if (doc) doc.documentElement.setAttribute("data-theme", theme === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme);
      } catch { /* cross-origin */ }
    },
  };
}
