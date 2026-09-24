import type { ComponentChildren } from "preact";
import type { Status } from "../types";
import { Icon } from "./Icon";

const LABELS: Record<Status, string> = {
  passed: "Passed", failed: "Failed", broken: "Broken", skipped: "Skipped", unknown: "Unknown", neutral: "Published",
};

const known = (s?: string | null): Status => (s && s in LABELS ? (s as Status) : "neutral");

export const statusLabel = (s?: string | null) => LABELS[known(s)];

export function StatusPill({ status, children }: { status?: Status | null; children?: ComponentChildren }) {
  const st = known(status);
  return (
    <span class={`pill st-${st}`}>
      <Icon name={`status-${st}`} />
      {children ?? LABELS[st]}
    </span>
  );
}

export function StatusDot({ status }: { status?: Status | null }) {
  const st = known(status);
  return <span class={`dot st-${st}`} role="img" aria-label={LABELS[st]} title={LABELS[st]} />;
}
