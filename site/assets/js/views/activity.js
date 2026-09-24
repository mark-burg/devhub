import { h } from "../util.js";
import { store, allRuns, branchesOf, runStatus } from "../store.js";
import { go } from "../router.js";
import { emptyState, pageHeader, runsTable, select } from "../components.js";

const STATUSES = [["", "Any status"], ["failed", "Failed"], ["broken", "Broken"], ["passed", "Passed"], ["neutral", "Published (no tests)"]];

export function activityView(ctx) {
  const q = ctx.route.query;
  const project = q.get("project") ?? "";
  const status = q.get("status") ?? "";
  const branch = q.get("branch") ?? "";
  const set = (patch) => go(["activity"], { project, status, branch, ...patch });

  const every = allRuns();
  const rows = every.filter(({ project: p, run }) =>
    (!project || p.id === project) && (!status || runStatus(run) === status) && (!branch || run.git?.branch === branch));

  const filters = h("div", { class: "filters" },
    select("Project", project, [{ value: "", label: "All projects" }, ...store.projects.map((p) => ({ value: p.id, label: p.title }))], (v) => set({ project: v })),
    select("Status", status, STATUSES.map(([value, label]) => ({ value, label })), (v) => set({ status: v })),
    select("Branch", branch, [{ value: "", label: "All branches" }, ...branchesOf(every.map((x) => x.run)).map((b) => ({ value: b, label: b }))], (v) => set({ branch: v })));

  const slot = h("div", { class: "card" });
  const render = (limit) => slot.replaceChildren(rows.length
    ? runsTable(rows, { showReport: true, limit, onMore: () => render(Infinity) })
    : emptyState("No runs match these filters"));
  render(50);

  return {
    title: "Activity",
    crumbs: [{ label: "Activity" }],
    el: h("div", { class: "page" }, pageHeader("Activity", `${rows.length} of ${every.length} runs`), filters, slot),
  };
}
