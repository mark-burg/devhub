import { expect, test } from "@playwright/test";

const frame = (page: import("@playwright/test").Page) => page.frameLocator("iframe.viewer-frame");

test.describe("report viewer", () => {
  test("loads the Allure report and navigates runs with buttons, select and [ ]", async ({ page }) => {
    await page.goto("#/r/shop-web/e2e");
    await expect(frame(page).getByText("Web E2E").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".crumbs")).toContainText("#151");

    const crumb = page.locator(".crumb.current");
    await page.getByTitle(/Older run #150/).click();
    await expect(page).toHaveURL(/\/e2e\/150$/);
    await expect(crumb).toHaveText("#150");
    await page.locator(".topbar").click({ position: { x: 600, y: 20 } });
    await page.keyboard.press("[");
    await expect(crumb).toHaveText("#149");
    await expect(page).toHaveURL(/\/e2e\/149$/);
    await page.keyboard.press("]");
    await expect(crumb).toHaveText("#150");
    await expect(page).toHaveURL(/\/e2e\/150$/);

    const select = page.getByLabel("Run", { exact: true });
    await select.selectOption("145");
    await expect(page).toHaveURL(/\/e2e\/145$/);
    // Archived runs can't be picked.
    await expect(select.locator("option[value='140']")).toBeDisabled();
  });

  test("focus mode hides the chrome and Esc restores it", async ({ page }) => {
    await page.goto("#/r/shop-web/e2e");
    await page.getByTitle("Focus mode (f)").click();
    await expect(page.locator(".sidebar")).toBeHidden();
    await expect(page.locator(".topbar")).toBeHidden();
    await page.locator(".viewer-bar").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Escape");
    await expect(page.locator(".sidebar")).toBeVisible();
    await page.keyboard.press("f");
    await expect(page.locator(".app")).toHaveClass(/focus/);
    await page.keyboard.press("f");
    await expect(page.locator(".app")).not.toHaveClass(/focus/);
  });

  test("the report's inner location is mirrored into ?at= and deep links reopen it", async ({ page, context }) => {
    await page.goto("#/r/shop-web/e2e/151");
    await frame(page).getByText("Guest checkout completes").nth(1).click({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/e2e\/151\?at=[0-9a-f]{32}$/);
    const link = page.url();

    const second = await context.newPage();
    await second.goto(link);
    await expect(frame(second).getByRole("heading", { name: "Guest checkout completes" })).toBeVisible({ timeout: 20_000 });
  });

  test("copy link includes the inner location", async ({ page, browserName }) => {
    await page.goto("#/r/shop-web/e2e/151");
    await frame(page).getByText("Cart").first().click({ timeout: 20_000 });
    await page.getByTitle("Copy link to this run").click();
    await expect(page.locator(".toast")).toContainText(/Link copied|Could not copy/);
    if (browserName === "chromium") {
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      expect(copied).toContain("#/r/shop-web/e2e/151");
    }
  });

  test("⌘K works while focus is inside the report", async ({ page }) => {
    await page.goto("#/r/shop-web/e2e");
    const search = frame(page).getByPlaceholder("Search tests");
    await search.click({ timeout: 20_000 });
    await search.press("ControlOrMeta+k");
    await expect(page.getByPlaceholder(/Jump to a project/)).toBeFocused();
  });

  test("theme changes reach the embedded report", async ({ page }) => {
    await page.goto("#/r/shop-web/e2e");
    await expect(frame(page).getByText("Web E2E").first()).toBeVisible({ timeout: 20_000 });
    const btn = page.locator("button[title^='Theme:']");
    await btn.click(); // light
    await expect(frame(page).locator("html")).toHaveAttribute("data-theme", "light");
    await btn.click(); // dark
    await expect(frame(page).locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(frame(page).locator("html")).toHaveAttribute("data-theme", "dark", { timeout: 20_000 });
  });

  test("archived runs explain themselves and link onwards", async ({ page }) => {
    await page.goto("#/r/shop-web/e2e/140");
    await expect(page.getByRole("heading", { name: "This run was archived" })).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.getByRole("link", { name: "Open latest run" }).click();
    await expect(frame(page).getByText("Web E2E").first()).toBeVisible({ timeout: 20_000 });
  });

  test("coverage report and its latest/ redirect", async ({ page }) => {
    await page.goto("#/r/shop-web/coverage");
    await expect(frame(page).getByRole("heading", { name: "All files" })).toBeVisible();
    await page.goto("reports/shop-web/e2e/latest/");
    await expect(page).toHaveURL(/reports\/shop-web\/e2e\/151\/$/);
  });
});
