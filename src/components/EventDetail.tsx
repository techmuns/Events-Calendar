import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { CompanyFiling, CorporateEvent, FilingCategory, FilingSource } from "../types";
import { companyAccent, eventTypeMeta, filingCategoryMeta, initials, tokens } from "../theme";
import {
  CalendarIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileTextIcon,
  LayersIcon,
  MicIcon,
  PlayIcon,
  PresentationIcon,
  StarIcon,
  UsersIcon,
} from "./icons";
import { parseISO } from "../lib/dates";
import { downloadIcs } from "../lib/ics";
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

const CAT_ORDER: FilingCategory[] = ["PRESS", "MEET", "PRESENTATION", "CONCALL", "SCHEME"];
const TAB_LABEL: Record<FilingCategory, string> = {
  PRESS: "Press Releases",
  MEET: "Investor Meets",
  PRESENTATION: "Presentations",
  CONCALL: "Concalls",
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

// Filing cards carry a subtle fixed purple accent (soft left border + primary CTA).
const FILING_PURPLE = "#7c3aed";
const FILING_PURPLE_GRAD = "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)";

function LinkAction({ label, url }: { label: string; url: string }) {
  const l = label.toLowerCase();
  const Icon = /ppt|present|deck|slide/.test(l)
    ? PresentationIcon
    : /rec|listen|audio|call/.test(l)
      ? PlayIcon
      : /transcript|note/.test(l)
        ? FileTextIcon
        : ExternalLinkIcon;
  const nice = /ppt/.test(l) ? "Slides" : /rec/.test(l) ? "Listen" : label;
  return (
    <a href={url} target="_blank" rel="noreferrer" style={chipBtn}>
      <Icon size={13} /> {nice}
    </a>
  );
}

function DocumentCard({ f }: { f: CompanyFiling }) {
  const cat = filingCategoryMeta[f.category];
  return (
    <div
      className="card-hover"
      style={{
        border: `1px solid ${tokens.border}`,
        borderLeft: `3px solid ${FILING_PURPLE}`,
        borderRadius: 13,
        padding: 12,
        background: tokens.surface,
        boxShadow: tokens.shadowCard,
      }}
    >
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
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
              fontSize: 13,
              fontWeight: 600,
              color: tokens.textPrimary,
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {f.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: tokens.textHint }}>{shortDate(f.date)}</span>
            <SourceBadge source={f.source} />
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#dc2626" }}>PDF</span>
          </div>
        </div>
      </div>
      {f.url && (
        <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
          <a href={f.url} target="_blank" rel="noreferrer" style={{ ...chipBtn, flex: 1 }}>
            <EyeIcon size={13} /> Preview
          </a>
          <a
            href={f.url}
            target="_blank"
            rel="noreferrer"
            style={{
              ...chipBtn,
              flex: 1,
              color: "#fff",
              background: FILING_PURPLE_GRAD,
              border: "none",
              boxShadow: `0 1px 3px color-mix(in srgb, ${FILING_PURPLE} 45%, transparent)`,
            }}
          >
            <ExternalLinkIcon size={13} /> Open Filing
          </a>
        </div>
      )}
    </div>
  );
}

function ConcallCard({ f }: { f: CompanyFiling }) {
  return (
    <div
      className="card-hover"
      style={{
        border: `1px solid ${tokens.border}`,
        borderLeft: `3px solid ${FILING_PURPLE}`,
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
          <div style={{ fontSize: 13, fontWeight: 700, color: tokens.textPrimary }}>{f.title}</div>
          <div style={{ marginTop: 3 }}>
            <SourceBadge source={f.source} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
        {(f.links ?? []).map((l, i) => (
          <LinkAction key={`${l.url}_${i}`} label={l.label} url={l.url} />
        ))}
      </div>
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
        gap: 12,
        padding: "9px 0",
        borderBottom: last ? "none" : `1px solid ${tokens.border}`,
      }}
    >
      <span style={{ fontSize: 12.5, color: tokens.textHint }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: tokens.textSecondary, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export function EventDetail({
  event,
  allEvents,
  onSelect,
  isStarred,
  onToggleStar,
}: {
  event: CorporateEvent;
  allEvents: CorporateEvent[];
  onSelect: (e: CorporateEvent) => void;
  isStarred: (ticker: string) => boolean;
  onToggleStar: (ticker: string) => void;
}) {
  const { filings, source, loading } = useCompanyFilings(event.ticker, event.company);
  const [tab, setTab] = useState<"overview" | FilingCategory>("overview");
  useEffect(() => setTab("overview"), [event.id]);

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

  // Event Details sits in a single soft WHITE card — no bulky grey container.
  const detailsCard: CSSProperties = {
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 14,
    boxShadow: tokens.shadowCard,
    padding: "4px 14px 5px",
  };
  // Compact white summary card for a Company Materials tile.
  const materialCard: CSSProperties = {
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
          >
            {initials(event.company)}
          </span>
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
              Upcoming event
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: tokens.textPrimary, marginTop: 1 }}>
              {event.subtype} · {longDate(event.date)}
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
          <button onClick={() => downloadIcs(event)} style={{ ...chipBtn, flex: 1 }}>
            <DownloadIcon size={14} /> Calendar
          </button>
          {event.sourceUrl && (
            <a href={event.sourceUrl} target="_blank" rel="noreferrer" style={{ ...chipBtn, flex: 1 }}>
              <ExternalLinkIcon size={14} /> Filing
            </a>
          )}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* EVENT DETAILS — full width, first, in one soft white card */}
            <div>
              <div style={{ ...sectionTitle, marginBottom: 8 }}>Event details</div>
              <div style={detailsCard}>
                {detailRows.map((r, i) => (
                  <Field key={r.label} label={r.label} value={r.value} last={i === detailRows.length - 1} />
                ))}
              </div>
            </div>

            {/* COMPANY MATERIALS — full width below; compact white summary cards, no grey box */}
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
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

            {/* Other upcoming events — same compact white-card language */}
            {others.length > 0 && (
              <div>
                <div style={{ ...sectionTitle, marginBottom: 9 }}>Other upcoming events</div>
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
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {byCat[tab].map((f, i) =>
              f.links && f.links.length ? <ConcallCard key={i} f={f} /> : <DocumentCard key={i} f={f} />,
            )}
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
                    color: FILING_PURPLE,
                    background: `color-mix(in srgb, ${FILING_PURPLE} 8%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${FILING_PURPLE} 26%, transparent)`,
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
