import type { CorporateEvent } from "../types";
import { tokens } from "../theme";
import { EventTypeChip, StatusBadge, ExchangePill } from "./badges";
import { DownloadIcon, ExternalLinkIcon, StarIcon } from "./icons";
import { parseISO } from "../lib/dates";
import { downloadIcs } from "../lib/ics";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function longDate(iso: string): string {
  const d = parseISO(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid ${tokens.border}` }}>
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
  const starred = isStarred(event.ticker);
  const others = allEvents
    .filter((e) => e.ticker === event.ticker && e.id !== event.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  const actionBtn = {
    flex: 1,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    padding: "9px 12px",
    borderRadius: 10,
    border: `1px solid ${tokens.borderSolid}`,
    background: tokens.surface,
    color: tokens.textSecondary,
  } as const;

  return (
    <div style={{ padding: "16px 18px" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: tokens.textPrimary }}>{event.company}</div>
      <div style={{ fontSize: 12.5, color: tokens.textHint, marginTop: 2 }}>
        {event.ticker}
        {event.isin ? ` · ${event.isin}` : ""}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0" }}>
        <EventTypeChip type={event.eventType} />
        <StatusBadge status={event.status} />
        <ExchangePill exchange={event.exchange} />
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: tokens.textPrimary }}>{event.subtype}</div>
      <div style={{ fontSize: 13.5, color: tokens.primaryText, marginTop: 4 }}>{longDate(event.date)}</div>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <button
          onClick={() => onToggleStar(event.ticker)}
          style={{ ...actionBtn, color: starred ? "#f59e0b" : tokens.textSecondary, borderColor: starred ? "#fcd34d" : tokens.borderSolid }}
        >
          <StarIcon size={15} filled={starred} /> {starred ? "In watchlist" : "Add to watchlist"}
        </button>
        <button onClick={() => downloadIcs(event)} style={actionBtn}>
          <DownloadIcon size={15} /> Calendar
        </button>
      </div>

      <div>
        {event.time && <Field label="Time" value={event.time} />}
        <Field label="Status" value={event.status} />
        <Field label="Exchange" value={event.exchange} />
        {event.sector && <Field label="Sector" value={event.sector} />}
        {event.indices.length > 0 && <Field label="Index" value={event.indices.join(", ")} />}
      </div>

      {event.sourceUrl && (
        <a
          href={event.sourceUrl}
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14, fontSize: 13, fontWeight: 600, color: tokens.primary, textDecoration: "none" }}
        >
          View exchange filing <ExternalLinkIcon size={13} />
        </a>
      )}

      {others.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: tokens.textHint, marginBottom: 8 }}>
            Other upcoming events
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {others.map((o) => (
              <button
                key={o.id}
                onClick={() => onSelect(o)}
                style={{ cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: `1px solid ${tokens.border}`, background: tokens.surface }}
              >
                <EventTypeChip type={o.eventType} />
                <span style={{ fontSize: 12.5, color: tokens.textSecondary, flex: 1 }}>{o.subtype}</span>
                <span style={{ fontSize: 12, color: tokens.textHint }}>{o.date.slice(5)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
