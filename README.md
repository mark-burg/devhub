# Dev Hub

A static GitHub Pages site that holds all your **Allure reports** — and coverage, Playwright,
Lighthouse, benchmarks, API docs and other developer tooling — behind one navigable UI with
trends across runs.

- **Report viewer**: every published run in a same-origin iframe, with a run switcher, prev/next,
  focus mode and shareable deep links into a specific Allure test.
- **Dashboard & trends**: pass rate, failing reports, recent activity; per project stacked results,
  duration and metric charts with branch filters; a filterable activity log. New runs appear live.
- **Allure 3 native**: the action generates reports with persisted `history.jsonl` (trends, retries,
  flaky detection), follows Allure's own theme, and reads its `summary.json`.
- **Other tools**: coverage (istanbul, lcov, coverage.py, Cobertura, JaCoCo), Playwright HTML,
  Lighthouse, JUnit XML, k6, Storybook — stats and metrics are detected and charted.
- **Pages**: Markdown with Mermaid diagrams, OpenAPI (Swagger UI / Redoc / Scalar),
  github-action-benchmark charts, Vega-Lite specs, and embeds — configured in one JSON file.
- **Extras**: ⌘K search over every report, run and commit; shields.io badges; `latest/` redirects;
  `data/runs.json` for your own charts; dark mode; mobile layout.

**Stack:** the site is Preact + `@preact/signals` + TypeScript, built with Vite and tested with
Vitest. Markdown, Mermaid and Vega are bundled as lazy chunks. The publisher (`scripts/hub.mjs`)
and the composite action stay zero-dependency, so publishing never needs `npm install`.

## Quick start

```bash
npm install
npm run demo     # a week of demo runs with real Allure 3 reports (uses npx allure@3)
npm run dev      # http://localhost:5173 — hot reload, demo data served from .devhub-preview/
```

To put it online:

1. Push this repo to GitHub, then run **Actions → Deploy hub site** once (it builds the site
   and creates the `gh-pages` branch).
2. **Settings → Pages**: deploy from branch `gh-pages`, folder `/ (root)`.
3. Add the action to any test workflow:

```yaml
- uses: OWNER/devhub@main
  if: ${{ !cancelled() }}
  with:
    project: web-app
    report: e2e
    allure-results: allure-results
    # hub-repo: OWNER/devhub                 # when publishing from another repository
    # token: ${{ secrets.DEVHUB_TOKEN }}      # PAT with contents:write on the hub repo
```

The full guide — other tools, inputs, badges, sidebar pages, retention — is
[site/public/docs/publishing.md](site/public/docs/publishing.md) (also rendered inside the hub).
Copy-paste workflows are in [examples/](examples).

## Development

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server; `/reports` and `/data` come from `.devhub-preview/` |
| `npm run demo` | Seed `.devhub-preview/` with demo runs (`demo:offline` skips Allure) |
| `npm test` | Vitest: selectors, router, charts, parsers, components, and the publisher CLI against real tool output (`test/fixtures/`) |
| `npm run test:e2e` | Build, seed demo data, then Playwright in Chromium, WebKit and Firefox under `/devhub/` (includes an axe accessibility scan) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Typecheck, then build `site/` into `dist/` |
| `npm run preview` | Build and serve `dist/` layered over `.devhub-preview/`, like gh-pages |

```text
site/
  index.html                  Vite entry
  public/                     copied as-is: hub.config.json, docs/, favicon, .nojekyll
  src/
    main.tsx, app.tsx         mount + shell (sidebar, topbar, palette, toast, hotkeys, live refresh)
    state.ts                  signals: hub data, theme, focus mode, palette, toast
    selectors.ts, types.ts    pure data functions and the manifest/config types
    router.ts                 hash router (#/p/…, #/r/…, #/page/…)
    views/                    Dashboard, ProjectView, Activity, Viewer, resolve.tsx, pages/
    components/, charts/      UI pieces; SVG RunChart and Sparkline
    styles/app.css            design tokens (light/dark) and all styles
action.yml                    composite action: generate (Allure 3) + publish into gh-pages
scripts/hub.mjs               publisher CLI: publish, remove, list, rebuild, sync-shell
scripts/pages-lib.sh          clone / commit / push-with-retry helpers for the Pages branch
scripts/demo.mjs              demo seeder;  sample-results.mjs fakes allure-results
scripts/serve.mjs             layered static server (dist + preview content)
.github/workflows/            deploy-site, CI, demo reports, monthly gh-pages compaction
```

To add a page type, add a component under `site/src/views/pages/` and a case in
`PageView.tsx`. To add a view, add a route in `views/resolve.tsx`.

On `gh-pages`, published content lives beside the built shell in `reports/` and `data/`; the
two never overwrite each other. See [How it works](site/public/docs/how-it-works.md).

## CLI

```bash
node scripts/hub.mjs publish --site <gh-pages checkout> --project web-app --report e2e --source allure-report
node scripts/hub.mjs publish --site .devhub-preview --project web-app --report coverage --source coverage --type coverage
node scripts/hub.mjs publish --site .devhub-preview --project web-app --report bundle --metric bundle.size=412
node scripts/hub.mjs list    --site .devhub-preview
node scripts/hub.mjs remove  --site .devhub-preview --project web-app --report e2e --run 142
node scripts/hub.mjs help
```
