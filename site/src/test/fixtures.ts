import type { HubConfig, Manifest } from "../types";
import { normalize } from "../selectors";

const at = (hour: number) => new Date(Date.UTC(2026, 8, 20, hour)).toISOString();

export const config: HubConfig = {
  title: "Test Hub",
  projects: {
    web: { title: "Web", description: "Storefront", defaultBranch: "main" },
    hidden: { hidden: true },
  },
  metrics: { "bundle.size": { title: "Bundle size", unit: "kB", better: "lower", digits: 0 } },
  nav: [
    {
      group: "Docs",
      items: [
        { id: "guide", title: "Guide", type: "markdown", src: "docs/guide.md" },
        { title: "External Site", href: "https://example.com" },
      ],
    },
  ],
};

export const manifest: Manifest = {
  generatedAt: at(12),
  projects: [
    {
      id: "api",
      reports: [
        {
          id: "unit",
          type: "allure",
          runs: [{ id: "5", label: "#5", createdAt: at(8), path: "reports/api/unit/5/", status: "failed", stats: { total: 4, passed: 3, failed: 1 }, durationMs: 4000 }],
        },
      ],
    },
    {
      id: "web",
      title: "web",
      reports: [
        {
          id: "e2e",
          title: "E2E",
          type: "allure",
          // Deliberately out of order: normalize() sorts newest first.
          runs: [
            { id: "1", label: "#1", createdAt: at(9), pruned: true, status: "failed", stats: { total: 10, passed: 8, broken: 1, skipped: 1 }, git: { branch: "main" } },
            {
              id: "3", label: "#3", createdAt: at(11), path: "reports/web/e2e/3/", status: "failed",
              stats: { total: 10, passed: 7, failed: 2, skipped: 1 }, durationMs: 90_000, git: { branch: "feature/x", commit: "c3c3c3c3c3" },
            },
            {
              id: "2", label: "#2", createdAt: at(10), path: "reports/web/e2e/2/", status: "passed",
              stats: { total: 10, passed: 9, skipped: 1 }, durationMs: 80_000,
              git: { branch: "main", commit: "c2c2c2c2c2", pr: 7, message: "Fix checkout" },
              ci: { repo: "o/web", runUrl: "https://github.com/o/web/actions/runs/2" },
            },
          ],
        },
        {
          id: "coverage",
          type: "coverage",
          runs: [
            { id: "2", label: "#2", createdAt: at(10), path: "reports/web/coverage/2/", metrics: { coverage: 81.5, "bundle.size": 410 }, git: { branch: "main" } },
            { id: "1", label: "#1", createdAt: at(9), path: "reports/web/coverage/1/", metrics: { coverage: 80, "bundle.size": 420 }, git: { branch: "main" } },
          ],
        },
      ],
    },
    { id: "empty", reports: [] },
    { id: "hidden", reports: [{ id: "x", runs: [{ id: "1", label: "#1", createdAt: at(1) }] }] },
  ],
};

export const hub = () => normalize(config, manifest);
