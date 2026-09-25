// ⌘K palette: jump to any project, report, run (by label, branch, commit, PR) or page.

import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { Hub } from "../types";
import { runStatus } from "../selectors";
import { fmtRelative } from "../lib/format";
import { routes } from "../router";
import { paletteOpen } from "../state";
import { Icon, typeIcon } from "./Icon";
import { StatusDot } from "./status";

export interface PaletteItem {
  label: string;
  sub?: string;
  icon?: string;
  lead?: ComponentChildren;
  href: string;
  external?: boolean;
  /** Extra searchable text (commit sha, PR number). */
  extra?: string;
  /** Runs rank below projects/reports/pages and are hidden until the user types. */
  weight?: number;
}

export function buildItems(hub: Hub): PaletteItem[] {
  const out: PaletteItem[] = [
    { label: "Dashboard", sub: "Overview", icon: "grid", href: routes.dashboard() },
    { label: "Activity", sub: "All runs", icon: "activity", href: routes.activity() },
  ];
  for (const project of hub.projects) {
    out.push({ label: project.title, sub: "Project trends", icon: "folder", href: routes.project(project.id) });
    for (const report of project.reports) {
      out.push({ label: `${project.title} / ${report.title}`, sub: `Latest ${report.type} report`, icon: typeIcon(report.type), href: routes.report(project.id, report.id) });
      for (const run of report.runs.slice(0, 15)) {
        if (!run.path) continue;
        out.push({
          label: `${project.title} / ${report.title} ${run.label}`,
          sub: [run.git?.branch, run.git?.message, fmtRelative(run.createdAt)].filter(Boolean).join(" · "),
          lead: <StatusDot status={runStatus(run)} />,
          href: routes.report(project.id, report.id, run.id),
          extra: `${run.git?.commit ?? ""} ${run.git?.pr ? `pr ${run.git.pr}` : ""}`,
          weight: -1,
        });
      }
    }
  }
  for (const group of hub.navGroups) {
    for (const item of group.items) {
      out.push(item.type === "link"
        ? { label: item.title, sub: item.href, icon: "external", href: item.href ?? "#", external: true }
        : { label: item.title, sub: group.title || item.type, icon: item.icon ?? typeIcon(item.type), href: routes.page(item.id) });
    }
  }
  return out;
}

/** Every query word must appear; earlier and word-start matches rank higher. -Infinity = no match. */
export function score(item: PaletteItem, words: string[]): number {
  const hay = `${item.label} ${item.sub ?? ""} ${item.extra ?? ""}`.toLowerCase();
  let total = item.weight ?? 0;
  for (const w of words) {
    const i = hay.indexOf(w);
    if (i < 0) return -Infinity;
    total += 10 - Math.min(i, 40) / 4 + (i === 0 || /[\s/·#-]/.test(hay[i - 1]) ? 6 : 0);
  }
  return total;
}

export function search(items: PaletteItem[], query: string): PaletteItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items.filter((it) => it.weight !== -1).slice(0, 40);
  return items
    .map((it) => [it, score(it, words)] as const)
    .filter(([, s]) => s > -Infinity)
    .sort((a, b) => b[1] - a[1])
    .map(([it]) => it)
    .slice(0, 40);
}

export function CommandPalette({ hub }: { hub: Hub }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const open = paletteOpen.value;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const items = useMemo(() => (open ? buildItems(hub) : []), [open, hub]);
  const results = useMemo(() => search(items, query), [items, query]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      setQuery("");
      setSelected(0);
      d.showModal();
      input.current?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    list.current?.querySelector(".selected")?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const choose = (item?: PaletteItem) => {
    if (!item) return;
    paletteOpen.value = false;
    if (item.external) window.open(item.href, "_blank", "noopener");
    else location.hash = item.href;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") setSelected((s) => Math.max(0, Math.min(results.length - 1, s + 1)));
    else if (e.key === "ArrowUp") setSelected((s) => Math.max(0, s - 1));
    else if (e.key === "Enter") choose(results[selected]);
    else return;
    e.preventDefault();
  };

  return (
    <dialog
      class="palette"
      ref={dialog}
      aria-label="Search"
      onClose={() => { paletteOpen.value = false; }}
      onClick={(e) => { if (e.target === dialog.current) paletteOpen.value = false; }}
    >
      <div class="palette-box">
        <div class="palette-search">
          <Icon name="search" />
          <input
            ref={input}
            type="text"
            placeholder="Jump to a project, report, run, commit or page…"
            autocomplete="off"
            spellcheck={false}
            role="combobox"
            aria-label="Search projects, reports, runs and pages"
            aria-expanded={open && results.length > 0}
            aria-autocomplete="list"
            aria-controls="palette-list"
            aria-activedescendant={results.length ? `palette-opt-${selected}` : undefined}
            value={query}
            onInput={(e) => { setQuery(e.currentTarget.value); setSelected(0); }}
            onKeyDown={onKeyDown}
          />
          <kbd>esc</kbd>
        </div>
        <ul class="palette-list" id="palette-list" role="listbox" aria-label="Results" tabIndex={-1} ref={list} hidden={!results.length}>
          {results.map((it, i) => (
            <li
              key={it.href + it.label}
              id={`palette-opt-${i}`}
              class={`palette-item${i === selected ? " selected" : ""}`}
              role="option"
              aria-selected={i === selected}
              onClick={() => choose(it)}
              onMouseMove={() => { if (selected !== i) setSelected(i); }}
            >
              {it.lead ? <span class="palette-lead">{it.lead}</span> : <Icon name={it.icon ?? "layers"} />}
              <span class="palette-text">
                <span class="palette-label">{it.label}</span>
                {it.sub ? <span class="palette-sub">{it.sub}</span> : null}
              </span>
              {it.external ? <Icon name="external" class="muted" /> : null}
            </li>
          ))}
        </ul>
        {results.length ? null : <div class="palette-empty" role="status">No matches</div>}
      </div>
    </dialog>
  );
}
