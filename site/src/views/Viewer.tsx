// Report viewer: the published report in a same-origin iframe with run navigation around it.
// The iframe's own location (e.g. an Allure test page) is mirrored into ?at= so links open there.

import { useEffect, useRef, useState } from "preact/hooks";
import type { Report, Run } from "../types";
import { runHref, runStatus } from "../selectors";
import { fmtRelative } from "../lib/format";
import { copyText } from "../lib/prefs";
import { go, replace, routes } from "../router";
import { focusMode, isDark, paletteOpen, showToast } from "../state";
import { Icon, typeIcon } from "../components/Icon";
import { StatusPill, statusLabel } from "../components/status";
import { StatsInline } from "../components/metrics";
import { RunMeta } from "../components/RunMeta";
import { Button, EmptyState, Page } from "../components/ui";

interface Props {
  report: Report;
  run: Run;
  /** The run segment from the URL ("latest", an id, or undefined). */
  runParam?: string;
  /** Initial inner location of the report (from ?at=). */
  at: string;
}

export function Viewer({ report, run, runParam, at }: Props) {
  const project = report.project;
  const pid = project.id;
  const rid = report.id;
  const idx = report.runs.indexOf(run);
  const older = report.runs[idx + 1];
  const newer = report.runs[idx - 1];
  const base = runHref(run);
  const [src] = useState(() => (base ? `${base}${at ? `#${at}` : ""}` : null));
  const [loading, setLoading] = useState(true);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const lastInner = useRef(at);
  const poll = useRef<ReturnType<typeof setInterval>>();
  const dark = isDark.value;
  // Set once this view has asked to navigate away. [ and ] always target another run, so the
  // view remounts (fresh ref); until then, further keys must not act on this stale view.
  const leaving = useRef(false);

  const innerHash = () => {
    try {
      return frameRef.current?.contentWindow?.location.hash.replace(/^#/, "") ?? "";
    } catch {
      return ""; // cross-origin
    }
  };

  const sync = () => {
    const inner = innerHash();
    if (inner === lastInner.current) return;
    lastInner.current = inner;
    replace(["r", pid, rid, inner ? run.id : runParam], { at: inner || null });
  };

  const onFrameLoad = () => {
    setLoading(false);
    const frame = frameRef.current;
    let win: Window | null | undefined;
    try {
      win = frame?.contentWindow;
      void win?.location.href; // throws when cross-origin
    } catch {
      return;
    }
    if (!win) return;
    // Allure 3 navigates with history.pushState and dispatches these custom events.
    for (const ev of ["hashchange", "popstate", "pushState", "replaceState"]) win.addEventListener(ev, () => setTimeout(sync));
    win.document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        paletteOpen.value = true;
      }
    });
    applyFrameTheme(frame, dark);
    clearInterval(poll.current);
    poll.current = setInterval(sync, 1000);
    sync();
  };

  useEffect(() => () => clearInterval(poll.current), []);

  // Allure 3 reads the shared "theme" key on load; flip the live document too.
  useEffect(() => { applyFrameTheme(frameRef.current, dark); }, [dark]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element | null)?.closest?.("input, select, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (leaving.current) return;
      const target = e.key === "[" ? older : e.key === "]" ? newer : undefined;
      if (!target) return;
      leaving.current = true;
      go(["r", pid, rid, target.id]);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [older, newer, pid, rid]);

  const copyLink = async (e: Event) => {
    const url = new URL(routes.report(pid, rid, run.id, { at: innerHash() || null }), location.href).href;
    showToast((await copyText(url)) ? "Link copied" : "Could not copy — use the address bar");
    (e.currentTarget as HTMLElement | null)?.blur();
  };

  const runOption = (r: Run) =>
    [r.label, r.git?.branch, fmtRelative(r.createdAt), r.stats ? statusLabel(runStatus(r)) : null, r.pruned ? "archived" : null].filter(Boolean).join(" · ");

  return (
    <div class="viewer">
      <div class="viewer-bar">
        <div class="viewer-nav">
          <Icon name={typeIcon(report.type)} class="muted" />
          <Button href={older ? routes.report(pid, rid, older.id) : undefined} disabled={!older} icon="chevron-left"
            title={older ? `Older run ${older.label} ([)` : undefined} />
          <select class="select run-select" aria-label="Run" value={run.id} onChange={(e) => go(["r", pid, rid, e.currentTarget.value])}>
            {report.runs.map((r) => <option key={r.id} value={r.id} disabled={!r.path && r !== run}>{runOption(r)}</option>)}
          </select>
          <Button href={newer ? routes.report(pid, rid, newer.id) : undefined} disabled={!newer} icon="chevron-right"
            title={newer ? `Newer run ${newer.label} (])` : undefined} />
        </div>
        <div class="viewer-meta">
          <StatusPill status={runStatus(run)} />
          <StatsInline stats={run.stats} />
          <RunMeta run={run} />
        </div>
        <div class="viewer-actions">
          <Button icon="link" title="Copy link to this run" onClick={copyLink} />
          {src ? <a class="btn btn-ghost btn-icon" href={src} target="_blank" rel="noopener" title="Open report in a new tab"><Icon name="external" /></a> : null}
          <Button icon={focusMode.value ? "minimize" : "maximize"} title="Focus mode (f)" onClick={() => { focusMode.value = !focusMode.value; }} />
        </div>
      </div>
      <div class="viewer-body">
        {src ? (
          <>
            {loading ? <div class="viewer-loading"><span class="spinner" />Loading report…</div> : null}
            <iframe ref={frameRef} class="viewer-frame" src={src} title={`${project.title} / ${report.title} ${run.label}`} onLoad={onFrameLoad} />
          </>
        ) : (
          <Page>
            <EmptyState
              title="This run was archived"
              actions={<>
                <Button href={routes.report(pid, rid)} variant="primary">Open latest run</Button>
                <Button href={routes.project(pid)}>Project trends</Button>
              </>}
            >
              Its report files were pruned to keep the Pages branch small. Stats and metrics are still part of the trend charts.
            </EmptyState>
          </Page>
        )}
      </div>
    </div>
  );
}

function applyFrameTheme(frame: HTMLIFrameElement | null, dark: boolean) {
  try {
    frame?.contentDocument?.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  } catch {
    /* cross-origin */
  }
}
