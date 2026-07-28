import { useState } from "react";
import type { CSSProperties } from "react";
import type { Filters } from "./types";
import { tokens } from "./theme";
import { useEvents } from "./hooks/useEvents";
import { useHostContext } from "./hooks/useHostContext";
import { applyFilters } from "./lib/filter";
import { FiltersBar } from "./components/FiltersBar";
import { KpiRow } from "./components/KpiRow";
import { AgendaView } from "./components/AgendaView";
import { MonthView } from "./components/MonthView";
import { DetailTable } from "./components/DetailTable";
import { SourcesWidget } from "./components/SourcesWidget";
import { WidgetCard } from "./components/WidgetCard";
import { ErrorState, ShimmerRows } from "./components/states";

const DEFAULT_FILTERS: Filters = {
  universe: "NIFTY500",
  types: ["EARNINGS", "CONCALL", "DEMERGER"],
  horizonDays: 90,
  search: "",
};

type View = "agenda" | "month";

function KpiShimmer() {
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="shimmer" style={{ height: 82, borderRadius: 14 }} />
      ))}
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const opts: { key: View; label: string }[] = [
    { key: "agenda", label: "Agenda" },
    { key: "month", label: "Month" },
  ];
  return (
    <div style={{ display: "inline-flex", background: "#f3f4f6", borderRadius: 8, padding: 2 }}>
      {opts.map((o) => {
        const active = o.key === view;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{
              border: "none",
              cursor: "pointer",
              fontSize: 12.5,
              fontWeight: 600,
              padding: "5px 12px",
              borderRadius: 6,
              background: active ? "#fff" : "transparent",
              color: active ? tokens.primaryText : tokens.textMuted,
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [view, setView] = useState<View>("agenda");
  const { result, loading, error, reload } = useEvents();
  const { ticker, tickerCompany } = useHostContext();

  const filtered = result ? applyFilters(result.events, filters) : [];

  const shell: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
    background: tokens.pageBg,
    fontFamily: tokens.font,
    color: tokens.textPrimary,
  };

  const actionBtn: CSSProperties = {
    cursor: "pointer",
    border: `1px solid ${tokens.borderSolid}`,
    background: "#fff",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12.5,
    fontWeight: 600,
    color: tokens.textSecondary,
  };

  return (
    <div style={shell}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          height: 48,
          background: tokens.cardHeaderBg,
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${tokens.borderSolid}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: tokens.textPrimary, margin: 0 }}>
            Events Calendar
          </h1>
          {ticker && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "2px 10px",
                background: tokens.primaryLight,
                color: tokens.primaryText,
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 600,
                border: `1px solid ${tokens.primaryBorder}`,
              }}
            >
              <span style={{ width: 6, height: 6, background: tokens.primary, borderRadius: "50%" }} />
              {ticker}
              {tickerCompany && <span style={{ color: "#818cf8", fontWeight: 400 }}>· {tickerCompany}</span>}
            </span>
          )}
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "2px 8px",
              borderRadius: 6,
              border: "1px solid #fde68a",
              background: "#fffbeb",
              color: "#d97706",
            }}
          >
            India · NSE/BSE
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ViewToggle view={view} onChange={setView} />
          <button style={actionBtn} onClick={() => void reload()} disabled={loading}>
            {loading ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </header>

      <main
        id="dashboard-main"
        data-dashboard-capture-root="true"
        style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1280, margin: "0 auto" }}>
          <FiltersBar filters={filters} onChange={setFilters} />

          {result ? (
            <KpiRow events={filtered} generatedAt={result.generatedAt} live={result.live} />
          ) : (
            <KpiShimmer />
          )}

          <WidgetCard
            title={view === "agenda" ? "Upcoming events" : "Calendar"}
            subtitle={
              result
                ? `${filtered.length} events · next ${filters.horizonDays} days`
                : "Loading events…"
            }
          >
            {error ? (
              <ErrorState message={error} />
            ) : !result ? (
              <ShimmerRows rows={6} />
            ) : view === "agenda" ? (
              <AgendaView events={filtered} />
            ) : (
              <MonthView events={filtered} />
            )}
          </WidgetCard>

          <WidgetCard title="All events" subtitle="Sortable — click a column header">
            {!result ? <ShimmerRows rows={4} /> : <DetailTable events={filtered} />}
          </WidgetCard>

          <WidgetCard title="Sources & freshness">
            {!result ? <ShimmerRows rows={3} /> : <SourcesWidget result={result} />}
          </WidgetCard>
        </div>
      </main>
    </div>
  );
}
