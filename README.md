# Dev Hub

A static GitHub Pages site that holds all your **Allure reports** — and coverage, Playwright,
Lighthouse, benchmarks, API docs and other developer tooling — behind one navigable UI with
trends across runs.

- **Report viewer**: every published run in a same-origin iframe, with a run switcher, prev/next,
  focus mode and shareable deep links into a specific Allure test.
- **Dashboard & trends**: pass rate, failing reports, recent activity; per project stacked results,
  duration and metric charts with branch filters; a filterable activity log.
- **Allure 3 native**: the action generates reports with persisted `history.jsonl` (trends, retries,
  flaky detection), follows Allure's own theme, and reads its `summary.json`.
- **Other tools**: coverage (istanbul, lcov, coverage.py, Cobertura, JaCoCo), Playwright HTML,
  Lighthouse, JUnit XML, k6, Storybook — stats and metrics are detected and charted.
- **Pages**: Markdown with Mermaid diagrams, OpenAPI (Swagger UI / Redoc / Scalar),
  github-action-benchmark charts, Vega-Lite specs, and embeds — configured in one JSON file.
- **Extras**: ⌘K search over every report, run and commit; shields.io badges; `latest/` redirects;
  `data/runs.json` for your own charts; dark mode; mobile layout.
- **No build step, no dependencies**: vanilla ES modules for the site, a zero-dependency Node
  script for publishing, and a composite GitHub Action.

## Quick start

```bash
npm run demo     # a week of demo runs with real Allure 3 reports (uses npx allure@3)
npm run serve    # http://localhost:4173
```

To put it online:

1. Push this repo to GitHub, then run **Actions → Deploy hub site** once.
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
[site/docs/publishing.md](site/docs/publishing.md) (also rendered inside the hub).
Copy-paste workflows are in [examples/](examples).

## Layout

```text
action.yml                    composite action: generate (Allure 3) + publish into gh-pages
scripts/hub.mjs               publisher CLI: publish, remove, list, rebuild, sync-shell
scripts/pages-lib.sh          clone / commit / push-with-retry helpers for the Pages branch
scripts/demo.mjs              seeds site/ with demo runs;  sample-results.mjs fakes allure-results
scripts/serve.mjs             local static server
site/                         the site shell (deployed to gh-pages by deploy-site.yml)
  hub.config.json             title, project metadata, metric hints, sidebar pages
  docs/                       markdown, OpenAPI, benchmark and Vega-Lite examples
  assets/js/                  app (views/, charts.js, store.js, router.js…)
.github/workflows/            deploy-site, demo reports, monthly gh-pages compaction
```

On `gh-pages`, published content lives beside the shell in `reports/` and `data/`; the
two never overwrite each other. See [How it works](site/docs/how-it-works.md).

## CLI

```bash
node scripts/hub.mjs publish --site <gh-pages checkout> --project web-app --report e2e --source allure-report
node scripts/hub.mjs publish --site site --project web-app --report coverage --source coverage --type coverage
node scripts/hub.mjs publish --site site --project web-app --report bundle --metric bundle.size=412
node scripts/hub.mjs list    --site site
node scripts/hub.mjs remove  --site site --project web-app --report e2e --run 142
node scripts/hub.mjs help
```
