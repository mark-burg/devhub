import { defineConfig, type Plugin } from "vitest/config";
import preact from "@preact/preset-vite";
import { fileURLToPath } from "node:url";
// Plain ESM helper shared with `npm run serve` (this file is not type-checked by tsc).
import { createStaticHandler } from "./scripts/serve.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));

// Published content (reports, manifest, badges) never lives in the source tree. In dev,
// serve it from .devhub-preview/ (filled by `npm run demo`) so the app has data to show.
function previewContent(): Plugin {
  const isContent = (p: string) =>
    p.startsWith("/reports/") || p === "/data/manifest.json" || p === "/data/runs.json" || p.startsWith("/data/badges/");
  return {
    name: "devhub-preview-content",
    configureServer(server) {
      server.middlewares.use(createStaticHandler([`${here}.devhub-preview`], { accept: isContent }));
    },
  };
}

export default defineConfig({
  root: "site",
  base: "./", // relative URLs: the hub is served from https://<owner>.github.io/<repo>/
  plugins: [preact(), previewContent()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2022",
    chunkSizeWarningLimit: 3000, // mermaid and vega are large, but lazy-loaded
  },
  server: { port: 5173 },
  test: {
    root: here,
    environment: "jsdom", // hub CLI tests opt into node with a @vitest-environment docblock
    include: ["site/src/**/*.test.{ts,tsx}", "test/**/*.test.ts"],
    setupFiles: ["site/src/test/setup.ts"],
  },
});
