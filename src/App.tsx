import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { CompanyMatch, CorporateEvent, EventType, FilingCategory, Filters } from "./types";
import { companyAccent, tokens } from "./theme";
import { useEvents } from "./hooks/useEvents";
import { useHostContext } from "./hooks/useHostContext";
import { useCompanySearch } from "./hooks/useCompanySearch";
import { applyFilters, applyRecent } from "./lib/filter";
import { bucketFor, formatDate, parseISO, todayStart, type Bucket } from "./lib/dates";

const RANGE_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtRange(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  return `${d} ${RANGE_MONTHS[m - 1]}`;
}

// Quick time filters shown beside the "Upcoming events" title.
const AGENDA_QUICK: { key: Bucket | null; label: string }[] = [
  { key: null, label: "All" },
  { key: "Today", label: "Today" },
  { key: "Tomorrow", label: "Tomorrow" },
  { key: "This week", label: "This week" },
  { key: "Next week", label: "Next week" },
];
function BucketChips({ value, onChange }: { value: Bucket | null; onChange: (b: Bucket | null) => void }) {
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {AGENDA_QUICK.map((b) => {
        const active = value === b.key;
        return (
          <button
            key={b.label}
            onClick={() => onChange(b.key)}
            style={{
              cursor: "pointer",
              fontSize: 11.5,
              fontWeight: 600,
              padding: "4px 11px",
              borderRadius: 99,
              whiteSpace: "nowrap",
              border: `1px solid ${active ? tokens.primary : tokens.border}`,
              background: active ? tokens.primary : tokens.surface,
              color: active ? "#fff" : tokens.textSecondary,
              transition: "all 0.15s",
            }}
          >
            {b.label}
          </button>
        );
      })}
    </div>
  );
}
import { FiltersBar } from "./components/FiltersBar";
import { KpiRow } from "./components/KpiRow";
import { AgendaView } from "./components/AgendaView";
import { MonthView } from "./components/MonthView";
import { DetailTable } from "./components/DetailTable";
import { WidgetCard } from "./components/WidgetCard";
import { EmptyState, ErrorState, ShimmerRows } from "./components/states";
import { DensityCard } from "./components/DensityCard";
import { EventModal } from "./components/EventModal";
import { ComingUp } from "./components/ComingUp";
import { useTheme } from "./hooks/useTheme";
import { useWatchlist } from "./hooks/useWatchlist";
import { useEventDiff } from "./hooks/useEventDiff";
import { ChevronRightIcon, HomeIcon, MoonIcon, RefreshIcon, SunIcon } from "./components/icons";

const DEFAULT_FILTERS: Filters = {
  universe: "ALL",
  types: ["EARNINGS", "DEMERGER"],
  horizonDays: 14,
  search: "",
};

type View = "agenda" | "month" | "table";

function KpiShimmer() {
  return (
    <div className="kpi-grid">
      {Array.from({ length: 3 }).map((_, i) => (
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

// Search results for listed companies that have no upcoming event — clicking one
// opens its read-only profile (past filings & calls).
function CompanyProfileResults({
  matches,
  loading,
  onOpen,
}: {
  matches: CompanyMatch[];
  loading: boolean;
  onOpen: (m: CompanyMatch) => void;
}) {
  if (!loading && matches.length === 0) return null;
  return (
    <div style={{ padding: "11px 14px", borderBottom: `1px solid ${tokens.border}`, background: tokens.cardBodyBg }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: tokens.textHint,
          marginBottom: 8,
        }}
      >
        Companies {loading ? "· searching…" : `· ${matches.length}`}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {matches.map((m) => {
          const accent = companyAccent(m.symbol || m.name);
          return (
            <button
              key={m.symbol}
              onClick={() => onOpen(m)}
              className="card-hover"
              style={{
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "9px 12px",
                borderRadius: 11,
                border: `1px solid ${tokens.border}`,
                borderLeft: `3px solid ${accent}`,
                background: tokens.surface,
                boxShadow: tokens.shadowCard,
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: accent, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: tokens.textPrimary,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {m.name}
                </div>
                <div style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 1 }}>
                  {m.symbol} · {m.exchange} · past filings &amp; calls
                </div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, color: accent, flexShrink: 0 }}>
                View <ChevronRightIcon size={14} />
              </span>
            </button>
          );
        })}
      </div>
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
  const [agendaBucket, setAgendaBucket] = useState<Bucket | null>(null);
  const [pendingTab, setPendingTab] = useState<FilingCategory | null>(null);

  // Open a company's modal, optionally jumping straight to a materials tab.
  const selectEvent = (e: CorporateEvent, tab?: FilingCategory) => {
    setSelected(e);
    setPendingTab(tab ?? null);
  };

  // Open a searched company that has no upcoming event as a read-only profile
  // (its past filings, calls and materials still load in the details modal).
  const openProfile = (m: CompanyMatch) => {
    setSelected({
      id: `profile_${m.symbol}`,
      company: m.name,
      ticker: m.symbol,
      eventType: "EARNINGS",
      subtype: "Company profile",
      date: new Date().toISOString().slice(0, 10),
      status: "TENTATIVE",
      exchange: m.exchange,
      indices: [],
      sector: "",
      isProfile: true,
    });
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
  // Just-reported events shown above the upcoming list (not when drilled into a
  // single day). KPIs, density and reminders stay forward-looking via baseFiltered.
  const recentEvents = useMemo(() => (result ? applyRecent(result.events, filters, watchlist.set) : []), [result, filters, watchlist]);
  const agendaEvents = focusDay ? filtered : [...recentEvents, ...filtered];
  // Quick time filter (Today / Tomorrow / This week / Next week) beside the list.
  const displayAgenda = useMemo(() => {
    if (!agendaBucket) return agendaEvents;
    const t = todayStart();
    return agendaEvents.filter((e) => bucketFor(e.date, t) === agendaBucket);
  }, [agendaEvents, agendaBucket]);

  // Company search: surface listed firms that have no upcoming event (so they're
  // absent from the list) — e.g. CDSL, or a company that already reported.
  const { results: companyMatches, loading: searchLoading } = useCompanySearch(filters.search);
  const isSearching = filters.search.trim().length >= 2;
  const searchProfiles = useMemo(() => {
    const inList = new Set(filtered.map((e) => e.ticker.toUpperCase()));
    return companyMatches.filter((m) => !inList.has(m.symbol.toUpperCase()));
  }, [companyMatches, filtered]);

  const diffs = useEventDiff(result?.events ?? []);

  // "Coming up" reminders — the user's watchlist only, so the banner is purely
  // "your companies". Not horizon-limited: a watchlisted company reporting in 3
  // weeks still matters.
  const reminderEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (result?.events ?? [])
      .filter((e) => e.date >= today && watchlist.has(e.ticker) && filters.types.includes(e.eventType))
      .sort((a, b) => a.date.localeCompare(b.date) || a.company.localeCompare(b.company))
      .slice(0, 12);
  }, [result, watchlist, filters.types]);

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
  // A custom date range overrides the day-horizon everywhere the window is shown.
  const rangeActive = !!(filters.customStart && filters.customEnd);
  const rangeLabel = rangeActive ? `${fmtRange(filters.customStart!)} – ${fmtRange(filters.customEnd!)}` : `next ${filters.horizonDays} days`;
  const effectiveHorizon = rangeActive
    ? Math.max(1, Math.round((parseISO(filters.customEnd!).getTime() - parseISO(filters.customStart!).getTime()) / 86_400_000))
    : filters.horizonDays;
  const listSubtitle = result ? `${filtered.length} events · ${rangeLabel}` : "Loading events…";

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
              <HomeIcon size={19} />
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
          <KpiRow events={baseFiltered} onSelect={selectEvent} />
        ) : (
          <KpiShimmer />
        )}

        {result && !isSearching && filters.universe === "WATCHLIST" && (
          <ComingUp
            events={reminderEvents}
            watchlistCount={watchlist.set.size}
            isStarred={watchlist.has}
            onOpenEvent={selectEvent}
          />
        )}

        {result && baseFiltered.length > 0 && !filters.search.trim() && (
          <DensityCard
            events={baseFiltered}
            selectedDay={focusDay}
            onSelectDay={setFocusDay}
            horizonDays={effectiveHorizon}
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
                ) : view === "agenda" && !isSearching ? (
                  <BucketChips value={agendaBucket} onChange={setAgendaBucket} />
                ) : undefined
              }
            >
              {error ? (
                <ErrorState message={error} />
              ) : !result ? (
                <ShimmerRows rows={6} />
              ) : (
                <>
                  {isSearching && <CompanyProfileResults matches={searchProfiles} loading={searchLoading} onOpen={openProfile} />}
                  {view === "agenda" ? (
                    agendaEvents.length === 0 && isSearching ? (
                      searchProfiles.length > 0 ? null : (
                        <EmptyState
                          message={searchLoading ? "Searching companies…" : `No results for “${filters.search.trim()}”`}
                          hint="Try the full company name or its ticker symbol."
                        />
                      )
                    ) : (
                      <AgendaView
                        events={isSearching ? agendaEvents : displayAgenda}
                        diffs={diffs}
                        selectedId={selected?.id}
                        isDark={isDark}
                        onSelect={selectEvent}
                        isStarred={watchlist.has}
                        onToggleStar={watchlist.toggle}
                      />
                    )
                  ) : view === "month" ? (
                    <MonthView events={filtered} onSelect={selectEvent} />
                  ) : (
                    <DetailTable events={filtered} onSelect={selectEvent} />
                  )}
                </>
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
          initialTab={pendingTab}
        />
      )}
    </div>
  );
}
