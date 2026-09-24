import type { Hub } from "../types";
import { allRuns, branchesOf, runStatus } from "../selectors";
import { go } from "../router";
import { RunsTable } from "../components/RunsTable";
import { EmptyState, Page, PageHeader, Select } from "../components/ui";

const STATUSES = [["", "Any status"], ["failed", "Failed"], ["broken", "Broken"], ["passed", "Passed"], ["neutral", "Published (no tests)"]] as const;

export function Activity({ hub, query }: { hub: Hub; query: URLSearchParams }) {
  const project = query.get("project") ?? "";
  const status = query.get("status") ?? "";
  const branch = query.get("branch") ?? "";
  const set = (patch: Record<string, string>) => go(["activity"], { project, status, branch, ...patch });

  const every = allRuns(hub);
  const rows = every.filter(({ project: p, run }) =>
    (!project || p.id === project) && (!status || runStatus(run) === status) && (!branch || run.git?.branch === branch));

  return (
    <Page>
      <PageHeader title="Activity" subtitle={`${rows.length} of ${every.length} runs`} />
      <div class="filters">
        <Select label="Project" value={project} onChange={(v) => set({ project: v })}
          options={[{ value: "", label: "All projects" }, ...hub.projects.map((p) => ({ value: p.id, label: p.title }))]} />
        <Select label="Status" value={status} onChange={(v) => set({ status: v })}
          options={STATUSES.map(([value, label]) => ({ value, label }))} />
        <Select label="Branch" value={branch} onChange={(v) => set({ branch: v })}
          options={[{ value: "", label: "All branches" }, ...branchesOf(every.map((x) => x.run)).map((b) => ({ value: b, label: b }))]} />
      </div>
      <div class="card">
        {rows.length ? <RunsTable rows={rows} showReport limit={50} /> : <EmptyState title="No runs match these filters" />}
      </div>
    </Page>
  );
}
