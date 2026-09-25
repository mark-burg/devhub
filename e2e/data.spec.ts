import { expect, test } from "@playwright/test";
import { bigManifest } from "./helpers";

test.describe("data edge cases", () => {
  test("no manifest yet: onboarding points at the guide", async ({ page }) => {
    await page.route("**/data/manifest.json", (route) => route.fulfill({ status: 404, body: "Not found" }));
    await page.goto("#/");
    await expect(page.getByRole("heading", { name: "No reports published yet" })).toBeVisible();
    await expect(page.getByText("data/manifest.json was not found")).toBeVisible();
    await page.getByRole("link", { name: "Open the publishing guide" }).click();
    await expect(page.locator("article.md h1")).toHaveText("Publishing guide");
  });

  test("new runs appear without a reload (2-minute poll)", async ({ page }) => {
    await page.clock.install();
    let manifest: any = null;
    await page.route("**/data/manifest.json", async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      manifest ??= json;
      await route.fulfill({ response: res, json: manifest });
    });
    await page.goto("#/");
    await expect(page.locator(".page-head p")).toContainText("36 runs");

    // Publish a run (as the action would) by changing the manifest the server returns.
    const report = manifest.projects[0].reports[0];
    manifest = structuredClone(manifest);
    manifest.generatedAt = new Date(Date.now() + 60_000).toISOString();
    manifest.projects[0].reports[0].runs.unshift({ ...report.runs[0], id: "999", label: "#999", createdAt: new Date().toISOString() });
    await page.clock.fastForward("02:05");
    await expect(page.locator(".toast")).toContainText("New results were published");
    await expect(page.locator(".page-head p")).toContainText("37 runs");
  });

  test("large manifest (30 projects × 6 reports × 200 runs) stays responsive", async ({ page }) => {
    const manifest = bigManifest(30, 6, 200);
    await page.route("**/data/manifest.json", (route) => route.fulfill({ json: manifest }));
    const timings: Record<string, number> = {};
    const time = async (name: string, fn: () => Promise<void>) => {
      const t0 = Date.now();
      await fn();
      timings[name] = Date.now() - t0;
    };

    await time("dashboard", async () => {
      await page.goto("#/");
      await expect(page.locator(".project-card")).toHaveCount(30);
    });
    await time("project page", async () => {
      await page.locator(".sb-item", { hasText: "Project 07" }).click();
      await expect(page.locator(".report-section")).toHaveCount(6);
      await expect(page.locator(".chart-svg").first()).toBeVisible();
    });
    await time("project page, all runs", async () => {
      await page.getByLabel("Range").selectOption("all");
      await expect(page.locator(".report-section .chart-svg").first()).toBeVisible();
    });
    await time("activity", async () => {
      await page.goto("#/activity");
      await expect(page.locator(".page-head p")).toHaveText("36000 of 36000 runs");
    });
    await time("palette search", async () => {
      await page.keyboard.press("ControlOrMeta+k");
      await expect(page.getByPlaceholder(/Jump to a project/)).toBeFocused();
      await page.getByPlaceholder(/Jump to a project/).fill("project 29 report 4 #1195");
      await expect(page.locator(".palette-item").first()).toContainText("Project 29 / Report 4 #1195");
    });
    test.info().annotations.push({ type: "timings (ms)", description: JSON.stringify(timings) });
    console.log(`[${test.info().project.name}] large-manifest timings (ms):`, timings);
    for (const [name, ms] of Object.entries(timings)) expect(ms, name).toBeLessThan(8000);
  });
});
