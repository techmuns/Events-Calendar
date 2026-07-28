// Canonical domain types for the Events Calendar.
// Every view renders from CorporateEvent, so swapping the sample data layer for
// the live NSE/BSE feed later requires no UI changes.

export type EventType = "EARNINGS" | "CONCALL" | "DEMERGER";

export type EventStatus = "CONFIRMED" | "TENTATIVE" | "REVISED";

export type Exchange = "NSE" | "BSE";

export type MarketCap = "LARGE" | "MID" | "SMALL";

export interface CorporateEvent {
  id: string;
  company: string;
  ticker: string; // NSE symbol
  isin?: string;
  eventType: EventType;
  subtype: string; // e.g. "Q1 FY27 Results", "Analyst Concall", "Demerger record date"
  date: string; // ISO date, yyyy-mm-dd
  time?: string; // 24h "HH:MM" when known
  status: EventStatus;
  exchange: Exchange;
  sourceUrl?: string;
  indices: string[]; // e.g. ["NIFTY50", "NIFTY500"]
  sector: string;
  marketCap?: MarketCap;
}

export interface EventsResult {
  events: CorporateEvent[];
  generatedAt: string; // ISO timestamp of when this data was produced
  source: string; // human label, e.g. "Sample dataset" or "NSE + BSE (live)"
  live: boolean; // false for the seed data, true once wired to the feed
}

// ---- Filter state shared across the dashboard ----

export type Universe = "ALL" | "NIFTY50" | "NIFTY500" | "WATCHLIST";

export interface Filters {
  universe: Universe;
  types: EventType[]; // which event types are visible
  horizonDays: number; // only show events within this many days from today
  search: string;
}
