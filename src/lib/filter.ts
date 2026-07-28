import type { CorporateEvent, Filters, Universe } from "../types";
import { WATCHLIST_TICKERS } from "../data/sampleEvents";
import { diffDays, parseISO, todayStart } from "./dates";

function matchUniverse(e: CorporateEvent, universe: Universe): boolean {
  switch (universe) {
    case "ALL":
      return true;
    case "NIFTY50":
      return e.indices.includes("NIFTY50");
    case "NIFTY500":
      return e.indices.includes("NIFTY500");
    case "WATCHLIST":
      return WATCHLIST_TICKERS.includes(e.ticker);
    default:
      return true;
  }
}

// Upcoming events (today onward) that match the active filters, sorted by date.
export function applyFilters(events: CorporateEvent[], f: Filters): CorporateEvent[] {
  const today = todayStart();
  const q = f.search.trim().toLowerCase();
  return events
    .filter((e) => f.types.includes(e.eventType))
    .filter((e) => {
      const d = diffDays(today, parseISO(e.date));
      return d >= 0 && d <= f.horizonDays;
    })
    .filter((e) => matchUniverse(e, f.universe))
    .filter(
      (e) =>
        !q ||
        e.company.toLowerCase().includes(q) ||
        e.ticker.toLowerCase().includes(q) ||
        e.sector.toLowerCase().includes(q),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.company.localeCompare(b.company));
}
