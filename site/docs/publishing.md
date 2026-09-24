# Publishing guide

Everything in the hub arrives the same way: a CI job produces a report, then the
**devhub action** copies it onto the `gh-pages` branch and records the run in
`data/manifest.json`. The site picks it up on the next page load.

> Replace `OWNER/devhub` below with the repository this hub lives in.

## One-time setup

1. Push this repository to GitHub.
2. **Actions → Deploy hub site → Run workflow.** This creates the `gh-pages` branch with the site on it.
3. **Settings → Pages → Build and deployment:** *Deploy from a branch*, branch `gh-pages`, folder `/ (root)`.
4. Optional: **Actions → Demo reports → Run workflow** a few times to see real Allure reports and trends appear.

The site is then live at `https://OWNER.github.io/devhub/`.

## Publish Allure results

Any test framework with an Allure adapter works (Playwright, Jest, Vitest, pytest, JUnit 5,
TestNG, Cucumber, WebdriverIO, Appium…) — they all write an `allure-results/` folder.
The action generates an **Allure 3** report, restoring and saving its history so trend
charts, retries and flaky detection work across runs.

```yaml
permissions:
  contents: write            # needed when the hub is this same repository

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npx playwright install --with-deps
      - run: npx playwright test          # with the allure-playwright reporter

      - uses: OWNER/devhub@main
        if: ${{ !cancelled() }}          # publish failures too
        with:
          project: web-app
          report: e2e
          title: E2E tests
          allure-results: allure-results
```

Bring your own `allurerc.mjs` (categories, quality gate, extra plugins such as `dashboard`)
with `allure-config: allurerc.mjs`. The action only overrides `output`, `historyPath` and
`historyLimit`. When several plugins run, the viewer opens the Awesome report; set
`entry: dashboard/` to open another one.

## Publish from other repositories

The hub usually lives in its own repo while tests run elsewhere. The default `GITHUB_TOKEN`
cannot push to another repository, so:

1. Create a **fine-grained personal access token** (or a GitHub App token) with
   *Contents: Read and write* on the hub repository only.
2. Store it as a secret in each repository that publishes, e.g. `DEVHUB_TOKEN`.
3. Point the action at the hub:

```yaml
      - uses: OWNER/devhub@main
        if: ${{ !cancelled() }}
        with:
          hub-repo: OWNER/devhub
          token: ${{ secrets.DEVHUB_TOKEN }}
          project: payments-api
          report: integration
          allure-results: build/allure-results
```

Several repositories and jobs can publish at the same time — a rejected push is rebuilt
on top of the newer branch and retried.

## Other tools

Anything that produces static HTML can be published with `report-dir`. Test counts and
metrics are picked up automatically where possible, which feeds the dashboard and trends.

| Tool | Produce it with | Action inputs |
|---|---|---|
| Playwright HTML | `reporter: [['html', { open: 'never' }], ['json', { outputFile: 'results.json' }]]` | `report-dir: playwright-report`, `stats-file: results.json`, `type: playwright` |
| Vitest / Jest coverage | `--coverage --coverage.reporter=html --coverage.reporter=json-summary` | `report-dir: coverage`, `type: coverage` |
| pytest-cov | `--cov-report=html --cov-report=json:htmlcov/coverage.json` | `report-dir: htmlcov`, `type: coverage` |
| JaCoCo | Maven `target/site/jacoco` / Gradle `build/reports/jacoco/test` | `report-dir: …`, `type: coverage` |
| Any `lcov.info` / Cobertura XML | put it next to the HTML | detected automatically |
| Lighthouse CI | `lhci upload --target=filesystem --outputDir=lhci` | `report-dir: lhci`, `type: lighthouse` |
| pytest-html + JUnit | `--html=report/index.html --self-contained-html --junitxml=report/junit.xml` | `report-dir: report`, `junit: report/junit.xml` |
| k6 | `K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=k6.html k6 run …` | `report-dir: k6.html`, `type: k6` |
| Storybook / TypeDoc / Sphinx | `storybook build -o storybook-static` | `report-dir: storybook-static`, `type: storybook`, `keep: 5` |
| Only numbers | — | `metrics: \| bundle.size=412` (no report files) |

Detected automatically: Allure 2/3 summaries, istanbul `coverage-summary.json`, `lcov.info`,
coverage.py `coverage.json`, Cobertura and JaCoCo XML, Lighthouse JSON results.
`junit:` accepts files or folders of JUnit XML from any framework.

### Metrics

Every numeric metric becomes a trend chart on the project page and a column in the runs
table. Describe custom ones in `hub.config.json` so they are titled, formatted and judged
correctly:

```json
"metrics": {
  "bundle.size": { "title": "Bundle size", "unit": "kB", "better": "lower", "digits": 0 },
  "build.minutes": { "title": "Build time", "unit": "min", "better": "lower" }
}
```

## Action outputs

`url` (the run inside the hub), `report-url`, `badge-url`, `run-id`, `status`, `total`,
`passed`, `failed`, `broken`, `skipped`. A job summary with the numbers and links is added
to the workflow run automatically. For example, to comment on a pull request:

```yaml
      - uses: OWNER/devhub@main
        id: hub
        if: ${{ !cancelled() }}
        with: { project: web-app, report: e2e, allure-results: allure-results }

      - if: ${{ !cancelled() && github.event_name == 'pull_request' }}
        env:
          GH_TOKEN: ${{ github.token }}
          BODY: "E2E: ${{ steps.hub.outputs.passed }} passed, ${{ steps.hub.outputs.failed }} failed — ${{ steps.hub.outputs.url }}"
        run: gh pr comment ${{ github.event.pull_request.number }} --body "$BODY"
```

Set `fail-on-test-failure: true` to fail the step after publishing when tests failed.

## Badges

Each report channel gets a [shields.io endpoint](https://shields.io/badges/endpoint-badge)
badge (and one per metric):

```markdown
![E2E](https://img.shields.io/endpoint?url=https://OWNER.github.io/devhub/data/badges/web-app/e2e.json)
![Coverage](https://img.shields.io/endpoint?url=https://OWNER.github.io/devhub/data/badges/web-app/coverage.json)
```

`https://OWNER.github.io/devhub/reports/<project>/<report>/latest/` always redirects to the
newest report of a channel.

## Sidebar pages

Everything under **Docs**, **Examples** and **Links** comes from `nav` in
[`site/hub.config.json`](../hub.config.json). Files you reference live in `site/` on `main`
and are deployed by the *Deploy hub site* workflow.

| `type` | Renders | Keys |
|---|---|---|
| `markdown` | GitHub-flavoured Markdown with Mermaid diagrams, highlighted code and a table of contents | `src` |
| `openapi` | OpenAPI / Swagger spec (JSON or YAML) | `src`, `renderer`: `swagger` \| `redoc` \| `scalar`, `tryItOut` |
| `benchmark` | [github-action-benchmark](https://github.com/benchmark-action/github-action-benchmark) `data.js`, or `{ "series": [{ "name", "unit", "points": [{ "x", "y" }] }] }` | `src`, `zero` |
| `vega` | A [Vega-Lite](https://vega.github.io/vega-lite/) or Vega spec — e.g. over `data/runs.json` | `src` or inline `spec` |
| `embed` | Any page in an iframe (Storybook, Grafana public dashboard, …) | `src` |
| `link` | External link, opens in a new tab | `href` |

All items accept `title`, `id` (used in the URL), `icon` and `description`.

`data/runs.json` is a flat list of every run (project, report, status, counts, pass rate,
duration, branch, commit, metrics) that is regenerated on each publish — handy for your own
Vega-Lite charts, notebooks or spreadsheets.

Benchmarks from github-action-benchmark can be pushed straight into the hub by pointing its
`gh-repository` at the hub repository and `benchmark-data-dir-path` at e.g. `bench/web-app`,
then adding `{ "type": "benchmark", "src": "bench/web-app/data.js" }` to the nav.

## Projects

Projects appear as soon as something is published to them. Optional metadata in
`hub.config.json`:

```json
"projects": {
  "web-app": {
    "title": "Web App",
    "description": "Storefront — Playwright E2E and unit coverage",
    "repo": "https://github.com/OWNER/web-app",
    "defaultBranch": "main",
    "reports": { "e2e": { "title": "E2E (Chromium)" } }
  }
}
```

`defaultBranch` makes the dashboard judge each report by its latest run on that branch, so a
red pull request doesn't turn the whole project red. Key order sets sidebar order; `"hidden": true`
hides a project.

## Retention

- `keep` (default 20) report folders are kept per channel; older runs lose their HTML but keep
  their numbers, so trend charts stay long.
- `history` (default 200) runs are kept in the manifest.
- The *Compact gh-pages* workflow squashes the branch history monthly so deleted reports stop
  taking space in git.
- Remove things by hand with `node scripts/hub.mjs remove --site <gh-pages checkout> --project <id> [--report <id>] [--run <id>]`.

## Local preview

```bash
npm run demo     # seed site/ with a week of demo runs (real Allure 3 reports via npx)
npm run serve    # http://localhost:4173
```

Or publish a real local report: `node scripts/hub.mjs publish --site site --project my-app --report e2e --source allure-report`.

## Keyboard shortcuts

| Key | Action |
|---|---|
| <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> / <kbd>/</kbd> | Search projects, reports, runs, commits and pages |
| <kbd>[</kbd> / <kbd>]</kbd> | Previous / next run in the report viewer |
| <kbd>f</kbd> | Focus mode — hide the sidebar around a report |
| <kbd>←</kbd> <kbd>→</kbd> <kbd>Enter</kbd> | Move through a focused chart and open that run |

Links copied from the viewer include the page you are on inside the report (for example a
specific Allure test), so they open exactly there.
