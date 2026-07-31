// The single data boundary for the dashboard. The UI depends only on
// EventsProvider, so moving from sample data to the live NSE/BSE feed is a
// one-line swap of `eventsProvider` below — no component changes.

import type { CompanyFilingsResult, EventsResult } from "../types";
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
// Results are memoised per symbol for the session so re-opening is instant.
const filingsCache = new Map<string, CompanyFilingsResult>();

export async function getCompanyFilings(symbol: string): Promise<CompanyFilingsResult> {
  const sym = symbol.trim().toUpperCase();
  const cached = filingsCache.get(sym);
  if (cached) return cached;
  const res = await fetch(`/api/company-filings?symbol=${encodeURIComponent(sym)}`);
  if (!res.ok) throw new Error(`Filings unavailable (HTTP ${res.status})`);
  const data = (await res.json()) as CompanyFilingsResult;
  const normalised: CompanyFilingsResult = { ...data, filings: data.filings ?? [] };
  filingsCache.set(sym, normalised);
  return normalised;
}
