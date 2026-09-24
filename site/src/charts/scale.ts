// Scale and path helpers for the SVG charts. Pure functions.

export interface NiceScale {
  lo: number;
  hi: number;
  ticks: number[];
}

/** Round a [min, max] domain out to clean tick steps (1, 2, 5 × 10ⁿ). */
export function niceScale(min: number, max: number, count = 4): NiceScale {
  if (!(max > min)) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const step = (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * mag;
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return { lo, hi, ticks };
}

/** Clamp a nice scale to hard bounds (e.g. 0–100 for percentages). */
export function clampScale(sc: NiceScale, min: number | null | undefined, max: number | null | undefined): NiceScale {
  let { lo, hi, ticks } = sc;
  if (max != null && hi > max) { hi = max; ticks = ticks.filter((t) => t <= max); }
  if (min != null && lo < min) { lo = min; ticks = ticks.filter((t) => t >= min); }
  return { lo, hi, ticks };
}

export function rectPath(x: number, y: number, w: number, h: number): string {
  return `M${x},${y}h${w}v${h}h${-w}Z`;
}

/** Column with 4px rounded data-end and a square baseline. */
export function roundedTopPath(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h}Z`;
}

export type Point = [number, number];

/** Split a series into runs of consecutive defined points (gaps break the line). */
export function contiguous(points: Array<Point | null>): Point[][] {
  const out: Point[][] = [];
  let cur: Point[] = [];
  for (const p of points) {
    if (p) cur.push(p);
    else if (cur.length) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
}

export const isNum = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

export function findLast(values: Array<number | null | undefined>): number {
  for (let i = values.length - 1; i >= 0; i--) if (isNum(values[i])) return i;
  return -1;
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const linePath = (pts: Point[]) => pts.map((p, j) => `${j ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
