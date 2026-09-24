// Small building blocks shared by the views.

import type { ComponentChildren, JSX } from "preact";
import { Icon, type IconName } from "./Icon";

interface ButtonProps {
  children?: ComponentChildren;
  href?: string;
  onClick?: (e: JSX.TargetedMouseEvent<HTMLElement>) => void;
  icon?: IconName;
  variant?: "ghost" | "outline" | "primary";
  title?: string;
  external?: boolean;
  trailing?: boolean;
  disabled?: boolean;
}

export function Button({ children, href, onClick, icon, variant = "ghost", title, external, trailing, disabled }: ButtonProps) {
  const iconOnly = children == null || children === "";
  const cls = `btn btn-${variant}${iconOnly ? " btn-icon" : ""}${disabled ? " is-disabled" : ""}`;
  const ic = icon ? <Icon name={icon} /> : null;
  const text = iconOnly ? null : <span>{children}</span>;
  const body = trailing ? [text, ic] : [ic, text];
  if (disabled) return <span class={cls} aria-hidden="true">{body}</span>;
  if (href) {
    return (
      <a class={cls} href={href} title={title} aria-label={iconOnly ? title : undefined}
        target={external ? "_blank" : undefined} rel={external ? "noopener" : undefined} onClick={onClick}>
        {body}
      </a>
    );
  }
  return <button class={cls} type="button" title={title} aria-label={iconOnly ? title : undefined} onClick={onClick}>{body}</button>;
}

export interface Option { value: string; label: string; disabled?: boolean }

export function Select({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (v: string) => void }) {
  return (
    <label class="field">
      <span class="field-label">{label}</span>
      <select class="select" aria-label={label} value={value} onChange={(e) => onChange(e.currentTarget.value)}>
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ComponentChildren; children?: ComponentChildren }) {
  return (
    <header class="page-head">
      <div class="page-head-text">
        <h1>{title}</h1>
        {subtitle ? <p class="subtle">{subtitle}</p> : null}
      </div>
      {children ? <div class="page-head-actions">{children}</div> : null}
    </header>
  );
}

export function EmptyState({ title, children, actions }: { title: string; children?: ComponentChildren; actions?: ComponentChildren }) {
  return (
    <div class="empty card">
      <Icon name="layers" class="empty-icon" />
      <h2>{title}</h2>
      {children ? <div class="subtle">{children}</div> : null}
      {actions ? <div class="row gap">{actions}</div> : null}
    </div>
  );
}

export function Loading({ text = "Loading…" }: { text?: string }) {
  return <div class="loading"><span class="spinner" aria-hidden="true" />{text}</div>;
}

export function ErrorBox({ title, detail }: { title: string; detail?: string }) {
  return (
    <div class="card error-box">
      <Icon name="alert" />
      <div><strong>{title}</strong>{detail ? <div class="subtle">{detail}</div> : null}</div>
    </div>
  );
}

export function Page({ children, class: cls = "" }: { children: ComponentChildren; class?: string }) {
  return <div class={`page ${cls}`.trim()}>{children}</div>;
}
