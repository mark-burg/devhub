import { expect, test } from "@playwright/test";
import { trackErrors } from "./helpers";

test.describe("shell", () => {
  test("dashboard summarises projects and failing reports", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("#/");
    await expect(page.locator(".project-card")).toHaveCount(2);
    await expect(page.locator(".page-head p")).toContainText("2 projects · 3 reports");
    await expect(page.locator(".tile").first()).toContainText("Pass rate");
    await expect(page.locator(".list-row")).toContainText(["Shop Web / E2E tests"]);
    await expect(page.locator(".channel-row .spark")).toHaveCount(3);
    await page.getByRole("link", { name: "All activity" }).click();
    await expect(page).toHaveURL(/#\/activity$/);
    expect(errors).toEqual([]);
  });

  test("sidebar marks the active item and remembers collapsed projects", async ({ page }) => {
    await page.goto("#/r/shop-web/coverage");
    await expect(page.locator(".sb-item.active")).toHaveText(/Unit coverage/);
    await expect(page.locator(".sb-item", { hasText: "Unit coverage" })).toContainText("%");
    await page.getByRole("button", { name: "Toggle Shop API" }).click();
    await expect(page.locator(".sb-item", { hasText: "Integration tests" })).toBeHidden();
    await page.reload();
    await expect(page.locator(".sb-item", { hasText: "Integration tests" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Toggle Shop API" })).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Toggle Shop API" }).click();
    await expect(page.locator(".sb-item", { hasText: "Integration tests" })).toBeVisible();
  });

  test("theme cycles auto → light → dark and is stored the way Allure reads it", async ({ page }) => {
    await page.goto("#/");
    const html = page.locator("html");
    const btn = page.locator("button[title^='Theme:']");
    await expect(html).not.toHaveAttribute("data-theme", /./);
    await btn.click();
    await expect(html).toHaveAttribute("data-theme", "light");
    await btn.click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await btn.click();
    await expect(html).not.toHaveAttribute("data-theme", /./);
  });

  test("command palette: open with / or ⌘K, filter, arrow keys, Enter", async ({ page }) => {
    await page.goto("#/");
    await page.keyboard.press("/");
    const input = page.getByPlaceholder(/Jump to a project/);
    await expect(input).toBeFocused();
    await input.fill("shop api");
    const items = page.locator(".palette-item");
    await expect(items.first()).toContainText("Shop API");
    const count = await items.count();
    expect(count).toBeGreaterThan(1);
    await page.keyboard.press("ArrowDown");
    await expect(items.nth(1)).toHaveClass(/selected/);
    await page.keyboard.press("ArrowUp");
    await expect(items.nth(0)).toHaveClass(/selected/);
    await page.keyboard.press("Enter");
    await expect(page.locator("dialog.palette")).not.toHaveAttribute("open", "");
    await expect(page).toHaveURL(/#\/p\/shop-api$/);

    await page.keyboard.press("ControlOrMeta+k");
    await input.fill("zzzz-no-match");
    await expect(page.locator(".palette-empty")).toHaveText("No matches");
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog.palette")).not.toHaveAttribute("open", "");
  });

  test("palette finds a run by commit sha", async ({ page }) => {
    await page.goto("#/");
    const sha: string = await page.evaluate(async () =>
      (await (await fetch("data/manifest.json")).json()).projects[0].reports[0].runs[2].git.commit.slice(0, 7));
    await page.keyboard.press("ControlOrMeta+k");
    const input = page.getByPlaceholder(/Jump to a project/);
    await expect(input).toBeFocused();
    await input.fill(sha);
    await expect(page.locator(".palette-item.selected .palette-label")).toContainText("#");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/r\/[^/]+\/[^/]+\/\d+$/);
  });

  test("unknown routes show a way back", async ({ page }) => {
    await page.goto("#/p/does-not-exist");
    await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();
    await page.getByRole("link", { name: "Go to the dashboard" }).click();
    await expect(page.locator(".project-card")).toHaveCount(2);
    await page.goto("#/r/shop-web/e2e/9999");
    await expect(page.getByRole("heading", { name: "Run not found" })).toBeVisible();
  });

  test("? shows the keyboard help", async ({ page }) => {
    await page.goto("#/");
    await page.locator("body").press("?");
    await expect(page.locator(".toast")).toContainText("search");
  });

  test.describe("mobile", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("drawer opens, navigates and closes; nothing overflows", async ({ page }) => {
      await page.goto("#/");
      await expect(page.locator(".sidebar")).not.toBeInViewport();
      await page.getByRole("button", { name: "Open navigation" }).click();
      await expect(page.locator(".sidebar")).toBeInViewport();
      await page.locator(".sb-item", { hasText: "Activity" }).click();
      await expect(page).toHaveURL(/#\/activity/);
      await expect(page.locator(".app")).not.toHaveClass(/nav-open/);
      for (const route of ["#/", "#/p/shop-web", "#/activity", "#/r/shop-web/e2e", "#/page/publishing"]) {
        await page.goto(route);
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(0);
      }
    });
  });
});
