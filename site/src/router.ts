// Hash router: #/<segment>/<segment>?key=value. Hash routes keep deep links working on
// GitHub Pages without a 404 fallback, and survive being served from a sub-path.

import { signal } from "@preact/signals";

export interface Route {
  parts: string[];
  query: URLSearchParams;
}

export function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "");
  const q = raw.indexOf("?");
  const path = q < 0 ? raw : raw.slice(0, q);
  const query = new URLSearchParams(q < 0 ? "" : raw.slice(q + 1));
  const parts = path.split("/").filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  return { parts, query };
}

type Query = Record<string, string | null | undefined>;

export function href(parts: Array<string | null | undefined>, query?: Query): string {
  const path = "#/" + parts.filter((p): p is string => p != null && p !== "").map(encodeURIComponent).join("/");
  const entries = Object.entries(query ?? {}).filter((e): e is [string, string] => e[1] != null && e[1] !== "");
  const qs = new URLSearchParams(entries).toString();
  return qs ? `${path}?${qs}` : path;
}

export const route = signal<Route>(parse(typeof location === "undefined" ? "" : location.hash));

export function startRouter(): () => void {
  const onChange = () => { route.value = parse(location.hash); };
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function go(parts: Array<string | null | undefined>, query?: Query): void {
  location.hash = href(parts, query);
}

/** Update the URL without re-rendering (e.g. mirroring an iframe's inner location). */
export function replace(parts: Array<string | null | undefined>, query?: Query): void {
  history.replaceState(history.state, "", href(parts, query));
}

export const routes = {
  dashboard: () => href([]),
  activity: (query?: Query) => href(["activity"], query),
  project: (p: string, query?: Query) => href(["p", p], query),
  report: (p: string, r: string, run?: string, query?: Query) => href(["r", p, r, run], query),
  page: (id: string, query?: Query) => href(["page", id], query),
};
