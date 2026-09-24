#!/usr/bin/env node
// Seeds the local site with a week of realistic demo runs so every view has data:
//   • shop-web / e2e       — real Allure 3 reports (with history) from generated results
//   • shop-web / coverage  — coverage HTML + coverage-summary.json (trending up)
//   • shop-api / integration — real Allure 3 reports
// Uses the same publish path as CI (scripts/hub.mjs). Allure is run via `npx allure@3`;
// pass --no-allure (or run offline) to publish lightweight placeholder pages instead.
//
//   node scripts/demo.mjs [--site site] [--runs 12] [--no-allure] [--clean]

import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HERE = dirname(fileURLToPath(import.meta.url));
const { values: args } = parseArgs({
  options: {
    site: { type: "string", default: join(HERE, "..", ".devhub-preview") },
    runs: { type: "string", default: "12" },
    "no-allure": { type: "boolean", default: false },
    clean: { type: "boolean", default: true },
    "allure-version": { type: "string", default: "3" },
  },
});

const site = resolve(args.site);
const RUNS = Number(args.runs);
const work = mkdtempSync(join(tmpdir(), "devhub-demo-"));
const HUB = join(HERE, "hub.mjs");
const SAMPLE = join(HERE, "sample-results.mjs");

const run = (cmd, argv, opts = {}) => new Promise((res, rej) => {
  const p = spawn(cmd, argv, { stdio: opts.quiet ? "ignore" : "inherit", ...opts });
  p.on("error", rej);
  p.on("exit", (code) => (code === 0 ? res() : rej(new Error(`${cmd} ${argv.slice(0, 3).join(" ")} exited with ${code}`))));
});

if (args.clean) {
  for (const p of ["reports", "data/manifest.json", "data/runs.json", "data/badges"]) rmSync(join(site, p), { recursive: true, force: true });
}

let useAllure = !args["no-allure"];
if (useAllure) {
  try {
    await run("npx", ["-y", `allure@${args["allure-version"]}`, "--version"], { quiet: true });
  } catch {
    console.warn("Allure 3 CLI not available (offline?) — publishing placeholder pages instead of real reports.");
    useAllure = false;
  }
}

const HOUR = 3600e3;
const now = Date.now();
const messages = [
  "Add saved-card checkout", "Fix flaky cart persistence test", "Bump playwright to 1.5x", "Refactor auth fixtures",
  "Search: debounce suggestions", "Checkout v2: new address form", "Checkout v2: 3DS challenge", "Merge checkout v2",
  "Cache product images", "Tighten coupon validation", "Upgrade to Node 24", "Profile: avatar cropping",
];
const sha = (i, salt) => [...`${salt}${i * 7919}`].reduce((h, c) => ((h * 33) ^ c.charCodeAt(0)) >>> 0, 5381).toString(16).padStart(8, "0") + (i * 2654435761 >>> 0).toString(16).padStart(8, "0").repeat(4).slice(0, 32);

function timeline(i) {
  const created = new Date(now - (RUNS - 1 - i) * 13 * HOUR - 20 * 60e3);
  const branch = i === RUNS - 5 || i === RUNS - 6 ? "feature/checkout-v2" : "main";
  return { created, branch, runNumber: 140 + i, message: messages[i % messages.length] };
}

async function allureChannel({ project, projectTitle, report, title, suite, failRates }) {
  for (let i = 0; i < RUNS; i++) {
    const t = timeline(i);
    const dir = join(work, `${project}-${report}-${i}`);
    const results = join(dir, "allure-results");
    const out = join(dir, "allure-report");
    await run(process.execPath, [SAMPLE, "--out", results, "--seed", String(1000 + i * 17 + suite.length), "--fail-rate", String(failRates[i % failRates.length]), "--suite", suite, "--start-time", String(t.created.getTime() - 20 * 60e3)], { quiet: true });

    const historyFile = join(site, "reports", project, report, "history.jsonl");
    const workHistory = join(dir, "history.jsonl");
    if (existsSync(historyFile)) cpSync(historyFile, workHistory);

    let extra;
    if (useAllure) {
      writeFileSync(join(dir, "allurerc.mjs"), `export default ${JSON.stringify({
        name: `${projectTitle} · ${title}`, output: out, historyPath: workHistory, historyLimit: 30,
        plugins: { awesome: { options: { reportName: `${projectTitle} · ${title}` } } },
      }, null, 2)};\n`);
      await run("npx", ["-y", `allure@${args["allure-version"]}`, "generate", "--config", join(dir, "allurerc.mjs"), results], { quiet: true });
      extra = ["--history-file", workHistory];
    } else {
      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, "index.html"), placeholder(`${projectTitle} · ${title}`, `Run #${t.runNumber}`));
      await writeStatsFromResults(results, join(dir, "stats.json"));
      extra = ["--stats-file", join(dir, "stats.json")];
    }

    await run(process.execPath, [HUB, "publish", "--site", site,
      "--project", project, "--project-title", projectTitle, "--report", report, "--title", title, "--type", "allure",
      "--source", out, "--run-id", String(t.runNumber), "--label", `#${t.runNumber}`, "--created", t.created.toISOString(),
      "--branch", t.branch, "--commit", sha(i, project), "--message", t.message, "--keep", "10", ...extra],
      { env: { ...process.env, GITHUB_ACTIONS: "" } });
  }
}

async function writeStatsFromResults(resultsDir, file) {
  const { readdirSync, readFileSync } = await import("node:fs");
  const latest = new Map();
  for (const f of readdirSync(resultsDir).filter((x) => x.endsWith("-result.json"))) {
    const r = JSON.parse(readFileSync(join(resultsDir, f), "utf8"));
    const prev = latest.get(r.historyId);
    if (!prev || prev.stop < r.stop) latest.set(r.historyId, r);
  }
  const stats = { total: 0, passed: 0, failed: 0, broken: 0, skipped: 0 };
  let start = Infinity, stop = 0;
  for (const r of latest.values()) { stats.total++; stats[r.status]++; start = Math.min(start, r.start); stop = Math.max(stop, r.stop); }
  writeFileSync(file, JSON.stringify({ ...stats, durationMs: stop - start }));
}

async function coverageChannel() {
  for (let i = 0; i < RUNS; i++) {
    const t = timeline(i);
    const pct = (base) => Math.min(99, base + i * 1.1 + ((i * 37) % 5) * 0.4);
    const summary = { lines: pct(71.2), statements: pct(70.4), functions: pct(64.8), branches: pct(58.9) };
    const dir = join(work, `coverage-${i}`);
    mkdirSync(dir, { recursive: true });
    const tot = (p, n) => ({ total: n, covered: Math.round((p / 100) * n), skipped: 0, pct: Math.round(p * 100) / 100 });
    writeFileSync(join(dir, "coverage-summary.json"), JSON.stringify({
      total: { lines: tot(summary.lines, 4210), statements: tot(summary.statements, 4580), functions: tot(summary.functions, 812), branches: tot(summary.branches, 1390) },
    }));
    writeFileSync(join(dir, "index.html"), coveragePage(summary, i));
    await run(process.execPath, [HUB, "publish", "--site", site, "--project", "shop-web", "--project-title", "Shop Web",
      "--report", "coverage", "--title", "Unit coverage", "--type", "coverage", "--source", dir,
      "--run-id", String(t.runNumber), "--label", `#${t.runNumber}`, "--created", t.created.toISOString(),
      "--branch", t.branch, "--commit", sha(i, "shop-web"), "--message", t.message, "--metric", `bundle.size=${Math.round(412 + i * 3.5 - (i > 8 ? 30 : 0))}`, "--keep", "10"],
      { env: { ...process.env, GITHUB_ACTIONS: "" } });
  }
}

await Promise.all([
  allureChannel({ project: "shop-web", projectTitle: "Shop Web", report: "e2e", title: "E2E tests", suite: "web", failRates: [0.03, 0.01, 0.04, 0, 0.02, 0.01, 0.16, 0.2, 0.04, 0, 0.01, 0.06] }),
  allureChannel({ project: "shop-api", projectTitle: "Shop API", report: "integration", title: "Integration tests", suite: "api", failRates: [0.02, 0.0, 0.03, 0.0, 0.05, 0.02, 0.0, 0.01, 0.0, 0.02, 0.0, 0.0] }),
  coverageChannel(),
]);

rmSync(work, { recursive: true, force: true });
console.log(`\nDemo data written to ${site}. Start the app with: npm run dev  (or npm run preview for the production build)`);

// ───────────── fake pages ─────────────

function placeholder(title, sub) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font:15px system-ui;display:grid;place-items:center;height:100vh;margin:0;color:#52514e}</style></head>
<body><div style="text-align:center"><h1 style="color:#0b0b0b">${title}</h1><p>${sub}</p><p>Placeholder — run the demo with Allure available (<code>npx allure@3</code>) to publish real reports.</p></div></body></html>`;
}

function coveragePage(s, i) {
  const files = ["src/cart/cart.ts", "src/cart/coupon.ts", "src/checkout/address.ts", "src/checkout/payment.ts", "src/search/index.ts", "src/auth/session.ts", "src/profile/avatar.ts", "src/lib/http.ts"];
  const row = (f, k) => {
    const p = Math.max(20, Math.min(100, s.lines + ((k * 13 + i * 3) % 30) - 12));
    const c = p >= 80 ? "#0ca30c" : p >= 60 ? "#eda100" : "#d03b3b";
    return `<tr><td>${f}</td><td><div class="bar"><span style="width:${p}%;background:${c}"></span></div></td><td class="n">${p.toFixed(1)}%</td></tr>`;
  };
  const stat = (label, v) => `<div class="stat"><b>${v.toFixed(2)}%</b><span>${label}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Coverage report</title>
<style>body{font:14px system-ui,sans-serif;margin:0;padding:32px;color:#0b0b0b;background:#fcfcfb}h1{font-size:20px;margin:0 0 20px}
.stats{display:flex;gap:28px;margin-bottom:24px}.stat{display:flex;flex-direction:column}.stat b{font-size:22px}.stat span{color:#52514e;font-size:13px}
table{border-collapse:collapse;width:100%;max-width:820px}td,th{padding:8px 10px;border-bottom:1px solid #e1e0d9;text-align:left}.n{text-align:right;font-variant-numeric:tabular-nums}
.bar{height:8px;background:#f0efec;border-radius:4px;width:240px;overflow:hidden}.bar span{display:block;height:100%}
@media (prefers-color-scheme:dark){body{background:#1a1a19;color:#fff}.stat span{color:#c3c2b7}td,th{border-color:#2c2c2a}.bar{background:#2c2c2a}}</style></head>
<body><h1>All files</h1><div class="stats">${stat("Statements", s.statements)}${stat("Branches", s.branches)}${stat("Functions", s.functions)}${stat("Lines", s.lines)}</div>
<table><thead><tr><th>File</th><th>Lines</th><th class="n">%</th></tr></thead><tbody>${files.map(row).join("")}</tbody></table>
<p style="color:#898781;margin-top:24px">Demo coverage page — in CI publish your real lcov / istanbul / coverage.py / JaCoCo HTML here.</p></body></html>`;
}
