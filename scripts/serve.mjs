#!/usr/bin/env node
// Minimal static server for previewing the hub locally (reports must be served over HTTP,
// not file://, so their iframes and fetches work).  node scripts/serve.mjs [dir] [--port 4173]

import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { port: { type: "string", default: process.env.PORT ?? "4173" } } });
const root = resolve(positionals[0] ?? join(fileURLToPath(new URL(".", import.meta.url)), "..", "site"));

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".jsonl": "application/x-ndjson",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8", ".yml": "text/yaml; charset=utf-8", ".xml": "application/xml", ".zip": "application/zip",
  ".webm": "video/webm", ".mp4": "video/mp4",
};

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!file.startsWith(root + sep) && file !== root) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!url.pathname.endsWith("/")) { res.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end(); return; }
    file = join(file, "index.html");
  }
  if (!existsSync(file)) { res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found"); return; }
  res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-cache" });
  createReadStream(file).pipe(res);
}).listen(Number(values.port), () => {
  console.log(`Serving ${root} at http://localhost:${values.port}/`);
});
