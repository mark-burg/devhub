import type { Hub, Project } from "../types";
import {
  aggregatePassRate, allRuns, headline, headlineSeries, isFailing, latestRun, previousRun, runStatus,
} from "../selectors";
import { fmtDate, fmtNumber, fmtPct, fmtRelative } from "../lib/format";
import { routes } from "../router";
import { Sparkline } from "../charts/Sparkline";
import { Icon, typeIcon } from "../components/Icon";
import { StatusPill } from "../components/status";
import { Delta, StatsInline, Tile } from "../components/metrics";
import { RunsTable } from "../components/RunsTable";
import { Button, EmptyState, Page, PageHeader } from "../components/ui";

const DAY = 86_400_000;

export function Dashboard({ hub }: { hub: Hub }) {
  const title = hub.config.title ?? "Dev Hub";
  if (!hub.projects.length) return <Onboarding hub={hub} title={title} />;

  const channels = hub.projects.flatMap((project) => project.reports.map((report) => ({ project, report, run: latestRun(report) })));
  const testChannels = channels.filter((c) => c.run?.stats);
  const failing = channels.filter((c) => isFailing(c.run));
  const runs = allRuns(hub);

  const rateNow = aggregatePassRate(testChannels.map((c) => c.run));
  const ratePrev = aggregatePassRate(testChannels.map((c) => previousRun(c.report, c.run)));
  const testsNow = testChannels.reduce((n, c) => n + (c.run?.stats?.total ?? 0), 0);
  const testsPrev = testChannels.reduce((n, c) => n + (previousRun(c.report, c.run)?.stats?.total ?? c.run?.stats?.total ?? 0), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const perDay = Array.from({ length: 14 }, (_, i) => {
    const start = today.getTime() - (13 - i) * DAY;
    return runs.filter((x) => { const t = Date.parse(x.run.createdAt); return t >= start && t < start + DAY; }).length;
  });
  const week = perDay.slice(7).reduce((a, b) => a + b, 0);
  const lastWeek = perDay.slice(0, 7).reduce((a, b) => a + b, 0);

  const subtitle = [
    hub.config.tagline,
    `${hub.projects.length} projects · ${channels.length} reports · ${runs.length} runs`,
    hub.generatedAt ? `Updated ${fmtRelative(hub.generatedAt)}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <Page>
      <PageHeader title={title} subtitle={subtitle} />

      <section class="kpis" aria-label="Summary">
        <Tile label="Pass rate" icon="status-passed" value={fmtPct(rateNow)}
          delta={<Delta curr={rateNow} prev={ratePrev} unit=" pts" />}
          sub={`Latest run of ${testChannels.length} test report${testChannels.length === 1 ? "" : "s"} · passed ÷ executed`} />
        <Tile label="Tests" icon="flask" value={fmtNumber(testsNow)}
          delta={<Delta curr={testsNow} prev={testsPrev} better="neutral" digits={0} />}
          sub="Across the latest runs" />
        <Tile label="Failing reports" icon={failing.length ? "status-failed" : "status-passed"} tone={failing.length ? "bad" : "good"}
          value={String(failing.length)} sub={failing.length ? "Latest run has failed or broken tests" : "Everything is green"} />
        <Tile label="Runs this week" icon="activity" value={String(week)}
          spark={<Sparkline values={perDay} width={104} height={30} label="Runs per day, last 14 days" min={0} />}
          delta={<Delta curr={week} prev={lastWeek} better="neutral" digits={0} suffix="vs last week" />}
          sub="Published runs per day, last 14 days" />
      </section>

      {failing.length ? (
        <section class="section">
          <h2 class="section-title"><Icon name="alert" />Needs attention</h2>
          <div class="card list">
            {failing.map(({ project, report, run }) => run && (
              <a key={`${project.id}/${report.id}`} class="list-row" href={routes.report(project.id, report.id, run.id)}>
                <StatusPill status={runStatus(run)} />
                <span class="list-main"><strong>{project.title} / {report.title}</strong><span class="subtle"> {run.label}</span></span>
                <StatsInline stats={run.stats} />
                <span class="list-side subtle">
                  {run.git?.branch ? <span class="mono">{run.git.branch}</span> : null}
                  <time dateTime={run.createdAt} title={fmtDate(run.createdAt)}>{fmtRelative(run.createdAt)}</time>
                </span>
                <Icon name="chevron-right" class="muted" />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section class="section">
        <h2 class="section-title"><Icon name="folder" />Projects</h2>
        <div class="project-grid">{hub.projects.map((p) => <ProjectCard key={p.id} project={p} hub={hub} />)}</div>
      </section>

      <section class="section">
        <div class="section-title-row">
          <h2 class="section-title"><Icon name="activity" />Recent activity</h2>
          <Button href={routes.activity()} icon="chevron-right" trailing>All activity</Button>
        </div>
        <div class="card"><RunsTable rows={runs} showReport limit={8} expandable={false} /></div>
      </section>
    </Page>
  );
}

function ProjectCard({ project, hub }: { project: Project; hub: Hub }) {
  const metrics = hub.config.metrics;
  return (
    <article class="card project-card">
      <a class="project-card-head" href={routes.project(project.id)}>
        <div>
          <h3>{project.title}</h3>
          {project.description ? <p class="subtle">{project.description}</p> : null}
        </div>
        <Icon name="chevron-right" class="muted" />
      </a>
      <div class="channel-list">
        {project.reports.map((report) => {
          const run = latestRun(report);
          const head = headline(run, metrics);
          const series = headlineSeries(report.runs.slice(0, 12).reverse(), metrics);
          const hasTrend = !!head && !!series && series.filter((v) => v != null).length > 1;
          return (
            <a key={report.id} class="channel-row" href={routes.report(project.id, report.id)}>
              <span class="channel-name"><Icon name={typeIcon(report.type)} /><span>{report.title}</span></span>
              <StatusPill status={runStatus(run)} />
              {hasTrend
                ? <Sparkline values={series!} width={72} height={22} label={`${head!.info.title} trend`} min={head!.info.min} max={head!.info.max} />
                : <span class="spark-placeholder" />}
              <span class="channel-value" title={head?.info.title ?? ""}>{head ? head.info.format(head.value) : ""}</span>
              <time class="channel-time subtle" dateTime={run?.createdAt} title={fmtDate(run?.createdAt)}>{run ? fmtRelative(run.createdAt) : "—"}</time>
            </a>
          );
        })}
      </div>
    </article>
  );
}

function Onboarding({ hub, title }: { hub: Hub; title: string }) {
  const guide = hub.pages.find((p) => p.type === "markdown");
  return (
    <Page>
      <PageHeader title={title} subtitle={hub.config.tagline ?? "Test reports, coverage and developer docs in one place"} />
      <EmptyState
        title="No reports published yet"
        actions={guide ? <Button href={routes.page(guide.id)} icon="book" variant="primary">Open the publishing guide</Button> : null}
      >
        <div class="onboard">
          <p>{hub.hasManifest ? "The hub is deployed but nothing has been published to it." : "data/manifest.json was not found — publish a report to create it."}</p>
          <ol>
            <li>Run your tests with an Allure reporter so they write <code>allure-results/</code>.</li>
            <li>Add the devhub action to that workflow (see the publishing guide).</li>
            <li>Or try it locally: <code>npm run demo</code> then <code>npm run dev</code>.</li>
          </ol>
        </div>
      </EmptyState>
    </Page>
  );
}
