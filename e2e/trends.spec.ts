import { expect, test } from "@playwright/test";

test.describe("project trends", () => {
  test("branch filter scopes the charts and runs table, via the URL", async ({ page }) => {
    await page.goto("#/p/shop-web");
    const e2e = page.locator("#report-e2e");
    await expect(e2e.locator(".table tbody tr")).toHaveCount(10);
    await page.getByLabel("Branch", { exact: true }).selectOption("feature/checkout-v2");
    await expect(page).toHaveURL(/branch=feature%2Fcheckout-v2/);
    const rows = e2e.locator(".table tbody tr");
    await expect(rows).toHaveCount(2);
    for (const branch of await rows.locator(".branch").allTextContents()) expect(branch).toBe("feature/checkout-v2");
    await expect(e2e.locator(".chart-svg").first().locator(".marks path")).not.toHaveCount(0);

    await page.reload();
    await expect(page.getByLabel("Branch", { exact: true })).toHaveValue("feature/checkout-v2");
    await page.getByLabel("Branch", { exact: true }).selectOption("");
    await expect(page).not.toHaveURL(/branch=/);
  });

  test("range filter and Show all", async ({ page }) => {
    await page.goto("#/p/shop-web");
    const e2e = page.locator("#report-e2e");
    await page.getByLabel("Range").selectOption("10");
    await expect(page).toHaveURL(/n=10/);
    await expect(e2e.locator(".table tbody tr")).toHaveCount(10);
    await expect(e2e.getByRole("button", { name: /Show all/ })).toHaveCount(0);

    await page.getByLabel("Range").selectOption("all");
    await expect(e2e.locator(".table tbody tr")).toHaveCount(10);
    await e2e.getByRole("button", { name: "Show all 12 runs" }).click();
    await expect(e2e.locator(".table tbody tr")).toHaveCount(12);
    await expect(e2e.locator(".table tbody tr.is-pruned")).toHaveCount(2);
  });

  test("chart hover shows every series; keyboard moves and Enter opens the run", async ({ page }) => {
    await page.goto("#/p/shop-web");
    const chart = page.locator("#report-e2e .chart-svg").first();
    const box = (await chart.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.95, box.y + box.height / 2);
    const tip = page.locator("#report-e2e .chart-tip");
    await expect(tip).toContainText("Passed");
    await expect(tip).toContainText("#151");
    await expect(page.locator("#report-e2e .hover-band")).toHaveCount(1);
    await page.mouse.move(0, 0);
    await expect(tip).toHaveCount(0);

    const duration = page.locator("#report-e2e .chart-svg").nth(1);
    await duration.focus();
    await expect(tip).toContainText("#151");
    await page.keyboard.press("ArrowLeft");
    await expect(tip).toContainText("#150");
    await expect(page.locator("#report-e2e .crosshair")).toHaveCount(1);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/r\/shop-web\/e2e\/150$/);
  });

  test("clicking an archived run's column does not navigate", async ({ page }) => {
    await page.goto("#/p/shop-web?n=all");
    const chart = page.locator("#report-e2e .chart-svg").first();
    const box = (await chart.boundingBox())!;
    // Leftmost column = oldest run (#140), whose report files were pruned.
    await page.mouse.click(box.x + 60, box.y + box.height / 2);
    await expect(page).toHaveURL(/#\/p\/shop-web/);
  });

  test("metric reports get one chart per metric with deltas", async ({ page }) => {
    await page.goto("#/p/shop-web");
    const cov = page.locator("#report-coverage");
    await expect(cov.locator("figcaption")).toContainText(["Coverage", "Branch coverage", "Function coverage", "Statement coverage", "Bundle size"]);
    await expect(cov.locator("figcaption").filter({ hasText: "Bundle size" })).toContainText("kB");
    await expect(cov.locator(".delta.good").first()).toBeVisible();
  });

  test("activity filters combine", async ({ page }) => {
    await page.goto("#/activity");
    const rows = page.locator(".table tbody tr");
    await expect(page.locator(".page-head p")).toHaveText("36 of 36 runs");
    await page.getByLabel("Project", { exact: true }).selectOption("shop-web");
    await page.getByLabel("Status", { exact: true }).selectOption("failed");
    await expect(page).toHaveURL(/project=shop-web/);
    await expect(page).toHaveURL(/status=failed/);
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    for (const pill of await rows.locator(".pill").allTextContents()) expect(pill).toBe("Failed");
    await page.getByLabel("Branch", { exact: true }).selectOption("feature/checkout-v2");
    await expect(rows).toHaveCount(2);
    await page.getByLabel("Project", { exact: true }).selectOption("shop-api");
    await expect(page.getByRole("heading", { name: "No runs match these filters" })).toBeVisible();
  });
});
