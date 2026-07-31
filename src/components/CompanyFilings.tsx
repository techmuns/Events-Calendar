import type { CSSProperties } from "react";
import type { CompanyFiling, FilingCategory } from "../types";
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

function pdfBadge(color: string): CSSProperties {
  return {
    flexShrink: 0,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.03em",
    color,
    background: `color-mix(in srgb, ${color} 14%, transparent)`,
    border: `1px solid color-mix(in srgb, ${color} 34%, transparent)`,
    borderRadius: 5,
    padding: "2px 5px",
  };
}

function FilingRow({ filing, color }: { filing: CompanyFiling; color: string }) {
  return (
    <a
      href={filing.url}
      target="_blank"
      rel="noreferrer"
      title={filing.title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "8px 10px",
        borderRadius: 9,
        border: `1px solid ${tokens.border}`,
        background: tokens.surface,
        textDecoration: "none",
      }}
    >
      <span style={pdfBadge("#dc2626")}>PDF</span>
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
      <span style={{ fontSize: 11.5, color: tokens.textHint, flexShrink: 0 }}>{formatDate(filing.date)}</span>
      <span style={{ color, flexShrink: 0, display: "inline-flex" }}>
        <ExternalLinkIcon size={13} />
      </span>
    </a>
  );
}

export function CompanyFilings({ ticker }: { ticker: string }) {
  const { filings, loading, error } = useCompanyFilings(ticker);

  const heading = (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: tokens.textHint,
        marginBottom: 10,
      }}
    >
      Filings
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
            : `No recent Press Release, Investor Meet, Presentation or Concall filings found on NSE for ${ticker}.`}
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
                {shown.map((f, i) => (
                  <FilingRow key={`${f.url}_${i}`} filing={f} color={g.color} />
                ))}
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
