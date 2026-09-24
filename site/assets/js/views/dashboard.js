import { h, icon, fmtNumber, fmtPct, fmtRelative, fmtDate, statusPill, typeIcon } from "../util.js";
import { store, allRuns, headline, headlineSeries, latestRun, passRate, runStatus } from "../store.js";
import { routes } from "../router.js";
import { sparkline } from "../charts.js";
import { button, delta, emptyState, pageHeader, runsTable, statsInline, tile } from "../components.js";

export function dashboardView() {
  const hubTitle = store.config.title ?? "Dev Hub";
  if (!store.projects.length) return { title: "Dashboard", crumbs: [{ label: "Dashboard" }], el: onboarding(hubTitle) };

  const channels = store.projects.flatMap((project) =>
    project.reports.map((report) => ({ project, report, run: latestRun(report) })));
  const testChannels = channels.filter((c) => c.run?.stats);
  const failing = channels.filter((c) => ["failed", "broken"].includes(runStatus(c.run)));
  const runs = allRuns();

  const aggregate = (list) => {
    let passed = 0, executed = 0;
    for (const r of list) {
      if (!r?.stats) continue;
      passed += r.stats.passed ?? 0;
      executed += (r.stats.total ?? 0) - (r.stats.skipped ?? 0);
    }
    return executed ? (100 * passed) / executed : null;
  };
  const previous = (c) => c.report.runs[c.report.runs.indexOf(c.run) + 1];
  const rateNow = aggregate(testChannels.map((c) => c.run));
  const ratePrev = aggregate(testChannels.map(previous));
  const testsNow = testChannels.reduce((n, c) => n + (c.run.stats.total ?? 0), 0);
  const testsPrev = testChannels.reduce((n, c) => n + (previous(c)?.stats?.total ?? c.run.stats.total ?? 0), 0);

  const DAY = 86400000;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const perDay = Array.from({ length: 14 }, (_, i) => {
    const start = today.getTime() - (13 - i) * DAY;
    return runs.filter((x) => { const t = Date.parse(x.run.createdAt); return t >= start && t < start + DAY; }).length;
  });
  const week = perDay.slice(7).reduce((a, b) => a + b, 0);
  const lastWeek = perDay.slice(0, 7).reduce((a, b) => a + b, 0);

  const kpis = h("section", { class: "kpis", "aria-label": "Summary" },
    tile({
      label: "Pass rate", iconName: "status-passed",
      value: fmtPct(rateNow),
      deltaEl: delta(rateNow, ratePrev, { unit: " pts" }),
      sub: `Latest run of ${testChannels.length} test report${testChannels.length === 1 ? "" : "s"} · passed ÷ executed`,
    }),
    tile({
      label: "Tests", iconName: "flask", value: fmtNumber(testsNow),
      deltaEl: delta(testsNow, testsPrev, { better: "neutral", digits: 0 }),
      sub: "Across the latest runs",
    }),
    tile({
      label: "Failing reports", iconName: failing.length ? "status-failed" : "status-passed",
      tone: failing.length ? "bad" : "good",
      value: String(failing.length),
      sub: failing.length ? "Latest run has failed or broken tests" : "Everything is green",
    }),
    tile({
      label: "Runs this week", iconName: "activity", value: String(week),
      spark: sparkline(perDay, { width: 104, height: 30, label: "Runs per day, last 14 days", min: 0 }),
      deltaEl: delta(week, lastWeek, { better: "neutral", digits: 0, suffix: "vs last week" }),
      sub: "Published runs per day, last 14 days",
    }),
  );

  const attention = failing.length
    ? h("section", { class: "section" },
        h("h2", { class: "section-title" }, icon("alert"), "Needs attention"),
        h("div", { class: "card list" }, failing.map(({ project, report, run }) =>
          h("a", { class: "list-row", href: routes.report(project.id, report.id, run.id) },
            statusPill(runStatus(run)),
            h("span", { class: "list-main" }, h("strong", null, `${project.title} / ${report.title}`), h("span", { class: "subtle" }, ` ${run.label}`)),
            statsInline(run.stats),
            h("span", { class: "list-side subtle" }, run.git?.branch ? h("span", { class: "mono" }, run.git.branch) : null,
              h("time", { datetime: run.createdAt, title: fmtDate(run.createdAt) }, fmtRelative(run.createdAt))),
            icon("chevron-right", "muted")))))
    : null;

  const cards = h("section", { class: "section" },
    h("h2", { class: "section-title" }, icon("folder"), "Projects"),
    h("div", { class: "project-grid" }, store.projects.map(projectCard)));

  const recent = h("section", { class: "section" },
    h("div", { class: "section-title-row" },
      h("h2", { class: "section-title" }, icon("activity"), "Recent activity"),
      button("All activity", { href: routes.activity(), iconName: "chevron-right", trailing: true })),
    h("div", { class: "card" }, runsTable(runs, { showReport: true, limit: 8 })));

  const updated = store.generatedAt ? `Updated ${fmtRelative(store.generatedAt)}` : "";
  return {
    title: "Dashboard",
    crumbs: [{ label: "Dashboard" }],
    el: h("div", { class: "page" },
      pageHeader(hubTitle, [store.config.tagline, `${store.projects.length} projects · ${channels.length} reports · ${runs.length} runs`, updated].filter(Boolean).join(" · ")),
      kpis, attention, cards, recent),
  };
}

function projectCard(project) {
  return h("article", { class: "card project-card" },
    h("a", { class: "project-card-head", href: routes.project(project.id) },
      h("div", null, h("h3", null, project.title), project.description ? h("p", { class: "subtle" }, project.description) : null),
      icon("chevron-right", "muted")),
    h("div", { class: "channel-list" }, project.reports.map((report) => {
      const run = latestRun(report);
      const head = headline(report, run);
      const series = headlineSeries(report, report.runs.slice(0, 12).reverse());
      return h("a", { class: "channel-row", href: routes.report(project.id, report.id) },
        h("span", { class: "channel-name" }, icon(typeIcon(report.type)), h("span", null, report.title)),
        statusPill(runStatus(run)),
        series && series.filter((v) => v != null).length > 1
          ? sparkline(series, { width: 72, height: 22, label: `${head.info.title} trend`, min: head.info.min, max: head.info.max })
          : h("span", { class: "spark-placeholder" }),
        h("span", { class: "channel-value", title: head?.info.title ?? "" }, head ? head.info.format(head.value) : ""),
        h("time", { class: "channel-time subtle", datetime: run?.createdAt, title: fmtDate(run?.createdAt) }, run ? fmtRelative(run.createdAt) : "—"));
    })));
}

function onboarding(title) {
  const guide = store.pages.find((p) => p.type === "markdown");
  return h("div", { class: "page" },
    pageHeader(title, store.config.tagline ?? "Test reports, coverage and developer docs in one place"),
    emptyState("No reports published yet",
      h("div", { class: "onboard" },
        h("p", null, store.hasManifest
          ? "The hub is deployed but nothing has been published to it."
          : "data/manifest.json was not found — publish a report to create it."),
        h("ol", null,
          h("li", null, "Run your tests with an Allure reporter so they write ", h("code", null, "allure-results/"), "."),
          h("li", null, "Add the devhub action to that workflow (see the publishing guide)."),
          h("li", null, "Or try it locally: ", h("code", null, "npm run demo"), " then ", h("code", null, "npm run serve"), "."))),
      guide ? button("Open the publishing guide", { href: routes.page(guide.id), iconName: "book", variant: "primary" }) : null));
}
