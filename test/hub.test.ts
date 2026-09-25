// @vitest-environment node
// Tests for scripts/hub.mjs, run as a CLI exactly like the action runs it.

import { describe, expect, it, beforeEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const HUB = join(ROOT, "scripts/hub.mjs");
const FIX = join(ROOT, "test/fixtures");

// A clean environment: no GitHub Actions variables leaking in from CI.
const baseEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GITHUB_") && k !== "DEVHUB_REPO"));

function hub(args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [HUB, ...args], { encoding: "utf8", env: { ...baseEnv, ...env }, cwd: tmpdir() });
}
function ok(args: string[], env: Record<string, string> = {}) {
  const r = hub(args, env);
  if (r.status !== 0) throw new Error(`hub ${args.join(" ")} failed:\n${r.stderr}${r.stdout}`);
  return r.stdout;
}
const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const manifestOf = (site: string) => readJson(join(site, "data/manifest.json"));
const reportOf = (site: string, p: string, r: string) =>
  manifestOf(site).projects.find((x: any) => x.id === p).reports.find((x: any) => x.id === r);

let site: string;
let work: string;
beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "devhub-test-"));
  site = join(work, "site");
});

function publishFixture(name: string, extra: string[] = []) {
  ok(["publish", "--site", site, "--project", "p", "--report", name, "--run-id", "1", ...extra]);
  return reportOf(site, "p", name);
}

describe("detection from real tool output", () => {
  it("coverage.py (hashed HTML assets + coverage.json)", () => {
    const r = publishFixture("covpy", ["--source", join(FIX, "coverage-py")]);
    expect(r.type).toBe("coverage");
    expect(r.runs[0].metrics).toEqual({ coverage: 95.12, "coverage.branches": 100 });
  });

  it("Cobertura XML", () => {
    const r = publishFixture("cobertura", ["--source", join(FIX, "cobertura")]);
    expect(r.type).toBe("coverage");
    expect(r.runs[0].metrics).toEqual({ coverage: 93.94, "coverage.branches": 100 });
  });

  it("JaCoCo XML uses the report-level counters", () => {
    const r = publishFixture("jacoco", ["--source", join(FIX, "jacoco")]);
    expect(r.type).toBe("coverage");
    // LINE 16/18, BRANCH 10/18, INSTRUCTION 79/100 in the real report
    expect(r.runs[0].metrics).toEqual({ coverage: 88.89, "coverage.branches": 55.56, "coverage.instructions": 79 });
  });

  it("istanbul json-summary", () => {
    const r = publishFixture("istanbul", ["--source", join(FIX, "istanbul")]);
    expect(r.type).toBe("coverage");
    expect(r.runs[0].metrics).toEqual({ coverage: 62.5, "coverage.statements": 62.5, "coverage.branches": 60, "coverage.functions": 66.66 });
  });

  it("lcov.info on its own", () => {
    const r = publishFixture("lcov", ["--source", join(FIX, "lcov")]);
    expect(r.type).toBe("coverage");
    expect(r.runs[0].metrics).toEqual({ coverage: 62.5, "coverage.branches": 60, "coverage.functions": 66.67 });
  });

  it("Allure 2 widgets/summary.json", () => {
    const r = publishFixture("allure2", ["--source", join(FIX, "allure2")]);
    expect(r.type).toBe("allure");
    const run = r.runs[0];
    expect(run.status).toBe("failed");
    expect(run.stats).toEqual({ total: 47, passed: 38, failed: 2, broken: 2, skipped: 5, unknown: 0 });
    expect(run.durationMs).toBe(147688);
    expect(run.entry).toBeUndefined();
  });

  it("Allure 3 with several plugins opens the Awesome report", () => {
    const r = publishFixture("multi", ["--source", join(FIX, "allure3-multi")]);
    expect(r.type).toBe("allure");
    expect(r.runs[0].entry).toBe("awesome/");
    expect(r.runs[0].stats).toMatchObject({ total: 47, passed: 38, failed: 2, broken: 2, skipped: 5 });
  });

  it("Allure 3 single report (summary.json at the root)", () => {
    const r = publishFixture("single", ["--source", join(FIX, "allure3-multi/awesome")]);
    expect(r.type).toBe("allure");
    expect(r.runs[0].entry).toBeUndefined();
    expect(r.runs[0].status).toBe("failed");
  });

  it("Lighthouse: scores ×100 and the lone HTML page as entry", () => {
    const r = publishFixture("lh", ["--source", join(FIX, "lighthouse")]);
    expect(r.type).toBe("lighthouse");
    expect(r.runs[0].entry).toBe("home.report.html");
    expect(r.runs[0].metrics).toEqual({ "lighthouse.performance": 99, "lighthouse.accessibility": 100, "lighthouse.best-practices": 100, "lighthouse.seo": 100 });
  });

  it("Playwright HTML report + JSON stats", () => {
    const r = publishFixture("pw", ["--source", join(FIX, "playwright"), "--stats-file", join(FIX, "playwright/results.json")]);
    expect(r.type).toBe("playwright");
    expect(r.runs[0]).toMatchObject({ status: "passed", stats: { total: 8, passed: 8, failed: 0, skipped: 0, flaky: 0 } });
    expect(r.runs[0].durationMs).toBe(3369);
  });

  it("pytest JUnit XML without totals on <testsuites>", () => {
    const r = publishFixture("junit", ["--source", join(FIX, "junit"), "--junit", join(FIX, "junit/pytest.xml")]);
    expect(r.runs[0]).toMatchObject({ status: "failed", stats: { total: 8, failed: 1, broken: 0, skipped: 1, passed: 6 }, durationMs: 18 });
  });

  it("JUnit given as a directory", () => {
    const r = publishFixture("junitdir", ["--junit", join(FIX, "junit")]);
    expect(r.runs[0].stats).toMatchObject({ total: 8, passed: 6 });
  });
});

describe("publishing", () => {
  it("records numbers-only runs without report files", () => {
    ok(["publish", "--site", site, "--project", "web", "--report", "bundle", "--metric", "bundle.size=412, lcp_ms=1830", "--metric", "x=1"]);
    const run = reportOf(site, "web", "bundle").runs[0];
    expect(run).toMatchObject({ pruned: true, metrics: { "bundle.size": 412, lcp_ms: 1830, x: 1 } });
    expect(run.path).toBeUndefined();
    expect(reportOf(site, "web", "bundle").type).toBe("metrics");
  });

  it("rejects malformed metrics", () => {
    const r = hub(["publish", "--site", site, "--project", "web", "--report", "bundle", "--metric", "size=big"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Invalid --metric "size=big"');
  });

  it("uses GitHub run numbers as ids and never overwrites a run", () => {
    const env = { GITHUB_ACTIONS: "true", GITHUB_RUN_NUMBER: "42", GITHUB_RUN_ATTEMPT: "1", GITHUB_RUN_ID: "9", GITHUB_REPOSITORY: "o/r", GITHUB_SERVER_URL: "https://github.com" };
    ok(["publish", "--site", site, "--project", "p", "--report", "r", "--metric", "a=1"], env);
    ok(["publish", "--site", site, "--project", "p", "--report", "r", "--metric", "a=2"], env);
    ok(["publish", "--site", site, "--project", "p", "--report", "r", "--metric", "a=3"], { ...env, GITHUB_RUN_ATTEMPT: "2" });
    const ids = reportOf(site, "p", "r").runs.map((x: any) => x.id).sort();
    expect(ids).toEqual(["42", "42-2", "42-2-2"].sort());
    expect(reportOf(site, "p", "r").runs.find((x: any) => x.id === "42").label).toBe("#42");
  });

  it("reads branch, commit, PR and message from a pull_request event", () => {
    const event = join(work, "event.json");
    writeFileSync(event, JSON.stringify({ pull_request: { number: 7, title: "Add coupons\n\nDetails", head: { sha: "headsha" } } }));
    ok(["publish", "--site", site, "--project", "p", "--report", "r", "--metric", "a=1"], {
      GITHUB_ACTIONS: "true", GITHUB_RUN_NUMBER: "5", GITHUB_RUN_ID: "123", GITHUB_REPOSITORY: "o/r", GITHUB_SERVER_URL: "https://github.com",
      GITHUB_HEAD_REF: "feature/coupons", GITHUB_REF_NAME: "7/merge", GITHUB_SHA: "mergesha", GITHUB_EVENT_PATH: event, GITHUB_EVENT_NAME: "pull_request",
    });
    const run = reportOf(site, "p", "r").runs[0];
    expect(run.git).toEqual({ branch: "feature/coupons", commit: "headsha", message: "Add coupons", pr: 7 });
    expect(run.ci).toMatchObject({ runUrl: "https://github.com/o/r/actions/runs/123", runNumber: 5, repo: "o/r", event: "pull_request" });
  });

  it("prunes report folders beyond --keep but keeps their numbers, and caps --history", () => {
    for (let i = 1; i <= 5; i++) {
      ok(["publish", "--site", site, "--project", "p", "--report", "r", "--source", join(FIX, "allure2"), "--run-id", String(i),
        "--created", new Date(Date.UTC(2026, 0, i)).toISOString(), "--keep", "2", "--history", "4"]);
    }
    const runs = reportOf(site, "p", "r").runs;
    expect(runs.map((x: any) => x.id)).toEqual(["5", "4", "3", "2"]);
    expect(runs.map((x: any) => !!x.pruned)).toEqual([false, false, true, true]);
    expect(runs[3].stats.total).toBe(47);
    expect(readdirSync(join(site, "reports/p/r")).sort()).toEqual(["4", "5", "latest"]);
  });

  it("writes a latest/ redirect and shields.io badges", () => {
    publishFixture("allure2", ["--source", join(FIX, "allure2")]);
    publishFixture("jacoco", ["--source", join(FIX, "jacoco")]);
    expect(readFileSync(join(site, "reports/p/allure2/latest/index.html"), "utf8")).toContain('url=../1/"');
    expect(readJson(join(site, "data/badges/p/allure2.json"))).toEqual({ schemaVersion: 1, label: "allure2", message: "4 failed, 38 passed", color: "critical" });
    expect(readJson(join(site, "data/badges/p/jacoco.json"))).toMatchObject({ message: "88.9%", color: "green" });
    expect(readJson(join(site, "data/badges/p/jacoco.coverage.branches.json"))).toMatchObject({ message: "55.6%", color: "orange" });
  });

  it("merges Allure history by uuid, oldest first, capped", () => {
    const line = (uuid: string, t: number) => JSON.stringify({ uuid, timestamp: t, testResults: {} });
    mkdirSync(join(site, "reports/p/r"), { recursive: true });
    writeFileSync(join(site, "reports/p/r/history.jsonl"), [line("a", 1), line("b", 2), line("c", 3)].join("\n") + "\n");
    const fresh = join(work, "history.jsonl");
    writeFileSync(fresh, [line("b", 2), line("d", 4)].join("\n") + "\nnot json\n");
    ok(["publish", "--site", site, "--project", "p", "--report", "r", "--metric", "a=1", "--history-file", fresh, "--history-limit", "3"]);
    const uuids = readFileSync(join(site, "reports/p/r/history.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l).uuid);
    expect(uuids).toEqual(["b", "c", "d"]);
  });

  it("writes the flat runs.json", () => {
    publishFixture("allure2", ["--source", join(FIX, "allure2")]);
    const [row] = readJson(join(site, "data/runs.json"));
    expect(row).toMatchObject({ project: "p", report: "allure2", run: "1", status: "failed", total: 47, passed: 38, passRate: 90.48, hasReport: true });
  });

  it("derives public URLs for project and user Pages sites", () => {
    const result = join(work, "result.json");
    ok(["publish", "--site", site, "--project", "p", "--report", "r", "--metric", "a=1", "--result", result], { DEVHUB_REPO: "Mark-Burg/devhub" });
    expect(readJson(result).url).toBe("https://mark-burg.github.io/devhub/#/r/p/r/" + readJson(result).runId);
    ok(["publish", "--site", site, "--project", "p", "--report", "r", "--metric", "a=1", "--result", result], { DEVHUB_REPO: "mark-burg/mark-burg.github.io" });
    expect(readJson(result).url).toMatch(/^https:\/\/mark-burg\.github\.io\/#\/r\/p\/r\//);
  });

  it("gh-summary writes step outputs and a job summary", () => {
    const result = join(work, "result.json");
    ok(["publish", "--site", site, "--project", "p", "--report", "r", "--source", join(FIX, "allure2"), "--run-id", "3", "--result", result], { DEVHUB_REPO: "o/hub" });
    const out = join(work, "out"), summary = join(work, "summary.md");
    writeFileSync(out, "");
    ok(["gh-summary", "--result", result], { GITHUB_OUTPUT: out, GITHUB_STEP_SUMMARY: summary });
    const outputs = Object.fromEntries(readFileSync(out, "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
    expect(outputs).toMatchObject({ "run-id": "3", status: "failed", total: "47", passed: "38", failed: "2", broken: "2", skipped: "5" });
    expect(outputs.url).toBe("https://o.github.io/hub/#/r/p/r/3");
    expect(readFileSync(summary, "utf8")).toContain("| 47 | 38 | 2 | 2 | 5 | 2m 28s |");
  });
});

describe("maintenance commands", () => {
  it("remove deletes a run, a report and a project", () => {
    publishFixture("a", ["--source", join(FIX, "allure2")]);
    ok(["publish", "--site", site, "--project", "p", "--report", "a", "--source", join(FIX, "allure2"), "--run-id", "2"]);
    publishFixture("b", ["--source", join(FIX, "jacoco")]);
    ok(["remove", "--site", site, "--project", "p", "--report", "a", "--run", "2"]);
    expect(reportOf(site, "p", "a").runs.map((x: any) => x.id)).toEqual(["1"]);
    expect(existsSync(join(site, "reports/p/a/2"))).toBe(false);
    ok(["remove", "--site", site, "--project", "p", "--report", "b"]);
    expect(existsSync(join(site, "data/badges/p/b.json"))).toBe(false);
    ok(["remove", "--site", site, "--project", "p"]);
    expect(manifestOf(site).projects).toEqual([]);
    expect(hub(["remove", "--site", site, "--project", "nope"]).status).toBe(1);
  });

  it("sync-shell copies the built shell without touching published content", () => {
    const shell = join(work, "dist");
    mkdirSync(join(shell, "assets"), { recursive: true });
    writeFileSync(join(shell, "index.html"), "<h1>v1</h1>");
    writeFileSync(join(shell, "assets/old.js"), "old");
    publishFixture("allure2", ["--source", join(FIX, "allure2")]);
    writeFileSync(join(site, "user-added.txt"), "from another tool");

    ok(["sync-shell", "--site", site, "--from", shell]);
    expect(readFileSync(join(site, "index.html"), "utf8")).toBe("<h1>v1</h1>");

    // Next deploy: old.js was dropped from the build, index changed.
    writeFileSync(join(shell, "index.html"), "<h1>v2</h1>");
    execFileSync("rm", [join(shell, "assets/old.js")]);
    writeFileSync(join(shell, "assets/new.js"), "new");
    ok(["sync-shell", "--site", site, "--from", shell]);
    expect(readFileSync(join(site, "index.html"), "utf8")).toBe("<h1>v2</h1>");
    expect(existsSync(join(site, "assets/old.js"))).toBe(false);
    expect(existsSync(join(site, "assets/new.js"))).toBe(true);
    expect(existsSync(join(site, "user-added.txt"))).toBe(true);
    expect(existsSync(join(site, "reports/p/allure2/1/widgets/summary.json"))).toBe(true);
    expect(manifestOf(site).projects).toHaveLength(1);
  });

  it("sync-shell refuses an unbuilt source", () => {
    const r = hub(["sync-shell", "--site", site, "--from", join(work, "missing")]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("npm run build");
  });

  it("rebuild regenerates badges and redirects from the manifest", () => {
    publishFixture("allure2", ["--source", join(FIX, "allure2")]);
    execFileSync("rm", ["-r", join(site, "data/badges"), join(site, "reports/p/allure2/latest")]);
    ok(["rebuild", "--site", site]);
    expect(existsSync(join(site, "data/badges/p/allure2.json"))).toBe(true);
    expect(existsSync(join(site, "reports/p/allure2/latest/index.html"))).toBe(true);
  });
});
