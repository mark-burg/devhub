import { useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { Hub, Project } from "../types";
import { failedCount, headline, isFailing, latestRun, runStatus } from "../selectors";
import { fmtDate, fmtRelative } from "../lib/format";
import { prefs } from "../lib/prefs";
import { href, routes, type Route } from "../router";
import { paletteOpen } from "../state";
import { Icon, typeIcon, type IconName } from "./Icon";
import { StatusDot } from "./status";

const COLLAPSED_KEY = "devhub.collapsed";

export function Sidebar({ hub, route }: { hub: Hub; route: Route }) {
  const current = href(route.parts);
  // Longest matching nav target is active: "#/r/p/r" beats "#/p/p", "#/" only matches the dashboard.
  const isActive = (target: string) => (target === "#/" ? current === "#/" : current === target || current.startsWith(`${target}/`));
  const [collapsed, setCollapsed] = useState<string[]>(() => prefs.get(COLLAPSED_KEY, [] as string[]));
  const toggle = (id: string) => {
    const next = collapsed.includes(id) ? collapsed.filter((x) => x !== id) : [...collapsed, id];
    setCollapsed(next);
    prefs.set(COLLAPSED_KEY, next);
  };
  const kbd = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

  return (
    <aside class="sidebar" aria-label="Navigation">
      <div class="sb-head">
        <a class="brand" href="#/">
          <span class="brand-mark" aria-hidden="true"><Icon name="logo" /></span>
          <span class="brand-text">
            <span class="brand-title">{hub.config.title ?? "Dev Hub"}</span>
            <span class="brand-sub">{hub.config.tagline ?? "Reports & tools"}</span>
          </span>
        </a>
      </div>
      <button class="sb-search" type="button" onClick={() => { paletteOpen.value = true; }}>
        <Icon name="search" /><span>Search reports…</span><kbd>{kbd}</kbd>
      </button>
      <nav class="sb-nav">
        <div class="sb-section">
          <NavLink to={routes.dashboard()} active={isActive(routes.dashboard())} icon="grid">Dashboard</NavLink>
          <NavLink to={routes.activity()} active={isActive(routes.activity())} icon="activity">Activity</NavLink>
        </div>
        {hub.projects.length ? (
          <div class="sb-section">
            <div class="sb-label">Projects</div>
            {hub.projects.map((p) => (
              <ProjectGroup key={p.id} hub={hub} project={p} collapsed={collapsed.includes(p.id)} onToggle={() => toggle(p.id)} isActive={isActive} />
            ))}
          </div>
        ) : null}
        {hub.navGroups.filter((g) => g.items.length).map((group) => (
          <div key={group.title} class="sb-section">
            {group.title ? <div class="sb-label">{group.title}</div> : null}
            {group.items.map((item) => (item.type === "link" ? (
              <NavLink key={item.id} to={item.href ?? "#"} icon={item.icon ?? "external"} external title={item.href}>{item.title}</NavLink>
            ) : (
              <NavLink key={item.id} to={routes.page(item.id)} active={isActive(routes.page(item.id))} icon={item.icon ?? typeIcon(item.type)}>{item.title}</NavLink>
            )))}
          </div>
        ))}
      </nav>
      <div class="sb-foot">
        <span title={hub.generatedAt ? fmtDate(hub.generatedAt) : ""}>
          {hub.generatedAt ? `Updated ${fmtRelative(hub.generatedAt)}` : "No reports yet"}
        </span>
      </div>
    </aside>
  );
}

function ProjectGroup({ hub, project, collapsed, onToggle, isActive }: {
  hub: Hub; project: Project; collapsed: boolean; onToggle: () => void; isActive: (t: string) => boolean;
}) {
  const worst = project.reports.map((r) => latestRun(r)).find(isFailing);
  return (
    <div class={`sb-group${collapsed ? " collapsed" : ""}`}>
      <div class="sb-group-head">
        <button class="sb-caret-btn" type="button" aria-expanded={!collapsed} aria-label={`Toggle ${project.title}`} onClick={onToggle}>
          <Icon name="chevron-down" class="sb-caret" />
        </button>
        <NavLink to={routes.project(project.id)} active={isActive(routes.project(project.id))} icon="folder"
          hint={worst ? <StatusDot status={runStatus(worst)} /> : null}>{project.title}</NavLink>
      </div>
      <div class="sb-children">
        {project.reports.map((report) => {
          const run = latestRun(report);
          const head = headline(run, hub.config.metrics);
          const failed = failedCount(run);
          const hint = run?.stats && failed
            ? <span class="sb-count bad" title="Failed + broken in the latest run">{failed}</span>
            : head && head.key !== "passRate" ? <span class="hint">{head.info.format(head.value)}</span> : null;
          const target = routes.report(project.id, report.id);
          return (
            <NavLink key={report.id} to={target} active={isActive(target)} lead={<span class="sb-lead"><StatusDot status={runStatus(run)} /></span>}
              hint={hint} title={`${report.type} · ${run ? `${run.label}, ${fmtRelative(run.createdAt)}` : "no runs"}`}>
              {report.title}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

interface NavLinkProps {
  to: string;
  children: ComponentChildren;
  icon?: IconName | string;
  lead?: ComponentChildren;
  hint?: ComponentChildren;
  active?: boolean;
  external?: boolean;
  title?: string;
}

function NavLink({ to, children, icon, lead, hint, active, external, title }: NavLinkProps) {
  return (
    <a class={`sb-item${active ? " active" : ""}`} href={to} title={title} aria-current={active ? "page" : undefined}
      target={external ? "_blank" : undefined} rel={external ? "noopener" : undefined}>
      {lead ?? <Icon name={icon ?? "layers"} />}
      <span class="label">{children}</span>
      {hint}
      {external ? <Icon name="external" class="sb-ext" /> : null}
    </a>
  );
}
