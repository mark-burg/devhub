import { isNum, linePath, type Point } from "./scale";

interface Props {
  values: Array<number | null | undefined>;
  width?: number;
  height?: number;
  label?: string;
  /** Hard bounds; the line zooms into the data within them (a flat 100% still reads as "top"). */
  min?: number | null;
  max?: number | null;
}

/** De-emphasis trend line with the current value marked in the accent colour. */
export function Sparkline({ values, width = 96, height = 28, label = "", min = null, max = null }: Props) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => isNum(p[1]));
  if (!pts.length) return <svg width={width} height={height} class="spark" role="img" aria-label={label} />;

  const dLo = Math.min(...pts.map((p) => p[1]));
  const dHi = Math.max(...pts.map((p) => p[1]));
  let lo = dLo;
  let hi = dHi;
  if (min != null || max != null) {
    const pad = Math.max((dHi - dLo) * 0.2, 1);
    lo = Math.max(min ?? -Infinity, dLo - pad);
    hi = Math.min(max ?? Infinity, dHi + pad);
    if (hi - lo < 1e-9) lo = hi - 1;
  } else if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }

  const px = 4;
  const py = 4;
  const n = values.length;
  const x = (i: number) => px + (n > 1 ? (i / (n - 1)) * (width - 2 * px) : (width - 2 * px) / 2);
  const y = (v: number) => py + (1 - (v - lo) / (hi - lo)) * (height - 2 * py);
  const coords: Point[] = pts.map(([i, v]) => [x(i), y(v)]);
  const last = coords[coords.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} class="spark" role="img" aria-label={label}>
      {coords.length > 1 ? <path d={linePath(coords)} class="spark-line" /> : null}
      <circle cx={last[0]} cy={last[1]} r={3} class="spark-dot" />
    </svg>
  );
}
