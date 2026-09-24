// Vega-Lite / Vega specs rendered with vega-embed (a lazy chunk). Relative data URLs in the
// spec resolve against the spec file, e.g. "../../data/runs.json".

import { useEffect, useRef, useState } from "preact/hooks";
import type { NavItem } from "../../types";
import { isDark } from "../../state";
import { ErrorBox, Loading, Page, PageHeader } from "../../components/ui";
import { absUrl, fetchText } from "./Markdown";

export function Vega({ page }: { page: NavItem }) {
  const target = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | { error: string }>("loading");
  const dark = isDark.value;

  useEffect(() => {
    let cancelled = false;
    let finalize: (() => void) | undefined;
    (async () => {
      try {
        const spec = page.spec ?? JSON.parse(await fetchText(page.src ?? ""));
        const { default: embed } = await import("vega-embed");
        if (cancelled || !target.current) return;
        const result = await embed(target.current, spec, {
          actions: { export: true, source: true, compiled: false, editor: true },
          theme: dark ? "dark" : undefined,
          config: { background: "transparent", font: "system-ui, sans-serif" },
          loader: { baseURL: page.src ? absUrl(page.src).replace(/[^/]*$/, "") : location.href },
        });
        finalize = () => result.finalize();
        if (cancelled) finalize();
        else setStatus("ready");
      } catch (err) {
        if (!cancelled) setStatus({ error: (err as Error).message });
      }
    })();
    return () => { cancelled = true; finalize?.(); };
  }, [page.src, page.spec, dark]);

  return (
    <Page>
      <PageHeader title={page.title} subtitle={page.description} />
      <div class="card vega-card">
        {status === "loading" ? <Loading /> : null}
        {typeof status === "object" ? <ErrorBox title="Could not render this chart" detail={status.error} /> : null}
        <div class="vega-target" ref={target} />
      </div>
    </Page>
  );
}
