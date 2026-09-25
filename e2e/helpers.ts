import type { Page, Route } from "@playwright/test";

type Json = Record<string, any>;

/** Serve a modified hub.config.json for this page (adds test-only pages, renderers…). */
export async function withConfig(page: Page, mutate: (config: Json) => void): Promise<void> {
  await page.route("**/hub.config.json", async (route) => {
    const res = await route.fetch();
    const config = await res.json();
    mutate(config);
    await route.fulfill({ response: res, json: config });
  });
}

/** Add one sidebar page under a "Test" group. */
export function addPage(page: Page, item: Json): Promise<void> {
  return withConfig(page, (config) => {
    config.nav = [...(config.nav ?? []), { group: "Test", items: [item] }];
  });
}

/** Serve a text file at a URL pattern. */
export async function serveText(page: Page, pattern: string, body: string, contentType = "text/plain"): Promise<void> {
  await page.route(pattern, (route: Route) => route.fulfill({ body, contentType }));
}

/** Collect uncaught page errors (the iframe's own analytics noise is ignored). */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** A synthetic manifest with `projects × reports × runs` runs, for load testing. */
export function bigManifest(projects: number, reports: number, runs: number): Json {
  const now = Date.now();
  return {
    schema: 1,
    generatedAt: new Date(now).toISOString(),
    projects: Array.from({ length: projects }, (_, p) => ({
      id: `project-${p}`,
      title: `Project ${String(p).padStart(2, "0")}`,
      reports: Array.from({ length: reports }, (_, r) => ({
        id: `report-${r}`,
        title: `Report ${r}`,
        type: r % 2 ? "coverage" : "allure",
        runs: Array.from({ length: runs }, (_, i) => {
          const failed = (i + p + r) % 7 === 0 ? 2 : 0;
          const base = {
            id: String(1000 + runs - i),
            label: `#${1000 + runs - i}`,
            createdAt: new Date(now - i * 3_600_000 - p * 60_000).toISOString(),
            path: i < 20 ? `reports/project-${p}/report-${r}/${1000 + runs - i}/` : undefined,
            pruned: i >= 20 ? true : undefined,
            git: { branch: i % 5 ? "main" : `feature/${i}`, commit: `${p}${r}${i}`.padEnd(40, "a") },
          };
          return r % 2
            ? { ...base, metrics: { coverage: 70 + ((i * 7) % 25), "coverage.branches": 60 + ((i * 3) % 30) } }
            : { ...base, status: failed ? "failed" : "passed", durationMs: 60_000 + i * 50, stats: { total: 120, passed: 118 - failed, failed, skipped: 2 } };
        }),
      })),
    })),
  };
}
