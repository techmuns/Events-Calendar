import type { CorporateEvent, Filters, Universe } from "../types";
import { diffDays, parseISO, todayStart } from "./dates";

function matchUniverse(e: CorporateEvent, universe: Universe, watchlist: Set<string>): boolean {
  switch (universe) {
    case "ALL":
      return true;
    case "NIFTY50":
      return e.indices.includes("NIFTY50");
    case "NIFTY500":
      return e.indices.includes("NIFTY500");
    case "WATCHLIST":
      return watchlist.has(e.ticker);
    default:
      return true;
  }
}

// Upcoming events (today onward) matching the active filters, sorted by date.
export function applyFilters(
  events: CorporateEvent[],
  f: Filters,
  watchlist: Set<string>,
): CorporateEvent[] {
  const today = todayStart();
  const q = f.search.trim().toLowerCase();
  const customRange = f.customStart && f.customEnd ? { start: f.customStart, end: f.customEnd } : null;
  return events
    .filter((e) => f.types.includes(e.eventType))
    .filter((e) => {
      if (customRange) return e.date >= customRange.start && e.date <= customRange.end;
      const d = diffDays(today, parseISO(e.date));
      return d >= 0 && d <= f.horizonDays;
    })
    .filter((e) => matchUniverse(e, f.universe, watchlist))
    .filter(
      (e) =>
        !q ||
        e.company.toLowerCase().includes(q) ||
        e.ticker.toLowerCase().includes(q) ||
        e.sector.toLowerCase().includes(q),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.company.localeCompare(b.company));
}
