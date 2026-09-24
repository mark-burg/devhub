// Small SVG chart kit: stacked columns and line charts over an ordinal "run" axis, plus sparklines.
// Marks follow one spec everywhere: ≤24px columns with 4px rounded data-ends and 2px surface gaps,
// 2px lines, ≥8px end markers with a surface ring, hairline solid grid, crosshair/column tooltips,
// keyboard support (←/→ to move, Enter to open).

import { h, s } from "./util.js";

const GAP = 2;

export const STATUS_SERIES = [
  { key: "passed", name: "Passed", color: "var(--st-passed)" },
  { key: "failed", name: "Failed", color: "var(--st-failed)" },
  { key: "broken", name: "Broken", color: "var(--st-broken)" },
  { key: "skipped", name: "Skipped", color: "var(--st-skipped)" },
  { key: "unknown", name: "Unknown", color: "var(--st-unknown)" },
];

export function niceScale(min, max, count = 4) {
  if (!(max > min)) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const step = (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * mag;
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return { lo, hi, ticks };
}

/**
 * Chart over runs (oldest → newest, left → right).
 * o.kind       "stack" | "line"
 * o.labels     x labels, one per run
 * o.series     [{ key, name, color, values: (number|null)[] }]
 * o.height     plot height incl. the x-axis band (px)
 * o.yFormat    tick/value formatter
 * o.min/o.max  clamp the value domain (e.g. 0..100 for percentages)
 * o.tipTitle   (i) => string          o.tipFoot (i) => string
 * o.onSelect   (i) => void            (click / Enter on a run)
 */
export function runChart(el, o) {
  const series = o.series;
  const n = o.labels.length;
  const H = o.height ?? 180;
  const yFormat = o.yFormat ?? ((v) => String(v));
  const isStack = o.kind === "stack";

  el.classList.add("chart");
  const legend = series.length > 1
    ? h("div", { class: "legend" }, series.map((se) =>
        h("span", { class: "legend-item" }, h("span", { class: isStack ? "swatch" : "swatch line", style: { background: se.color } }), se.name)))
    : null;
  const plot = h("div", { class: "chart-plot", style: { height: `${H}px` } });
  const tip = h("div", { class: "chart-tip", role: "status" });
  tip.hidden = true;
  plot.append(tip);
  el.replaceChildren(...[legend, plot].filter(Boolean));

  let active = -1;
  let frame = 0;
  let lastWidth = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const w = Math.floor(plot.clientWidth);
      if (w && w !== lastWidth) { lastWidth = w; draw(w); }
    });
  });
  ro.observe(plot);

  function draw(W) {
    plot.querySelector("svg")?.remove();
    tip.hidden = true;

    let lo, hi;
    if (isStack) {
      lo = 0;
      hi = Math.max(1, ...o.labels.map((_, i) => series.reduce((a, se) => a + (se.values[i] ?? 0), 0)));
    } else {
      const vals = series.flatMap((se) => se.values).filter((v) => v != null && Number.isFinite(v));
      lo = vals.length ? Math.min(...vals) : 0;
      hi = vals.length ? Math.max(...vals) : 1;
      const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.05 || 1;
      lo -= pad;
      hi += pad;
      if (o.min != null) lo = Math.max(lo, o.min);
      if (o.max != null) hi = Math.min(hi, o.max);
      if (o.zero) lo = Math.min(lo, 0);
    }
    const sc = niceScale(lo, hi, H < 150 ? 3 : 4);
    if (o.max != null && sc.hi > o.max) { sc.hi = o.max; sc.ticks = sc.ticks.filter((t) => t <= o.max); }
    if (o.min != null && sc.lo < o.min) { sc.lo = o.min; sc.ticks = sc.ticks.filter((t) => t >= o.min); }

    const single = !isStack && series.length === 1;
    const lastIdx = single ? findLast(series[0].values) : -1;
    const endText = single && lastIdx >= 0 ? yFormat(series[0].values[lastIdx]) : "";
    const m = {
      top: 12,
      right: endText ? Math.max(16, endText.length * 7 + 14) : 12,
      bottom: 26,
      left: Math.max(30, Math.max(...sc.ticks.map((t) => yFormat(t).length)) * 6.6 + 14),
    };
    const pw = Math.max(20, W - m.left - m.right);
    const ph = H - m.top - m.bottom;
    const band = pw / Math.max(1, n);
    const x = (i) => m.left + band * (i + 0.5);
    const y = (v) => m.top + ph - ((v - sc.lo) / (sc.hi - sc.lo || 1)) * ph;

    const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: "chart-svg", role: "img", tabindex: "0", "aria-label": o.ariaLabel ?? "" });

    // Grid & axes
    const axis = s("g", { class: "axis" });
    for (const t of sc.ticks) {
      const yy = Math.round(y(t)) + 0.5;
      axis.append(s("line", { x1: m.left, x2: W - m.right, y1: yy, y2: yy, class: t === sc.lo ? "baseline" : "gridline" }));
      axis.append(s("text", { x: m.left - 8, y: yy + 4, "text-anchor": "end", class: "tick" }, yFormat(t)));
    }
    const stride = Math.ceil(n / Math.max(1, Math.floor(pw / 54)));
    for (let i = n - 1; i >= 0; i -= stride) {
      axis.append(s("text", { x: x(i), y: H - 8, "text-anchor": "middle", class: "tick" }, o.labels[i]));
    }
    svg.append(axis);

    const hoverBand = s("rect", { class: "hover-band", y: m.top, height: ph, width: band, x: 0, visibility: "hidden" });
    const cross = s("line", { class: "crosshair", y1: m.top, y2: m.top + ph, x1: 0, x2: 0, visibility: "hidden" });
    svg.append(isStack ? hoverBand : cross);

    const hoverDots = [];
    if (isStack) {
      const bw = Math.max(3, Math.min(24, band * 0.62));
      const marks = s("g", { class: "marks" });
      for (let i = 0; i < n; i++) {
        const segs = series.map((se) => ({ se, v: se.values[i] ?? 0 })).filter((d) => d.v > 0);
        let acc = 0;
        let cursor = y(0);
        segs.forEach((d, k) => {
          const bottom = k === 0 ? cursor : cursor - GAP;
          acc += d.v;
          const top = Math.min(y(acc), bottom - 2); // keep tiny counts visible
          const height = bottom - top;
          const left = x(i) - bw / 2;
          const isTop = k === segs.length - 1;
          marks.append(s("path", { d: isTop ? roundedTop(left, top, bw, height, 4) : rect(left, top, bw, height), style: `fill:${d.se.color}` }));
          cursor = top;
        });
      }
      svg.append(marks);
    } else {
      const marks = s("g", { class: "marks" });
      for (const se of series) {
        const pts = se.values.map((v, i) => (v == null || !Number.isFinite(v) ? null : [x(i), y(v)]));
        const runs = contiguous(pts);
        if (single && o.area !== false) {
          const base = y(sc.lo);
          for (const r of runs) {
            if (r.length < 2) continue;
            const d = `M${r[0][0]},${base}` + r.map((p) => `L${p[0]},${p[1]}`).join("") + `L${r.at(-1)[0]},${base}Z`;
            marks.append(s("path", { d, class: "area", style: `fill:${se.color}` }));
          }
        }
        for (const r of runs) {
          if (r.length === 1) marks.append(s("circle", { cx: r[0][0], cy: r[0][1], r: 3, style: `fill:${se.color}` }));
          else marks.append(s("path", { d: r.map((p, j) => `${j ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(""), class: "line", style: `stroke:${se.color}` }));
        }
        const li = findLast(se.values);
        if (li >= 0) marks.append(s("circle", { cx: x(li), cy: y(se.values[li]), r: 4, class: "end-dot", style: `fill:${se.color}` }));
        const dot = s("circle", { r: 4, class: "end-dot", style: `fill:${se.color}`, visibility: "hidden" });
        hoverDots.push({ dot, se });
      }
      if (endText) marks.append(s("text", { x: x(lastIdx) + 9, y: y(series[0].values[lastIdx]) + 4, class: "value-label" }, endText));
      for (const { dot } of hoverDots) marks.append(dot);
      svg.append(marks);
    }

    const hit = s("rect", { x: m.left, y: 0, width: pw, height: H, class: o.onSelect ? "hit clickable" : "hit" });
    svg.append(hit);
    plot.prepend(svg);

    const indexAt = (evt) => {
      const r = svg.getBoundingClientRect();
      return clamp(Math.floor((evt.clientX - r.left - m.left) / band), 0, n - 1);
    };

    function show(i) {
      if (n === 0) return;
      active = i;
      if (isStack) {
        hoverBand.setAttribute("x", x(i) - band / 2);
        hoverBand.setAttribute("visibility", "visible");
      } else {
        cross.setAttribute("x1", x(i));
        cross.setAttribute("x2", x(i));
        cross.setAttribute("visibility", "visible");
        for (const { dot, se } of hoverDots) {
          const v = se.values[i];
          if (v == null || !Number.isFinite(v)) { dot.setAttribute("visibility", "hidden"); continue; }
          dot.setAttribute("cx", x(i));
          dot.setAttribute("cy", y(v));
          dot.setAttribute("visibility", "visible");
        }
      }
      const rows = (isStack ? [...series].reverse() : series).map((se) =>
        h("div", { class: "tip-row" },
          h("span", { class: "tip-key", style: { background: se.color } }),
          h("strong", null, (o.valueFormat ?? yFormat)(se.values[i] ?? (isStack ? 0 : null))),
          h("span", { class: "tip-name" }, se.name)));
      tip.replaceChildren(
        h("div", { class: "tip-title" }, o.tipTitle ? o.tipTitle(i) : o.labels[i]),
        ...rows,
        o.tipFoot ? h("div", { class: "tip-foot" }, o.tipFoot(i)) : null,
        o.onSelect ? h("div", { class: "tip-hint" }, "Click to open") : null,
      );
      tip.hidden = false;
      const tw = tip.offsetWidth;
      let left = x(i) + band / 2 + 8;
      if (left + tw > W) left = x(i) - band / 2 - 8 - tw;
      tip.style.left = `${clamp(left, 0, Math.max(0, W - tw))}px`;
      tip.style.top = `${m.top}px`;
    }
    function hide() {
      active = -1;
      tip.hidden = true;
      hoverBand.setAttribute("visibility", "hidden");
      cross.setAttribute("visibility", "hidden");
      for (const { dot } of hoverDots) dot.setAttribute("visibility", "hidden");
    }

    hit.addEventListener("pointermove", (e) => show(indexAt(e)));
    hit.addEventListener("pointerleave", () => { if (document.activeElement !== svg) hide(); });
    hit.addEventListener("click", (e) => o.onSelect?.(indexAt(e)));
    svg.addEventListener("focus", () => show(active >= 0 ? active : n - 1));
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") show(Math.max(0, (active < 0 ? n : active) - 1));
      else if (e.key === "ArrowRight") show(Math.min(n - 1, active + 1));
      else if (e.key === "Enter" && active >= 0) o.onSelect?.(active);
      else if (e.key === "Escape") { hide(); svg.blur(); }
      else return;
      e.preventDefault();
    });
  }

  return { destroy: () => ro.disconnect() };
}

// Sparkline for stat tiles and cards: de-emphasis stroke, current value in the accent.
export function sparkline(values, { width = 96, height = 28, label = "", min = null, max = null } = {}) {
  const svg = s("svg", { width, height, viewBox: `0 0 ${width} ${height}`, class: "spark", role: "img", "aria-label": label });
  const pts = values.map((v, i) => [i, v]).filter(([, v]) => v != null && Number.isFinite(v));
  if (!pts.length) return svg;
  let lo = min ?? Math.min(...pts.map((p) => p[1]));
  let hi = max ?? Math.max(...pts.map((p) => p[1]));
  if (min == null && max == null && hi - lo < 1e-9) { lo -= 1; hi += 1; }
  if (min != null || max != null) {
    // Zoom into the data while respecting hard bounds — a flat 100% line still reads as "top".
    const dLo = Math.min(...pts.map((p) => p[1])), dHi = Math.max(...pts.map((p) => p[1]));
    const pad = Math.max((dHi - dLo) * 0.2, 1);
    lo = Math.max(min ?? -Infinity, dLo - pad);
    hi = Math.min(max ?? Infinity, dHi + pad);
    if (hi - lo < 1e-9) lo = hi - 1;
  }
  const px = 4, py = 4;
  const n = values.length;
  const x = (i) => px + (n > 1 ? (i / (n - 1)) * (width - 2 * px) : (width - 2 * px) / 2);
  const y = (v) => py + (1 - (v - lo) / (hi - lo)) * (height - 2 * py);
  if (pts.length > 1) {
    svg.append(s("path", { d: pts.map(([i, v], j) => `${j ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(""), class: "spark-line" }));
  }
  const [li, lv] = pts.at(-1);
  svg.append(s("circle", { cx: x(li), cy: y(lv), r: 3, class: "spark-dot" }));
  return svg;
}

function rect(x, y, w, hgt) {
  return `M${x},${y}h${w}v${hgt}h${-w}Z`;
}
function roundedTop(x, y, w, hgt, r) {
  r = Math.max(0, Math.min(r, w / 2, hgt));
  return `M${x},${y + hgt}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + hgt}Z`;
}
function contiguous(pts) {
  const out = [];
  let cur = [];
  for (const p of pts) {
    if (p) cur.push(p);
    else if (cur.length) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
}
function findLast(values) {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] != null && Number.isFinite(values[i])) return i;
  return -1;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
