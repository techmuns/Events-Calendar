import type { CSSProperties } from "react";
import type { CorporateEvent } from "../types";
import type { EventDiff } from "../hooks/useEventDiff";
import { tokens } from "../theme";
import { ChangeBadge, EventTypeChip, StatusBadge, ExchangePill } from "./badges";
import { EmptyState } from "./states";
import { ExternalLinkIcon, StarIcon } from "./icons";
import { type Bucket, bucketFor, formatDate, parseISO, todayStart } from "../lib/dates";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BUCKET_ORDER: Bucket[] = ["Today", "This week", "Next week", "Later"];

interface RowHandlers {
  onSelect: (e: CorporateEvent) => void;
  isStarred: (ticker: string) => boolean;
  onToggleStar: (ticker: string) => void;
}

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

function EventRow({
  e,
  diff,
  onSelect,
  isStarred,
  onToggleStar,
}: { e: CorporateEvent; diff?: EventDiff } & RowHandlers) {
  const starred = isStarred(e.ticker);
  const row: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "10px 16px",
    borderBottom: `1px solid ${tokens.border}`,
    cursor: "pointer",
  };
  const stop = (fn: () => void) => (ev: { stopPropagation: () => void }) => {
    ev.stopPropagation();
    fn();
  };
  const meta = [e.subtype, e.time, e.sector].filter(Boolean).join(" · ");
  return (
    <div style={row} onClick={() => onSelect(e)}>
      <button
        onClick={stop(() => onToggleStar(e.ticker))}
        aria-label={starred ? "Remove from watchlist" : "Add to watchlist"}
        title={starred ? "In watchlist" : "Add to watchlist"}
        style={{ cursor: "pointer", border: "none", background: "transparent", padding: 2, color: starred ? "#f59e0b" : tokens.textHint, display: "inline-flex", flexShrink: 0 }}
      >
        <StarIcon size={16} filled={starred} />
      </button>
      <DateBlock iso={e.date} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: tokens.textPrimary }}>{e.company}</span>
          <span style={{ fontSize: 12, color: tokens.textHint }}>{e.ticker}</span>
        </div>
        <div style={{ fontSize: 12.5, color: tokens.textMuted, marginTop: 2 }}>
          {meta}
          {diff?.isRevised && diff.prevDate && (
            <span style={{ color: "#f97316", fontWeight: 500 }}> · was {formatDate(diff.prevDate)}</span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {diff?.isNew && <ChangeBadge kind="new" />}
        {diff?.isRevised && <ChangeBadge kind="moved" />}
        <EventTypeChip type={e.eventType} />
        <StatusBadge status={e.status} />
        <ExchangePill exchange={e.exchange} />
        {e.sourceUrl && (
          <a
            href={e.sourceUrl}
            target="_blank"
            rel="noreferrer"
            title="View filing"
            onClick={(ev) => ev.stopPropagation()}
            style={{ display: "inline-flex", color: tokens.primary, padding: "0 4px" }}
          >
            <ExternalLinkIcon size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

export function AgendaView({
  events,
  diffs,
  ...handlers
}: { events: CorporateEvent[]; diffs?: Map<string, EventDiff> } & RowHandlers) {
  if (events.length === 0) {
    return <EmptyState message="No events match these filters" hint="Try widening the horizon or switching the universe to All." />;
  }
  const today = todayStart();
  const groups: Record<Bucket, CorporateEvent[]> = { Today: [], "This week": [], "Next week": [], Later: [] };
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
            <EventRow key={e.id} e={e} diff={diffs?.get(e.id)} {...handlers} />
          ))}
        </div>
      ))}
    </div>
  );
}
