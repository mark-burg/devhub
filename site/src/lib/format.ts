// Number, time and text formatting shared by every view.

export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s % 60);
  if (m < 60) return rest ? `${m}m ${rest}s` : `${m}m`;
  return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 60)}h`;
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "short" });

export function fmtRelative(iso: string | null | undefined, now = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "—";
  const sec = Math.round((t - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  if (abs < 86400 * 14) return rtf.format(Math.round(sec / 86400), "day");
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: abs > 86400 * 300 ? "numeric" : undefined });
}

export function fmtDate(iso: string | null | undefined): string {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
}

const compactFmt = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const plainFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function fmtNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.abs(n) >= 10000 ? compactFmt.format(n) : plainFmt.format(n);
}

export function fmtCompact(n: number): string {
  return compactFmt.format(n);
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 99.95 && n < 100) return "99.9%";
  return `${n.toFixed(n === 100 || n === 0 ? 0 : digits)}%`;
}

export const shortSha = (sha?: string | null): string => (sha ? String(sha).slice(0, 7) : "");

export function titleize(id: string): string {
  return String(id).replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slugify(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
