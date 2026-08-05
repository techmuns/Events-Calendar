// The single data boundary for the dashboard. The UI depends only on
// EventsProvider, so moving from sample data to the live NSE/BSE feed is a
// one-line swap of `eventsProvider` below — no component changes.

import type { CompanyFilingsResult, CompanyMatch, EventsResult } from "../types";
import { buildSampleConcalls, buildSampleEvents } from "./sampleEvents";

export interface EventsProvider {
  getEvents(): Promise<EventsResult>;
}

export const sampleProvider: EventsProvider = {
  async getEvents() {
    // brief delay so loading states are exercised
    await new Promise((r) => setTimeout(r, 450));
    return {
      events: buildSampleEvents(),
      concalls: buildSampleConcalls(),
      generatedAt: new Date().toISOString(),
      source: "Sample dataset",
      live: false,
    };
  },
};

// Wired in the next step: our Worker fetches NSE/BSE server-side and returns
// the same EventsResult shape.
export const apiProvider: EventsProvider = {
  async getEvents() {
    const res = await fetch("/api/corporate-calendar");
    if (!res.ok) throw new Error(`Feed unavailable (HTTP ${res.status})`);
    const data = (await res.json()) as EventsResult;
    return { ...data, concalls: data.concalls ?? [] };
  },
};

// Active provider: prefer the live NSE feed, fall back to sample data so the
// dashboard always shows something (e.g. if Cloudflare can't reach NSE).
export const eventsProvider: EventsProvider = {
  async getEvents() {
    try {
      const live = await apiProvider.getEvents();
      if (live.live && live.events.length > 0) return live;
      const sample = await sampleProvider.getEvents();
      return { ...sample, source: "Sample dataset (live feed returned no rows yet)" };
    } catch {
      return sampleProvider.getEvents();
    }
  },
};

// Per-company filings, fetched on demand when a company is opened in Details.
// Aggregated server-side from NSE + Screener (+ BSE-hosted docs via Screener).
// Results are memoised per company for the session so re-opening is instant.
const filingsCache = new Map<string, CompanyFilingsResult>();

export async function getCompanyFilings(symbol: string, name = ""): Promise<CompanyFilingsResult> {
  const sym = symbol.trim().toUpperCase();
  const key = `${sym}|${name.trim().toLowerCase()}`;
  const cached = filingsCache.get(key);
  if (cached) return cached;
  const qs = new URLSearchParams();
  if (sym) qs.set("symbol", sym);
  if (name.trim()) qs.set("name", name.trim());
  const res = await fetch(`/api/company-filings?${qs.toString()}`);
  if (!res.ok) throw new Error(`Filings unavailable (HTTP ${res.status})`);
  const data = (await res.json()) as CompanyFilingsResult;
  const normalised: CompanyFilingsResult = { ...data, filings: data.filings ?? [] };
  filingsCache.set(key, normalised);
  return normalised;
}

// Free-text company lookup so a searched firm with no upcoming event can still
// be opened for its past filings & calls.
const searchCache = new Map<string, CompanyMatch[]>();

export async function getCompanySearch(query: string): Promise<CompanyMatch[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const key = q.toLowerCase();
  const cached = searchCache.get(key);
  if (cached) return cached;
  try {
    const res = await fetch(`/api/company-search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: CompanyMatch[] };
    const results = data.results ?? [];
    searchCache.set(key, results);
    return results;
  } catch {
    return [];
  }
}
