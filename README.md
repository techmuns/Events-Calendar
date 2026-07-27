# Events Calendar

A forward-looking corporate-events calendar for **Indian listed companies (NSE/BSE)** — monitor
upcoming **earnings, concalls, and demergers** across the market, delivered as a Munshot embedded
dashboard on top of a structured events feed built from free public exchange data.

## Status

Early / greenfield. The agreed v1 baseline lives in
**[`docs/EVENTS_CALENDAR_SPEC.md`](docs/EVENTS_CALENDAR_SPEC.md)** — read that first.

## At a glance

- **Market:** India (NSE + BSE)
- **Data:** in-house ingestion from free public exchange endpoints (no paid vendor)
- **Scope (v1):** earnings/results, concalls, demergers
- **UI:** agenda-first calendar with a month-grid toggle, filterable by index / sector / watchlist
- **Architecture:** ingestion service → events API (registered datasource) → embedded dashboard
