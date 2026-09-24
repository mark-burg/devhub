import type { ComponentChildren } from "preact";
import type { Better, Stats } from "../types";
import { fmtDuration } from "../lib/format";
import { Icon, type IconName } from "./Icon";

interface DeltaProps {
  curr: number | null | undefined;
  prev: number | null | undefined;
  better?: Better;
  /** Suffix for the change, e.g. " pts". "ms" formats the change as a duration. */
  unit?: string;
  digits?: number;
  suffix?: string;
}

/** Signed change vs. the previous value, coloured by whether the direction is good. */
export function Delta({ curr, prev, better = "higher", unit = "", digits = 1, suffix = "vs previous" }: DeltaProps) {
  if (curr == null || prev == null || !Number.isFinite(curr - prev)) return null;
  const d = curr - prev;
  if (Math.abs(d) < 10 ** -digits / 2) return <span class="delta flat">No change {suffix}</span>;
  const good = better === "neutral" ? null : better === "higher" ? d > 0 : d < 0;
  const cls = good == null ? "flat" : good ? "good" : "bad";
  const text = unit === "ms" ? fmtDuration(Math.abs(d)) : `${Math.abs(d).toFixed(digits)}${unit}`;
  return <span class={`delta ${cls}`}>{d > 0 ? "▲" : "▼"} {text} {suffix}</span>;
}

interface TileProps {
  label: string;
  value: ComponentChildren;
  sub?: string;
  delta?: ComponentChildren;
  spark?: ComponentChildren;
  icon?: IconName;
  tone?: "good" | "bad" | null;
}

export function Tile({ label, value, sub, delta, spark, icon, tone }: TileProps) {
  return (
    <div class={`tile card${tone ? ` tone-${tone}` : ""}`}>
      <div class="tile-label">{icon ? <Icon name={icon} /> : null}{label}</div>
      <div class="tile-row"><div class="tile-value">{value}</div>{spark}</div>
      {delta}
      {sub ? <div class="tile-sub">{sub}</div> : null}
    </div>
  );
}

export function StatsInline({ stats }: { stats?: Stats | null }) {
  if (!stats) return null;
  const parts = (["passed", "failed", "broken", "skipped"] as const)
    .map((k) => [k, stats[k]] as const)
    .filter(([, v]) => v);
  const shown: Array<readonly [string, number | undefined]> = parts.length ? parts : [["total", stats.total ?? 0]];
  return (
    <span class="stats-inline">
      {shown.map(([k, v]) => (
        <span key={k} class={`stat st-${k}`}><span class="dot" /><b>{String(v)}</b> {k}</span>
      ))}
    </span>
  );
}
