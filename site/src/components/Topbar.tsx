import type { Crumb } from "../views/resolve";
import { cycleTheme, navOpen, paletteOpen, theme } from "../state";
import { Icon } from "./Icon";

const THEME_ICON = { auto: "monitor", light: "sun", dark: "moon" } as const;

export function Topbar({ crumbs }: { crumbs: Crumb[] }) {
  const themeTitle = `Theme: ${theme.value} (click to change)`;
  return (
    <header class="topbar">
      <button class="btn btn-ghost btn-icon menu-btn" type="button" aria-label="Open navigation" onClick={() => { navOpen.value = !navOpen.value; }}>
        <Icon name="menu" />
      </button>
      <nav class="crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => [
          i ? <Icon key={`s${i}`} name="chevron-right" class="crumb-sep" /> : null,
          c.href
            ? <a key={i} href={c.href} class="crumb">{c.label}</a>
            : <span key={i} class={`crumb${i === crumbs.length - 1 ? " current" : ""}`}>{c.label}</span>,
        ])}
      </nav>
      <div class="topbar-actions">
        <button class="btn btn-ghost btn-icon search-top" type="button" aria-label="Search" onClick={() => { paletteOpen.value = true; }}>
          <Icon name="search" />
        </button>
        <button class="btn btn-ghost btn-icon" type="button" title={themeTitle} aria-label={themeTitle} onClick={cycleTheme}>
          <Icon name={THEME_ICON[theme.value]} />
        </button>
      </div>
    </header>
  );
}
