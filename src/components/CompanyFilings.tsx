import type { CSSProperties } from "react";
import type { CompanyFiling, FilingCategory, FilingSource } from "../types";
import { tokens } from "../theme";
import { formatDate } from "../lib/dates";
import { useCompanyFilings } from "../hooks/useCompanyFilings";
import { ExternalLinkIcon } from "./icons";

// Fixed display order; only categories with filings are rendered.
const CATS: { key: FilingCategory; label: string; color: string }[] = [
  { key: "PRESS", label: "Press Release", color: "#64748b" },
  { key: "MEET", label: "Investor / Analyst Meet", color: "#3b82f6" },
  { key: "PRESENTATION", label: "Investor Presentation", color: "#f59e0b" },
  { key: "CONCALL", label: "Concalls", color: "#14b8a6" },
  { key: "SCHEME", label: "Scheme / Demerger", color: "#8b5cf6" },
];

const PER_CATEGORY = 6;

const SRC_COLOR: Record<FilingSource, string> = {
  NSE: "#2563eb",
  BSE: "#0891b2",
  Screener: "#7c3aed",
  Web: "#6b7280",
};

function SourceTag({ source }: { source: FilingSource }) {
  const c = SRC_COLOR[source];
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.02em",
        color: c,
        background: `color-mix(in srgb, ${c} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${c} 32%, transparent)`,
        borderRadius: 5,
        padding: "1px 5px",
      }}
    >
      {source}
    </span>
  );
}

const pdfBadge: CSSProperties = {
  flexShrink: 0,
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: "0.03em",
  color: "#dc2626",
  background: "color-mix(in srgb, #dc2626 14%, transparent)",
  border: "1px solid color-mix(in srgb, #dc2626 34%, transparent)",
  borderRadius: 5,
  padding: "2px 5px",
};

const rowBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "8px 10px",
  borderRadius: 9,
  border: `1px solid ${tokens.border}`,
  background: tokens.surface,
  textDecoration: "none",
};

// Multi-document filing (Screener concall): a period + Transcript/PPT/REC chips.
function ConcallRow({ filing }: { filing: CompanyFiling }) {
  return (
    <div style={{ ...rowBase, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: tokens.textSecondary, flex: 1, minWidth: 92 }}>
        {filing.title}
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(filing.links ?? []).map((l, i) => (
          <a
            key={`${l.url}_${i}`}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            title={`${l.label} · ${l.source}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11.5,
              fontWeight: 600,
              color: SRC_COLOR[l.source],
              background: `color-mix(in srgb, ${SRC_COLOR[l.source]} 10%, transparent)`,
              border: `1px solid color-mix(in srgb, ${SRC_COLOR[l.source]} 30%, transparent)`,
              borderRadius: 7,
              padding: "3px 8px",
              textDecoration: "none",
            }}
          >
            {l.label}
            <ExternalLinkIcon size={11} />
          </a>
        ))}
      </div>
    </div>
  );
}

// Single-document filing (NSE/BSE announcement): PDF badge + title + date.
function DocRow({ filing }: { filing: CompanyFiling }) {
  return (
    <a href={filing.url} target="_blank" rel="noreferrer" title={filing.title} style={rowBase}>
      <span style={pdfBadge}>PDF</span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 12.5,
          color: tokens.textSecondary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {filing.title}
      </span>
      <SourceTag source={filing.source} />
      <span style={{ fontSize: 11.5, color: tokens.textHint, flexShrink: 0 }}>{formatDate(filing.date)}</span>
      <span style={{ color: tokens.textHint, flexShrink: 0, display: "inline-flex" }}>
        <ExternalLinkIcon size={13} />
      </span>
    </a>
  );
}

export function CompanyFilings({ ticker, name = "" }: { ticker: string; name?: string }) {
  const { filings, source, loading, error } = useCompanyFilings(ticker, name);

  const heading = (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: tokens.textHint,
        }}
      >
        Filings
      </span>
      {source && <span style={{ fontSize: 11, color: tokens.textHint }}>via {source}</span>}
    </div>
  );

  if (loading) {
    return (
      <div style={{ marginTop: 22 }}>
        {heading}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="shimmer" style={{ height: 36, borderRadius: 9 }} />
          ))}
        </div>
      </div>
    );
  }

  const grouped = CATS.map((c) => ({
    ...c,
    items: filings.filter((f) => f.category === c.key),
  })).filter((g) => g.items.length > 0);

  if (grouped.length === 0) {
    return (
      <div style={{ marginTop: 22 }}>
        {heading}
        <div style={{ fontSize: 12.5, color: tokens.textHint }}>
          {error
            ? "Filings couldn’t be loaded right now."
            : `No recent Press Release, Investor Meet, Presentation or Concall filings found on NSE, BSE or Screener for ${
                name || ticker
              }.`}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 22 }}>
      {heading}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {grouped.map((g) => {
          const shown = g.items.slice(0, PER_CATEGORY);
          const extra = g.items.length - shown.length;
          return (
            <div key={g.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: g.color }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: tokens.textPrimary }}>{g.label}</span>
                <span style={{ fontSize: 11.5, color: tokens.textHint }}>{g.items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {shown.map((f, i) =>
                  f.links && f.links.length ? (
                    <ConcallRow key={`${g.key}_${i}`} filing={f} />
                  ) : (
                    <DocRow key={`${g.key}_${i}`} filing={f} />
                  ),
                )}
                {extra > 0 && (
                  <div style={{ fontSize: 11.5, color: tokens.textHint, paddingLeft: 2 }}>
                    +{extra} earlier {extra === 1 ? "filing" : "filings"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
