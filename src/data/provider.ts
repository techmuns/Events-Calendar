// The single data boundary for the dashboard. The UI depends only on
// EventsProvider, so moving from sample data to the live NSE/BSE feed is a
// one-line swap of `eventsProvider` below — no component changes.

import type { EventsResult } from "../types";
import { buildSampleEvents } from "./sampleEvents";

export interface EventsProvider {
  getEvents(): Promise<EventsResult>;
}

export const sampleProvider: EventsProvider = {
  async getEvents() {
    // brief delay so loading states are exercised
    await new Promise((r) => setTimeout(r, 450));
    return {
      events: buildSampleEvents(),
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
    return (await res.json()) as EventsResult;
  },
};

// Active provider. Switch to `apiProvider` once the backend is live.
export const eventsProvider: EventsProvider = sampleProvider;
