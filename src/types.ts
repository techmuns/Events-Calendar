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
  isProfile?: boolean; // a searched company with no upcoming event — show its past filings only
}

// A company match from search (used to open a profile for firms that have no
// upcoming event, e.g. CDSL / Tata Steel / an already-reported company).
export interface CompanyMatch {
  name: string;
  symbol: string;
  exchange: Exchange;
}

// Concalls have no structured future date on BSE/NSE (it lives inside the PDF
// filing), so they're surfaced as "recently announced" intimations rather than
// dated timeline events.
export interface ConcallItem {
  id: string;
  company: string;
  ticker: string;
  summary: string; // what was filed, e.g. "Investor Conference Call"
  filedDate: string; // ISO date the intimation was filed
  exchange: Exchange;
  sourceUrl?: string; // link to the filing (which carries the exact date/time)
}

export interface EventsResult {
  events: CorporateEvent[];
  concalls: ConcallItem[];
  generatedAt: string; // ISO timestamp of when this data was produced
  source: string; // human label, e.g. "Sample dataset" or "BSE + NSE (live)"
  live: boolean; // false for the seed data, true once wired to the feed
}

// ---- Per-company filings (Details tab) ----
// Recent exchange filings for one company, segregated by kind, each with a
// direct PDF link. Populated on demand when a company's event is opened.

export type FilingCategory = "PRESS" | "MEET" | "PRESENTATION" | "CONCALL" | "SCHEME";
export type FilingSource = "NSE" | "BSE" | "Screener" | "Web";

export interface FilingLink {
  label: string; // e.g. "Transcript", "PPT", "REC"
  url: string;
  source: FilingSource;
}

export interface CompanyFiling {
  category: FilingCategory;
  title: string; // short human label from the filing
  date: string; // ISO date filed
  url?: string; // single-document filings (announcements)
  links?: FilingLink[]; // multi-document filings (Screener concalls)
  source: FilingSource; // where the primary document is hosted
}

export interface CompanyFilingsResult {
  symbol: string;
  filings: CompanyFiling[];
  generatedAt: string;
  source: string; // provenance label, e.g. "BSE · NSE · Screener"
  ok?: boolean; // false when every source failed (vs. genuinely no filings)
}

// ---- Filter state shared across the dashboard ----

export type Universe = "ALL" | "NIFTY50" | "NIFTY500" | "WATCHLIST";

export interface Filters {
  universe: Universe;
  types: EventType[]; // which event types are visible
  horizonDays: number; // only show events within this many days from today
  customStart?: string; // ISO — when set with customEnd, overrides horizonDays
  customEnd?: string; // ISO — inclusive end of a custom date range
  search: string;
}
