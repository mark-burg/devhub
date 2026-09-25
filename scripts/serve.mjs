#!/usr/bin/env node
// Minimal static server for previewing the hub locally (reports must be served over HTTP,
// not file://, so their iframes and fetches work). Several roots can be layered — the first
// one containing a path wins — which mirrors gh-pages, where the built shell and published
// content sit side by side:
//
//   node scripts/serve.mjs dist .devhub-preview [--port 4173] [--prefix /devhub/]
//
// --prefix serves everything below a sub-path, like a GitHub Pages project site.

import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".jsonl": "application/x-ndjson",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8", ".yml": "text/yaml; charset=utf-8", ".xml": "application/xml", ".zip": "application/zip",
  ".webm": "video/webm", ".mp4": "video/mp4",
};

/**
 * Returns a Node/Connect-style handler serving files from `roots` (first match wins).
 * `accept(pathname)` limits which paths are handled; others go to `next()` or 404.
 * `prefix` (e.g. "/devhub/") mounts the roots below a sub-path.
 */
export function createStaticHandler(roots, { accept = () => true, prefix = "/" } = {}) {
  const dirs = roots.map((r) => resolve(r));
  const mount = `/${prefix.replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
  return (req, res, next) => {
    let url;
    try {
      url = new URL(`http://localhost${req.url.startsWith("/") ? "" : "/"}${req.url}`); // "//x" is a path, not a host
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (mount !== "/") {
      if (`${url.pathname}/` === mount) { res.writeHead(301, { Location: `${mount}${url.search}` }).end(); return; }
      if (!url.pathname.startsWith(mount)) return next ? next() : notFound(res);
    }
    const sitePath = url.pathname.slice(mount.length - 1);
    let pathname;
    try { pathname = decodeURIComponent(sitePath); } catch { pathname = sitePath; }
    if (!accept(pathname)) return next ? next() : notFound(res);
    for (const root of dirs) {
      let file = normalize(join(root, pathname));
      if (!file.startsWith(root + sep) && file !== root) continue;
      if (!existsSync(file)) continue;
      if (statSync(file).isDirectory()) {
        if (!url.pathname.endsWith("/")) { res.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end(); return; }
        file = join(file, "index.html");
        if (!existsSync(file)) continue;
      }
      res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-cache" });
      createReadStream(file).pipe(res);
      return;
    }
    return next ? next() : notFound(res);
  };
}

function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { port: { type: "string", default: process.env.PORT ?? "4173" }, prefix: { type: "string", default: "/" } },
  });
  const here = fileURLToPath(new URL(".", import.meta.url));
  const roots = positionals.length ? positionals : [join(here, "..", "dist"), join(here, "..", ".devhub-preview")];
  const missing = roots.filter((r) => !existsSync(r));
  if (missing.length === roots.length) {
    console.error(`Nothing to serve: ${roots.join(", ")} not found. Run \`npm run build\` (and \`npm run demo\` for sample data).`);
    process.exit(1);
  }
  const handler = createStaticHandler(roots.filter((r) => existsSync(r)), { prefix: values.prefix });
  createServer(handler).listen(Number(values.port), () => {
    console.log(`Serving ${roots.join(" + ")} at http://localhost:${values.port}${values.prefix.startsWith("/") ? "" : "/"}${values.prefix}`);
  });
}
