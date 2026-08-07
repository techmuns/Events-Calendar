import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { CompanyFiling, CorporateEvent, FilingCategory, FilingSource } from "../types";
import { companyAccent, eventTypeMeta, filingCategoryMeta, tokens } from "../theme";
import {
  CalendarIcon,
  ClockIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LayersIcon,
  MicIcon,
  PlayIcon,
  PresentationIcon,
  StarIcon,
  UsersIcon,
} from "./icons";
import { parseISO } from "../lib/dates";
import { downloadEventPdf } from "../lib/pdf";
import { callMonthToQuarter, lastNQuarters, quarterRank, type Quarter } from "../lib/quarters";
import { useCompanyFilings } from "../hooks/useCompanyFilings";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function longDate(iso: string): string {
  const d = parseISO(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function shortDate(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function monthYear(iso: string): string {
  const d = parseISO(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
// The Indian fiscal quarter a filing falls in (by its own date), for grouping a
// tab's documents into "Q1 FY27 · Q4 FY26 · …" sections of past quarters.
function fiscalQuarter(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return "Earlier";
  let q: number;
  let fy: number;
  if (m >= 4 && m <= 6) {
    q = 1;
    fy = y + 1;
  } else if (m >= 7 && m <= 9) {
    q = 2;
    fy = y + 1;
  } else if (m >= 10 && m <= 12) {
    q = 3;
    fy = y + 1;
  } else {
    q = 4;
    fy = y;
  }
  return `Q${q} FY${String(fy % 100).padStart(2, "0")}`;
}
function groupByQuarter(filings: CompanyFiling[]): [string, CompanyFiling[]][] {
  const map = new Map<string, CompanyFiling[]>();
  for (const f of filings) {
    const k = fiscalQuarter(f.date);
    (map.get(k) ?? map.set(k, []).get(k)!).push(f);
  }
  return [...map.entries()]; // filings are newest-first, so quarters come newest-first
}

const CAT_ORDER: FilingCategory[] = ["PRESS", "MEET", "PRESENTATION", "CONCALL", "SCHEME"];
const TAB_LABEL: Record<FilingCategory, string> = {
  PRESS: "Press Releases",
  MEET: "Investor Meets",
  PRESENTATION: "Presentations",
  CONCALL: "Earnings Calls",
  SCHEME: "Corporate Actions",
};
const TAB_ICON: Record<FilingCategory, (p: { size?: number }) => JSX.Element> = {
  PRESS: FileTextIcon,
  MEET: UsersIcon,
  PRESENTATION: PresentationIcon,
  CONCALL: MicIcon,
  SCHEME: LayersIcon,
};

const SRC_COLOR: Record<FilingSource, string> = {
  NSE: "#2563eb",
  BSE: "#0891b2",
  Screener: "#7c3aed",
  Web: "#64748b",
};

function SourceBadge({ source }: { source: FilingSource }) {
  const c = SRC_COLOR[source];
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        color: c,
        background: `color-mix(in srgb, ${c} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${c} 30%, transparent)`,
        borderRadius: 5,
        padding: "1px 5px",
      }}
    >
      {source}
    </span>
  );
}

const chipBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 600,
  padding: "7px 11px",
  borderRadius: 9,
  cursor: "pointer",
  border: `1px solid ${tokens.border}`,
  background: tokens.surface,
  color: tokens.textSecondary,
  textDecoration: "none",
};

function LinkAction({ label, url }: { label: string; url: string }) {
  const l = label.toLowerCase();
  const Icon = /ppt|present|deck|slide/.test(l)
    ? PresentationIcon
    : /rec|listen|audio|call/.test(l)
      ? PlayIcon
      : /transcript|note/.test(l)
        ? FileTextIcon
        : ExternalLinkIcon;
  const nice = /rec|listen|audio/.test(l) ? "Audio" : /transcript|note/.test(l) ? "Transcript" : /ppt|slide/.test(l) ? "Slides" : label;
  return (
    <a href={url} target="_blank" rel="noreferrer" style={chipBtn}>
      <Icon size={13} /> {nice}
    </a>
  );
}

function DocumentCard({ f, accent }: { f: CompanyFiling; accent: string }) {
  const cat = filingCategoryMeta[f.category];
  return (
    <div
      className="card-hover"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        border: `1px solid ${tokens.border}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 13,
        padding: "10px 12px",
        background: tokens.surface,
        boxShadow: tokens.shadowCard,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 38,
          height: 38,
          borderRadius: 10,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: cat.hex,
          background: cat.bg,
          border: `1px solid ${cat.border}`,
        }}
      >
        <FileTextIcon size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: tokens.textPrimary,
            letterSpacing: "-0.01em",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {f.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: tokens.textHint }}>{shortDate(f.date)}</span>
          <SourceBadge source={f.source} />
          <span style={{ fontSize: 9.5, fontWeight: 700, color: "#dc2626" }}>PDF</span>
        </div>
      </div>
      {f.url && (
        <a
          href={f.url}
          target="_blank"
          rel="noreferrer"
          style={{
            ...chipBtn,
            flexShrink: 0,
            whiteSpace: "nowrap",
            color: "#fff",
            background: `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 74%, #000) 100%)`,
            border: "none",
            boxShadow: `0 1px 3px color-mix(in srgb, ${accent} 45%, transparent)`,
          }}
        >
          <ExternalLinkIcon size={13} /> Open Filing
        </a>
      )}
    </div>
  );
}

function ConcallCard({ f, accent, q }: { f: CompanyFiling; accent: string; q?: Quarter }) {
  return (
    <div
      className="card-hover"
      style={{
        border: `1px solid ${tokens.border}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 13,
        padding: 12,
        background: tokens.surface,
        boxShadow: tokens.shadowCard,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            flexShrink: 0,
            width: 38,
            height: 38,
            borderRadius: 10,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: filingCategoryMeta.CONCALL.hex,
            background: filingCategoryMeta.CONCALL.bg,
            border: `1px solid ${filingCategoryMeta.CONCALL.border}`,
          }}
        >
          <MicIcon size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: tokens.textPrimary, letterSpacing: "-0.01em" }}>
            {q ? `${q.label} Earnings Call` : f.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
            {q && <span style={{ fontSize: 11.5, color: tokens.textHint }}>Held {monthYear(f.date)}</span>}
            <SourceBadge source={f.source} />
          </div>
        </div>
      </div>
      {(() => {
        // Show the audio recording and the text transcript; drop the slide deck.
        const links = (f.links ?? []).filter((l) => !/ppt|slide|deck/i.test(l.label));
        return (
          <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap", alignItems: "center" }}>
            {links.length ? (
              links.map((l, i) => <LinkAction key={`${l.url}_${i}`} label={l.label} url={l.url} />)
            ) : (
              <span style={{ fontSize: 11.5, color: tokens.textHint }}>Audio & text transcript expected within a few days</span>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// A quarter with no earnings call on record — rendered as a muted, dashed row so
// the history reads as a continuous quarter-by-quarter timeline with visible
// gaps. `awaited` distinguishes the current quarter (call not yet held) from an
// older quarter the company genuinely skipped.
function ConcallMissing({ q, awaited }: { q: Quarter; awaited?: boolean }) {
  const tint = awaited ? "#b45309" : tokens.textHint;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        border: `1px dashed ${awaited ? "#fcd34d" : tokens.border}`,
        borderRadius: 13,
        padding: "11px 12px",
        background: awaited ? "color-mix(in srgb, #f59e0b 6%, transparent)" : "transparent",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 38,
          height: 38,
          borderRadius: 10,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: tint,
          background: awaited ? "color-mix(in srgb, #f59e0b 12%, transparent)" : tokens.moduleBg,
          border: `1px solid ${awaited ? "#fcd34d" : tokens.border}`,
          opacity: awaited ? 1 : 0.9,
        }}
      >
        {awaited ? <ClockIcon size={18} /> : <MicIcon size={18} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: tokens.textMuted }}>{q.label} Earnings Call</div>
        <div style={{ fontSize: 11.5, color: awaited ? "#b45309" : tokens.textHint, marginTop: 2, fontWeight: awaited ? 600 : 400 }}>
          {awaited ? "Awaited — call not yet held" : "Concall not available"}
        </div>
      </div>
    </div>
  );
}

// Map a concall filing (dated by the month the call was held) to the results
// quarter it covers.
function quarterOf(f: CompanyFiling): Quarter | null {
  const [y, m] = f.date.split("-").map(Number);
  if (!y || !m) return null;
  return callMonthToQuarter(y, m);
}

// Quarter-by-quarter earnings-call history: the last eight fiscal quarters,
// newest first, each either the real call (transcript / audio) or a
// "Concall not available" placeholder so skipped quarters are explicit.
function ConcallHistory({ concalls, accent }: { concalls: CompanyFiling[]; accent: string }) {
  const now = new Date();
  const byQuarter = new Map<string, CompanyFiling>();
  // Anchor the timeline to the newest of {this quarter, latest call on record}
  // so a company that hasn't reported the current quarter still shows the gap.
  const currentQ = callMonthToQuarter(now.getFullYear(), now.getMonth() + 1);
  let top = currentQ;
  for (const f of concalls) {
    const q = quarterOf(f);
    if (!q) continue;
    if (!byQuarter.has(q.key)) byQuarter.set(q.key, f);
    if (quarterRank(q) > quarterRank(top)) top = q;
  }
  const grid = lastNQuarters(top.endY, top.endM, 8);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {grid.map((q) => {
        const f = byQuarter.get(q.key);
        if (f) return <ConcallCard key={q.key} f={f} q={q} accent={accent} />;
        // A gap at the current/most-recent quarter is a call that's due but not
        // yet held, not one the company skipped.
        return <ConcallMissing key={q.key} q={q} awaited={quarterRank(q) >= quarterRank(currentQ)} />;
      })}
    </div>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "36px 20px",
        color: tokens.textHint,
        fontSize: 12.5,
      }}
    >
      <div style={{ display: "inline-flex", marginBottom: 8, opacity: 0.6 }}>
        <FileTextIcon size={26} />
      </div>
      <div>No {label.toLowerCase()} on record for this company yet.</div>
    </div>
  );
}

function Field({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "8px 0",
        borderBottom: last ? "none" : `1px solid ${tokens.border}`,
      }}
    >
      <span style={{ fontSize: 12.5, color: tokens.textMuted }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: tokens.textPrimary, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export function EventDetail({
  event,
  allEvents,
  onSelect,
  isStarred,
  onToggleStar,
  initialTab,
}: {
  event: CorporateEvent;
  allEvents: CorporateEvent[];
  onSelect: (e: CorporateEvent) => void;
  isStarred: (ticker: string) => boolean;
  onToggleStar: (ticker: string) => void;
  initialTab?: FilingCategory | null;
}) {
  const { filings, source, loading } = useCompanyFilings(event.ticker, event.company);
  const [tab, setTab] = useState<"overview" | FilingCategory>(initialTab ?? "overview");
  useEffect(() => setTab(initialTab ?? "overview"), [event.id, initialTab]);
  const isProfile = event.isProfile === true; // searched company with no upcoming event

  // Company identity accent, derived from the initials/avatar colour and applied
  // consistently across the details panel (avatar, active tab, count pills, CTA).
  const accent = companyAccent(event.ticker || event.company);
  const accentGrad = `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 74%, #000) 100%)`;
  const accentShadow = `0 1px 3px color-mix(in srgb, ${accent} 45%, transparent)`;
  const accentSoftBg = `color-mix(in srgb, ${accent} 12%, transparent)`;
  const typeMeta = eventTypeMeta[event.eventType];
  const starred = isStarred(event.ticker);

  const byCat: Record<FilingCategory, CompanyFiling[]> = { PRESS: [], MEET: [], PRESENTATION: [], CONCALL: [], SCHEME: [] };
  for (const f of filings) byCat[f.category].push(f);
  const activeCats = CAT_ORDER.filter((c) => byCat[c].length > 0);

  const others = allEvents
    .filter((e) => e.ticker === event.ticker && e.id !== event.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Overview "Event details" rows, built so we can drop the divider on the last one.
  const detailRows = [
    { label: "Date", value: longDate(event.date) },
    ...(event.time ? [{ label: "Time", value: event.time }] : []),
    { label: "Exchange", value: event.exchange },
    ...(event.sector ? [{ label: "Sector", value: event.sector }] : []),
    ...(event.indices.length > 0 ? [{ label: "Index", value: event.indices.join(", ") }] : []),
  ];

  // Soft, cool-tinted Overview module surface (polished, not a heavy grey block).
  const overviewModule: CSSProperties = {
    background: tokens.moduleBg,
    border: `1px solid ${tokens.moduleBd}`,
    borderRadius: 16,
  };
  // Compact white summary card for a Company Materials tile (elevated on the module).
  const materialCard: CSSProperties = {
    position: "relative",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "11px 12px",
    borderRadius: 12,
    cursor: "pointer",
    textAlign: "left",
    border: `1px solid ${tokens.border}`,
    background: tokens.surface,
    boxShadow: tokens.shadowCard,
  };
  const sectionTitle: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: tokens.textHint,
  };

  const headerChip: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 9px",
    borderRadius: 7,
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    color: tokens.textSecondary,
    whiteSpace: "nowrap",
  };

  const tabBtn = (active: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    border: "none",
    background: active ? accentGrad : "transparent",
    color: active ? "#fff" : tokens.textMuted,
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 10px",
    borderRadius: 9,
    whiteSpace: "nowrap",
    boxShadow: active ? accentShadow : "none",
  });

  const countPill = (active: boolean, n: number) => (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        color: active ? "#fff" : accent,
        background: active ? "rgba(255,255,255,0.25)" : accentSoftBg,
        borderRadius: 6,
        padding: "0 5px",
      }}
    >
      {n}
    </span>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Gradient company header */}
      <div
        style={{
          flexShrink: 0,
          padding: "16px 18px 14px",
          borderBottom: `1px solid ${tokens.border}`,
          background: "var(--detail-header-bg)",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span
            style={{
              flexShrink: 0,
              width: 46,
              height: 46,
              borderRadius: 13,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 800,
              color: "#fff",
              background: accentGrad,
              boxShadow: `0 4px 12px color-mix(in srgb, ${accent} 40%, transparent)`,
            }}
          />

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 16.5,
                fontWeight: 800,
                color: tokens.textPrimary,
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {event.company}
            </div>
            <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 1 }}>
              {event.ticker}
              {event.sector ? ` · ${event.sector}` : ""}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            marginTop: 13,
            padding: "10px 12px",
            borderRadius: 12,
            background: tokens.surface,
            border: `1px solid ${tokens.border}`,
          }}
        >
          <span
            style={{
              flexShrink: 0,
              width: 34,
              height: 34,
              borderRadius: 9,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: typeMeta.hex,
              background: typeMeta.bg,
              border: `1px solid ${typeMeta.border}`,
            }}
          >
            <CalendarIcon size={17} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: tokens.textHint }}>
              {isProfile ? "Company profile" : "Upcoming event"}
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: tokens.textPrimary, marginTop: 1 }}>
              {isProfile ? "Past filings, calls & investor materials" : `${event.subtype} · ${longDate(event.date)}`}
            </div>
          </div>
          <span style={headerChip}>{event.exchange}</span>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            onClick={() => onToggleStar(event.ticker)}
            style={{
              ...chipBtn,
              flex: 1,
              color: starred ? "#b45309" : tokens.textSecondary,
              background: starred ? "#fffbeb" : tokens.surface,
              borderColor: starred ? "#fcd34d" : tokens.border,
            }}
          >
            <StarIcon size={14} filled={starred} /> {starred ? "Watchlisted" : "Watchlist"}
          </button>
          <button onClick={() => downloadEventPdf(event)} style={{ ...chipBtn, flex: 1 }}>
            <DownloadIcon size={14} /> Calendar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: 5,
          padding: "9px 11px",
          borderBottom: `1px solid ${tokens.border}`,
          background: tokens.cardHeaderBg,
        }}
      >
        <button style={tabBtn(tab === "overview")} onClick={() => setTab("overview")}>
          <LayersIcon size={13} /> Overview
        </button>
        {activeCats.map((c) => {
          const Icon = TAB_ICON[c];
          const active = tab === c;
          return (
            <button key={c} style={tabBtn(active)} onClick={() => setTab(c)}>
              <Icon size={13} /> {TAB_LABEL[c]} {countPill(active, byCat[c].length)}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 16, background: tokens.cardBodyBg }}>
        {tab === "overview" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* EVENT DETAILS — hidden for a searched company profile (no real event) */}
            {!isProfile && (
              <div style={{ ...overviewModule, position: "relative", overflow: "hidden", padding: "13px 15px 9px" }}>
                <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accentGrad }} />
                <div style={{ ...sectionTitle, marginBottom: 6 }}>Event details</div>
                {detailRows.map((r, i) => (
                  <Field key={r.label} label={r.label} value={r.value} last={i === detailRows.length - 1} />
                ))}
              </div>
            )}

            {/* COMPANY MATERIALS — full-width polished module below; compact white summary cards */}
            <div style={{ ...overviewModule, padding: "13px 15px 15px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                <span style={sectionTitle}>Company materials</span>
                {source && <span style={{ fontSize: 11, fontWeight: 500, color: tokens.textHint }}>· via {source}</span>}
              </div>
              {loading ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="shimmer" style={{ height: 58, borderRadius: 12 }} />
                  ))}
                </div>
              ) : activeCats.length === 0 ? (
                <div style={{ fontSize: 12.5, color: tokens.textHint }}>
                  No recent filings found on NSE, BSE or Screener for {event.company}.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {activeCats.map((c) => {
                    const m = filingCategoryMeta[c];
                    const Icon = TAB_ICON[c];
                    return (
                      <button key={c} onClick={() => setTab(c)} className="card-hover" style={materialCard}>
                        <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: m.hex }} />
                        <span
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 9,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: m.hex,
                            background: m.bg,
                            border: `1px solid ${m.border}`,
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={16} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: tokens.textPrimary, lineHeight: 1 }}>{byCat[c].length}</div>
                          <div style={{ fontSize: 11, color: tokens.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
                            {TAB_LABEL[c]}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Other upcoming events — same polished module framing */}
            {others.length > 0 && (
              <div style={{ ...overviewModule, padding: "13px 15px 14px" }}>
                <div style={{ ...sectionTitle, marginBottom: 10 }}>Other upcoming events</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {others.map((o) => {
                    const om = eventTypeMeta[o.eventType];
                    return (
                      <button
                        key={o.id}
                        onClick={() => onSelect(o)}
                        className="card-hover"
                        style={{
                          cursor: "pointer",
                          textAlign: "left",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: `1px solid ${tokens.border}`,
                          background: tokens.surface,
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: om.hex, flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, color: tokens.textSecondary, flex: 1 }}>{o.subtype}</span>
                        <span style={{ fontSize: 12, color: tokens.textHint }}>{shortDate(o.date).replace(/ \d{4}$/, "")}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="shimmer" style={{ height: 64, borderRadius: 13 }} />
            ))}
          </div>
        ) : byCat[tab].length === 0 ? (
          <EmptyTab label={TAB_LABEL[tab]} />
        ) : tab === "CONCALL" ? (
          <ConcallHistory concalls={byCat.CONCALL} accent={accent} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {groupByQuarter(byCat[tab]).map(([q, items]) => (
              <div key={q}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: tokens.textHint,
                  }}
                >
                  <span>{q}</span>
                  <span style={{ flex: 1, height: 1, background: tokens.border }} />
                  <span style={{ fontWeight: 600 }}>{items.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {items.map((f, i) =>
                    f.links && f.links.length ? <ConcallCard key={i} f={f} accent={accent} /> : <DocumentCard key={i} f={f} accent={accent} />,
                  )}
                </div>
              </div>
            ))}
            {(() => {
              const viewAllUrl = event.sourceUrl ?? byCat[tab].find((f) => f.url)?.url;
              return viewAllUrl ? (
                <a
                  href={viewAllUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    marginTop: 2,
                    padding: "9px 12px",
                    borderRadius: 10,
                    fontSize: 12.5,
                    fontWeight: 600,
                    textDecoration: "none",
                    color: accent,
                    background: `color-mix(in srgb, ${accent} 8%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${accent} 26%, transparent)`,
                  }}
                >
                  View all {TAB_LABEL[tab].toLowerCase()} <ExternalLinkIcon size={13} />
                </a>
              ) : null;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
