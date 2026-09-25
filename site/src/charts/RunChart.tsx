// Stacked columns or lines over an ordinal "run" axis (oldest → newest, left → right).
// Marks follow one spec everywhere: ≤24px columns with 4px rounded data-ends and 2px surface
// gaps, 2px lines, ≥8px end markers with a surface ring, hairline solid grid, a crosshair or
// column tooltip listing every series, keyboard support (←/→ move, Enter opens, Esc clears).

import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import { useElementWidth } from "../lib/useElementWidth";
import {
  clamp, clampScale, contiguous, findLast, isNum, linePath, niceScale, rectPath, roundedTopPath, type NiceScale, type Point,
} from "./scale";

export interface Series {
  key: string;
  name: string;
  /** CSS color, typically a token such as var(--series-1). */
  color: string;
  values: Array<number | null>;
}

export interface RunChartProps {
  kind: "stack" | "line";
  labels: string[];
  series: Series[];
  /** Plot height including the x-axis band, in px. */
  height?: number;
  yFormat?: (v: number) => string;
  valueFormat?: (v: number | null) => string;
  /** Hard bounds for the value domain (e.g. 0–100 for percentages). */
  min?: number | null;
  max?: number | null;
  /** Always include zero in the domain (line charts). */
  zero?: boolean;
  /** Area wash under a single line (default true). */
  area?: boolean;
  tipTitle?: (i: number) => string;
  tipFoot?: (i: number) => string;
  onSelect?: (i: number) => void;
  ariaLabel?: string;
}

const GAP = 2;

interface Layout {
  sc: NiceScale;
  m: { top: number; right: number; bottom: number; left: number };
  pw: number;
  ph: number;
  band: number;
  x: (i: number) => number;
  y: (v: number) => number;
  endText: string;
  lastIdx: number;
}

export function computeLayout(p: RunChartProps, W: number): Layout {
  const H = p.height ?? 180;
  const n = p.labels.length;
  const yFormat = p.yFormat ?? String;
  let lo: number;
  let hi: number;
  if (p.kind === "stack") {
    lo = 0;
    hi = Math.max(1, ...p.labels.map((_, i) => p.series.reduce((a, se) => a + (se.values[i] ?? 0), 0)));
  } else {
    const vals = p.series.flatMap((se) => se.values).filter(isNum);
    lo = vals.length ? Math.min(...vals) : 0;
    hi = vals.length ? Math.max(...vals) : 1;
    const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.05 || 1;
    lo -= pad;
    hi += pad;
    if (p.min != null) lo = Math.max(lo, p.min);
    if (p.max != null) hi = Math.min(hi, p.max);
    if (p.zero) lo = Math.min(lo, 0);
  }
  const sc = clampScale(niceScale(lo, hi, H < 150 ? 3 : 4), p.min, p.max);

  const single = p.kind === "line" && p.series.length === 1;
  const lastIdx = single ? findLast(p.series[0].values) : -1;
  const endText = single && lastIdx >= 0 ? yFormat(p.series[0].values[lastIdx] as number) : "";
  const m = {
    top: 12,
    right: endText ? Math.max(16, endText.length * 7 + 14) : 12,
    bottom: 26,
    left: Math.max(30, Math.max(...sc.ticks.map((t) => yFormat(t).length)) * 6.6 + 14),
  };
  const pw = Math.max(20, W - m.left - m.right);
  const ph = H - m.top - m.bottom;
  const band = pw / Math.max(1, n);
  return {
    sc, m, pw, ph, band, endText, lastIdx,
    x: (i) => m.left + band * (i + 0.5),
    y: (v) => m.top + ph - ((v - sc.lo) / (sc.hi - sc.lo || 1)) * ph,
  };
}

export function RunChart(props: RunChartProps) {
  const { kind, labels, series, onSelect } = props;
  const H = props.height ?? 180;
  const n = labels.length;
  const isStack = kind === "stack";
  const yFormat = props.yFormat ?? String;
  const valueFormat = props.valueFormat ?? ((v: number | null) => (v == null ? "—" : yFormat(v)));

  const [plotRef, W] = useElementWidth<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);
  const L = W ? computeLayout(props, W) : null;

  // Place the tooltip beside the active column, flipping left near the right edge.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!L || active < 0 || !tip) return;
    const tw = tip.offsetWidth;
    let left = L.x(active) + L.band / 2 + 8;
    if (left + tw > W) left = L.x(active) - L.band / 2 - 8 - tw;
    tip.style.left = `${clamp(left, 0, Math.max(0, W - tw))}px`;
    tip.style.top = `${L.m.top}px`;
  });

  const indexAt = (e: MouseEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return clamp(Math.floor((e.clientX - r.left - L!.m.left) / L!.band), 0, n - 1);
  };

  const onKeyDown = (e: JSX.TargetedKeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a < 0 ? n : a) - 1));
    else if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, a + 1));
    else if (e.key === "Enter" && active >= 0) onSelect?.(active);
    else if (e.key === "Escape") { setActive(-1); e.currentTarget.blur(); }
    else return;
    e.preventDefault();
  };

  return (
    <div class="chart">
      {series.length > 1 ? (
        <div class="legend">
          {series.map((se) => (
            <span key={se.key} class="legend-item">
              <span class={isStack ? "swatch" : "swatch line"} style={{ background: se.color }} />
              {se.name}
            </span>
          ))}
        </div>
      ) : null}
      <div class="chart-plot" ref={plotRef} style={{ height: `${H}px` }}>
        {L ? (
          <svg
            ref={svgRef}
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            class="chart-svg"
            role="img"
            tabindex={0} // lowercase: SVG attribute names are case-sensitive (camelCase is ignored by WebKit/Firefox)
            aria-label={props.ariaLabel ?? ""}
            onFocus={() => setActive((a) => (a >= 0 ? a : n - 1))}
            onBlur={() => setActive(-1)}
            onKeyDown={onKeyDown}
          >
            <Axes L={L} W={W} H={H} labels={labels} yFormat={yFormat} />
            {active >= 0 ? (
              isStack
                ? <rect class="hover-band" x={L.x(active) - L.band / 2} y={L.m.top} width={L.band} height={L.ph} />
                : <line class="crosshair" x1={L.x(active)} x2={L.x(active)} y1={L.m.top} y2={L.m.top + L.ph} />
            ) : null}
            {isStack ? <StackMarks L={L} series={series} n={n} /> : <LineMarks L={L} series={series} area={props.area !== false} active={active} />}
            <rect
              x={L.m.left}
              y={0}
              width={L.pw}
              height={H}
              class={onSelect ? "hit clickable" : "hit"}
              onPointerMove={(e) => setActive(indexAt(e))}
              onPointerLeave={() => { if (document.activeElement !== svgRef.current) setActive(-1); }}
              onClick={(e) => onSelect?.(indexAt(e))}
            />
          </svg>
        ) : null}
        {L && active >= 0 && active < n ? (
          <div class="chart-tip" role="status" ref={tipRef}>
            <div class="tip-title">{props.tipTitle ? props.tipTitle(active) : labels[active]}</div>
            {(isStack ? [...series].reverse() : series).map((se) => (
              <div key={se.key} class="tip-row">
                <span class="tip-key" style={{ background: se.color }} />
                <strong>{valueFormat(se.values[active] ?? (isStack ? 0 : null))}</strong>
                <span class="tip-name">{se.name}</span>
              </div>
            ))}
            {props.tipFoot && props.tipFoot(active) ? <div class="tip-foot">{props.tipFoot(active)}</div> : null}
            {onSelect ? <div class="tip-hint">Click to open</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Axes({ L, W, H, labels, yFormat }: { L: Layout; W: number; H: number; labels: string[]; yFormat: (v: number) => string }) {
  const n = labels.length;
  const stride = Math.ceil(n / Math.max(1, Math.floor(L.pw / 54)));
  const xTicks: number[] = [];
  for (let i = n - 1; i >= 0; i -= stride) xTicks.push(i);
  return (
    <g class="axis">
      {L.sc.ticks.map((t) => {
        const yy = Math.round(L.y(t)) + 0.5;
        return (
          <g key={t}>
            <line x1={L.m.left} x2={W - L.m.right} y1={yy} y2={yy} class={t === L.sc.lo ? "baseline" : "gridline"} />
            <text x={L.m.left - 8} y={yy + 4} text-anchor="end" class="tick">{yFormat(t)}</text>
          </g>
        );
      })}
      {xTicks.map((i) => <text key={`x${i}`} x={L.x(i)} y={H - 8} text-anchor="middle" class="tick">{labels[i]}</text>)}
    </g>
  );
}

function StackMarks({ L, series, n }: { L: Layout; series: Series[]; n: number }) {
  const bw = Math.max(3, Math.min(24, L.band * 0.62));
  const paths: JSX.Element[] = [];
  for (let i = 0; i < n; i++) {
    const segs = series.map((se) => ({ se, v: se.values[i] ?? 0 })).filter((d) => d.v > 0);
    let acc = 0;
    let cursor = L.y(0);
    segs.forEach((d, k) => {
      const bottom = k === 0 ? cursor : cursor - GAP;
      acc += d.v;
      const top = Math.min(L.y(acc), bottom - 2); // keep tiny counts visible
      const h = bottom - top;
      const left = L.x(i) - bw / 2;
      const isTop = k === segs.length - 1;
      paths.push(
        <path key={`${i}-${d.se.key}`} d={isTop ? roundedTopPath(left, top, bw, h, 4) : rectPath(left, top, bw, h)} style={{ fill: d.se.color }} />,
      );
      cursor = top;
    });
  }
  return <g class="marks">{paths}</g>;
}

function LineMarks({ L, series, area, active }: { L: Layout; series: Series[]; area: boolean; active: number }) {
  const single = series.length === 1;
  const base = L.y(L.sc.lo);
  return (
    <g class="marks">
      {series.map((se) => {
        const pts = se.values.map((v, i): Point | null => (isNum(v) ? [L.x(i), L.y(v)] : null));
        const runs = contiguous(pts);
        const li = findLast(se.values);
        return (
          <g key={se.key}>
            {single && area
              ? runs.filter((r) => r.length > 1).map((r, j) => (
                  <path key={`a${j}`} class="area" style={{ fill: se.color }}
                    d={`M${r[0][0]},${base}${r.map((p) => `L${p[0]},${p[1]}`).join("")}L${r[r.length - 1][0]},${base}Z`} />
                ))
              : null}
            {runs.map((r, j) => (r.length === 1
              ? <circle key={`p${j}`} cx={r[0][0]} cy={r[0][1]} r={3} style={{ fill: se.color }} />
              : <path key={`l${j}`} d={linePath(r)} class="line" style={{ stroke: se.color }} />))}
            {li >= 0 ? <circle cx={L.x(li)} cy={L.y(se.values[li] as number)} r={4} class="end-dot" style={{ fill: se.color }} /> : null}
          </g>
        );
      })}
      {L.endText ? (
        <text x={L.x(L.lastIdx) + 9} y={L.y(series[0].values[L.lastIdx] as number) + 4} class="value-label">{L.endText}</text>
      ) : null}
      {active >= 0
        ? series.map((se) => {
            const v = se.values[active];
            return isNum(v) ? <circle key={`h-${se.key}`} cx={L.x(active)} cy={L.y(v)} r={4} class="end-dot" style={{ fill: se.color }} /> : null;
          })
        : null}
    </g>
  );
}
