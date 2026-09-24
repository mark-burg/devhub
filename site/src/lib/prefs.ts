// Per-viewer conveniences (collapsed groups, theme). Storage can be missing or throw
// (private windows, blocked site data) — the app must work without it.

export const prefs = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* not persisted */
    }
  },
};

export type Theme = "auto" | "light" | "dark";
export const THEMES: Theme[] = ["auto", "light", "dark"];

// Allure 3 stores its theme under the same key as a raw string ("light" | "dark" | "auto");
// sharing it keeps embedded reports in step with the hub.
export function readTheme(): Theme {
  try {
    const v = (localStorage.getItem("theme") ?? "").replace(/"/g, "");
    return (THEMES as string[]).includes(v) ? (v as Theme) : "auto";
  } catch {
    return "auto";
  }
}

export function writeTheme(theme: Theme): void {
  try {
    localStorage.setItem("theme", theme);
  } catch {
    /* not persisted */
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
