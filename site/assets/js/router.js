// Hash router: #/<segment>/<segment>?key=value. Hash routes keep deep links working on
// GitHub Pages without a 404 fallback, and survive being served from a sub-path.

export function parse(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, "");
  const q = raw.indexOf("?");
  const path = q < 0 ? raw : raw.slice(0, q);
  const query = new URLSearchParams(q < 0 ? "" : raw.slice(q + 1));
  const parts = path.split("/").filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  return { parts, query };
}

export function href(parts, query) {
  const path = "#/" + parts.filter((p) => p != null && p !== "").map((p) => encodeURIComponent(p)).join("/");
  const qs = new URLSearchParams(Object.entries(query ?? {}).filter(([, v]) => v != null && v !== "")).toString();
  return qs ? `${path}?${qs}` : path;
}

export function go(parts, query) {
  location.hash = href(parts, query);
}

// Update the URL without triggering a re-render (e.g. syncing an iframe's inner location).
export function replace(parts, query) {
  history.replaceState(history.state, "", href(parts, query));
}

export const routes = {
  dashboard: () => href([]),
  activity: (query) => href(["activity"], query),
  project: (p, query) => href(["p", p], query),
  report: (p, r, run, query) => href(["r", p, r, run], query),
  page: (id) => href(["page", id]),
};
