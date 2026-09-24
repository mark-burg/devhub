import { useState } from "preact/hooks";
import type { MetricInfo, RunRef } from "../types";
import { commitUrl, passRate, runStatus } from "../selectors";
import { fmtDate, fmtDuration, fmtPct, fmtRelative, shortSha } from "../lib/format";
import { routes } from "../router";
import { Icon, typeIcon } from "./Icon";
import { StatusPill } from "./status";
import { Button } from "./ui";

interface Props {
  rows: RunRef[];
  showReport?: boolean;
  metricCols?: MetricInfo[];
  /** Rows shown before "Show all". */
  limit?: number;
  /** Hide the "Show all" button (e.g. on the dashboard, which links elsewhere). */
  expandable?: boolean;
}

/** Runs as a table; every run label links to the viewer. Doubles as the charts' table view. */
export function RunsTable({ rows, showReport = false, metricCols = [], limit = Infinity, expandable = true }: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasStats = rows.some((r) => r.run.stats);
  const visible = expanded ? rows : rows.slice(0, limit);

  return (
    <div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Run</th>
              {showReport ? <th>Report</th> : null}
              <th>Status</th>
              {hasStats ? ["Passed", "Failed", "Broken", "Skipped", "Pass rate", "Duration"].map((t) => <th key={t} class="num">{t}</th>) : null}
              {metricCols.map((m) => <th key={m.key} class="num">{m.title}</th>)}
              <th>Branch</th>
              <th>Commit</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ project, report, run }) => {
              const s = run.stats;
              const commit = commitUrl(run);
              const num = (v: number | undefined, cls = "") => (
                <td class={`num ${cls}`.trim()}>{v ? String(v) : <span class="muted">0</span>}</td>
              );
              return (
                <tr key={`${project.id}/${report.id}/${run.id}`} class={run.pruned ? "is-pruned" : undefined}>
                  <td>
                    {run.pruned ? (
                      <span class="run-label" title="Report files were pruned; stats are kept for trends"><Icon name="archive" />{run.label}</span>
                    ) : (
                      <a class="run-label link" href={routes.report(project.id, report.id, run.id)}>{run.label}</a>
                    )}
                  </td>
                  {showReport ? (
                    <td>
                      <a href={routes.report(project.id, report.id)} class="report-cell">
                        <Icon name={typeIcon(report.type)} /><span>{project.title} / {report.title}</span>
                      </a>
                    </td>
                  ) : null}
                  <td><StatusPill status={runStatus(run)} /></td>
                  {hasStats
                    ? s
                      ? [
                          num(s.passed),
                          num(s.failed, s.failed ? "bad" : ""),
                          num(s.broken, s.broken ? "warn" : ""),
                          num(s.skipped),
                          <td class="num">{fmtPct(passRate(run))}</td>,
                          <td class="num">{fmtDuration(run.durationMs)}</td>,
                        ]
                      : Array.from({ length: 6 }, (_, i) => <td key={i} class="num muted">—</td>)
                    : null}
                  {metricCols.map((m) => <td key={m.key} class="num">{m.format(run.metrics?.[m.key])}</td>)}
                  <td>{run.git?.branch ? <span class="mono branch" title={run.git.branch}>{run.git.branch}</span> : <span class="muted">—</span>}</td>
                  <td>
                    {run.git?.commit ? (
                      commit
                        ? <a href={commit} target="_blank" rel="noopener" class="mono link" title={run.git.message ?? ""}>{shortSha(run.git.commit)}</a>
                        : <span class="mono" title={run.git.message ?? ""}>{shortSha(run.git.commit)}</span>
                    ) : <span class="muted">—</span>}
                  </td>
                  <td><time dateTime={run.createdAt} title={fmtDate(run.createdAt)}>{fmtRelative(run.createdAt)}</time></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {expandable && !expanded && rows.length > limit ? (
        <div class="table-more">
          <Button icon="chevron-down" onClick={() => setExpanded(true)}>Show all {rows.length} runs</Button>
        </div>
      ) : null}
    </div>
  );
}
