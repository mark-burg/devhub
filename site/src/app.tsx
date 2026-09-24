import { useEffect, useLayoutEffect, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { route } from "./router";
import { fetchUpdate, focusMode, hub, loaded, navOpen, paletteOpen, showToast } from "./state";
import { resolveView } from "./views/resolve";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { CommandPalette } from "./components/CommandPalette";
import { Toast } from "./components/Toast";
import { Loading } from "./components/ui";

const REFRESH_MS = 120_000;

export function App() {
  const h = hub.value;
  const r = route.value;
  const view = resolveView(r, h);
  const main = useRef<HTMLElement>(null);
  const full = useRef(false);
  full.current = !!view.full;
  const siteTitle = h.config.title ?? "Dev Hub";

  useEffect(() => { document.title = `${view.title} · ${siteTitle}`; }, [view.title, siteTitle]);

  // New route: start at the top and close the mobile nav.
  useLayoutEffect(() => {
    if (main.current) main.current.scrollTop = 0;
    navOpen.value = false;
  }, [view.key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); paletteOpen.value = true; return; }
      const typing = (e.target as Element | null)?.closest?.("input, textarea, select, [contenteditable]");
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); paletteOpen.value = true; }
      else if (e.key === "f" && full.current) focusMode.value = !focusMode.value;
      else if (e.key === "Escape" && focusMode.value) focusMode.value = false;
      else if (e.key === "?") showToast("⌘K or / search · [ ] previous/next run · f focus mode · ? this help");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Pick up newly published runs. Pages update in place; an open report keeps its frame until asked.
  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const next = await fetchUpdate();
      if (!next) return;
      if (full.current) {
        showToast("New results were published.", { label: "Refresh", run: () => { hub.value = next; } });
      } else {
        hub.value = next;
        showToast("New results were published.");
      }
    };
    document.addEventListener("visibilitychange", check);
    const timer = setInterval(check, REFRESH_MS);
    return () => { document.removeEventListener("visibilitychange", check); clearInterval(timer); };
  }, []);

  return (
    <>
      <div class={`app${focusMode.value ? " focus" : ""}${navOpen.value ? " nav-open" : ""}`}>
        <Sidebar hub={h} route={r} />
        <div class="scrim" onClick={() => { navOpen.value = false; }} />
        <div class="main">
          <Topbar crumbs={view.crumbs} />
          <main class={`view${view.full ? " is-full" : ""}`} ref={main} tabIndex={-1}>
            {loaded.value ? <ViewSlot key={view.key}>{view.element}</ViewSlot> : <div class="page"><Loading /></div>}
          </main>
        </div>
      </div>
      <CommandPalette hub={h} />
      <Toast />
    </>
  );
}

// A keyed wrapper so every route change remounts the view (fresh effects, iframes, filters).
function ViewSlot({ children }: { children: ComponentChildren }) {
  return <>{children}</>;
}
