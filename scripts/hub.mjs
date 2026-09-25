#!/usr/bin/env node
// devhub CLI — manages the content of the GitHub Pages branch (reports, manifest, badges).
// Zero dependencies; needs Node 18+.
//
//   node scripts/hub.mjs publish      --site <pages dir> --project <id> --report <id> --source <dir|file> [options]
//   node scripts/hub.mjs history-path --site <pages dir> --project <id> --report <id>
//   node scripts/hub.mjs remove       --site <pages dir> --project <id> [--report <id>] [--run <id>]
//   node scripts/hub.mjs sync-shell   --site <pages dir> [--from dist]
//   node scripts/hub.mjs rebuild      --site <pages dir>
//   node scripts/hub.mjs list         --site <pages dir>
//   node scripts/hub.mjs gh-summary   --result <file>
//
// Run `node scripts/hub.mjs help` for every publish option.

import {
  appendFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = "data/manifest.json";
const SHELL_INDEX = ".devhub-shell.json";
// Paths on the Pages branch that belong to publishes, never to the site shell.
const GENERATED = ["reports", "data/manifest.json", "data/runs.json", "data/badges", SHELL_INDEX, ".git"];

const OPTIONS = {
  site: { type: "string" },
  project: { type: "string" },
  report: { type: "string" },
  run: { type: "string" },
  source: { type: "string" },
  type: { type: "string" },
  title: { type: "string" },
  "project-title": { type: "string" },
  "run-id": { type: "string" },
  label: { type: "string" },
  entry: { type: "string" },
  created: { type: "string" },
  branch: { type: "string" },
  commit: { type: "string" },
  message: { type: "string" },
  pr: { type: "string" },
  "run-url": { type: "string" },
  "stats-file": { type: "string" },
  junit: { type: "string", multiple: true },
  metric: { type: "string", multiple: true },
  "metrics-file": { type: "string" },
  "history-file": { type: "string" },
  "history-limit": { type: "string" },
  keep: { type: "string", default: "20" },
  history: { type: "string", default: "200" },
  "base-url": { type: "string" },
  result: { type: "string" },
  from: { type: "string" },
  help: { type: "boolean", short: "h" },
};

const HELP = `devhub — publish reports into a GitHub Pages hub

publish options
  --site <dir>            Checkout of the Pages branch (required)
  --project <id>          Project slug, e.g. web-app (required)
  --report <id>           Report channel within the project, e.g. e2e, coverage (required)
  --source <dir|file>     Report to publish: a directory with index.html, or a single .html file
  --type <type>           allure | playwright | coverage | lighthouse | html | … (default: detected)
  --title <text>          Display name of the report channel
  --project-title <text>  Display name of the project
  --run-id <id>           Folder name for this run (default: CI run number, else a timestamp)
  --label <text>          Short label shown in the UI (default: #<run number>)
  --entry <path>          Page inside the report to open (default: detected)
  --created <iso date>    Override the run timestamp (useful for backfills)
  --branch, --commit, --message, --pr, --run-url
                          Git/CI metadata (default: read from GitHub Actions env / local git)
  --stats-file <file>     Test stats: Allure summary.json, Playwright JSON report, or {passed,failed,…}
  --junit <file|dir>      JUnit XML file(s) to compute test stats from (repeatable)
  --metric name=value     Numeric metric to record, e.g. coverage=83.4 (repeatable)
  --metrics-file <file>   JSON object of name → number
  --history-file <file>   Allure 3 history.jsonl to store for the next run (merged by uuid)
  --history-limit <n>     Max entries kept in history.jsonl (default: 50)
  --keep <n>              Report folders to keep per channel; older ones are pruned (default: 20)
  --history <n>           Runs to keep in the manifest for trend charts (default: 200)
  --base-url <url>        Public URL of the hub, used for links in outputs and badges
  --result <file>         Write a JSON description of the published run here
`;

const cmd = process.argv[2];
const { values: opt } = parseArgs({ args: process.argv.slice(3), options: OPTIONS, allowPositionals: false });

const commands = { publish, "history-path": historyPath, remove, "sync-shell": syncShell, rebuild, list, "gh-summary": ghSummary };
if (!cmd || cmd === "help" || opt.help || !commands[cmd]) {
  console.log(HELP);
  process.exit(cmd && cmd !== "help" && !opt.help ? 1 : 0);
}
try {
  await commands[cmd]();
} catch (err) {
  console.error(`devhub ${cmd}: ${err.message}`);
  process.exit(1);
}

// ───────────────────────────── commands ─────────────────────────────

async function publish() {
  const site = requireDir(opt.site, "--site");
  const projectId = slug(required(opt.project, "--project"));
  const reportId = slug(required(opt.report, "--report"));
  const source = opt.source ? resolve(opt.source) : null;
  if (source && !existsSync(source)) throw new Error(`--source not found: ${source}`);

  const manifest = readManifest(site);
  const project = upsert(manifest.projects, projectId, () => ({ id: projectId, title: titleize(projectId), reports: [] }));
  if (opt["project-title"]) project.title = opt["project-title"];

  // Scan a report folder for coverage / Lighthouse numbers once; used for both the type and the metrics.
  const sourceIsDir = !!source && statSync(source).isDirectory();
  let autoMetrics = sourceIsDir ? detectMetrics(source) : null;
  const detected = source && !opt.type ? detectType(source, autoMetrics) : null;
  const report = upsert(project.reports, reportId, () => ({
    id: reportId,
    title: titleize(reportId),
    type: opt.type || detected || (source ? "html" : "metrics"),
    runs: [],
  }));
  if (opt.title) report.title = opt.title;
  if (opt.type) report.type = opt.type;
  else if (detected && report.type === "html") report.type = detected;

  const ci = ciContext();
  const runId = uniqueRunId(report, slug(opt["run-id"] || ci.runId || timestampId()));
  const channelDir = join(site, "reports", projectId, reportId);
  const runDir = join(channelDir, runId);

  const run = {
    id: runId,
    label: opt.label || (ci.runNumber ? `#${ci.runNumber}` : runId),
    createdAt: new Date(opt.created || Date.now()).toISOString(),
  };

  if (source) {
    mkdirSync(runDir, { recursive: true });
    if (statSync(source).isDirectory()) {
      cpSync(source, runDir, { recursive: true });
      run.entry = opt.entry ?? detectEntry(runDir);
      if (!run.entry && !existsSync(join(runDir, "index.html"))) writeDirectoryIndex(runDir, `${project.title} · ${report.title}`);
    } else {
      cpSync(source, join(runDir, basename(source)));
      run.entry = opt.entry ?? basename(source);
    }
    run.path = `reports/${projectId}/${reportId}/${runId}/`;
    if (!run.entry) delete run.entry;
  } else {
    run.pruned = true; // metadata-only run: stats/metrics for trends, no report files
  }

  // Test statistics
  const stats = collectStats(source && existsSync(runDir) ? runDir : null);
  if (stats) {
    run.status = stats.status;
    run.stats = stats.stats;
    if (Number.isFinite(stats.durationMs)) run.durationMs = Math.round(stats.durationMs);
  }

  // Numeric metrics (coverage, lighthouse, custom). A single-file source is scanned where it was copied.
  if (source && !sourceIsDir) autoMetrics = detectMetrics(runDir);
  const metrics = { ...(autoMetrics ?? {}), ...readMetricsFile(opt["metrics-file"]), ...parseMetricFlags(opt.metric) };
  if (Object.keys(metrics).length) run.metrics = metrics;

  const git = compact({
    branch: opt.branch ?? ci.branch,
    commit: opt.commit ?? ci.commit,
    message: firstLine(opt.message ?? ci.message),
    pr: toInt(opt.pr ?? ci.pr),
    author: ci.actor,
  });
  if (Object.keys(git).length) run.git = git;
  const ciInfo = compact({
    runUrl: opt["run-url"] ?? ci.runUrl,
    runNumber: toInt(ci.runNumber),
    workflow: ci.workflow,
    event: ci.event,
    repo: ci.repo,
  });
  if (Object.keys(ciInfo).length) run.ci = ciInfo;

  report.runs.unshift(run);
  report.runs.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  if (opt["history-file"] && existsSync(opt["history-file"])) {
    mergeHistory(resolve(opt["history-file"]), join(channelDir, "history.jsonl"), toInt(opt["history-limit"]) ?? 50);
  }

  const pruned = prune(site, report, toInt(opt.keep) ?? 20, toInt(opt.history) ?? 200);
  writeChannelFiles(site, project, report);
  writeManifest(site, manifest);

  const baseUrl = normalizeBase(opt["base-url"] ?? defaultBaseUrl());
  const result = {
    project: projectId,
    report: reportId,
    runId,
    label: run.label,
    status: run.status ?? null,
    stats: run.stats ?? null,
    metrics: run.metrics ?? null,
    durationMs: run.durationMs ?? null,
    path: run.path ?? null,
    url: baseUrl ? `${baseUrl}#/r/${projectId}/${reportId}/${runId}` : null,
    reportUrl: baseUrl && run.path ? `${baseUrl}${run.path}${run.entry ?? ""}` : null,
    badgeUrl: baseUrl ? `https://img.shields.io/endpoint?url=${encodeURIComponent(`${baseUrl}data/badges/${projectId}/${reportId}.json`)}` : null,
    pruned,
  };
  if (opt.result) writeFileSync(opt.result, JSON.stringify(result, null, 2));

  const statLine = run.stats ? ` — ${describeStats(run.stats)}` : "";
  console.log(`Published ${projectId}/${reportId} run ${runId} (${run.status ?? report.type})${statLine}`);
  if (pruned.length) console.log(`Pruned ${pruned.length} old report folder(s): ${pruned.join(", ")}`);
  if (result.url) console.log(`View: ${result.url}`);
}

async function historyPath() {
  const site = resolve(required(opt.site, "--site"));
  const file = join(site, "reports", slug(required(opt.project, "--project")), slug(required(opt.report, "--report")), "history.jsonl");
  console.log(file);
}

async function remove() {
  const site = requireDir(opt.site, "--site");
  const manifest = readManifest(site);
  const projectId = slug(required(opt.project, "--project"));
  const pIdx = manifest.projects.findIndex((p) => p.id === projectId);
  if (pIdx < 0) throw new Error(`No project "${projectId}"`);
  const project = manifest.projects[pIdx];

  if (!opt.report) {
    rmSync(join(site, "reports", projectId), { recursive: true, force: true });
    rmSync(join(site, "data/badges", projectId), { recursive: true, force: true });
    manifest.projects.splice(pIdx, 1);
    console.log(`Removed project ${projectId}`);
  } else {
    const reportId = slug(opt.report);
    const rIdx = project.reports.findIndex((r) => r.id === reportId);
    if (rIdx < 0) throw new Error(`No report "${projectId}/${reportId}"`);
    const report = project.reports[rIdx];
    if (!opt.run) {
      rmSync(join(site, "reports", projectId, reportId), { recursive: true, force: true });
      for (const f of listBadgeFiles(site, projectId, reportId)) rmSync(f, { force: true });
      project.reports.splice(rIdx, 1);
      console.log(`Removed report ${projectId}/${reportId}`);
    } else {
      const runIdx = report.runs.findIndex((r) => r.id === opt.run);
      if (runIdx < 0) throw new Error(`No run "${opt.run}" in ${projectId}/${reportId}`);
      rmSync(join(site, "reports", projectId, reportId, opt.run), { recursive: true, force: true });
      report.runs.splice(runIdx, 1);
      writeChannelFiles(site, project, report);
      console.log(`Removed run ${projectId}/${reportId}/${opt.run}`);
    }
    if (project.reports.length === 0) manifest.projects.splice(manifest.projects.indexOf(project), 1);
  }
  writeManifest(site, manifest);
}

// Copies the site shell (index.html, assets, docs, config…) into the Pages checkout without
// touching published reports. Files the shell shipped last time but no longer contains are removed.
async function syncShell() {
  const site = resolve(required(opt.site, "--site"));
  const from = resolve(opt.from ?? join(HERE, "..", "dist"));
  if (!existsSync(join(from, "index.html"))) throw new Error(`${from} does not look like the built site shell (no index.html) — run \`npm run build\` first`);
  mkdirSync(site, { recursive: true });

  const files = walk(from).filter((rel) => !isGenerated(rel));
  const previous = readJSON(join(site, SHELL_INDEX))?.files ?? [];
  const current = new Set(files);
  for (const rel of previous) {
    if (!current.has(rel) && !isGenerated(rel)) rmSync(join(site, rel), { force: true });
  }
  for (const rel of files) {
    mkdirSync(dirname(join(site, rel)), { recursive: true });
    cpSync(join(from, rel), join(site, rel));
  }
  writeFileSync(join(site, SHELL_INDEX), JSON.stringify({ updatedAt: new Date().toISOString(), files }, null, 1) + "\n");
  if (!existsSync(join(site, MANIFEST))) writeManifest(site, { schema: 1, projects: [] });
  console.log(`Synced ${files.length} shell file(s) into ${site}`);
}

async function rebuild() {
  const site = requireDir(opt.site, "--site");
  const manifest = readManifest(site);
  for (const project of manifest.projects) {
    for (const report of project.reports) writeChannelFiles(site, project, report);
  }
  writeManifest(site, manifest);
  console.log(`Rebuilt badges and latest links for ${manifest.projects.length} project(s)`);
}

async function list() {
  const site = requireDir(opt.site, "--site");
  const manifest = readManifest(site);
  if (!manifest.projects.length) return console.log("No reports published yet.");
  for (const project of manifest.projects) {
    console.log(`${project.title} (${project.id})`);
    for (const report of project.reports) {
      const latest = report.runs[0];
      const kept = report.runs.filter((r) => !r.pruned).length;
      console.log(`  ${report.id.padEnd(18)} ${report.type.padEnd(11)} ${String(report.runs.length).padStart(4)} runs (${kept} with files)  latest ${latest?.label ?? "—"} ${latest?.status ?? ""}`);
    }
  }
}

// Writes GitHub Actions step outputs and a job summary from a --result file.
async function ghSummary() {
  const result = readJSON(required(opt.result, "--result"));
  if (!result) throw new Error(`Cannot read ${opt.result}`);
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    const s = result.stats ?? {};
    const lines = {
      "run-id": result.runId, url: result.url ?? "", "report-url": result.reportUrl ?? "", "badge-url": result.badgeUrl ?? "",
      status: result.status ?? "", total: s.total ?? "", passed: s.passed ?? "", failed: s.failed ?? "", broken: s.broken ?? "", skipped: s.skipped ?? "",
    };
    appendFileSync(out, Object.entries(lines).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  }
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const icon = { passed: "✅", failed: "❌", broken: "⚠️" }[result.status] ?? "📦";
    const md = [`### ${icon} ${result.project} / ${result.report} — ${result.label}`, ""];
    if (result.stats) {
      const s = result.stats;
      md.push("| Total | Passed | Failed | Broken | Skipped | Duration |", "|---:|---:|---:|---:|---:|---:|",
        `| ${s.total ?? 0} | ${s.passed ?? 0} | ${s.failed ?? 0} | ${s.broken ?? 0} | ${s.skipped ?? 0} | ${result.durationMs != null ? fmtDuration(result.durationMs) : "—"} |`, "");
    }
    if (result.metrics) md.push(Object.entries(result.metrics).map(([k, v]) => `**${k}:** ${v}`).join(" · "), "");
    if (result.url) md.push(`[Open in hub](${result.url})${result.reportUrl ? ` · [Raw report](${result.reportUrl})` : ""}`, "");
    appendFileSync(summary, md.join("\n") + "\n");
  }
  console.log(result.url ?? `${result.project}/${result.report}/${result.runId}`);
}

// ───────────────────────────── manifest ─────────────────────────────

function readManifest(site) {
  const m = readJSON(join(site, MANIFEST)) ?? {};
  return { schema: 1, ...m, projects: Array.isArray(m.projects) ? m.projects : [] };
}

function writeManifest(site, manifest) {
  manifest.generatedAt = new Date().toISOString();
  manifest.projects.sort((a, b) => a.title.localeCompare(b.title));
  for (const p of manifest.projects) p.reports.sort((a, b) => a.title.localeCompare(b.title));
  mkdirSync(join(site, "data"), { recursive: true });
  writeFileSync(join(site, MANIFEST), JSON.stringify(manifest, null, 1) + "\n");

  // Flat, one-row-per-run view for custom charts (Vega-Lite pages, notebooks, dashboards).
  const rows = manifest.projects.flatMap((p) => p.reports.flatMap((r) => r.runs.map((run) => {
    const s = run.stats ?? {};
    const executed = (s.total ?? 0) - (s.skipped ?? 0);
    return {
      project: p.id, projectTitle: p.title, report: r.id, reportTitle: r.title, type: r.type,
      run: run.id, label: run.label, createdAt: run.createdAt, status: run.status ?? null,
      total: s.total ?? null, passed: s.passed ?? null, failed: s.failed ?? null, broken: s.broken ?? null, skipped: s.skipped ?? null,
      passRate: run.stats && executed > 0 ? round((100 * (s.passed ?? 0)) / executed, 2) : null,
      durationMs: run.durationMs ?? null, branch: run.git?.branch ?? null, commit: run.git?.commit ?? null,
      metrics: run.metrics ?? {}, hasReport: !!run.path,
    };
  })));
  writeFileSync(join(site, "data/runs.json"), JSON.stringify(rows) + "\n");
}

function upsert(list, id, create) {
  let item = list.find((x) => x.id === id);
  if (!item) list.push((item = create()));
  return item;
}

function uniqueRunId(report, id) {
  const taken = new Set(report.runs.map((r) => r.id));
  if (!taken.has(id)) return id;
  for (let i = 2; ; i++) if (!taken.has(`${id}-${i}`)) return `${id}-${i}`;
}

// Deletes report folders beyond `keep` (their stats stay in the manifest for trends)
// and drops manifest entries beyond `history`.
function prune(site, report, keep, history) {
  const pruned = [];
  let kept = 0;
  for (const run of report.runs) {
    if (run.pruned || !run.path) continue;
    if (kept < keep) { kept++; continue; }
    rmSync(join(site, run.path), { recursive: true, force: true });
    delete run.path;
    delete run.entry;
    run.pruned = true;
    pruned.push(run.id);
  }
  for (const run of report.runs.splice(history)) {
    if (run.path) rmSync(join(site, run.path), { recursive: true, force: true });
  }
  return pruned;
}

// latest/ redirect + shields.io endpoint badges for one report channel.
function writeChannelFiles(site, project, report) {
  const channelDir = join(site, "reports", project.id, report.id);
  const latest = report.runs.find((r) => r.path);
  if (latest) {
    mkdirSync(join(channelDir, "latest"), { recursive: true });
    const target = `../${latest.id}/${latest.entry ?? ""}`;
    writeFileSync(join(channelDir, "latest", "index.html"),
      `<!doctype html><meta charset="utf-8"><title>${escapeHtml(report.title)} — latest</title>` +
      `<meta http-equiv="refresh" content="0; url=${target}"><script>location.replace(${JSON.stringify(target)} + location.hash)</script>` +
      `<a href="${target}">Go to the latest report</a>\n`);
  }

  for (const f of listBadgeFiles(site, project.id, report.id)) rmSync(f, { force: true });
  const run = report.runs[0];
  if (!run) return;
  const dir = join(site, "data/badges", project.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${report.id}.json`), JSON.stringify(badgeFor(report, run)) + "\n");
  for (const [key, value] of Object.entries(run.metrics ?? {})) {
    writeFileSync(join(dir, `${report.id}.${slug(key)}.json`), JSON.stringify(metricBadge(key, value)) + "\n");
  }
}

function listBadgeFiles(site, projectId, reportId) {
  const dir = join(site, "data/badges", projectId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f === `${reportId}.json` || f.startsWith(`${reportId}.`)).map((f) => join(dir, f));
}

function badgeFor(report, run) {
  if (run.stats) {
    const s = run.stats;
    const bad = (s.failed ?? 0) + (s.broken ?? 0);
    const message = bad ? `${bad} failed, ${s.passed ?? 0} passed` : `${s.passed ?? 0} passed${s.skipped ? `, ${s.skipped} skipped` : ""}`;
    return { schemaVersion: 1, label: report.title.toLowerCase(), message, color: bad ? "critical" : "success" };
  }
  const key = ["coverage", "lighthouse.performance"].find((k) => run.metrics?.[k] != null);
  if (key) return { ...metricBadge(key, run.metrics[key]), label: report.title.toLowerCase() };
  return { schemaVersion: 1, label: report.title.toLowerCase(), message: run.label, color: "informational" };
}

function metricBadge(key, value) {
  const pct = /coverage|lighthouse|score|rate/i.test(key);
  const color = !pct ? "informational" : value >= 90 ? "brightgreen" : value >= 80 ? "green" : value >= 70 ? "yellowgreen" : value >= 60 ? "yellow" : value >= 50 ? "orange" : "red";
  return { schemaVersion: 1, label: key, message: pct ? `${round(value, 1)}%` : String(round(value, 2)), color };
}

// Merge the freshly generated Allure history with whatever is on the branch now (another
// run may have appended in the meantime), keyed by uuid, oldest first, capped at `limit`.
function mergeHistory(fresh, stored, limit) {
  const byId = new Map();
  for (const file of [stored, fresh]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const point = JSON.parse(line);
        byId.set(point.uuid ?? line, { point, line });
      } catch { /* skip corrupt line */ }
    }
  }
  const lines = [...byId.values()].sort((a, b) => (a.point.timestamp ?? 0) - (b.point.timestamp ?? 0)).slice(-limit).map((x) => x.line);
  mkdirSync(dirname(stored), { recursive: true });
  writeFileSync(stored, lines.join("\n") + (lines.length ? "\n" : ""));
}

// ───────────────────────────── detection ─────────────────────────────

function detectType(source, metrics) {
  if (statSync(source).isFile()) return /lighthouse|\.report\.html$/i.test(source) ? "lighthouse" : "html";
  const has = (p) => existsSync(join(source, p));
  if (has("summary.json") && readJSON(join(source, "summary.json"))?.stats) return "allure";
  if (has("widgets/summary.json") || has("data/test-results") || has("awesome/summary.json")) return "allure";
  if (has("coverage-summary.json") || has("lcov-report") || has("lcov.info") || has("jacoco-sessions.html") || has("cobertura-coverage.xml")) return "coverage";
  // coverage.py HTML: coverage_html.js, or coverage_html_cb_<hash>.js since coverage.py 7.5
  if (readdirSync(source).some((f) => /^coverage_html(_cb_[0-9a-f]+)?\.js$/.test(f))) return "coverage";
  if (has("index.html") && /playwright/i.test(safeRead(join(source, "index.html"), 4000))) return "playwright";
  if (findFiles(source, (f) => /\.report\.json$|^lhr.*\.json$/i.test(f), 1).length) return "lighthouse";
  // Anything else carrying coverage numbers, e.g. a folder with Cobertura (coverage.xml) or JaCoCo XML.
  // Pass --type to override (say, a test report that happens to ship an lcov.info).
  if (Object.keys(metrics ?? {}).some((k) => k.startsWith("coverage"))) return "coverage";
  return null;
}

function detectEntry(dir) {
  // Allure 3 with several plugins writes a summary page at the root and each report in a
  // sub-folder; open the Awesome report directly (pass --entry to pick another).
  if (existsSync(join(dir, "awesome/index.html")) && !existsSync(join(dir, "summary.json"))) return "awesome/";
  if (existsSync(join(dir, "index.html"))) return "";
  const htmlFiles = readdirSync(dir).filter((f) => f.endsWith(".html"));
  if (htmlFiles.length === 1) return htmlFiles[0];
  for (const sub of ["awesome", "lcov-report", "html", "htmlcov", "report"]) {
    if (existsSync(join(dir, sub, "index.html"))) return `${sub}/`;
  }
  const dirs = readdirSync(dir).filter((f) => existsSync(join(dir, f, "index.html")));
  return dirs.length === 1 ? `${dirs[0]}/` : "";
}

// For reports made of several pages without an index (e.g. Lighthouse CI with many URLs).
function writeDirectoryIndex(dir, title) {
  const pages = findFiles(dir, (f) => f.endsWith(".html"), 1).map((f) => relative(dir, f).split(sep).join("/")).sort();
  const items = pages.map((p) => `<li><a href="${escapeHtml(p)}">${escapeHtml(p)}</a></li>`).join("");
  writeFileSync(join(dir, "index.html"), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{font:15px/1.6 system-ui,sans-serif;margin:32px;color:#0b0b0b;background:#fcfcfb}a{color:#1c5cab}@media(prefers-color-scheme:dark){body{background:#1a1a19;color:#fff}a{color:#86b6ef}}</style>
<h1 style="font-size:20px">${escapeHtml(title)}</h1><ul>${items || "<li>No HTML pages in this report.</li>"}</ul>\n`);
}

// Returns { status, stats, durationMs } or null.
function collectStats(dir) {
  if (opt["stats-file"]) {
    const data = readJSON(opt["stats-file"]);
    if (!data) throw new Error(`Cannot read --stats-file ${opt["stats-file"]}`);
    return statsFromJson(data) ?? fail(`Unrecognized stats format in ${opt["stats-file"]}`);
  }
  if (opt.junit?.length) return statsFromJUnit(opt.junit);
  if (!dir) return null;

  // Allure 3: <report>/summary.json, or <report>/<plugin>/summary.json when several plugins ran.
  const candidates = [join(dir, "summary.json"), join(dir, "awesome/summary.json"),
    ...readdirSync(dir).map((d) => join(dir, d, "summary.json"))];
  for (const file of candidates) {
    const data = existsSync(file) ? readJSON(file) : null;
    if (data?.stats) return statsFromJson(data);
  }
  // Allure 2
  const a2 = readJSON(join(dir, "widgets/summary.json"));
  if (a2?.statistic) return statsFromJson(a2);
  return null;
}

function statsFromJson(data) {
  let raw, durationMs, status;
  if (data.stats && typeof data.stats.total === "number" && ("status" in data || "plugin" in data || "newTests" in data)) {
    raw = data.stats; durationMs = data.duration; status = data.status; // Allure 3 summary.json
  } else if (data.statistic) {
    raw = data.statistic; durationMs = data.time?.duration; // Allure 2 widgets/summary.json
  } else if (data.stats && "expected" in data.stats) {
    const s = data.stats; // Playwright JSON reporter
    raw = { passed: (s.expected ?? 0) + (s.flaky ?? 0), failed: s.unexpected ?? 0, skipped: s.skipped ?? 0, flaky: s.flaky ?? 0 };
    durationMs = s.duration;
  } else if (["passed", "failed", "total"].some((k) => typeof data[k] === "number")) {
    raw = data; durationMs = data.durationMs ?? data.duration; status = data.status;
  } else if (data.stats && typeof data.stats === "object") {
    raw = data.stats; durationMs = data.durationMs ?? data.duration; status = data.status;
  } else {
    return null;
  }
  const stats = {};
  for (const k of ["total", "passed", "failed", "broken", "skipped", "unknown", "flaky", "retries"]) {
    if (Number.isFinite(raw[k])) stats[k] = raw[k];
  }
  if (stats.total == null) stats.total = ["passed", "failed", "broken", "skipped", "unknown"].reduce((n, k) => n + (stats[k] ?? 0), 0);
  return { stats, durationMs, status: normalizeStatus(status, stats) };
}

function normalizeStatus(status, stats) {
  if (["passed", "failed", "broken"].includes(status)) return status;
  if (stats.failed) return "failed";
  if (stats.broken) return "broken";
  if (!stats.total || stats.total === (stats.skipped ?? 0)) return "unknown";
  return "passed";
}

function statsFromJUnit(paths) {
  const files = paths.flatMap((p) => statSync(p).isDirectory() ? findFiles(resolve(p), (f) => f.endsWith(".xml"), 3) : [resolve(p)]);
  const totals = { total: 0, failed: 0, broken: 0, skipped: 0 };
  let seconds = 0;
  for (const file of files) {
    const xml = readFileSync(file, "utf8");
    const root = xml.match(/<testsuites\b[^>]*>/)?.[0];
    const tags = root && /\btests="/.test(root) ? [root] : [...xml.matchAll(/<testsuite\b[^>]*>/g)].map((m) => m[0]);
    for (const tag of tags) {
      const attr = (n) => Number(tag.match(new RegExp(`\\b${n}="([\\d.]+)"`))?.[1] ?? 0);
      totals.total += attr("tests");
      totals.failed += attr("failures");
      totals.broken += attr("errors");
      totals.skipped += attr("skipped") + attr("disabled");
      seconds += attr("time");
    }
  }
  const stats = { ...totals, passed: Math.max(0, totals.total - totals.failed - totals.broken - totals.skipped) };
  return { stats, durationMs: seconds * 1000, status: normalizeStatus(null, stats) };
}

// Coverage (istanbul, lcov, coverage.py, cobertura, JaCoCo) and Lighthouse scores.
function detectMetrics(dir) {
  const m = {};
  const find = (re) => findFiles(dir, (f) => re.test(f), 3);

  const istanbul = find(/^coverage-summary\.json$/)[0];
  const lcov = find(/^lcov\.info$/)[0];
  const pyCov = find(/^coverage\.json$/)[0];
  const cobertura = find(/^(cobertura-coverage|coverage|cobertura)\.xml$/)[0];
  const jacoco = find(/^(jacoco|jacocoTestReport)\.xml$/)[0];

  if (istanbul) {
    const t = readJSON(istanbul)?.total;
    if (t) {
      setMetric(m, "coverage", t.lines?.pct);
      setMetric(m, "coverage.statements", t.statements?.pct);
      setMetric(m, "coverage.branches", t.branches?.pct);
      setMetric(m, "coverage.functions", t.functions?.pct);
    }
  } else if (lcov) {
    const text = readFileSync(lcov, "utf8");
    const sum = (key) => [...text.matchAll(new RegExp(`^${key}:(\\d+)`, "gm"))].reduce((n, x) => n + Number(x[1]), 0);
    const pct = (hit, found) => (found ? (100 * sum(hit)) / found : undefined);
    setMetric(m, "coverage", pct("LH", sum("LF")));
    setMetric(m, "coverage.branches", pct("BRH", sum("BRF")));
    setMetric(m, "coverage.functions", pct("FNH", sum("FNF")));
  } else if (pyCov) {
    const t = readJSON(pyCov)?.totals;
    if (t) {
      setMetric(m, "coverage", t.percent_covered);
      if (t.num_branches) setMetric(m, "coverage.branches", (100 * t.covered_branches) / t.num_branches);
    }
  } else if (cobertura) {
    const root = readFileSync(cobertura, "utf8").match(/<coverage\b[^>]*>/)?.[0] ?? "";
    const rate = (n) => Number(root.match(new RegExp(`\\b${n}="([\\d.]+)"`))?.[1]);
    if (root) {
      setMetric(m, "coverage", rate("line-rate") * 100);
      if (rate("branches-valid")) setMetric(m, "coverage.branches", rate("branch-rate") * 100);
    }
  } else if (jacoco) {
    const xml = readFileSync(jacoco, "utf8");
    const counter = (type) => {
      const all = [...xml.matchAll(new RegExp(`<counter type="${type}" missed="(\\d+)" covered="(\\d+)"\\s*/>`, "g"))];
      const last = all.at(-1); // report-level totals come last
      if (!last) return undefined;
      const missed = Number(last[1]), covered = Number(last[2]);
      return missed + covered ? (100 * covered) / (missed + covered) : undefined;
    };
    setMetric(m, "coverage", counter("LINE"));
    setMetric(m, "coverage.branches", counter("BRANCH"));
    setMetric(m, "coverage.instructions", counter("INSTRUCTION"));
  }

  const lhr = find(/(\.report\.json|^lhr.*\.json)$/i).map(readJSON).filter((r) => r?.lighthouseVersion && r.categories);
  if (lhr.length) {
    for (const cat of ["performance", "accessibility", "best-practices", "seo"]) {
      const scores = lhr.map((r) => r.categories[cat]?.score).filter((s) => typeof s === "number");
      if (scores.length) setMetric(m, `lighthouse.${cat}`, (100 * scores.reduce((a, b) => a + b, 0)) / scores.length);
    }
  }
  return m;
}

function setMetric(m, key, value) {
  if (Number.isFinite(value)) m[key] = round(value, 2);
}

function parseMetricFlags(flags = []) {
  const m = {};
  for (const f of flags.flatMap((x) => x.split(/[\n,]/)).map((x) => x.trim()).filter(Boolean)) {
    const [k, ...rest] = f.split("=");
    const v = Number(rest.join("=").trim());
    if (!k.trim() || !Number.isFinite(v)) throw new Error(`Invalid --metric "${f}" (expected name=number)`);
    m[k.trim()] = v;
  }
  return m;
}

function readMetricsFile(file) {
  if (!file) return {};
  const data = readJSON(file);
  if (!data || typeof data !== "object") throw new Error(`Cannot read --metrics-file ${file}`);
  return Object.fromEntries(Object.entries(data).filter(([, v]) => Number.isFinite(v)));
}

// ───────────────────────────── CI context ─────────────────────────────

function ciContext() {
  const env = process.env;
  if (env.GITHUB_ACTIONS === "true") {
    const event = readJSON(env.GITHUB_EVENT_PATH) ?? {};
    const pr = event.pull_request;
    const attempt = Number(env.GITHUB_RUN_ATTEMPT ?? 1);
    return {
      runId: env.GITHUB_RUN_NUMBER ? `${env.GITHUB_RUN_NUMBER}${attempt > 1 ? `-${attempt}` : ""}` : null,
      runNumber: env.GITHUB_RUN_NUMBER,
      runUrl: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}${attempt > 1 ? `/attempts/${attempt}` : ""}`,
      branch: env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME,
      commit: pr?.head?.sha ?? env.GITHUB_SHA,
      message: pr ? pr.title : event.head_commit?.message,
      pr: pr?.number,
      actor: env.GITHUB_ACTOR,
      workflow: env.GITHUB_WORKFLOW,
      event: env.GITHUB_EVENT_NAME,
      repo: env.GITHUB_REPOSITORY,
    };
  }
  const git = (...a) => { try { return execFileSync("git", a, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return undefined; } };
  return { branch: git("rev-parse", "--abbrev-ref", "HEAD"), commit: git("rev-parse", "HEAD"), message: git("log", "-1", "--format=%s") };
}

function defaultBaseUrl() {
  const repo = process.env.DEVHUB_REPO || process.env.GITHUB_REPOSITORY;
  if (!repo) return null;
  const [owner, name] = repo.split("/");
  return name.toLowerCase() === `${owner.toLowerCase()}.github.io` ? `https://${name}/` : `https://${owner.toLowerCase()}.github.io/${name}/`;
}

// ───────────────────────────── helpers ─────────────────────────────

function readJSON(file) {
  if (!file || !existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
}
function safeRead(file, bytes) {
  try { return readFileSync(file, "utf8").slice(0, bytes); } catch { return ""; }
}
function findFiles(dir, test, depth) {
  const out = [];
  const visit = (d, level) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) { if (level < depth) visit(p, level + 1); } else if (test(e.name)) out.push(p);
    }
  };
  visit(dir, 0);
  return out;
}
function walk(dir) {
  const out = [];
  const visit = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) visit(p); else out.push(relative(dir, p).split(sep).join("/"));
    }
  };
  visit(dir);
  return out;
}
function isGenerated(rel) {
  return GENERATED.some((g) => rel === g || rel.startsWith(`${g}/`)) || rel.endsWith(".DS_Store");
}
function requireDir(p, flag) {
  const dir = resolve(required(p, flag));
  mkdirSync(dir, { recursive: true });
  return dir;
}
function required(v, flag) {
  if (v == null || v === "") throw new Error(`${flag} is required`);
  return v;
}
function fail(msg) { throw new Error(msg); }
function slug(s) {
  const out = String(s).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+|-+$/g, "");
  if (!out) throw new Error(`"${s}" is not a usable id`);
  return out;
}
function titleize(id) {
  return id.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function timestampId() {
  return new Date(opt.created || Date.now()).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "").replace("T", "-");
}
function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}
function round(n, d) { const f = 10 ** d; return Math.round(n * f) / f; }
function compact(o) { return Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== "")); }
function firstLine(s) { return s ? String(s).split("\n")[0].slice(0, 200) : undefined; }
function normalizeBase(u) { return u ? (u.endsWith("/") ? u : `${u}/`) : null; }
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
function describeStats(s) {
  return ["passed", "failed", "broken", "skipped"].filter((k) => s[k]).map((k) => `${s[k]} ${k}`).join(", ") || `${s.total} tests`;
}
function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
