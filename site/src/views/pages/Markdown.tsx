// GitHub-flavoured Markdown with Mermaid diagrams, highlighted code and an "On this page" TOC.
// marked, DOMPurify, highlight.js and mermaid are code-split chunks loaded on first use.

import { useEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import type { Hub, NavItem } from "../../types";
import { slugify } from "../../lib/format";
import { routes } from "../../router";
import { isDark } from "../../state";
import { ErrorBox, Loading, Page } from "../../components/ui";

interface TocEntry { id: string; text: string; level: 2 | 3 }
type State = { html: string; toc: TocEntry[] } | { error: string } | null;

export async function fetchText(src: string): Promise<string> {
  const res = await fetch(src, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${src}`);
  return res.text();
}

export const absUrl = (src: string) => new URL(src, location.href).href;

export function Markdown({ hub, page }: { hub: Hub; page: NavItem }) {
  const [state, setState] = useState<State>(null);
  const article = useRef<HTMLElement>(null);
  const dark = isDark.value;

  useEffect(() => {
    let cancelled = false;
    setState(null);
    (async () => {
      try {
        const [text, { marked }, { default: DOMPurify }] = await Promise.all([
          fetchText(page.src ?? ""), import("marked"), import("dompurify"),
        ]);
        const root = document.createElement("div");
        root.innerHTML = DOMPurify.sanitize(marked.parse(text, { gfm: true, async: false })); // sanitized
        postProcess(root, page, hub);
        const toc = [...root.querySelectorAll("h2, h3")].map((h) => ({ id: h.id, text: h.textContent ?? "", level: h.tagName === "H2" ? 2 : 3 }) as TocEntry);
        if (!cancelled) setState({ html: root.innerHTML, toc });
      } catch (err) {
        if (!cancelled) setState({ error: (err as Error).message });
      }
    })();
    return () => { cancelled = true; };
  }, [page.src]);

  // Highlight code and draw diagrams after the HTML is in the DOM; redraw diagrams on theme change.
  useEffect(() => {
    if (article.current && state && "html" in state) enhance(article.current, dark).catch(() => { /* leave source visible */ });
  }, [state, dark]);

  // In-document anchors must not hit the hash router.
  const onClick = (e: JSX.TargetedMouseEvent<HTMLElement>) => {
    const a = (e.target as Element).closest("a[href^='#']");
    const hrefAttr = a?.getAttribute("href");
    if (!hrefAttr || hrefAttr.startsWith("#/")) return;
    e.preventDefault();
    scrollToId(hrefAttr.slice(1));
  };

  return (
    <Page class="page-doc">
      <div class="doc-layout">
        {state == null ? <article class="md"><Loading /></article>
          : "error" in state ? <article class="md"><ErrorBox title="Could not render this page" detail={state.error} /></article>
          : <article class="md" ref={article} onClick={onClick} dangerouslySetInnerHTML={{ __html: state.html }} />}
        {state && "toc" in state && state.toc.length >= 3 ? (
          <nav class="toc" aria-label="On this page">
            <div class="toc-title">On this page</div>
            {state.toc.map((t) => (
              <a key={t.id} href={`#${t.id}`} class={`toc-h${t.level}`} onClick={(e) => { e.preventDefault(); scrollToId(t.id); }}>{t.text}</a>
            ))}
          </nav>
        ) : <nav class="toc" />}
      </div>
    </Page>
  );
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

/** Heading ids, hub-aware links, resolved image paths, scrollable tables, mermaid placeholders. */
export function postProcess(root: HTMLElement, page: NavItem, hub: Hub): void {
  const base = absUrl(page.src ?? "");
  const used = new Set<string>();
  for (const h of root.querySelectorAll<HTMLElement>("h1, h2, h3, h4")) {
    let id = slugify(h.textContent ?? "") || "section";
    while (used.has(id)) id += "-";
    used.add(id);
    h.id = id;
  }
  for (const a of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("#") || /^[a-z]+:/i.test(href)) {
      if (/^https?:/i.test(href)) { a.target = "_blank"; a.rel = "noopener"; }
      continue;
    }
    const target = new URL(href, base);
    const linked = hub.pages.find((p) => p.src && absUrl(p.src) === target.origin + target.pathname);
    a.setAttribute("href", linked ? routes.page(linked.id) : target.href);
  }
  for (const img of root.querySelectorAll<HTMLImageElement>("img[src]")) {
    const src = img.getAttribute("src") ?? "";
    if (!/^([a-z]+:|\/\/)/i.test(src)) img.setAttribute("src", new URL(src, base).href);
    img.setAttribute("loading", "lazy");
  }
  for (const table of root.querySelectorAll("table")) {
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    wrap.tabIndex = 0; // scrollable regions must be reachable by keyboard
    table.replaceWith(wrap);
    wrap.append(table);
  }
  for (const pre of root.querySelectorAll("pre")) pre.tabIndex = 0;
  for (const code of root.querySelectorAll("pre > code.language-mermaid")) {
    const div = document.createElement("div");
    div.className = "mermaid";
    div.dataset.src = code.textContent ?? "";
    code.parentElement!.replaceWith(div);
  }
}

async function enhance(root: HTMLElement, dark: boolean): Promise<void> {
  const code = [...root.querySelectorAll<HTMLElement>("pre > code[class*='language-']:not(.hljs)")];
  if (code.length) {
    const { default: hljs } = await import("highlight.js/lib/common");
    for (const c of code) hljs.highlightElement(c);
  }
  const diagrams = [...root.querySelectorAll<HTMLElement>(".mermaid[data-src]")];
  if (diagrams.length) {
    const { default: mermaid } = await import("mermaid");
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "neutral", fontFamily: "inherit" });
    for (const d of diagrams) {
      d.removeAttribute("data-processed");
      d.textContent = d.dataset.src ?? "";
    }
    await mermaid.run({ nodes: diagrams });
  }
}
