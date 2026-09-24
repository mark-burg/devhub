// OpenAPI / Swagger specs in an isolated srcdoc frame. The renderers are standalone bundles
// that expect their own document, so they load from jsDelivr inside the frame.

import type { NavItem, OpenApiRenderer } from "../../types";
import { isDark } from "../../state";
import { Icon } from "../../components/Icon";
import { Button } from "../../components/ui";
import { absUrl } from "./Markdown";

const CDN = {
  swaggerCss: "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css",
  swaggerJs: "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
  redoc: "https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js",
  scalar: "https://cdn.jsdelivr.net/npm/@scalar/api-reference",
};

export function openApiDocument(renderer: OpenApiRenderer, specUrl: string, opts: { dark: boolean; tryItOut?: boolean }): string {
  const spec = JSON.stringify(specUrl);
  const bodies: Record<OpenApiRenderer, string> = {
    swagger: `<link rel="stylesheet" href="${CDN.swaggerCss}"><style>body{margin:0}</style><div id="ui"></div>
<script src="${CDN.swaggerJs}"></script><script>SwaggerUIBundle({url:${spec},dom_id:"#ui",deepLinking:true,docExpansion:"list",tryItOutEnabled:${!!opts.tryItOut}})</script>`,
    redoc: `<style>body{margin:0}</style><div id="ui"></div><script src="${CDN.redoc}"></script>
<script>Redoc.init(${spec},{hideDownloadButton:false,theme:{typography:{fontFamily:"system-ui,sans-serif"}}},document.getElementById("ui"))</script>`,
    scalar: `<style>body{margin:0}</style><div id="app"></div><script src="${CDN.scalar}"></script>
<script>Scalar.createApiReference("#app",{url:${spec},darkMode:${opts.dark},hideDarkModeToggle:true,layout:"modern"})</script>`,
  };
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${bodies[renderer] ?? bodies.swagger}</body></html>`;
}

export function OpenApi({ page }: { page: NavItem }) {
  const renderer: OpenApiRenderer = page.renderer ?? "swagger";
  // Only Scalar follows the theme; re-reading isDark for it re-creates the frame on toggle.
  const dark = renderer === "scalar" ? isDark.value : false;
  const doc = openApiDocument(renderer, absUrl(page.src ?? ""), { dark, tryItOut: page.tryItOut });
  return (
    <div class="viewer">
      <div class="viewer-bar">
        <div class="viewer-nav"><Icon name="braces" class="muted" /><strong>{page.title}</strong><span class="tag">{renderer}</span></div>
        <div class="viewer-meta" />
        <div class="viewer-actions"><Button href={page.src} icon="external" external title="Open the raw spec">Spec</Button></div>
      </div>
      <div class="viewer-body">
        <iframe key={`${renderer}-${dark}`} class="viewer-frame" title={page.title} srcdoc={doc} />
      </div>
    </div>
  );
}
