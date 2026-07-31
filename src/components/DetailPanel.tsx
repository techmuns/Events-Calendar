import type { CSSProperties } from "react";
import type { CorporateEvent } from "../types";
import { tokens } from "../theme";
import { EventDetail } from "./EventDetail";
import { CalendarIcon } from "./icons";

// Right-hand pane: the selected event's details (including its per-company
// segregated filings). Concalls live inside those filings under their own
// heading, so there is no separate concalls tab.
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
    borderRadius: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    backdropFilter: "blur(8px)",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    height: "100%",
    overflow: "hidden",
  };

  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          borderBottom: `1px solid ${tokens.border}`,
          background: tokens.cardHeaderBg,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 700, color: tokens.textPrimary }}>Details</span>
        {selected && (
          <span
            style={{
              fontSize: 12,
              color: tokens.textHint,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            · {selected.ticker}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: tokens.cardBodyBg }}>
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
              minHeight: 220,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 28,
              gap: 10,
            }}
          >
            <span style={{ color: tokens.textHint }}>
              <CalendarIcon size={30} />
            </span>
            <div style={{ fontSize: 14, fontWeight: 600, color: tokens.textSecondary }}>Select an event</div>
            <div style={{ fontSize: 12.5, color: tokens.textHint, maxWidth: 260 }}>
              Click any event on the left to see its details, exchange filing, and segregated filings — press
              releases, investor meets, presentations and concalls.
            </div>
            <div style={{ fontSize: 11.5, color: tokens.textHint, marginTop: 8 }}>Data: {source}</div>
          </div>
        )}
      </div>
    </div>
  );
}
