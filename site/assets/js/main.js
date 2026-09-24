import { $, h, icon, fmtDate, fmtRelative, prefs, statusDot, typeIcon } from "./util.js";
import { store, load, refreshManifest, headline, latestRun, runStatus } from "./store.js";
import { parse, routes } from "./router.js";
import { dashboardView } from "./views/dashboard.js";
import { projectView } from "./views/project.js";
import { activityView } from "./views/activity.js";
import { viewerView } from "./views/viewer.js";
import { pageView } from "./views/pages.js";
import { emptyState, button } from "./components.js";
import { openPalette, initPalette } from "./palette.js";

const app = $("#app");
const sidebarNav = $("#sb-nav");
const viewEl = $("#view");
const crumbsEl = $("#crumbs");
let current = null; // { cleanup, onTheme, charts }

// ───────────── theme (shares Allure 3's "theme" key: light | dark | auto) ─────────────

const THEMES = ["auto", "light", "dark"];
function getTheme() {
  try {
    const v = (localStorage.getItem("theme") ?? "").replace(/"/g, "");
    return THEMES.includes(v) ? v : "auto";
  } catch { return "auto"; }
}
function applyTheme(theme) {
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  const btn = $("#theme-btn");
  btn.replaceChildren(icon({ auto: "monitor", light: "sun", dark: "moon" }[theme]));
  btn.title = `Theme: ${theme} (click to change)`;
  btn.setAttribute("aria-label", btn.title);
}
function cycleTheme() {
  const next = THEMES[(THEMES.indexOf(getTheme()) + 1) % THEMES.length];
  try { localStorage.setItem("theme", next); } catch { /* not persisted */ }
  applyTheme(next);
  current?.onTheme?.(next);
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (getTheme() === "auto") current?.onTheme?.("auto");
});

// ───────────── focus mode & toasts ─────────────

const isFocus = () => app.classList.contains("focus");
function toggleFocus(force) {
  app.classList.toggle("focus", force ?? !isFocus());
  if (current?.full) render(); // refresh the toolbar icon
}

let toastTimer = 0;
function toast(text, action) {
  const el = $("#toast");
  el.replaceChildren(h("span", null, text), action ? button(action.label, { onClick: () => { el.hidden = true; action.run(); } }) : null);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 12000 : 2500);
}

const appApi = { openPalette, toggleFocus, isFocus, toast, rerender: () => render() };

// ───────────── sidebar ─────────────

function renderSidebar() {
  $("#brand-title").textContent = store.config.title ?? "Dev Hub";
  $("#brand-sub").textContent = store.config.tagline ?? "Reports & tools";
  document.title = store.config.title ?? "Dev Hub";
  const collapsed = new Set(prefs.get("devhub.collapsed", []));

  const link = (href, label, iconName, extra = {}) =>
    h("a", { class: "sb-item", href, dataset: { route: href }, title: extra.title ?? null, target: extra.external ? "_blank" : null, rel: extra.external ? "noopener" : null },
      extra.lead ?? icon(iconName), h("span", { class: "label" }, label), extra.hint ?? null, extra.external ? icon("external", "sb-ext") : null);

  const sections = [
    h("div", { class: "sb-section" },
      link(routes.dashboard(), "Dashboard", "grid"),
      link(routes.activity(), "Activity", "activity")),
  ];

  if (store.projects.length) {
    sections.push(h("div", { class: "sb-section" }, h("div", { class: "sb-label" }, "Projects"),
      store.projects.map((project) => {
        const isCollapsed = collapsed.has(project.id);
        const group = h("div", { class: `sb-group${isCollapsed ? " collapsed" : ""}` });
        const toggle = h("button", {
          class: "sb-caret-btn", type: "button", "aria-expanded": String(!isCollapsed), "aria-label": `Toggle ${project.title}`,
          onClick: () => {
            const now = !group.classList.toggle("collapsed");
            toggle.setAttribute("aria-expanded", String(now));
            const set = new Set(prefs.get("devhub.collapsed", []));
            now ? set.delete(project.id) : set.add(project.id);
            prefs.set("devhub.collapsed", [...set]);
          },
        }, icon("chevron-down", "sb-caret"));
        const worst = project.reports.map((r) => runStatus(latestRun(r))).find((s) => s === "failed" || s === "broken");
        group.append(
          h("div", { class: "sb-group-head" }, toggle, link(routes.project(project.id), project.title, "folder", { hint: worst ? statusDot(worst) : null })),
          h("div", { class: "sb-children" }, project.reports.map((report) => {
            const run = latestRun(report);
            const head = headline(report, run);
            const hint = run?.stats && (run.stats.failed || run.stats.broken)
              ? h("span", { class: "sb-count bad", title: "Failed + broken in the latest run" }, String((run.stats.failed ?? 0) + (run.stats.broken ?? 0)))
              : head && head.key !== "passRate" ? h("span", { class: "hint" }, head.info.format(head.value)) : null;
            return link(routes.report(project.id, report.id), report.title, typeIcon(report.type), { lead: h("span", { class: "sb-lead" }, statusDot(runStatus(run))), hint, title: `${report.type} · ${run ? `${run.label}, ${fmtRelative(run.createdAt)}` : "no runs"}` });
          })));
        return group;
      })));
  }

  for (const group of store.navGroups) {
    if (!group.items.length) continue;
    sections.push(h("div", { class: "sb-section" }, group.title ? h("div", { class: "sb-label" }, group.title) : null,
      group.items.map((item) => item.type === "link"
        ? link(item.href, item.title, item.icon ?? "external", { external: true, title: item.href })
        : link(routes.page(item.id), item.title, item.icon ?? typeIcon(item.type)))));
  }

  sidebarNav.replaceChildren(...sections);
  const foot = $("#sb-updated");
  foot.textContent = store.generatedAt ? `Updated ${fmtRelative(store.generatedAt)}` : "No reports yet";
  foot.title = store.generatedAt ? fmtDate(store.generatedAt) : "";
  markActive();
}

function markActive() {
  const hash = location.hash || "#/";
  const path = hash.split("?")[0];
  let best = null;
  for (const a of sidebarNav.querySelectorAll(".sb-item[data-route]")) {
    const r = a.dataset.route;
    const match = r === "#/" ? path === "#/" || path === "#" || path === "" : path === r || path.startsWith(`${r}/`);
    a.classList.remove("active");
    a.removeAttribute("aria-current");
    if (match && (!best || r.length > best.dataset.route.length)) best = a;
  }
  best?.classList.add("active");
  best?.setAttribute("aria-current", "page");
}

// ───────────── routing ─────────────

function resolveView(route) {
  const [head] = route.parts;
  const ctx = { route, app: appApi, charts: [], track(c) { this.charts.push(c); return c; } };
  let view;
  if (!head) view = dashboardView(ctx);
  else if (head === "activity") view = activityView(ctx);
  else if (head === "p") view = projectView(ctx);
  else if (head === "r") view = viewerView(ctx);
  else if (head === "page") view = pageView(ctx);
  view ??= {
    title: "Not found", crumbs: [{ label: "Not found" }],
    el: h("div", { class: "page" }, emptyState("Nothing here", "This link points to a report or page that doesn't exist (any more).", button("Go to the dashboard", { href: routes.dashboard(), variant: "primary" }))),
  };
  return { view, ctx };
}

function render() {
  if (current) {
    current.cleanup?.();
    for (const c of current.charts) c.destroy?.();
  }
  const route = parse();
  const { view, ctx } = resolveView(route);
  current = { ...view, charts: ctx.charts };

  viewEl.classList.toggle("is-full", !!view.full);
  viewEl.replaceChildren(view.el);
  viewEl.scrollTop = 0;
  crumbsEl.replaceChildren(...(view.crumbs ?? []).flatMap((c, i) => [
    i ? icon("chevron-right", "crumb-sep") : null,
    c.href ? h("a", { href: c.href, class: "crumb" }, c.label) : h("span", { class: `crumb${i === view.crumbs.length - 1 ? " current" : ""}` }, c.label),
  ]).filter(Boolean));
  document.title = `${view.title} · ${store.config.title ?? "Dev Hub"}`;
  markActive();
  app.classList.remove("nav-open");
}

// ───────────── keyboard ─────────────

function onKey(e) {
  const typing = e.target.closest?.("input, textarea, select, [contenteditable]");
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "/") { e.preventDefault(); openPalette(); }
  else if (e.key === "f" && current?.full) toggleFocus();
  else if (e.key === "Escape" && isFocus()) toggleFocus(false);
  else if (e.key === "?") showShortcuts();
}

function showShortcuts() {
  toast("⌘K or / search · [ ] previous/next run · f focus mode · ? this help");
}

// ───────────── boot ─────────────

async function boot() {
  applyTheme(getTheme());
  $("#theme-btn").addEventListener("click", cycleTheme);
  $("#menu-btn").addEventListener("click", () => app.classList.toggle("nav-open"));
  $("#scrim").addEventListener("click", () => app.classList.remove("nav-open"));
  $("#search-btn").addEventListener("click", openPalette);
  $("#search-btn-top").addEventListener("click", openPalette);
  document.addEventListener("keydown", onKey);
  $("#kbd-hint").textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

  await load();
  initPalette();
  renderSidebar();
  render();
  window.addEventListener("hashchange", render);

  // Pick up newly published runs without a reload.
  const check = async () => {
    if (document.visibilityState !== "visible") return;
    if (await refreshManifest()) {
      renderSidebar();
      if (!current?.full) toast("New results were published.", { label: "Refresh", run: render });
    }
  };
  document.addEventListener("visibilitychange", check);
  setInterval(check, 120000);
}

boot();
