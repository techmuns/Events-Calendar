import type { CSSProperties } from "react";
import type { ConcallItem, CorporateEvent } from "../types";
import { tokens } from "../theme";
import { EventDetail } from "./EventDetail";
import { ConcallsPanel } from "./ConcallsPanel";
import { CalendarIcon } from "./icons";

export type DetailTab = "details" | "concalls";

export function DetailPanel({
  selected,
  allEvents,
  concalls,
  showConcalls,
  tab,
  onTab,
  onSelect,
  isStarred,
  onToggleStar,
  source,
}: {
  selected: CorporateEvent | null;
  allEvents: CorporateEvent[];
  concalls: ConcallItem[];
  showConcalls: boolean;
  tab: DetailTab;
  onTab: (t: DetailTab) => void;
  onSelect: (e: CorporateEvent) => void;
  isStarred: (ticker: string) => boolean;
  onToggleStar: (ticker: string) => void;
  source: string;
}) {
  const effective: DetailTab = tab === "concalls" && !showConcalls ? "details" : tab;

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

  const tabBtn = (active: boolean): CSSProperties => ({
    cursor: "pointer",
    border: "none",
    background: active ? tokens.primaryLight : "transparent",
    color: active ? tokens.primaryText : tokens.textMuted,
    fontSize: 13,
    fontWeight: 600,
    padding: "9px 14px",
    borderRadius: "8px 8px 0 0",
  });

  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "8px 10px 0",
          borderBottom: `1px solid ${tokens.border}`,
          background: tokens.cardHeaderBg,
          flexShrink: 0,
        }}
      >
        <button style={tabBtn(effective === "details")} onClick={() => onTab("details")}>
          Details
        </button>
        {showConcalls && (
          <button style={tabBtn(effective === "concalls")} onClick={() => onTab("concalls")}>
            Concalls <span style={{ opacity: 0.7 }}>{concalls.length}</span>
          </button>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: tokens.cardBodyBg }}>
        {effective === "concalls" ? (
          <ConcallsPanel concalls={concalls} />
        ) : selected ? (
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
            <div style={{ fontSize: 14, fontWeight: 600, color: tokens.textSecondary }}>
              Select an event
            </div>
            <div style={{ fontSize: 12.5, color: tokens.textHint, maxWidth: 260 }}>
              Click any event on the left to see its details, exchange filing, and related events.
            </div>
            <div style={{ fontSize: 11.5, color: tokens.textHint, marginTop: 8 }}>Data: {source}</div>
          </div>
        )}
      </div>
    </div>
  );
}
