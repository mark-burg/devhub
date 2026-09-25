import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { RefObject } from "preact";

/** True while the element's content is wider than the element (i.e. it scrolls sideways). */
export function useHorizontalOverflow<T extends HTMLElement>(): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflowing(isOverflowing(el));
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);
  return [ref, overflowing];
}

export const isOverflowing = (el: Element) => el.scrollWidth > el.clientWidth + 1;

/**
 * Scrollable regions must be reachable by keyboard (WCAG 2.1.1), but a tab stop on something
 * that doesn't scroll is just noise. Toggle tabindex to match.
 */
export function syncScrollableTabStops(root: ParentNode, selector: string): void {
  for (const el of root.querySelectorAll<HTMLElement>(selector)) {
    if (isOverflowing(el)) el.tabIndex = 0;
    else el.removeAttribute("tabindex");
  }
}
