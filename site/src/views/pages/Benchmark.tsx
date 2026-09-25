import { useEffect, useState } from "preact/hooks";
import type { NavItem } from "../../types";
import { fmtDate } from "../../lib/format";
import { go } from "../../router";
import { RunChart } from "../../charts/RunChart";
import { ErrorBox, Loading, Page, PageHeader, Select } from "../../components/ui";
import { fetchText } from "./Markdown";
import { fmtBench, parseBenchmarks, type BenchGroup } from "./benchmarks";

export function Benchmark({ page, query }: { page: NavItem; query: URLSearchParams }) {
  const [groups, setGroups] = useState<BenchGroup[] | { error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchText(page.src ?? "")
      .then((text) => {
        const parsed = parseBenchmarks(text);
        if (!parsed.length) throw new Error("No benchmark series found in the file.");
        if (!cancelled) setGroups(parsed);
      })
      .catch((err: Error) => { if (!cancelled) setGroups({ error: err.message }); });
    return () => { cancelled = true; };
  }, [page.src]);

  let body;
  if (groups == null) body = <Loading />;
  else if ("error" in groups) body = <ErrorBox title="Could not load benchmark data" detail={groups.error} />;
  else {
    const active = groups.find((g) => g.name === query.get("suite")) ?? groups[0];
    body = (
      <>
        {groups.length > 1 ? (
          <div class="filters">
            <Select label="Suite" value={active.name} onChange={(v) => go(["page", page.id], { suite: v })}
              options={groups.map((g) => ({ value: g.name, label: g.name }))} />
          </div>
        ) : null}
        {active.updated ? <p class="subtle">Last updated {fmtDate(active.updated)}</p> : null}
        <div class="chart-grid">
          {active.series.map((series) => {
            const latest = series.points[series.points.length - 1];
            return (
              <figure key={series.name} class="chart-card">
                <figcaption>
                  <span>{series.name}</span>
                  <span class="figure-value">{fmtBench(latest?.y)} {series.unit ?? ""}</span>
                </figcaption>
                <RunChart
                  kind="line" height={180} zero={page.zero ?? false}
                  labels={series.points.map((p) => p.label)}
                  series={[{ key: series.name, name: series.unit ? `${series.name} (${series.unit})` : series.name, color: "var(--series-1)", values: series.points.map((p) => p.y) }]}
                  yFormat={fmtBench}
                  tipTitle={(i) => [series.points[i].label, series.points[i].date ? fmtDate(series.points[i].date) : null].filter(Boolean).join(" · ")}
                  tipFoot={(i) => series.points[i].note ?? ""}
                  onSelect={(i) => { const url = series.points[i].href; if (url) window.open(url, "_blank", "noopener"); }}
                  isSelectable={(i) => !!series.points[i]?.href}
                  ariaLabel={`${series.name} over time`}
                />
              </figure>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <Page>
      <PageHeader title={page.title} subtitle={page.description} />
      {body}
    </Page>
  );
}
