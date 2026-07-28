// Munshot dashboard design tokens (from the embedded-dashboard UI standards).
// Indigo primary + grayscale chrome; per-category accents for event types.

import type { EventType, EventStatus } from "./types";

export const tokens = {
  primary: "#4f46e5",
  primaryLight: "#eef2ff",
  primaryBorder: "#e0e7ff",
  primaryText: "#4338ca",
  pageBg: "linear-gradient(to bottom, rgba(249,250,251,0.8), #ffffff)",
  cardBg: "rgba(255,255,255,0.9)",
  cardHeaderBg: "rgba(255,255,255,0.95)",
  cardBodyBg: "rgba(249,250,251,0.5)",
  border: "rgba(229,231,235,0.8)",
  borderSolid: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#374151",
  textMuted: "#6b7280",
  textHint: "#9ca3af",
  errorRed: "#ef4444",
  errorBg: "#fef2f2",
  font: "system-ui, -apple-system, sans-serif",
} as const;

export const eventTypeMeta: Record<
  EventType,
  { label: string; bg: string; text: string; border: string }
> = {
  EARNINGS: { label: "Earnings", bg: "#eff6ff", text: "#2563eb", border: "#dbeafe" },
  CONCALL: { label: "Concall", bg: "#f0fdfa", text: "#0d9488", border: "#99f6e4" },
  DEMERGER: { label: "Demerger", bg: "#f5f3ff", text: "#7c3aed", border: "#ede9fe" },
};

export const statusMeta: Record<
  EventStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  CONFIRMED: { label: "Confirmed", bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  TENTATIVE: { label: "Tentative", bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  REVISED: { label: "Revised", bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" },
};
