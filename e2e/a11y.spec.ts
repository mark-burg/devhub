import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Accessibility scan of the hub's own UI (embedded reports and third-party renderers are
// excluded — they are separate apps). Serious and critical violations fail the test.
const VIEWS = ["#/", "#/p/shop-web", "#/activity", "#/r/shop-web/e2e", "#/page/publishing", "#/page/benchmarks"];

for (const theme of ["light", "dark"] as const) {
  test.describe(`accessibility (${theme})`, () => {
    test.use({ colorScheme: theme });

    for (const route of VIEWS) {
      test(route, async ({ page }) => {
        await page.goto(route);
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(500);
        const results = await new AxeBuilder({ page })
          .exclude("iframe")
          .exclude(".mermaid")
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        const summary = serious.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}${v.nodes.length > 3 ? ` +${v.nodes.length - 3}` : ""}`);
        expect(summary, summary.join("\n")).toEqual([]);
      });
    }

    test("command palette", async ({ page }) => {
      await page.goto("#/");
      await page.keyboard.press("ControlOrMeta+k");
      await page.keyboard.type("shop");
      const results = await new AxeBuilder({ page }).include("dialog.palette").withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  });
}
