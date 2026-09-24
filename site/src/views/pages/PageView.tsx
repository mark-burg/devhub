// Config-driven pages (hub.config.json → nav[].items[]).

import type { Hub, NavItem } from "../../types";
import { Icon } from "../../components/Icon";
import { ErrorBox, Page } from "../../components/ui";
import { Markdown } from "./Markdown";
import { OpenApi } from "./OpenApi";
import { Benchmark } from "./Benchmark";
import { Vega } from "./Vega";

/** Page types that fill the viewport (iframe-based) instead of scrolling as a document. */
export const FULL_PAGE_TYPES = new Set(["openapi", "embed", "html"]);

export function PageView({ hub, page, query }: { hub: Hub; page: NavItem; query: URLSearchParams }) {
  switch (page.type) {
    case "markdown": return <Markdown hub={hub} page={page} />;
    case "openapi": return <OpenApi page={page} />;
    case "benchmark": return <Benchmark page={page} query={query} />;
    case "vega": return <Vega page={page} />;
    case "embed":
    case "html": return <Embed page={page} />;
    default:
      return (
        <Page>
          <ErrorBox title={`Unknown page type “${page.type}”`} detail="Supported: markdown, openapi, benchmark, vega, embed, link." />
        </Page>
      );
  }
}

/** Anything that can live in an iframe: Storybook, TypeDoc, a Grafana public dashboard… */
function Embed({ page }: { page: NavItem }) {
  return (
    <div class="viewer">
      <div class="viewer-bar">
        <div class="viewer-nav"><Icon name={page.icon ?? "window"} class="muted" /><strong>{page.title}</strong></div>
        <div class="viewer-meta">{page.description ? <span class="subtle">{page.description}</span> : null}</div>
        <div class="viewer-actions">
          <a class="btn btn-ghost btn-icon" href={page.src} target="_blank" rel="noopener" title="Open in a new tab"><Icon name="external" /></a>
        </div>
      </div>
      <div class="viewer-body">
        <iframe class="viewer-frame" src={page.src} title={page.title} allow="clipboard-write; fullscreen" />
      </div>
    </div>
  );
}
