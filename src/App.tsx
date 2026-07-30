import { useState } from "react";
import type { CSSProperties } from "react";
import type { CorporateEvent, Filters } from "./types";
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
import { Heatmap } from "./components/Heatmap";
import { EventDrawer } from "./components/EventDrawer";
import { ConcallsPanel } from "./components/ConcallsPanel";
import { useTheme } from "./hooks/useTheme";
import { useWatchlist } from "./hooks/useWatchlist";
import { useEventDiff } from "./hooks/useEventDiff";
import { CalendarIcon, MoonIcon, RefreshIcon, SunIcon } from "./components/icons";

const DEFAULT_FILTERS: Filters = {
  universe: "ALL",
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
    <div style={{ display: "inline-flex", background: tokens.surface2, borderRadius: 8, padding: 2 }}>
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
              background: active ? tokens.surface : "transparent",
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
  const { isDark, toggle } = useTheme();
  const watchlist = useWatchlist();
  const [selected, setSelected] = useState<CorporateEvent | null>(null);

  const filtered = result ? applyFilters(result.events, filters, watchlist.set) : [];
  const diffs = useEventDiff(result?.events ?? []);
  let newCount = 0;
  let revCount = 0;
  diffs.forEach((d) => (d.isNew ? newCount++ : d.isRevised ? revCount++ : null));

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
    background: tokens.surface,
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
          <span style={{ color: tokens.primary, display: "inline-flex" }}>
            <CalendarIcon size={18} />
          </span>
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
          <button
            style={{ ...actionBtn, display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={() => void reload()}
            disabled={loading}
          >
            <RefreshIcon size={14} /> {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            aria-label="Toggle light/dark theme"
            title="Toggle theme"
            onClick={toggle}
            style={{ ...actionBtn, width: 32, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            {isDark ? <SunIcon size={15} /> : <MoonIcon size={15} />}
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

          {result && filtered.length > 0 && (
            <WidgetCard title="Earnings-season density" subtitle="Upcoming event volume by week">
              <Heatmap events={filtered} />
            </WidgetCard>
          )}

          <WidgetCard
            title={view === "agenda" ? "Upcoming events" : "Calendar"}
            subtitle={
              result
                ? `${filtered.length} events · next ${filters.horizonDays} days${
                    newCount || revCount
                      ? ` · ${newCount} new, ${revCount} rescheduled since last visit`
                      : ""
                  }`
                : "Loading events…"
            }
          >
            {error ? (
              <ErrorState message={error} />
            ) : !result ? (
              <ShimmerRows rows={6} />
            ) : view === "agenda" ? (
              <AgendaView
                events={filtered}
                diffs={diffs}
                onSelect={setSelected}
                isStarred={watchlist.has}
                onToggleStar={watchlist.toggle}
              />
            ) : (
              <MonthView events={filtered} onSelect={setSelected} />
            )}
          </WidgetCard>

          {result && filters.types.includes("CONCALL") && (
            <WidgetCard
              title="Recently announced concalls"
              subtitle="Analyst / investor call intimations — NSE filings (SEBI Reg 30)"
            >
              <ConcallsPanel concalls={result.concalls} />
            </WidgetCard>
          )}

          <WidgetCard title="All events" subtitle="Sortable — click a column header">
            {!result ? <ShimmerRows rows={4} /> : <DetailTable events={filtered} onSelect={setSelected} />}
          </WidgetCard>

          <WidgetCard title="Sources & freshness">
            {!result ? <ShimmerRows rows={3} /> : <SourcesWidget result={result} />}
          </WidgetCard>
        </div>
      </main>

      <EventDrawer
        event={selected}
        allEvents={result?.events ?? []}
        onClose={() => setSelected(null)}
        onSelect={setSelected}
        isStarred={watchlist.has}
        onToggleStar={watchlist.toggle}
      />
    </div>
  );
}
