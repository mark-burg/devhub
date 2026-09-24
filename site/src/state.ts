// App-wide state as signals. Components read `.value` and re-render when it changes.

import { computed, effect, signal } from "@preact/signals";
import type { Hub, HubConfig, Manifest } from "./types";
import { normalize } from "./selectors";
import { readTheme, writeTheme, THEMES, type Theme } from "./lib/prefs";

export const hub = signal<Hub>(normalize({}, null));
export const loaded = signal(false);

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function load(): Promise<void> {
  const [config, manifest] = await Promise.all([
    fetchJSON<HubConfig>("hub.config.json"),
    fetchJSON<Manifest>("data/manifest.json"),
  ]);
  hub.value = normalize(config ?? {}, manifest);
  loaded.value = true;
}

/** Re-reads the manifest; resolves to the updated hub when something was published, else null. */
export async function fetchUpdate(): Promise<Hub | null> {
  const manifest = await fetchJSON<Manifest>("data/manifest.json");
  if (!manifest || manifest.generatedAt === hub.value.generatedAt) return null;
  return normalize(hub.value.config, manifest);
}

// ───────────── theme ─────────────

const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
const systemDark = signal(media?.matches ?? false);
media?.addEventListener("change", (e) => { systemDark.value = e.matches; });

export const theme = signal<Theme>(readTheme());
export const isDark = computed(() => theme.value === "dark" || (theme.value === "auto" && systemDark.value));

export function cycleTheme(): void {
  theme.value = THEMES[(THEMES.indexOf(theme.value) + 1) % THEMES.length];
  writeTheme(theme.value);
}

if (typeof document !== "undefined") {
  effect(() => {
    if (theme.value === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme.value;
  });
}

// ───────────── chrome ─────────────

export const focusMode = signal(false);
export const navOpen = signal(false);
export const paletteOpen = signal(false);

export interface ToastState {
  text: string;
  action?: { label: string; run: () => void };
}
export const toast = signal<ToastState | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function showToast(text: string, action?: ToastState["action"]): void {
  toast.value = { text, action };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value = null; }, action ? 12000 : 2500);
}
