# Events Calendar

A forward-looking corporate-events calendar for **Indian listed companies (NSE/BSE)** — monitor
upcoming **earnings, concalls, and demergers** across the market, delivered as a Munshot embedded
dashboard on top of a structured events feed built from free public exchange data.

## Status

Early / greenfield. The agreed v1 baseline lives in
**[`docs/EVENTS_CALENDAR_SPEC.md`](docs/EVENTS_CALENDAR_SPEC.md)** — read that first.

The repo contains a working **Layer 3 dashboard** (Vite + React + TypeScript): a filterable
**agenda + month calendar**, KPI row, sortable detail table, and a source/freshness panel.
It currently runs on a realistic **sample dataset** (shaped from the real NSE/BSE feed) behind a
single swappable data provider (`src/data/provider.ts`). The live NSE/BSE feed — a Worker with
Cron Triggers + D1 — wires in next by switching that one provider, with no UI changes.

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the dev server
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

Requires Node 18+ (developed on Node 22).

## At a glance

- **Market:** India (NSE + BSE)
- **Data:** in-house ingestion from free public exchange endpoints (no paid vendor)
- **Scope (v1):** earnings/results, concalls, demergers
- **UI:** agenda-first calendar with a month-grid toggle, filterable by index / sector / watchlist
- **Architecture:** ingestion service → events API (registered datasource) → embedded dashboard
