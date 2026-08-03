// Design tokens routed through CSS variables so the whole UI is theme-aware
// (light / dark). The variable values live in index.css. Event-type, filing and
// status chips use semi-transparent tints so they read on both surfaces.

import type { EventType, EventStatus, FilingCategory } from "./types";

export const tokens = {
  primary: "var(--primary)",
  primaryLight: "var(--primary-light)",
  primaryBorder: "var(--primary-border)",
  primaryText: "var(--primary-text)",
  accentBlue: "var(--accent-blue)",
  accentCyan: "var(--accent-cyan)",
  gradientBrand: "var(--gradient-brand)",
  gradientSoft: "var(--gradient-soft)",
  pageBg: "var(--page-bg)",
  cardBg: "var(--card-bg)",
  cardHeaderBg: "var(--card-header-bg)",
  cardBodyBg: "var(--card-body-bg)",
  surface: "var(--surface)",
  surface2: "var(--surface-2)",
  border: "var(--border)",
  borderSolid: "var(--border-solid)",
  borderStrong: "var(--border-strong)",
  bucketBg: "var(--bucket-bg)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  textHint: "var(--text-hint)",
  groupLabel: "var(--group-label)",
  moduleBg: "var(--module-bg)",
  moduleBd: "var(--module-bd)",
  errorRed: "var(--error-red)",
  errorBg: "var(--error-bg)",
  radiusCard: "var(--radius-card)",
  shadowCard: "var(--shadow-card)",
  shadowPop: "var(--shadow-pop)",
  shadowHeader: "var(--shadow-header)",
  font: "system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const;

export interface Chip {
  label: string;
  hex: string;
  bg: string;
  text: string;
  border: string;
}

function rgbOf(hex: string): string {
  return hex
    .replace("#", "")
    .match(/.{2}/g)!
    .map((h) => parseInt(h, 16))
    .join(",");
}

function chip(label: string, hex: string): Chip {
  const rgb = rgbOf(hex);
  return {
    label,
    hex,
    bg: `rgba(${rgb},0.12)`,
    text: hex,
    border: `rgba(${rgb},0.32)`,
  };
}

// Event types shown in the list. Earnings blue, Corporate Actions amber.
export const eventTypeMeta: Record<EventType, Chip> = {
  EARNINGS: chip("Earnings", "#2563eb"),
  CONCALL: chip("Concall", "#14b8a6"),
  DEMERGER: chip("Corporate Action", "#2563eb"),
};

// Filing categories in the details panel.
export const filingCategoryMeta: Record<FilingCategory, Chip> = {
  PRESS: chip("Press Release", "#6d4bff"),
  MEET: chip("Investor Meet", "#7c3aed"),
  PRESENTATION: chip("Presentation", "#06b6d4"),
  CONCALL: chip("Concall", "#14b8a6"),
  SCHEME: chip("Corporate Action", "#f59e0b"),
};

export const statusMeta: Record<EventStatus, Chip> = {
  CONFIRMED: chip("Confirmed", "#16a34a"),
  TENTATIVE: chip("Tentative", "#f59e0b"),
  REVISED: chip("Revised", "#f97316"),
};

// Deterministic accent + initials for a company avatar (no external logos).
const AVATAR_HUES = ["#4f46e5", "#2563eb", "#06b6d4", "#7c3aed", "#0ea5e9", "#0891b2", "#6366f1"];

export function companyAccent(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

export function initials(name: string): string {
  const words = name.replace(/\b(ltd|limited|inc|corp|co|the)\b/gi, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
