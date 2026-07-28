// Design tokens routed through CSS variables so the whole UI is theme-aware
// (light / dark). The variable values live in index.css. Event-type and status
// chips use semi-transparent tints so they read well on both light and dark
// surfaces without per-theme overrides.

import type { EventType, EventStatus } from "./types";

export const tokens = {
  primary: "var(--primary)",
  primaryLight: "var(--primary-light)",
  primaryBorder: "var(--primary-border)",
  primaryText: "var(--primary-text)",
  pageBg: "var(--page-bg)",
  cardBg: "var(--card-bg)",
  cardHeaderBg: "var(--card-header-bg)",
  cardBodyBg: "var(--card-body-bg)",
  surface: "var(--surface)",
  surface2: "var(--surface-2)",
  border: "var(--border)",
  borderSolid: "var(--border-solid)",
  bucketBg: "var(--bucket-bg)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  textHint: "var(--text-hint)",
  errorRed: "var(--error-red)",
  errorBg: "var(--error-bg)",
  font: "system-ui, -apple-system, sans-serif",
} as const;

interface Chip {
  label: string;
  bg: string;
  text: string;
  border: string;
}

function chip(label: string, hex: string): Chip {
  const rgb = hex
    .replace("#", "")
    .match(/.{2}/g)!
    .map((h) => parseInt(h, 16))
    .join(",");
  return {
    label,
    bg: `rgba(${rgb},0.14)`,
    text: hex,
    border: `rgba(${rgb},0.34)`,
  };
}

export const eventTypeMeta: Record<EventType, Chip> = {
  EARNINGS: chip("Earnings", "#3b82f6"),
  CONCALL: chip("Concall", "#14b8a6"),
  DEMERGER: chip("Demerger", "#8b5cf6"),
};

export const statusMeta: Record<EventStatus, Chip> = {
  CONFIRMED: chip("Confirmed", "#22c55e"),
  TENTATIVE: chip("Tentative", "#f59e0b"),
  REVISED: chip("Revised", "#f97316"),
};
