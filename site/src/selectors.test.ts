import { describe, expect, it } from "vitest";
import {
  aggregatePassRate, allRuns, branchesOf, commitUrl, findRun, getReport, headline, headlineSeries, latestRun, metricInfo,
  normalize, passRate, prUrl, reportKind,
} from "./selectors";
import { config, hub } from "./test/fixtures";

describe("normalize", () => {
  const h = hub();

  it("orders projects by config, then title, and drops hidden and empty ones", () => {
    expect(h.projects.map((p) => p.id)).toEqual(["web", "api"]);
  });

  it("applies config titles and titleizes the rest", () => {
    expect(h.projects[0].title).toBe("Web");
    expect(h.projects[1].title).toBe("Api");
    expect(getReport(h, "web", "coverage")?.title).toBe("Coverage");
  });

  it("sorts runs newest first", () => {
    expect(getReport(h, "web", "e2e")?.runs.map((r) => r.id)).toEqual(["3", "2", "1"]);
  });

  it("derives nav ids and link types; pages exclude links", () => {
    const items = h.navGroups[0].items;
    expect(items[1]).toMatchObject({ id: "external-site", type: "link" });
    expect(h.pages.map((p) => p.id)).toEqual(["guide"]);
  });

  it("copes with a missing manifest", () => {
    const empty = normalize(config, null);
    expect(empty.hasManifest).toBe(false);
    expect(empty.projects).toEqual([]);
  });
});

describe("runs", () => {
  const h = hub();
  const e2e = getReport(h, "web", "e2e")!;

  it("latestRun prefers the project's default branch", () => {
    expect(latestRun(e2e)?.id).toBe("2");
    expect(latestRun(getReport(h, "api", "unit")!)?.id).toBe("5");
  });

  it("findRun resolves latest, ids and misses", () => {
    expect(findRun(e2e, "latest")?.id).toBe("2");
    expect(findRun(e2e, undefined)?.id).toBe("2");
    expect(findRun(e2e, "3")?.id).toBe("3");
    expect(findRun(e2e, "nope")).toBeNull();
  });

  it("allRuns is newest first across projects", () => {
    expect(allRuns(h).map((x) => `${x.project.id}/${x.report.id}/${x.run.id}`).slice(0, 3))
      .toEqual(["web/e2e/3", "web/e2e/2", "web/coverage/2"]);
  });

  it("passRate ignores skipped tests", () => {
    expect(passRate(e2e.runs[0])).toBeCloseTo((7 / 9) * 100);
    expect(passRate({ id: "x", label: "x", createdAt: "", stats: { total: 2, skipped: 2 } })).toBeNull();
    expect(passRate(undefined)).toBeNull();
  });

  it("aggregatePassRate weights by executed tests", () => {
    expect(aggregatePassRate([e2e.runs[0], e2e.runs[1], null])).toBeCloseTo((16 / 18) * 100);
  });

  it("branchesOf is ordered by frequency", () => {
    expect(branchesOf(e2e.runs)).toEqual(["main", "feature/x"]);
  });

  it("reportKind distinguishes tests and metrics", () => {
    expect(reportKind(e2e)).toBe("tests");
    expect(reportKind(getReport(h, "web", "coverage")!)).toBe("metrics");
  });

  it("builds commit and PR links from CI metadata", () => {
    expect(commitUrl(e2e.runs[1])).toBe("https://github.com/o/web/commit/c2c2c2c2c2");
    expect(prUrl(e2e.runs[1])).toBe("https://github.com/o/web/pull/7");
    expect(commitUrl(e2e.runs[0])).toBeNull();
  });
});

describe("metrics", () => {
  it("headline is the pass rate for tests, else the lead metric", () => {
    const h = hub();
    expect(headline(getReport(h, "web", "e2e")!.runs[1])?.key).toBe("passRate");
    const cov = headline(getReport(h, "web", "coverage")!.runs[0], config.metrics);
    expect(cov?.key).toBe("coverage");
    expect(cov?.info.format(cov.value)).toBe("81.5%");
  });

  it("headlineSeries follows the first run's headline", () => {
    const runs = [...getReport(hub(), "web", "coverage")!.runs].reverse();
    expect(headlineSeries(runs)).toEqual([80, 81.5]);
  });

  it("metricInfo applies config overrides", () => {
    const info = metricInfo("bundle.size", config.metrics);
    expect(info).toMatchObject({ title: "Bundle size", better: "lower", unit: "kB" });
    expect(info.format(410)).toBe("410 kB");
  });

  it("metricInfo infers sensible defaults", () => {
    expect(metricInfo("lighthouse.performance")).toMatchObject({ title: "Performance", better: "higher", min: 0, max: 100, digits: 0 });
    expect(metricInfo("lcp_ms").better).toBe("lower");
    expect(metricInfo("coverage.branches").format(71.84)).toBe("71.8%");
    expect(metricInfo("widgets").format(12345)).toMatch(/12\.3K/);
    expect(metricInfo("widgets").format(null)).toBe("—");
  });
});
