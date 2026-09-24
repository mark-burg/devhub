// DOM helpers, icons and formatting. Untrusted strings always go through text nodes.

export const $ = (sel, root = document) => root.querySelector(sel);

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "value" || k === "checked" || k === "selected" || k === "disabled") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  append(el, children);
  return el;
}

const SVG_NS = "http://www.w3.org/2000/svg";
export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs ?? {})) if (v != null) el.setAttribute(k, v);
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// Stroke icons, 24×24 grid. Trusted constants — the only innerHTML in the app besides sanitized markdown.
const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  flask: '<path d="M9 3h6M10 3v6l-5.5 9.2A1.9 1.9 0 0 0 6.1 21h11.8a1.9 1.9 0 0 0 1.6-2.8L14 9V3"/><path d="M7 15h10"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  gauge: '<path d="M12 14l4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  braces: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1"/>',
  zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  window: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  "chevron-right": '<path d="M9 6l6 6-6 6"/>',
  "chevron-left": '<path d="M15 6l-6 6 6 6"/>',
  "chevron-down": '<path d="M6 9l6 6 6-6"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  branch: '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  commit: '<circle cx="12" cy="12" r="3"/><path d="M3 12h6M15 12h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  "status-passed": '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 10"/>',
  "status-failed": '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
  "status-broken": '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16.5h.01"/>',
  "status-skipped": '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  "status-unknown": '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.2-2.4 3.5M12 17h.01"/>',
  "status-neutral": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 10v10"/>',
  logo: '<path d="M4 7l8-4 8 4-8 4z"/><path d="M4 12l8 4 8-4"/><path d="M4 17l8 4 8-4"/>',
};

export function icon(name, cls = "") {
  const span = document.createElement("span");
  span.className = `icon ${cls}`.trim();
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ICONS.layers}</svg>`;
  return span;
}

// Icon per report/page type. Unknown types fall back to a generic stack.
const TYPE_ICONS = {
  allure: "flask", junit: "flask", tests: "flask", pytest: "flask",
  playwright: "play", cypress: "play", e2e: "play",
  coverage: "shield", lighthouse: "gauge", k6: "gauge", perf: "gauge",
  metrics: "chart", markdown: "file", docs: "book", openapi: "braces", benchmark: "zap", vega: "chart", chart: "chart",
  embed: "window", html: "layers", storybook: "window", link: "external",
};
export const typeIcon = (type) => TYPE_ICONS[type] ?? "layers";

const STATUS_LABEL = { passed: "Passed", failed: "Failed", broken: "Broken", skipped: "Skipped", unknown: "Unknown", neutral: "Published" };
export const statusLabel = (st) => STATUS_LABEL[st] ?? STATUS_LABEL.neutral;

export function statusPill(status, text) {
  const st = STATUS_LABEL[status] ? status : "neutral";
  return h("span", { class: `pill st-${st}` }, icon(`status-${st}`), text ?? statusLabel(st));
}

export function statusDot(status) {
  const st = STATUS_LABEL[status] ? status : "neutral";
  return h("span", { class: `dot st-${st}`, role: "img", "aria-label": statusLabel(st), title: statusLabel(st) });
}

// ───────────── formatting ─────────────

export function fmtDuration(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s % 60);
  if (m < 60) return rest ? `${m}m ${rest}s` : `${m}m`;
  return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 60)}h`;
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "short" });
export function fmtRelative(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const sec = Math.round((t - Date.now()) / 1000);
  const abs = Math.abs(sec);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  if (abs < 86400 * 14) return rtf.format(Math.round(sec / 86400), "day");
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: abs > 86400 * 300 ? "numeric" : undefined });
}

export function fmtDate(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
}

const compactFmt = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const plainFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
export function fmtNumber(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.abs(n) >= 10000 ? compactFmt.format(n) : plainFmt.format(n);
}

export function fmtPct(n, digits = 1) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 99.95 && n < 100 ? "99.9" : n.toFixed(n === 100 || n === 0 ? 0 : digits)}%`;
}

export const shortSha = (sha) => (sha ? String(sha).slice(0, 7) : "");

export function titleize(id) {
  return String(id).replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Per-viewer conveniences only (collapsed groups, theme). Never required for correctness.
export const prefs = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

// Lazy loaders for optional third-party renderers (markdown, mermaid, vega…).
const moduleCache = new Map();
export function loadModule(url) {
  if (!moduleCache.has(url)) moduleCache.set(url, import(url));
  return moduleCache.get(url);
}
const scriptCache = new Map();
export function loadScript(url) {
  if (!scriptCache.has(url)) {
    scriptCache.set(url, new Promise((res, rej) => {
      const el = document.createElement("script");
      el.src = url;
      el.onload = res;
      el.onerror = () => rej(new Error(`Failed to load ${url}`));
      document.head.append(el);
    }));
  }
  return scriptCache.get(url);
}

export function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t === "dark") return true;
  if (t === "light") return false;
  return matchMedia("(prefers-color-scheme: dark)").matches;
}
