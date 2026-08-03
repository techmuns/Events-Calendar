import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
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
import { EventModal } from "./components/EventModal";
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

// Segmented view switcher, styled for the translucent-on-gradient header.
function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const opts: { key: View; label: string }[] = [
    { key: "agenda", label: "Agenda" },
    { key: "month", label: "Month" },
    { key: "table", label: "Table" },
  ];
  return (
    <div
      style={{
        display: "inline-flex",
        background: "rgba(255,255,255,0.14)",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
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
              padding: "5px 13px",
              borderRadius: 7,
              background: active ? "#ffffff" : "transparent",
              color: active ? "#4338ca" : "rgba(255,255,255,0.85)",
              boxShadow: active ? "0 1px 3px rgba(15,23,42,0.18)" : "none",
              transition: "all 0.2s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function HeaderChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        padding: "3px 9px",
        borderRadius: 7,
        border: "1px solid rgba(255,255,255,0.28)",
        background: "rgba(255,255,255,0.13)",
        color: "#ffffff",
      }}
    >
      {children}
    </span>
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

  // Reset to the clean landing view: close any open company profile, drop the
  // day drill-down, and clear the search box (keeps universe/horizon prefs).
  const goHome = () => {
    setSelected(null);
    setFocusDay(null);
    setFilters((f) => (f.search ? { ...f, search: "" } : f));
  };

  const handleFilters = (next: Filters) => {
    // Clearing the search returns home instead of leaving a searched company
    // stranded open in the details panel.
    if (!next.search && filters.search) {
      setSelected(null);
      setFocusDay(null);
    }
    setFilters(next);
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

  const headerBtn: CSSProperties = {
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.24)",
    background: "rgba(255,255,255,0.13)",
    borderRadius: 9,
    padding: "6px 12px",
    fontSize: 12.5,
    fontWeight: 600,
    color: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  const syncedTime = result
    ? new Date(result.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
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
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "0 20px",
          height: 62,
          background: tokens.gradientBrand,
          boxShadow: tokens.shadowHeader,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div
            onClick={goHome}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                goHome();
              }
            }}
            title="Back to home"
            aria-label="Back to home"
            style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, cursor: "pointer" }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                background: "rgba(255,255,255,0.16)",
                border: "1px solid rgba(255,255,255,0.28)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                flexShrink: 0,
              }}
            >
              <CalendarIcon size={19} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                Events Calendar
              </h1>
              <div className="hide-960" style={{ fontSize: 11, color: "rgba(255,255,255,0.72)", marginTop: 1, whiteSpace: "nowrap" }}>
                Corporate events intelligence
              </div>
            </div>
          </div>
          {ticker && (
            <HeaderChip className="hide-760">
              <span style={{ width: 6, height: 6, background: "#fff", borderRadius: "50%" }} />
              {ticker}
              {tickerCompany && <span style={{ opacity: 0.85, fontWeight: 500, textTransform: "none" }}>· {tickerCompany}</span>}
            </HeaderChip>
          )}
          <HeaderChip className="hide-1180">India · NSE / BSE</HeaderChip>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {result && (
            <div
              className="hide-960"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontSize: 11.5,
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
                padding: "5px 11px",
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 99,
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: result.live ? "#4ade80" : "#fbbf24",
                  boxShadow: result.live ? "0 0 0 3px rgba(74,222,128,0.3)" : "none",
                }}
              />
              {result.live ? "Live" : "Sample"} · synced {syncedTime}
            </div>
          )}
          <ViewToggle view={view} onChange={setView} />
          <button style={headerBtn} onClick={() => void reload()} disabled={loading} title="Refresh data">
            <RefreshIcon size={14} /> {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            aria-label="Toggle light/dark theme"
            title="Toggle theme"
            onClick={toggle}
            style={{ ...headerBtn, width: 34, padding: 0, justifyContent: "center" }}
          >
            {isDark ? <SunIcon size={15} /> : <MoonIcon size={15} />}
          </button>
        </div>
      </header>

      <main id="dashboard-main" data-dashboard-capture-root="true" className="dash-main">
        <FiltersBar filters={filters} onChange={handleFilters} counts={typeCounts} isDark={isDark} />

        {result ? (
          <KpiRow events={baseFiltered} generatedAt={result.generatedAt} live={result.live} />
        ) : (
          <KpiShimmer />
        )}

        {result && baseFiltered.length > 0 && !filters.search.trim() && (
          <DensityCard
            events={baseFiltered}
            selectedDay={focusDay}
            onSelectDay={setFocusDay}
            horizonDays={filters.horizonDays}
          />
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
                  selectedId={selected?.id}
                  isDark={isDark}
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
        </div>
      </main>

      {selected && (
        <EventModal
          event={selected}
          allEvents={result?.events ?? []}
          onSelect={selectEvent}
          isStarred={watchlist.has}
          onToggleStar={watchlist.toggle}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
