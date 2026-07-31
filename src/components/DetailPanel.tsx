import type { CSSProperties } from "react";
import type { CorporateEvent } from "../types";
import { tokens } from "../theme";
import { EventDetail } from "./EventDetail";
import { LayersIcon } from "./icons";

// Sticky right-hand intelligence panel. Shows the selected event's gradient
// header, tabbed company materials, or a polished empty state.
export function DetailPanel({
  selected,
  allEvents,
  onSelect,
  isStarred,
  onToggleStar,
  source,
}: {
  selected: CorporateEvent | null;
  allEvents: CorporateEvent[];
  onSelect: (e: CorporateEvent) => void;
  isStarred: (ticker: string) => boolean;
  onToggleStar: (ticker: string) => void;
  source: string;
}) {
  const card: CSSProperties = {
    background: tokens.cardBg,
    border: `1px solid ${tokens.border}`,
    borderRadius: tokens.radiusCard,
    boxShadow: tokens.shadowCard,
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    height: "100%",
    overflow: "hidden",
  };

  return (
    <div style={card}>
      {selected ? (
        <EventDetail
          event={selected}
          allEvents={allEvents}
          onSelect={onSelect}
          isStarred={isStarred}
          onToggleStar={onToggleStar}
        />
      ) : (
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 32,
            gap: 12,
          }}
        >
          <span
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: tokens.primary,
              background: tokens.gradientSoft,
              border: `1px solid ${tokens.primaryBorder}`,
            }}
          >
            <LayersIcon size={26} />
          </span>
          <div style={{ fontSize: 15, fontWeight: 700, color: tokens.textPrimary }}>Select an event</div>
          <div style={{ fontSize: 12.5, color: tokens.textMuted, maxWidth: 280, lineHeight: 1.5 }}>
            Pick any event on the left to open its company profile — filings, press releases, investor meets,
            presentations and concalls, aggregated across NSE, BSE and Screener.
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              fontWeight: 600,
              color: tokens.textHint,
              padding: "4px 10px",
              borderRadius: 99,
              border: `1px solid ${tokens.border}`,
              background: tokens.surface,
            }}
          >
            Data · {source}
          </div>
        </div>
      )}
    </div>
  );
}
