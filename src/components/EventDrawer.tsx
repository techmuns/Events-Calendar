import type { CorporateEvent } from "../types";
import { tokens } from "../theme";
import { EventTypeChip, StatusBadge, ExchangePill } from "./badges";
import { DownloadIcon, ExternalLinkIcon, StarIcon, XIcon } from "./icons";
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

export function EventDrawer({
  event,
  allEvents,
  onClose,
  onSelect,
  isStarred,
  onToggleStar,
}: {
  event: CorporateEvent | null;
  allEvents: CorporateEvent[];
  onClose: () => void;
  onSelect: (e: CorporateEvent) => void;
  isStarred: (ticker: string) => boolean;
  onToggleStar: (ticker: string) => void;
}) {
  if (!event) return null;
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
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 40,
          animation: "fadeIn 0.2s ease",
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: "min(400px, 92vw)",
          background: tokens.surface,
          borderLeft: `1px solid ${tokens.borderSolid}`,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          animation: "drawerIn 0.25s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "-12px 0 40px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 18px", borderBottom: `1px solid ${tokens.border}` }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: tokens.textPrimary }}>{event.company}</div>
            <div style={{ fontSize: 12.5, color: tokens.textHint, marginTop: 2 }}>
              {event.ticker}
              {event.isin ? ` · ${event.isin}` : ""}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ cursor: "pointer", border: "none", background: "transparent", color: tokens.textMuted, padding: 4, display: "inline-flex" }}>
            <XIcon size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 18px" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
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

          <div style={{ marginTop: 4 }}>
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
                    style={{ cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: `1px solid ${tokens.border}`, background: tokens.cardBg }}
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
      </aside>
    </>
  );
}
