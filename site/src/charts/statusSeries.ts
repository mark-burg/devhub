import type { Run } from "../types";
import type { Series } from "./RunChart";

// Test-status colours are reserved tokens (never reused for ordinary series).
const STATUS_SERIES = [
  { key: "passed", name: "Passed", color: "var(--st-passed)" },
  { key: "failed", name: "Failed", color: "var(--st-failed)" },
  { key: "broken", name: "Broken", color: "var(--st-broken)" },
  { key: "skipped", name: "Skipped", color: "var(--st-skipped)" },
  { key: "unknown", name: "Unknown", color: "var(--st-unknown)" },
] as const;

/** One stacked series per test status present in `runs` (oldest → newest). */
export function statusSeries(runs: Run[]): Series[] {
  return STATUS_SERIES
    .map((st) => ({ ...st, values: runs.map((r) => r.stats?.[st.key] ?? null) }))
    .filter((se) => se.values.some((v) => v));
}
