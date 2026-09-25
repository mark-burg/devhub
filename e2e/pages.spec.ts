import { expect, test } from "@playwright/test";
import { addPage, serveText, withConfig } from "./helpers";

const FIXTURE_MD = `# Fixture page

Jump to the [target section](#target-section), or read [how it works](how-it-works.md).

![logo](../favicon.svg)

| A | B |
|---|---|
| 1 | 2 |

\`\`\`js
const answer = 42;
\`\`\`

\`\`\`mermaid
flowchart LR
  A[Start] --> B[Finish]
\`\`\`

<script>window.__xss = true</script>
<img src="x" onerror="window.__xss = true">

## Filler one
${"Lorem ipsum dolor sit amet. ".repeat(120)}

## Filler two
${"Lorem ipsum dolor sit amet. ".repeat(120)}

## Target section
You made it.
`;

test.describe("markdown pages", () => {
  test("renders GFM, highlights code, draws mermaid, sanitizes, resolves links", async ({ page }) => {
    await addPage(page, { id: "fixture", title: "Fixture", type: "markdown", src: "docs/fixture.md" });
    await serveText(page, "**/docs/fixture.md", FIXTURE_MD, "text/markdown");
    await page.goto("#/page/fixture");
    const md = page.locator("article.md");
    await expect(md.getByRole("heading", { name: "Fixture page" })).toBeVisible();
    await expect(md.locator(".table-wrap table")).toHaveCount(1);
    await expect(md.locator("code.hljs .hljs-keyword").first()).toHaveText("const");
    await expect(md.locator(".mermaid svg")).toHaveCount(1);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    await expect(md.locator("script")).toHaveCount(0);
    // Links to other configured pages stay inside the hub; images resolve relative to the file.
    await expect(md.getByRole("link", { name: "how it works" })).toHaveAttribute("href", "#/page/how-it-works");
    await expect(md.getByRole("img", { name: "logo" })).toHaveAttribute("src", /\/devhub\/favicon\.svg$/);
  });

  test("in-page anchors and the table of contents scroll without changing the route", async ({ page }) => {
    await addPage(page, { id: "fixture", title: "Fixture", type: "markdown", src: "docs/fixture.md" });
    await serveText(page, "**/docs/fixture.md", FIXTURE_MD, "text/markdown");
    await page.goto("#/page/fixture");
    const target = page.locator("#target-section");
    await expect(target).not.toBeInViewport();
    await page.locator("article.md").getByRole("link", { name: "target section" }).click();
    await expect(target).toBeInViewport();
    await expect(page).toHaveURL(/#\/page\/fixture$/);

    await page.locator("main.view").evaluate((el) => el.scrollTo(0, 0));
    await expect(target).not.toBeInViewport();
    await page.locator(".toc").getByRole("link", { name: "Target section" }).click();
    await expect(target).toBeInViewport();
    await expect(page).toHaveURL(/#\/page\/fixture$/);
  });

  test("mermaid redraws when the theme changes", async ({ page }) => {
    await page.goto("#/page/how-it-works");
    const first = page.locator(".mermaid svg").first();
    await expect(first).toBeVisible({ timeout: 20_000 });
    await first.evaluate((el) => el.setAttribute("data-old", "1"));
    await page.locator("button[title^='Theme:']").click(); // light (same as the page default here)
    await page.locator("button[title^='Theme:']").click(); // dark
    await expect(page.locator(".mermaid svg").first()).not.toHaveAttribute("data-old", "1", { timeout: 15_000 });
    await expect(page.locator(".mermaid svg").first()).toBeVisible();
  });

  test("a missing page source shows an error instead of a blank page", async ({ page }) => {
    await addPage(page, { id: "missing", title: "Missing", type: "markdown", src: "docs/nope.md" });
    await page.goto("#/page/missing");
    await expect(page.getByText("Could not render this page")).toBeVisible();
    await expect(page.locator(".error-box")).toContainText("404");
  });
});

test.describe("tool pages", () => {
  for (const renderer of ["swagger", "redoc", "scalar"] as const) {
    test(`OpenAPI renders with ${renderer}`, async ({ page }) => {
      await addPage(page, { id: `api-${renderer}`, title: `API ${renderer}`, type: "openapi", src: "docs/examples/openapi.json", renderer });
      await page.goto(`#/page/api-${renderer}`);
      const doc = page.frameLocator("iframe.viewer-frame");
      await expect(doc.getByText("Shop API").first()).toBeVisible({ timeout: 30_000 });
      await expect(doc.getByText(/Search products/).filter({ visible: true }).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".viewer-bar .tag")).toHaveText(renderer);
    });
  }

  test("benchmarks: one chart per benchmark, tooltips, suite switching", async ({ page }) => {
    await page.goto("#/page/benchmarks");
    await expect(page.locator(".chart-card")).toHaveCount(4);
    await expect(page.locator(".chart-card figcaption").first()).toContainText("ops/sec");
    const chart = page.locator(".chart-svg").first();
    const box = (await chart.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
    await expect(page.locator(".chart-tip")).toContainText("Click to open");
  });

  test("benchmarks: generic series format and suite switching", async ({ page }) => {
    const series = (name: string, y: number) => ({ name, unit: "ms", points: [{ x: "v1", y: 120 }, { x: "v2", y: 95 }, { x: "v3", y }] });
    const suites = {
      entries: {
        API: [{ commit: { id: "aaaaaaa1", message: "one" }, date: 1, benches: [{ name: "GET /users", value: 12, unit: "ms" }] },
              { commit: { id: "aaaaaaa2", message: "two" }, date: 2, benches: [{ name: "GET /users", value: 10, unit: "ms" }] }],
        UI: [{ commit: { id: "bbbbbbb1", message: "one" }, date: 1, benches: [{ name: "render", value: 5, unit: "ms" }, { name: "hydrate", value: 9, unit: "ms" }] }],
      },
    };
    await withConfig(page, (config) => {
      config.nav.push({ group: "Test", items: [
        { id: "generic", title: "Generic", type: "benchmark", src: "docs/generic.json" },
        { id: "suites", title: "Suites", type: "benchmark", src: "docs/suites.js" },
      ] });
    });
    await serveText(page, "**/docs/generic.json", JSON.stringify({ name: "Load", series: [series("p95 latency", 101)] }), "application/json");
    await serveText(page, "**/docs/suites.js", `window.BENCHMARK_DATA = ${JSON.stringify(suites)};`, "text/javascript");

    await page.goto("#/page/generic");
    await expect(page.locator(".chart-card")).toHaveCount(1);
    await expect(page.locator(".figure-value")).toHaveText("101 ms");

    await page.goto("#/page/suites");
    await expect(page.locator(".chart-card")).toHaveCount(1);
    await page.getByLabel("Suite").selectOption("UI");
    await expect(page).toHaveURL(/suite=UI/);
    await expect(page.locator(".chart-card")).toHaveCount(2);
  });

  test("benchmarks: malformed data shows an error", async ({ page }) => {
    await addPage(page, { id: "badbench", title: "Bad", type: "benchmark", src: "docs/bad.js" });
    await serveText(page, "**/docs/bad.js", "window.BENCHMARK_DATA = {not json");
    await page.goto("#/page/badbench");
    await expect(page.getByText("Could not load benchmark data")).toBeVisible();
  });

  test("vega renders from data/runs.json and redraws on theme change", async ({ page }) => {
    await page.goto("#/page/suite-duration");
    const target = page.locator(".vega-target");
    await expect(target.locator("svg, canvas").first()).toBeVisible({ timeout: 20_000 });
    await target.locator("svg, canvas").first().evaluate((el) => el.setAttribute("data-old", "1"));
    await page.locator("button[title^='Theme:']").click();
    await page.locator("button[title^='Theme:']").click();
    // A fresh view replaces the old one when the theme flips.
    await expect(target.locator("[data-old]")).toHaveCount(0, { timeout: 15_000 });
    await expect(target.locator("svg, canvas").first()).toBeVisible();
  });

  test("vega: an invalid spec shows an error", async ({ page }) => {
    await addPage(page, { id: "badvega", title: "Bad vega", type: "vega", src: "docs/bad.vl.json" });
    await serveText(page, "**/docs/bad.vl.json", "{ this is not json", "application/json");
    await page.goto("#/page/badvega");
    await expect(page.getByText("Could not render this chart")).toBeVisible();
  });

  test("embed pages frame any URL; link items open in a new tab", async ({ page }) => {
    await addPage(page, { id: "embedded", title: "Embedded", type: "embed", src: "reports/shop-web/coverage/latest/" });
    await page.goto("#/page/embedded");
    await expect(page.frameLocator("iframe.viewer-frame").getByRole("heading", { name: "All files" })).toBeVisible();
    const link = page.locator(".sb-item", { hasText: "Allure 3 docs" });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener");
  });

  test("unknown page types are reported", async ({ page }) => {
    await addPage(page, { id: "weird", title: "Weird", type: "hologram", src: "x" });
    await page.goto("#/page/weird");
    await expect(page.getByText("Unknown page type “hologram”")).toBeVisible();
  });
});
