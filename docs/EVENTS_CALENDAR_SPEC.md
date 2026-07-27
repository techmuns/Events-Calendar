# Events Calendar — v1 Specification

A forward-looking corporate-events calendar for **Indian listed companies (NSE/BSE)** that lets
users monitor upcoming **earnings, concalls, and demergers** across the market. Delivered as a
**Munshot embedded dashboard** (iframe + Dashboard SDK), fed by a structured events feed that we
build ourselves from the exchanges' free public data.

> Status: **v1 spec — locked for build.** This document is the agreed baseline before code.

---

## 1. Decisions (locked)

| Area | Decision |
| --- | --- |
| Market | India only — NSE & BSE |
| Data strategy | **Structured feed built in-house** from **free** public exchange endpoints (no paid vendor) |
| Universe | **Full listed universe** ingested into the backend; the dashboard **filters down** |
| Default filter | Nifty 500 (a dashboard-managed watchlist is a fast-follow); "All" always one click away |
| v1 event types | **Earnings/Results, Concalls, Demergers** (others deferred) |
| Primary UI | **Agenda-first** (upcoming timeline) with a **month-grid toggle** |
| Platform | Munshot embedded dashboard — 3-zone shell, `WidgetCard`s, Dashboard SDK auth/context |

---

## 2. What we're building

The client asked for "an events calendar where we can monitor all upcoming events such as
earnings, concalls, demerger dates etc for our tracking companies." Because we need **structured**
data across **all listed companies**, and no corporate-calendar datasource exists in the Munshot
registry today, this is a **two-part build**:

1. A **backend events feed** that ingests structured corporate-event data for the whole Indian
   listed universe from free exchange endpoints, and
2. This **dashboard** on top of it.

---

## 3. Architecture (3 layers)

```
BSE / NSE public endpoints
        │
        ▼
Layer 1 — Ingestion service   (fetch → classify → dedupe → store)
        │
        ▼
Layer 2 — Events API          (GET /corporate-calendar, registered datasource)
        │
        ▼
Layer 3 — Dashboard           (Munshot iframe: filters, agenda/month, KPIs, table, provenance)
```

A clean boundary at **Layer 2** means the dashboard doesn't care how events are sourced. If we ever
license a vendor feed, we swap Layer 1's fetchers and the UI is untouched.

### Layer 1 — Ingestion service

- **Schedule:** board meetings & announcements polled a few times per day; corporate actions daily.
- **Fetchers:** one per exchange, with browser-like headers (and NSE cookie bootstrap). Raw payloads
  stored for audit. Retry with exponential backoff; cache last-good pull.
- **Classifier** — map exchange categories to our 3 v1 types:
  - Board-meeting purpose contains "Financial Results" → **EARNINGS**
  - Announcement subject matches earnings-call / analyst-meet / concall patterns → **CONCALL**
  - Scheme-of-arrangement / demerger announcement + its record/ex-date → **DEMERGER**
- **Dedupe:** the same company + type + date across BSE & NSE collapses to one event, keeping both
  source links.
- **Upserts** are idempotent, keyed on the event `id`.
- **Status tracking:** a new future date is `CONFIRMED` (board-meeting intimation) or `TENTATIVE`;
  a later filing that changes the date marks it `REVISED`.

### Layer 2 — Events API (new registered datasource)

```
GET /corporate-calendar?from=&to=&types=&tickers=&index=&sector=&status=&page=&page_size=
  → { events[], total, page, page_size, generated_at, sources[] }

GET /corporate-calendar/universe     → filter options (indices, sectors)
GET /corporate-calendar/freshness    → last successful sync per exchange
```

- Auth: `Authorization: Bearer <session.token>` (JWT forwarded by the Dashboard SDK).
- Service pattern: `fastapi` (`https://fastapi.muns.io` + path).
- **Coordination step:** this endpoint must be **added to the Munshot datasource registry** so the
  dashboard consumes it under the standard rules (no undocumented API dependencies).

### Layer 3 — Dashboard (this repo)

Munshot 3-zone iframe shell. Reads `session.token` and `market.selectedTicker` from the SDK host
context; never implements its own auth. Implements the `dashboard.capture.visual` export handler.

---

## 4. Free data sources (what "full free" means)

We ingest directly from the exchanges' own public JSON — the same feeds their websites use — at no
cost:

- **BSE:** Board Meetings, Corporate Announcements, and Corporate Actions APIs (`api.bseindia.com`).
  Requires a browser `User-Agent` + `Origin` header. Generally the more reliable primary.
- **NSE:** `corporate-board-meetings`, `corporate-announcements`, `corporates-corporateActions`
  endpoints (`nseindia.com/api`). Requires a cookie bootstrap (load homepage first) + browser UA.
- **Universe metadata:** Nifty index constituent lists and sector/market-cap data (also free) power
  the filters.

**Honest caveat:** these endpoints are unofficial and may rate-limit, change, or block. "Free" means
**we own the maintenance.** Robustness plan: browser headers + cookie handling, retry/backoff,
cached last-good data, per-source freshness surfaced in the UI, and graceful partial-data handling
so one failed sync degrades gracefully instead of showing stale data as current.

> **Build Step 0 is a reachability spike** confirming both exchanges are callable from our infra —
> it is the single thing that can invalidate "full free," so we prove it first.

---

## 5. Data model

```
CorporateEvent {
  id              // stable hash(isin + event_type + event_date) — exchange-neutral
  company_name
  ticker          // NSE symbol
  bse_code        // BSE scrip code
  isin
  event_type      // EARNINGS | CONCALL | DEMERGER      (v1)
  event_subtype   // "Q1FY26 Results" | "Analyst Concall" | "Demerger record date"
  event_date      // date (+ time if provided)
  status          // CONFIRMED | TENTATIVE | REVISED
  source_exchange // BSE | NSE
  source_url      // link to the filing / announcement
  announced_at    // when the filing was made
  last_seen_at    // last ingest that reconfirmed the event
}

Company {
  ticker, bse_code, isin, company_name
  indices[]       // e.g. ["NIFTY50", "NIFTY500"]
  sector
  market_cap
}
```

---

## 6. Dashboard layout (Zone 2, in the mandated order)

- **Filters / context:** universe (Watchlist / Nifty 50 / Nifty 500 / All) · event-type toggles
  (Earnings, Concall, Demerger) · horizon (7 / 30 / 90 days) · search
- **KPIs (4):** Next event · Events this week · Companies reporting (next 30d) · Data freshness
- **Primary:** Agenda list (grouped Today / This week / Next week / Later) ⇄ **Month grid** toggle.
  Row = company · ticker · type chip · date · **status badge** · source link
- **Insights:** heaviest day · newly announced since last refresh · date revisions
- **Detail:** sortable / filterable events table
- **Sources / freshness:** per-exchange last-sync timestamps + link to each raw filing
- **States:** loading shimmer · waiting-for-session · empty · partial-data banner · friendly error
- **Export:** `dashboard.capture.visual` via `html-to-image`

Proposed stack: **React + Vite + TypeScript**, aligned with the SDK/iframe model and the
`use…` / `dashboard_…` naming conventions.

---

## 7. v1 scope boundaries

**In scope**
- Event types: earnings/results, concalls, demergers
- Exchanges: BSE + NSE
- Full universe ingested; filter by index / sector / watchlist
- Agenda + month views; provenance and freshness

**Deferred (later phases)**
- Additional event types: dividends / ex-dates, board meetings (generic), AGM/EGM, buyback, splits
- Alerts / notifications (e.g. X days before an event)
- Host-provided portfolio as the watchlist source
- Historical / past-event analytics

---

## 8. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Exchange endpoints block / rate-limit / change (free = fragile) | Browser headers + NSE cookie bootstrap, backoff, cached last-good, freshness surfaced, partial-data UI. Prove in Step 0. |
| Date reliability varies (results reliable; concall/demerger less so) | Show `CONFIRMED` / `TENTATIVE` / `REVISED` status honestly on every event. |
| Scale — full universe = 200+ events/day in results season | Filter-first UX; sensible default slice (Nifty 500), pagination / virtual scrolling. |
| Data usage terms | We surface only publicly filed corporate disclosures, attributed and linked to source; usage terms to be reviewed on our side. |

---

## 9. Build sequence

0. **Spike:** confirm BSE & NSE endpoint access from our infra.
1. BSE ingestion + classifier for the 3 event types → storage.
2. Events API (Layer 2) + register the datasource.
3. Add NSE ingestion + cross-exchange dedupe.
4. Dashboard shell + agenda view + filters against the API.
5. Month view, KPIs, insights, detail table, provenance, states, export.
6. Universe/index metadata + default filter (Nifty 500).
