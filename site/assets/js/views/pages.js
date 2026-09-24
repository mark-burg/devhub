// Config-driven pages (hub.config.json → nav[].items[]): markdown, openapi, benchmark, vega, embed.
// Third-party renderers load lazily from a CDN only when such a page is opened.

import { h, icon, isDark, loadModule, loadScript, slugify, fmtDate } from "../util.js";
import { getPage, store } from "../store.js";
import { routes } from "../router.js";
import { runChart } from "../charts.js";
import { button, errorBox, loading, pageHeader, select } from "../components.js";

const CDN = {
  marked: "https://cdn.jsdelivr.net/npm/marked@15/lib/marked.esm.js",
  purify: "https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.es.mjs",
  hljs: "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11/es/highlight.min.js",
  mermaid: "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs",
  vega: "https://cdn.jsdelivr.net/npm/vega@5",
  vegaLite: "https://cdn.jsdelivr.net/npm/vega-lite@5",
  vegaEmbed: "https://cdn.jsdelivr.net/npm/vega-embed@6",
  swaggerCss: "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css",
  swaggerJs: "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
  redoc: "https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js",
  scalar: "https://cdn.jsdelivr.net/npm/@scalar/api-reference",
};

const RENDERERS = { markdown, openapi, benchmark, vega, embed, html: embed };

export function pageView(ctx) {
  const page = getPage(ctx.route.parts[1]);
  if (!page) return null;
  const render = RENDERERS[page.type];
  const group = store.navGroups.find((g) => g.items.includes(page));
  const crumbs = [group?.title ? { label: group.title } : null, { label: page.title }].filter(Boolean);
  if (!render) {
    return { title: page.title, crumbs, el: h("div", { class: "page" }, errorBox(`Unknown page type “${page.type}”`, "Supported: markdown, openapi, benchmark, vega, embed, link.")) };
  }
  return { title: page.title, crumbs, ...render(ctx, page) };
}

const abs = (src) => new URL(src, location.href).href;

async function fetchText(src) {
  const res = await fetch(src, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${src}`);
  return res.text();
}

// ───────────── Markdown (+ mermaid diagrams, syntax highlighting, TOC) ─────────────

function markdown(ctx, page) {
  const article = h("article", { class: "md" }, loading());
  const toc = h("nav", { class: "toc", "aria-label": "On this page" });
  const el = h("div", { class: "page page-doc" }, h("div", { class: "doc-layout" }, article, toc));

  const draw = async () => {
    try {
      const [text, { marked }, { default: DOMPurify }] = await Promise.all([fetchText(page.src), loadModule(CDN.marked), loadModule(CDN.purify)]);
      const html = DOMPurify.sanitize(marked.parse(text, { gfm: true }));
      const tmp = h("div");
      tmp.innerHTML = html; // sanitized
      postProcess(tmp, page);
      article.replaceChildren(...tmp.childNodes);
      buildToc(article, toc);
      await enhanceCode(article);
    } catch (err) {
      article.replaceChildren(errorBox("Could not render this page", err.message));
    }
  };
  draw();

  // In-document anchors must not hit the hash router.
  article.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='#']");
    if (!a || a.getAttribute("href").startsWith("#/")) return;
    e.preventDefault();
    article.querySelector(`[id="${CSS.escape(a.getAttribute("href").slice(1))}"]`)?.scrollIntoView({ behavior: "smooth" });
  });

  return { el, onTheme: draw };
}

function postProcess(root, page) {
  const base = abs(page.src);
  const used = new Set();
  for (const hEl of root.querySelectorAll("h1, h2, h3, h4")) {
    let id = slugify(hEl.textContent) || "section";
    while (used.has(id)) id += "-";
    used.add(id);
    hEl.id = id;
  }
  for (const a of root.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (href.startsWith("#") || /^[a-z]+:/i.test(href)) {
      if (/^https?:/i.test(href)) { a.target = "_blank"; a.rel = "noopener"; }
      continue;
    }
    const target = new URL(href, base);
    const page2 = store.pages.find((p) => p.src && abs(p.src) === target.origin + target.pathname);
    a.setAttribute("href", page2 ? routes.page(page2.id) : target.href);
  }
  for (const img of root.querySelectorAll("img[src]")) {
    const src = img.getAttribute("src");
    if (!/^([a-z]+:|\/\/)/i.test(src)) img.src = new URL(src, base).href;
    img.loading = "lazy";
  }
  for (const table of root.querySelectorAll("table")) table.replaceWith(h("div", { class: "table-wrap" }, table.cloneNode(true)));
}

function buildToc(article, toc) {
  const heads = [...article.querySelectorAll("h2, h3")];
  if (heads.length < 3) { toc.replaceChildren(); return; }
  toc.replaceChildren(h("div", { class: "toc-title" }, "On this page"),
    ...heads.map((hd) => h("a", { href: `#${hd.id}`, class: `toc-${hd.tagName.toLowerCase()}`, onClick: (e) => { e.preventDefault(); hd.scrollIntoView({ behavior: "smooth" }); } }, hd.textContent)));
}

async function enhanceCode(root) {
  const blocks = [...root.querySelectorAll("pre > code")];
  const diagrams = blocks.filter((c) => c.classList.contains("language-mermaid"));
  const code = blocks.filter((c) => !diagrams.includes(c));
  if (code.length) {
    try {
      const { default: hljs } = await loadModule(CDN.hljs);
      for (const c of code) if ([...c.classList].some((k) => k.startsWith("language-"))) hljs.highlightElement(c);
    } catch { /* plain code is fine */ }
  }
  if (diagrams.length) {
    const { default: mermaid } = await loadModule(CDN.mermaid);
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: isDark() ? "dark" : "neutral", fontFamily: "inherit" });
    const nodes = diagrams.map((c) => {
      const div = h("div", { class: "mermaid" }, c.textContent);
      c.parentElement.replaceWith(div);
      return div;
    });
    await mermaid.run({ nodes });
  }
}

// ───────────── OpenAPI (Swagger UI · Redoc · Scalar) in an isolated frame ─────────────

function openapi(ctx, page) {
  const spec = JSON.stringify(abs(page.src));
  const renderer = page.renderer ?? "swagger";
  const dark = isDark();
  const docs = {
    swagger: `<link rel="stylesheet" href="${CDN.swaggerCss}"><style>body{margin:0}</style><div id="ui"></div>
<script src="${CDN.swaggerJs}"></script><script>SwaggerUIBundle({url:${spec},dom_id:"#ui",deepLinking:true,docExpansion:"list",tryItOutEnabled:${!!page.tryItOut}})</script>`,
    redoc: `<style>body{margin:0}</style><div id="ui"></div><script src="${CDN.redoc}"></script>
<script>Redoc.init(${spec},{hideDownloadButton:false,theme:{typography:{fontFamily:"system-ui,sans-serif"}}},document.getElementById("ui"))</script>`,
    scalar: `<style>body{margin:0}</style><div id="app"></div><script src="${CDN.scalar}"></script>
<script>Scalar.createApiReference("#app",{url:${spec},darkMode:${dark},hideDarkModeToggle:true,layout:"modern"})</script>`,
  };
  const body = docs[renderer] ?? docs.swagger;
  const frame = h("iframe", { class: "viewer-frame", title: page.title, srcdoc: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${body}</body></html>` });
  const bar = h("div", { class: "viewer-bar" },
    h("div", { class: "viewer-nav" }, icon("braces", "muted"), h("strong", null, page.title), h("span", { class: "tag" }, renderer)),
    h("div", { class: "viewer-meta" }),
    h("div", { class: "viewer-actions" }, button("Spec", { href: page.src, iconName: "external", external: true, title: "Open the raw spec" })));
  return { full: true, el: h("div", { class: "viewer" }, bar, h("div", { class: "viewer-body" }, frame)), onTheme: renderer === "scalar" ? () => ctx.app.rerender() : null };
}

// ───────────── Benchmarks (github-action-benchmark data.js, or a simple JSON series file) ─────────────

function benchmark(ctx, page) {
  const body = h("div", null, loading());
  const el = h("div", { class: "page" }, pageHeader(page.title, page.description ?? null), body);
  (async () => {
    try {
      const text = await fetchText(page.src);
      const groups = parseBenchmarks(text);
      if (!groups.length) throw new Error("No benchmark series found in the file.");
      const suite = ctx.route.query.get("suite") ?? groups[0].name;
      const active = groups.find((g) => g.name === suite) ?? groups[0];
      const filter = groups.length > 1
        ? h("div", { class: "filters" }, select("Suite", active.name, groups.map((g) => ({ value: g.name, label: g.name })), (v) => { location.hash = `${routes.page(page.id)}?suite=${encodeURIComponent(v)}`; }))
        : null;
      const grid = h("div", { class: "chart-grid" });
      for (const series of active.series) {
        const slot = h("div");
        const latest = series.points.at(-1);
        grid.append(h("figure", { class: "chart-card" },
          h("figcaption", null, h("span", null, series.name), h("span", { class: "figure-value" }, `${fmtBench(latest?.y)} ${series.unit ?? ""}`)),
          slot));
        ctx.track(runChart(slot, {
          kind: "line", height: 180, zero: page.zero ?? false,
          labels: series.points.map((p) => p.label),
          series: [{ key: series.name, name: series.unit ? `${series.name} (${series.unit})` : series.name, color: "var(--series-1)", values: series.points.map((p) => p.y) }],
          yFormat: fmtBench,
          tipTitle: (i) => [series.points[i].label, series.points[i].date ? fmtDate(series.points[i].date) : null].filter(Boolean).join(" · "),
          tipFoot: (i) => series.points[i].note ?? "",
          onSelect: (i) => { const url = series.points[i].href; if (url) window.open(url, "_blank", "noopener"); },
          ariaLabel: `${series.name} over time`,
        }));
      }
      const meta = active.updated ? h("p", { class: "subtle" }, `Last updated ${fmtDate(active.updated)}`) : null;
      body.replaceChildren(...[filter, meta, grid].filter(Boolean));
    } catch (err) {
      body.replaceChildren(errorBox("Could not load benchmark data", err.message));
    }
  })();
  return { el };
}

function parseBenchmarks(text) {
  const json = JSON.parse(text.trim().replace(/^[^{[]*=\s*/, "").replace(/;\s*$/, ""));
  if (json.entries) {
    // github-action-benchmark: { entries: { suite: [{ commit, date, benches: [{ name, value, unit }] }] } }
    return Object.entries(json.entries).map(([name, entries]) => {
      const byBench = new Map();
      for (const entry of entries) {
        for (const b of entry.benches ?? []) {
          if (!byBench.has(b.name)) byBench.set(b.name, { name: b.name, unit: b.unit, points: [] });
          byBench.get(b.name).points.push({
            label: entry.commit?.id?.slice(0, 7) ?? "", y: b.value, date: entry.date ? new Date(entry.date).toISOString() : null,
            href: entry.commit?.url, note: [entry.commit?.message?.split("\n")[0], b.range].filter(Boolean).join(" · "),
          });
        }
      }
      return { name, series: [...byBench.values()], updated: json.lastUpdate ? new Date(json.lastUpdate).toISOString() : null };
    });
  }
  // Generic: { series: [{ name, unit, points: [{ x, y, href? }] }] }
  const series = (json.series ?? []).map((s) => ({
    name: s.name, unit: s.unit,
    points: (s.points ?? []).map((p) => ({ label: String(p.label ?? p.x ?? ""), y: p.y, href: p.href, note: p.note, date: p.date })),
  }));
  return series.length ? [{ name: json.name ?? "Series", series, updated: json.updated ?? null }] : [];
}

function fmtBench(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.abs(v) >= 1000 ? new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(v) : String(Number(v.toPrecision(4)));
}

// ───────────── Vega-Lite / Vega specs ─────────────

function vega(ctx, page) {
  const target = h("div", { class: "vega-target" }, loading());
  const el = h("div", { class: "page" }, pageHeader(page.title, page.description ?? null), h("div", { class: "card vega-card" }, target));
  const draw = async () => {
    try {
      const spec = page.spec ?? JSON.parse(await fetchText(page.src));
      await loadScript(CDN.vega);
      await loadScript(CDN.vegaLite);
      await loadScript(CDN.vegaEmbed);
      target.replaceChildren();
      const res = await window.vegaEmbed(target, spec, {
        actions: { export: true, source: true, compiled: false, editor: true },
        theme: isDark() ? "dark" : undefined,
        config: { background: "transparent", font: "system-ui, sans-serif" },
        loader: { baseURL: page.src ? abs(page.src).replace(/[^/]*$/, "") : location.href },
      });
      ctx.track({ destroy: () => res.finalize() });
    } catch (err) {
      target.replaceChildren(errorBox("Could not render this chart", err.message));
    }
  };
  draw();
  return { el, onTheme: draw };
}

// ───────────── Anything else that can live in an iframe (Storybook, TypeDoc, Grafana…) ─────────────

function embed(ctx, page) {
  const frame = h("iframe", { class: "viewer-frame", src: page.src, title: page.title, allow: "clipboard-write; fullscreen" });
  const bar = h("div", { class: "viewer-bar" },
    h("div", { class: "viewer-nav" }, icon(page.icon ?? "window", "muted"), h("strong", null, page.title)),
    h("div", { class: "viewer-meta" }, page.description ? h("span", { class: "subtle" }, page.description) : null),
    h("div", { class: "viewer-actions" }, h("a", { class: "btn btn-ghost btn-icon", href: page.src, target: "_blank", rel: "noopener", title: "Open in a new tab" }, icon("external"))));
  return { full: true, el: h("div", { class: "viewer" }, bar, h("div", { class: "viewer-body" }, frame)) };
}
