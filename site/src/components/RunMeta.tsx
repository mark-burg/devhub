import type { Run } from "../types";
import { commitUrl, prUrl } from "../selectors";
import { fmtDate, fmtDuration, fmtRelative, shortSha } from "../lib/format";
import { Icon } from "./Icon";

/** Branch · PR · commit · duration · time · CI link for one run. */
export function RunMeta({ run, compact = false }: { run: Run; compact?: boolean }) {
  const pr = prUrl(run);
  const commit = commitUrl(run);
  return (
    <span class="meta-row">
      {run.git?.branch ? (
        <span class="meta" title="Branch"><Icon name="branch" /><span class="mono">{run.git.branch}</span></span>
      ) : null}
      {run.git?.pr ? (
        pr ? <a class="meta link" href={pr} target="_blank" rel="noopener" title="Pull request">PR #{run.git.pr}</a>
          : <span class="meta">PR #{run.git.pr}</span>
      ) : null}
      {run.git?.commit ? (
        commit ? (
          <a class="meta link" href={commit} target="_blank" rel="noopener" title={run.git.message ?? "Commit"}>
            <Icon name="commit" /><span class="mono">{shortSha(run.git.commit)}</span>
          </a>
        ) : (
          <span class="meta" title={run.git.message ?? "Commit"}><Icon name="commit" /><span class="mono">{shortSha(run.git.commit)}</span></span>
        )
      ) : null}
      {!compact && run.durationMs != null ? (
        <span class="meta" title="Duration"><Icon name="clock" />{fmtDuration(run.durationMs)}</span>
      ) : null}
      <time class="meta" dateTime={run.createdAt} title={fmtDate(run.createdAt)}>{fmtRelative(run.createdAt)}</time>
      {!compact && run.ci?.runUrl ? (
        <a class="meta link" href={run.ci.runUrl} target="_blank" rel="noopener">CI run<Icon name="external" /></a>
      ) : null}
    </span>
  );
}
