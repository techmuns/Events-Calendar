// How near an event is, expressed as a "tone" that drives colour, plus ready-made
// human phrases. Shared by the agenda rows, the "next up" hero KPI and the
// company popup so proximity reads identically everywhere.

import type { CSSProperties } from "react";
import type { EventType } from "../types";
import { tokens } from "../theme";
import { diffDays, parseISO, todayStart } from "./dates";

export type Tone = "today" | "tomorrow" | "soon" | "calm" | "past";

export interface Proximity {
  /** Signed whole-day offset from today: 0 = today, 1 = tomorrow, -3 = three days ago. */
  days: number;
  tone: Tone;
  /** Compact countdown label for a chip: "Today" · "Tomorrow" · "In 3 days" · "3d ago". */
  chip: string;
}

export function proximityOf(iso: string, today: Date = todayStart()): Proximity {
  const days = diffDays(today, parseISO(iso));
  if (days < 0) return { days, tone: "past", chip: `${-days}d ago` };
  if (days === 0) return { days, tone: "today", chip: "Today" };
  if (days === 1) return { days, tone: "tomorrow", chip: "Tomorrow" };
  if (days <= 6) return { days, tone: "soon", chip: `In ${days} days` };
  return { days, tone: "calm", chip: `In ${days} days` };
}

// Foreground colour for a tone (theme-aware via CSS variables).
export function toneColor(tone: Tone): string {
  switch (tone) {
    case "today":
      return tokens.todayFg;
    case "tomorrow":
      return tokens.tmrwFg;
    case "soon":
    case "calm":
      return tokens.primaryText;
    default:
      return tokens.textMuted;
  }
}

// Full colour set for a tone — used for a filled/outlined countdown chip or a
// surrounding wash on cards and rows.
export interface ToneSkin {
  fg: string;
  bg: string;
  bd: string;
  wash: string;
}
export function toneSkin(tone: Tone): ToneSkin {
  switch (tone) {
    case "today":
      return { fg: tokens.todayFg, bg: tokens.todayBg, bd: tokens.todayBd, wash: tokens.todayWash };
    case "tomorrow":
      return { fg: tokens.tmrwFg, bg: tokens.tmrwBg, bd: tokens.tmrwBd, wash: tokens.tmrwWash };
    case "soon":
    case "calm":
      return { fg: tokens.primaryText, bg: tokens.primaryLight, bd: tokens.primaryBorder, wash: tokens.primaryLight };
    default:
      return { fg: tokens.textMuted, bg: tokens.surface2, bd: tokens.border, wash: "transparent" };
  }
}

// Inline style for a small pill/chip that carries a tone.
export function toneChip(tone: Tone): CSSProperties {
  const s = toneSkin(tone);
  return { color: s.fg, background: s.bg, border: `1px solid ${s.bd}` };
}

// The "when" fragment on its own: "today" · "tomorrow" · "in 3 days" · "3 days ago".
export function whenWord(p: Proximity): string {
  if (p.days === 0) return "today";
  if (p.days === 1) return "tomorrow";
  if (p.days > 0) return `in ${p.days} days`;
  return `${-p.days} days ago`;
}

// A verb-led action phrase, type-aware: "Reports today", "Earnings call in 3 days",
// or — for corporate actions, which don't "report" — just the capitalised when.
export function actionPhrase(type: EventType, p: Proximity): string {
  const w = whenWord(p);
  if (type === "CONCALL") return `Earnings call ${w}`;
  if (type === "DEMERGER") return w.charAt(0).toUpperCase() + w.slice(1);
  return `Reports ${w}`;
}
