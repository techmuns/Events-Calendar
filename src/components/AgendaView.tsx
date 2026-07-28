import type { CSSProperties } from "react";
import type { CorporateEvent } from "../types";
import { tokens } from "../theme";
import { EventTypeChip, StatusBadge, ExchangePill } from "./badges";
import { EmptyState } from "./states";
import { ExternalLinkIcon } from "./icons";
import { type Bucket, bucketFor, parseISO, todayStart } from "../lib/dates";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BUCKET_ORDER: Bucket[] = ["Today", "This week", "Next week", "Later"];

function DateBlock({ iso }: { iso: string }) {
  const d = parseISO(iso);
  return (
    <div
      style={{
        width: 46,
        flexShrink: 0,
        textAlign: "center",
        borderRadius: 10,
        border: `1px solid ${tokens.border}`,
        background: tokens.surface,
        padding: "6px 0",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: tokens.primary, textTransform: "uppercase" }}>
        {MONTHS[d.getMonth()]}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: tokens.textPrimary, lineHeight: 1.1 }}>
        {d.getDate()}
      </div>
    </div>
  );
}

function EventRow({ e }: { e: CorporateEvent }) {
  const row: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "10px 16px",
    borderBottom: `1px solid ${tokens.border}`,
  };
  return (
    <div style={row}>
      <DateBlock iso={e.date} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: tokens.textPrimary }}>{e.company}</span>
          <span style={{ fontSize: 12, color: tokens.textHint }}>{e.ticker}</span>
        </div>
        <div style={{ fontSize: 12.5, color: tokens.textMuted, marginTop: 2 }}>
          {[e.subtype, e.time, e.sector].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <EventTypeChip type={e.eventType} />
        <StatusBadge status={e.status} />
        <ExchangePill exchange={e.exchange} />
        {e.sourceUrl && (
          <a
            href={e.sourceUrl}
            target="_blank"
            rel="noreferrer"
            title="View filing"
            style={{ display: "inline-flex", color: tokens.primary, padding: "0 4px" }}
          >
            <ExternalLinkIcon size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

export function AgendaView({ events }: { events: CorporateEvent[] }) {
  if (events.length === 0) {
    return <EmptyState message="No events match these filters" hint="Try widening the horizon or switching the universe to All." />;
  }
  const today = todayStart();
  const groups: Record<Bucket, CorporateEvent[]> = {
    Today: [],
    "This week": [],
    "Next week": [],
    Later: [],
  };
  for (const e of events) groups[bucketFor(e.date, today)].push(e);

  return (
    <div>
      {BUCKET_ORDER.filter((b) => groups[b].length > 0).map((b) => (
        <div key={b}>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              padding: "8px 16px",
              background: tokens.bucketBg,
              backdropFilter: "blur(6px)",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: tokens.primaryText,
              borderBottom: `1px solid ${tokens.border}`,
            }}
          >
            {b}
            <span style={{ color: tokens.textHint, fontWeight: 600 }}> · {groups[b].length}</span>
          </div>
          {groups[b].map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </div>
      ))}
    </div>
  );
}
