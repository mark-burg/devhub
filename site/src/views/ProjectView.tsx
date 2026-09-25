import type { Hub, Project, Report, Run } from "../types";
import { branchesOf, latestRun, metricInfo, metricKeys, passRate, reportKind, runStatus, failedCount } from "../selectors";
import { fmtDuration, fmtNumber, fmtPct } from "../lib/format";
import { go, routes } from "../router";
import { RunChart } from "../charts/RunChart";
import { statusSeries } from "../charts/statusSeries";
import { Icon, typeIcon } from "../components/Icon";
import { StatusPill } from "../components/status";
import { Delta, Tile } from "../components/metrics";
import { RunMeta } from "../components/RunMeta";
import { RunsTable } from "../components/RunsTable";
import { Button, EmptyState, Page, PageHeader, Select } from "../components/ui";

const RANGES = [["10", "Last 10 runs"], ["20", "Last 20 runs"], ["50", "Last 50 runs"], ["all", "All runs"]] as const;

export function ProjectView({ hub, project, query }: { hub: Hub; project: Project; query: URLSearchParams }) {
  const branch = query.get("branch") ?? "";
  const range = query.get("n") ?? "20";
  const setQuery = (patch: Record<string, string | null>) =>
    go(["p", project.id], { branch, n: range === "20" ? null : range, ...patch });

  const everyRun = project.reports.flatMap((r) => r.runs);
  return (
    <Page>
      <PageHeader
        title={project.title}
        subtitle={project.description || `${project.reports.length} report${project.reports.length === 1 ? "" : "s"} · ${everyRun.length} runs`}
      >
        {project.repo ? <Button href={project.repo} icon="external" external>Repository</Button> : null}
      </PageHeader>
      <div class="filters">
        <Select label="Branch" value={branch} onChange={(v) => setQuery({ branch: v || null })}
          options={[{ value: "", label: "All branches" }, ...branchesOf(everyRun).map((b) => ({ value: b, label: b }))]} />
        <Select label="Range" value={range} onChange={(v) => setQuery({ n: v === "20" ? null : v })}
          options={RANGES.map(([value, label]) => ({ value, label }))} />
      </div>
      {project.reports.map((report) => {
        let runs = report.runs.filter((r) => !branch || r.git?.branch === branch);
        if (range !== "all") runs = runs.slice(0, Number(range));
        return <ReportSection key={report.id} hub={hub} report={report} runs={runs} branch={branch} />;
      })}
    </Page>
  );
}

function ReportSection({ hub, report, runs, branch }: { hub: Hub; report: Report; runs: Run[]; branch: string }) {
  const project = report.project;
  const latest = runs[0];
  const chrono = [...runs].reverse();
  const labels = chrono.map((r) => r.label);
  const openRun = (i: number) => { const r = chrono[i]; if (r && !r.pruned) go(["r", project.id, report.id, r.id]); };
  const tipTitle = (i: number) => `${chrono[i].label} · ${new Date(chrono[i].createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
  const tipFoot = (i: number) => [chrono[i].git?.branch, chrono[i].git?.message].filter(Boolean).join(" · ");
  const chartProps = { labels, tipTitle, tipFoot, onSelect: openRun, isSelectable: (i: number) => !!chrono[i] && !chrono[i].pruned };

  const head = (
    <div class="report-head">
      <div class="report-title">
        <Icon name={typeIcon(report.type)} />
        <h2>{report.title}</h2>
        <span class="tag">{report.type}</span>
        {latest ? <StatusPill status={runStatus(latest)} /> : null}
      </div>
      {latestRun(report)?.path ? <Button href={routes.report(project.id, report.id)} icon="chevron-right" variant="primary" trailing>Open latest</Button> : null}
    </div>
  );

  if (!latest) {
    return (
      <section class="card report-section">
        {head}
        <EmptyState title="No runs match">{branch ? `No runs on branch “${branch}”.` : "Nothing published yet."}</EmptyState>
      </section>
    );
  }

  const prev = runs[1];
  const keys = metricKeys(runs);
  const metricCols = keys.slice(0, 4).map((k) => metricInfo(k, hub.config.metrics));

  return (
    <section class="card report-section" id={`report-${report.id}`}>
      {head}
      <div class="report-latest subtle">Latest <strong>{latest.label}</strong> · <RunMeta run={latest} /></div>

      {reportKind(report) === "tests" ? (
        <>
          <div class="kpis compact">
            <Tile label="Pass rate" value={fmtPct(passRate(latest))} delta={<Delta curr={passRate(latest)} prev={passRate(prev)} unit=" pts" />} />
            <Tile label="Tests" value={fmtNumber(latest.stats?.total)} delta={<Delta curr={latest.stats?.total} prev={prev?.stats?.total} better="neutral" digits={0} />} />
            <Tile label="Failed + broken" value={String(failedCount(latest))} tone={failedCount(latest) ? "bad" : null}
              delta={prev?.stats ? <Delta curr={failedCount(latest)} prev={failedCount(prev)} better="lower" digits={0} /> : null} />
            <Tile label="Duration" value={fmtDuration(latest.durationMs)} delta={<Delta curr={latest.durationMs} prev={prev?.durationMs} better="lower" unit="ms" />} />
          </div>
          <div class="chart-grid">
            <figure class="chart-card">
              <figcaption>Results by run</figcaption>
              <RunChart {...chartProps} kind="stack" series={statusSeries(chrono)} height={200} yFormat={fmtNumber}
                ariaLabel={`${report.title}: test results per run`} />
            </figure>
            <figure class="chart-card">
              <figcaption>Duration</figcaption>
              <RunChart {...chartProps} kind="line" height={200} min={0} yFormat={fmtDuration}
                series={[{ key: "duration", name: "Duration", color: "var(--series-1)", values: chrono.map((r) => r.durationMs ?? null) }]}
                ariaLabel={`${report.title}: duration per run`} />
            </figure>
          </div>
        </>
      ) : null}

      {keys.length ? (
        <div class="chart-grid">
          {keys.map((key) => {
            const info = metricInfo(key, hub.config.metrics);
            const latestVal = latest.metrics?.[key];
            const prevVal = runs.slice(1).find((r) => r.metrics?.[key] != null)?.metrics?.[key];
            return (
              <figure key={key} class="chart-card">
                <figcaption>
                  <span>{info.title}</span>
                  <span class="figure-value">{info.format(latestVal)}</span>
                  <Delta curr={latestVal} prev={prevVal} better={info.better} unit={info.unit === "%" ? " pts" : ""} digits={info.digits} />
                </figcaption>
                <RunChart {...chartProps} kind="line" height={170} min={info.min} max={info.max} yFormat={info.format}
                  series={[{ key, name: info.title, color: "var(--series-1)", values: chrono.map((r) => r.metrics?.[key] ?? null) }]}
                  ariaLabel={`${report.title}: ${info.title} per run`} />
              </figure>
            );
          })}
        </div>
      ) : null}

      <h3 class="table-title">Runs</h3>
      <div class="report-table">
        <RunsTable rows={runs.map((run) => ({ project, report, run }))} label={`${report.title} runs`} metricCols={metricCols} limit={10} />
      </div>
    </section>
  );
}
