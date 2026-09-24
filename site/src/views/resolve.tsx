// Maps a route to the view to render plus the chrome around it (title, breadcrumbs, layout).

import type { JSX } from "preact";
import type { Hub } from "../types";
import type { Route } from "../router";
import { routes } from "../router";
import { findRun, getPage, getProject, getReport, navGroupOf } from "../selectors";
import { Button, EmptyState, Page } from "../components/ui";
import { Dashboard } from "./Dashboard";
import { ProjectView } from "./ProjectView";
import { Activity } from "./Activity";
import { Viewer } from "./Viewer";
import { FULL_PAGE_TYPES, PageView } from "./pages/PageView";

export interface Crumb {
  label: string;
  href?: string;
}

export interface ViewDef {
  /** Changes whenever the view should remount (new route or query). */
  key: string;
  title: string;
  crumbs: Crumb[];
  /** Fills the viewport (iframe views) instead of scrolling as a page. */
  full?: boolean;
  element: JSX.Element;
}

export function resolveView(route: Route, hub: Hub): ViewDef {
  const [head, a, b, c] = route.parts;
  const key = `${route.parts.join("/")}?${route.query.toString()}`;

  if (!head) return { key, title: "Dashboard", crumbs: [{ label: "Dashboard" }], element: <Dashboard hub={hub} /> };

  if (head === "activity") return { key, title: "Activity", crumbs: [{ label: "Activity" }], element: <Activity hub={hub} query={route.query} /> };

  if (head === "p") {
    const project = getProject(hub, a);
    if (project) {
      return {
        key, title: project.title, crumbs: [{ label: "Projects" }, { label: project.title }],
        element: <ProjectView hub={hub} project={project} query={route.query} />,
      };
    }
  }

  if (head === "r") {
    const report = getReport(hub, a, b);
    if (report) {
      const project = report.project;
      const crumbs: Crumb[] = [{ label: project.title, href: routes.project(project.id) }, { label: report.title }];
      const run = findRun(report, c);
      if (!run) {
        return {
          key, title: report.title, crumbs,
          element: (
            <Page>
              <EmptyState title="Run not found" actions={<Button href={routes.report(project.id, report.id)} variant="primary">Latest run</Button>}>
                There is no run “{c}” in {project.title} / {report.title}.
              </EmptyState>
            </Page>
          ),
        };
      }
      // The inner report location (?at=) is mirrored with replaceState and must not remount the frame.
      const viewKey = `r/${project.id}/${report.id}/${run.id}`;
      return {
        key: viewKey, title: `${report.title} ${run.label}`, crumbs: [...crumbs, { label: run.label }], full: true,
        element: <Viewer key={viewKey} report={report} run={run} runParam={c} at={route.query.get("at") ?? ""} />,
      };
    }
  }

  if (head === "page") {
    const page = getPage(hub, a);
    if (page) {
      const group = navGroupOf(hub, page);
      return {
        key, title: page.title,
        crumbs: [group?.title ? { label: group.title } : null, { label: page.title }].filter((x): x is Crumb => !!x),
        full: FULL_PAGE_TYPES.has(page.type),
        element: <PageView hub={hub} page={page} query={route.query} />,
      };
    }
  }

  return {
    key, title: "Not found", crumbs: [{ label: "Not found" }],
    element: (
      <Page>
        <EmptyState title="Nothing here" actions={<Button href={routes.dashboard()} variant="primary">Go to the dashboard</Button>}>
          This link points to a report or page that doesn't exist (any more).
        </EmptyState>
      </Page>
    ),
  };
}
