import { useEffect, useMemo, useRef } from "react";
import type { CorporateEvent } from "../types";

// Browser-local "what changed since your last visit" detection. We key events by
// company + type (NOT id, because the id embeds the date — so a reschedule would
// otherwise look like a brand-new event). A snapshot of key -> date is kept in
// localStorage; on load we diff the current feed against it, then refresh it.

const KEY = "ec-seen-v1";

export interface EventDiff {
  isNew: boolean;
  isRevised: boolean;
  prevDate?: string;
}

function loadSeen(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {};
}

function keyOf(e: CorporateEvent): string {
  return `${e.ticker}_${e.eventType}`;
}

export function useEventDiff(events: CorporateEvent[]): Map<string, EventDiff> {
  // Capture the previous-visit snapshot once, before this session writes over it.
  const baseline = useRef<Record<string, string> | null>(null);
  if (baseline.current === null) baseline.current = loadSeen();

  const diffs = useMemo(() => {
    const base = baseline.current ?? {};
    const map = new Map<string, EventDiff>();
    if (Object.keys(base).length === 0) return map; // first ever visit: flag nothing
    for (const e of events) {
      const prev = base[keyOf(e)];
      if (prev === undefined) map.set(e.id, { isNew: true, isRevised: false });
      else if (prev !== e.date) map.set(e.id, { isNew: false, isRevised: true, prevDate: prev });
    }
    return map;
  }, [events]);

  useEffect(() => {
    if (events.length === 0) return;
    const snap: Record<string, string> = {};
    for (const e of events) snap[keyOf(e)] = e.date;
    try {
      localStorage.setItem(KEY, JSON.stringify(snap));
    } catch {
      /* ignore */
    }
  }, [events]);

  return diffs;
}
