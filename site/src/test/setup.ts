import { afterEach } from "vitest";
import { cleanup } from "@testing-library/preact";

afterEach(cleanup);

// jsdom has no layout: give elements a width so charts render, and stub ResizeObserver.
if (typeof HTMLElement !== "undefined") {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 800 });
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
