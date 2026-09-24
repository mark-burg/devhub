import { describe, expect, it } from "vitest";
import { href, parse, routes } from "./router";
import { fmtDuration, fmtPct, fmtRelative, shortSha, slugify, titleize } from "./lib/format";
import { clampScale, contiguous, niceScale, roundedTopPath } from "./charts/scale";
import { fmtBench, parseBenchmarks } from "./views/pages/benchmarks";
import { buildItems, score, search } from "./components/CommandPalette";
import { hub } from "./test/fixtures";

describe("router", () => {
  it("parses parts and query", () => {
    const r = parse("#/r/web/e2e/3?at=abc%2Fdef%23x&n=10");
    expect(r.parts).toEqual(["r", "web", "e2e", "3"]);
    expect(r.query.get("at")).toBe("abc/def#x");
    expect(r.query.get("n")).toBe("10");
  });

  it("round-trips through href, dropping empty params", () => {
    const h = href(["r", "a b", "c", undefined], { at: "x/y#z", n: null, branch: "" });
    expect(h).toBe("#/r/a%20b/c?at=x%2Fy%23z");
    expect(parse(h)).toMatchObject({ parts: ["r", "a b", "c"] });
    expect(parse(h).query.get("at")).toBe("x/y#z");
  });

  it("handles the dashboard and bad escapes", () => {
    expect(parse("").parts).toEqual([]);
    expect(parse("#/").parts).toEqual([]);
    expect(parse("#/p/%E0%A4%A").parts).toEqual(["p", "%E0%A4%A"]);
    expect(routes.dashboard()).toBe("#/");
    expect(routes.report("p", "r")).toBe("#/r/p/r");
  });
});

describe("format", () => {
  it("formats durations", () => {
    expect(fmtDuration(500)).toBe("500ms");
    expect(fmtDuration(1500)).toBe("1.5s");
    expect(fmtDuration(42_000)).toBe("42s");
    expect(fmtDuration(120_000)).toBe("2m");
    expect(fmtDuration(125_000)).toBe("2m 5s");
    expect(fmtDuration(3_600_000)).toBe("1h");
    expect(fmtDuration(null)).toBe("—");
  });

  it("formats percentages without rounding up to 100", () => {
    expect(fmtPct(100)).toBe("100%");
    expect(fmtPct(99.97)).toBe("99.9%");
    expect(fmtPct(97.73)).toBe("97.7%");
    expect(fmtPct(undefined)).toBe("—");
  });

  it("formats relative time and text", () => {
    expect(fmtRelative(new Date().toISOString())).toBe("just now");
    expect(fmtRelative("nope")).toBe("—");
    expect(shortSha("abcdef1234")).toBe("abcdef1");
    expect(slugify("External Site!")).toBe("external-site");
    expect(titleize("shop-web.e2e")).toBe("Shop Web E2e");
  });
});

describe("chart scales", () => {
  it("rounds domains to clean ticks", () => {
    expect(niceScale(0, 47).ticks).toEqual([0, 10, 20, 30, 40, 50]);
    expect(niceScale(96.3, 100.4, 4)).toMatchObject({ lo: 96, hi: 101 });
    expect(niceScale(5, 5).ticks.length).toBeGreaterThan(1);
  });

  it("clamps to hard bounds", () => {
    expect(clampScale(niceScale(90, 104), 0, 100).hi).toBe(100);
  });

  it("splits series at gaps and draws rounded columns", () => {
    expect(contiguous([[0, 0], [1, 1], null, [3, 3]])).toEqual([[[0, 0], [1, 1]], [[3, 3]]]);
    expect(roundedTopPath(0, 0, 20, 10, 4)).toMatch(/^M0,10V4A4,4/);
  });
});

describe("benchmarks", () => {
  it("parses github-action-benchmark data.js", () => {
    const text = `window.BENCHMARK_DATA = ${JSON.stringify({
      lastUpdate: Date.UTC(2026, 0, 2),
      entries: {
        Suite: [
          { commit: { id: "aaaaaaa1", message: "one\nbody", url: "u1" }, date: Date.UTC(2026, 0, 1), benches: [{ name: "parse", value: 10, unit: "ms", range: "±1%" }] },
          { commit: { id: "bbbbbbb2", message: "two" }, date: Date.UTC(2026, 0, 2), benches: [{ name: "parse", value: 8, unit: "ms" }] },
        ],
      },
    })};`;
    const [group] = parseBenchmarks(text);
    expect(group.name).toBe("Suite");
    expect(group.series[0]).toMatchObject({ name: "parse", unit: "ms" });
    expect(group.series[0].points.map((p) => [p.label, p.y, p.note])).toEqual([["aaaaaaa", 10, "one · ±1%"], ["bbbbbbb", 8, "two"]]);
    expect(group.updated).toBe("2026-01-02T00:00:00.000Z");
  });

  it("parses the generic series format", () => {
    const [group] = parseBenchmarks(JSON.stringify({ name: "Perf", series: [{ name: "p95", unit: "ms", points: [{ x: "v1", y: 120 }, { label: "v2", y: 110 }] }] }));
    expect(group.name).toBe("Perf");
    expect(group.series[0].points.map((p) => p.label)).toEqual(["v1", "v2"]);
    expect(parseBenchmarks("{}")).toEqual([]);
  });

  it("formats values", () => {
    expect(fmtBench(7.80912)).toBe("7.809");
    expect(fmtBench(56900)).toMatch(/56\.9K/);
    expect(fmtBench(null)).toBe("—");
  });
});

describe("command palette search", () => {
  const items = buildItems(hub());

  it("requires every word and favours word starts", () => {
    const run = items.find((i) => i.label === "Web / E2E #3")!;
    expect(score(run, ["web", "nope"])).toBe(-Infinity);
    expect(score(run, ["e2e"])).toBeGreaterThan(score(run, ["2e"]));
  });

  it("hides individual runs until the user types", () => {
    expect(search(items, "").some((i) => i.weight === -1)).toBe(false);
    expect(search(items, "Web E2E")[0].label).toBe("Web / E2E");
  });

  it("finds runs by commit sha", () => {
    expect(search(items, "c2c2c2")[0].label).toBe("Web / E2E #2");
  });

  it("skips archived runs and includes pages and links", () => {
    expect(items.some((i) => i.label === "Web / E2E #1")).toBe(false);
    expect(items.find((i) => i.label === "External Site")).toMatchObject({ external: true, href: "https://example.com" });
    expect(items.find((i) => i.label === "Guide")?.href).toBe("#/page/guide");
  });
});
