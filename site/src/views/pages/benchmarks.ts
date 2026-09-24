// Parses benchmark files for the `benchmark` page type:
//   • github-action-benchmark's data.js: window.BENCHMARK_DATA = { entries: { suite: [{ commit, date, benches }] } }
//   • a generic JSON file: { "name"?, "series": [{ "name", "unit"?, "points": [{ "x" | "label", "y", "href"?, "note"?, "date"? }] }] }

export interface BenchPoint {
  label: string;
  y: number | null;
  date?: string | null;
  href?: string;
  note?: string;
}

export interface BenchSeries {
  name: string;
  unit?: string;
  points: BenchPoint[];
}

export interface BenchGroup {
  name: string;
  series: BenchSeries[];
  updated: string | null;
}

interface ActionBenchmarkEntry {
  commit?: { id?: string; message?: string; url?: string };
  date?: number;
  benches?: Array<{ name: string; value: number; unit?: string; range?: string }>;
}

export function parseBenchmarks(text: string): BenchGroup[] {
  const json = JSON.parse(text.trim().replace(/^[^{[]*=\s*/, "").replace(/;\s*$/, ""));

  if (json.entries) {
    return Object.entries(json.entries as Record<string, ActionBenchmarkEntry[]>).map(([name, entries]) => {
      const byBench = new Map<string, BenchSeries>();
      for (const entry of entries) {
        for (const b of entry.benches ?? []) {
          if (!byBench.has(b.name)) byBench.set(b.name, { name: b.name, unit: b.unit, points: [] });
          byBench.get(b.name)!.points.push({
            label: entry.commit?.id?.slice(0, 7) ?? "",
            y: b.value,
            date: entry.date ? new Date(entry.date).toISOString() : null,
            href: entry.commit?.url,
            note: [entry.commit?.message?.split("\n")[0], b.range].filter(Boolean).join(" · "),
          });
        }
      }
      return { name, series: [...byBench.values()], updated: json.lastUpdate ? new Date(json.lastUpdate).toISOString() : null };
    });
  }

  const series: BenchSeries[] = (json.series ?? []).map((s: { name: string; unit?: string; points?: Array<Record<string, unknown>> }) => ({
    name: s.name,
    unit: s.unit,
    points: (s.points ?? []).map((p) => ({
      label: String(p.label ?? p.x ?? ""),
      y: typeof p.y === "number" ? p.y : null,
      href: p.href as string | undefined,
      note: p.note as string | undefined,
      date: (p.date as string | undefined) ?? null,
    })),
  }));
  return series.length ? [{ name: json.name ?? "Series", series, updated: json.updated ?? null }] : [];
}

export function fmtBench(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.abs(v) >= 1000
    ? new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(v)
    : String(Number(v.toPrecision(4)));
}
