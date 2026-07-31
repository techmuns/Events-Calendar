import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { CorporateEvent, EventType, Filters } from "./types";
import { tokens } from "./theme";
import { useEvents } from "./hooks/useEvents";
import { useHostContext } from "./hooks/useHostContext";
import { applyFilters } from "./lib/filter";
import { formatDate } from "./lib/dates";
import { FiltersBar } from "./components/FiltersBar";
import { KpiRow } from "./components/KpiRow";
import { AgendaView } from "./components/AgendaView";
import { MonthView } from "./components/MonthView";
import { DetailTable } from "./components/DetailTable";
import { WidgetCard } from "./components/WidgetCard";
import { ErrorState, ShimmerRows } from "./components/states";
import { DensityCard } from "./components/DensityCard";
import { DetailPanel } from "./components/DetailPanel";
import { useTheme } from "./hooks/useTheme";
import { useWatchlist } from "./hooks/useWatchlist";
import { useEventDiff } from "./hooks/useEventDiff";
import { CalendarIcon, MoonIcon, RefreshIcon, SunIcon } from "./components/icons";

const DEFAULT_FILTERS: Filters = {
  universe: "ALL",
  types: ["EARNINGS", "DEMERGER"],
  horizonDays: 90,
  search: "",
};

type View = "agenda" | "month" | "table";

function KpiShimmer() {
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="shimmer" style={{ height: 76, borderRadius: 14 }} />
      ))}
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const opts: { key: View; label: string }[] = [
    { key: "agenda", label: "Agenda" },
    { key: "month", label: "Month" },
    { key: "table", label: "Table" },
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
  const [focusDay, setFocusDay] = useState<string | null>(null);

  const selectEvent = (e: CorporateEvent) => {
    setSelected(e);
  };

  const baseFiltered = result ? applyFilters(result.events, filters, watchlist.set) : [];
  const filtered = focusDay ? baseFiltered.filter((e) => e.date === focusDay) : baseFiltered;
  const diffs = useEventDiff(result?.events ?? []);
  let newCount = 0;
  let revCount = 0;
  diffs.forEach((d) => (d.isNew ? newCount++ : d.isRevised ? revCount++ : null));

  const typeCounts = useMemo(() => {
    const c: Record<EventType, number> = { EARNINGS: 0, CONCALL: 0, DEMERGER: 0 };
    if (!result) return c;
    const all = applyFilters(
      result.events,
      { ...filters, types: ["EARNINGS", "DEMERGER"] },
      watchlist.set,
    );
    for (const e of all) c[e.eventType]++;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, filters.universe, filters.horizonDays, filters.search, watchlist.set]);

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

  const listTitle = view === "month" ? "Calendar" : view === "table" ? "All events" : "Upcoming events";
  const listSubtitle = result
    ? `${filtered.length} events · next ${filters.horizonDays} days${
        newCount || revCount ? ` · ${newCount} new, ${revCount} rescheduled` : ""
      }`
    : "Loading events…";

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
          padding: "0 20px",
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

      <main id="dashboard-main" data-dashboard-capture-root="true" className="dash-main">
        <FiltersBar filters={filters} onChange={setFilters} counts={typeCounts} />

        {result ? (
          <KpiRow events={baseFiltered} generatedAt={result.generatedAt} live={result.live} />
        ) : (
          <KpiShimmer />
        )}

        {result && baseFiltered.length > 0 && (
          <DensityCard events={baseFiltered} selectedDay={focusDay} onSelectDay={setFocusDay} />
        )}

        <div className="workspace">
          <div className="pane pane-left">
            <WidgetCard
              title={listTitle}
              subtitle={listSubtitle}
              fill
              right={
                focusDay ? (
                  <button
                    onClick={() => setFocusDay(null)}
                    style={{
                      cursor: "pointer",
                      border: `1px solid ${tokens.primaryBorder}`,
                      background: tokens.primaryLight,
                      color: tokens.primaryText,
                      borderRadius: 99,
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: "3px 10px",
                    }}
                  >
                    {formatDate(focusDay)} ✕
                  </button>
                ) : undefined
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
                  onSelect={selectEvent}
                  isStarred={watchlist.has}
                  onToggleStar={watchlist.toggle}
                />
              ) : view === "month" ? (
                <MonthView events={filtered} onSelect={selectEvent} />
              ) : (
                <DetailTable events={filtered} onSelect={selectEvent} />
              )}
            </WidgetCard>
          </div>

          <div className="pane pane-right">
            <DetailPanel
              selected={selected}
              allEvents={result?.events ?? []}
              onSelect={selectEvent}
              isStarred={watchlist.has}
              onToggleStar={watchlist.toggle}
              source={result?.source ?? "BSE + NSE"}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
