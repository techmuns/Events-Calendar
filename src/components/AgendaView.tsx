import type { CSSProperties } from "react";
import type { CorporateEvent } from "../types";
import type { EventDiff } from "../hooks/useEventDiff";
import { companyAccent, eventTypeMeta, initials, statusMeta, tokens } from "../theme";
import { ChangeBadge } from "./badges";
import { EmptyState } from "./states";
import { ClockIcon, ExternalLinkIcon, StarIcon } from "./icons";
import { type Bucket, bucketFor, formatDate, parseISO, todayStart } from "../lib/dates";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BUCKET_ORDER: Bucket[] = ["Today", "Tomorrow", "This week", "Next week", "Later"];

interface RowHandlers {
  onSelect: (e: CorporateEvent) => void;
  isStarred: (ticker: string) => boolean;
  onToggleStar: (ticker: string) => void;
}

function DateBlock({ iso, accent }: { iso: string; accent: string }) {
  const d = parseISO(iso);
  return (
    <div
      style={{
        width: 46,
        flexShrink: 0,
        textAlign: "center",
        borderRadius: 11,
        border: `1px solid ${tokens.border}`,
        background: tokens.surface,
        padding: "5px 0 6px",
      }}
    >
      <div style={{ fontSize: 9.5, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {MONTHS[d.getMonth()]}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: tokens.textPrimary, lineHeight: 1.05 }}>{d.getDate()}</div>
    </div>
  );
}

function Avatar({ name, seed }: { name: string; seed: string }) {
  const accent = companyAccent(seed);
  return (
    <span
      style={{
        flexShrink: 0,
        width: 34,
        height: 34,
        borderRadius: 10,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.01em",
        color: accent,
        background: `color-mix(in srgb, ${accent} 13%, transparent)`,
        border: `1px solid color-mix(in srgb, ${accent} 26%, transparent)`,
      }}
    >
      {initials(name)}
    </span>
  );
}

function TypeChip({ type }: { type: CorporateEvent["eventType"] }) {
  const m = eventTypeMeta[type];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 10.5,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 7,
        background: m.bg,
        color: m.text,
        border: `1px solid ${m.border}`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.hex }} />
      {m.label}
    </span>
  );
}

function EventRow({
  e,
  diff,
  onSelect,
  isStarred,
  onToggleStar,
  selected,
}: { e: CorporateEvent; diff?: EventDiff; selected: boolean } & RowHandlers) {
  const starred = isStarred(e.ticker);
  const accent = companyAccent(e.ticker || e.company);
  const status = statusMeta[e.status];
  const row: CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px 10px 18px",
    borderBottom: `1px solid ${selected ? tokens.borderStrong : tokens.border}`,
    cursor: "pointer",
    background: selected
      ? `linear-gradient(90deg, color-mix(in srgb, ${accent} 18%, transparent) 0%, color-mix(in srgb, ${accent} 7%, transparent) 100%)`
      : "transparent",
  };
  const stop = (fn: () => void) => (ev: { stopPropagation: () => void }) => {
    ev.stopPropagation();
    fn();
  };
  return (
    <div className="row-hover" style={row} onClick={() => onSelect(e)}>
      {/* event-type accent stripe */}
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: accent,
          opacity: selected ? 1 : 0.55,
        }}
      />
      <button
        onClick={stop(() => onToggleStar(e.ticker))}
        aria-label={starred ? "Remove from watchlist" : "Add to watchlist"}
        title={starred ? "In watchlist" : "Add to watchlist"}
        style={{
          cursor: "pointer",
          border: "none",
          background: "transparent",
          padding: 6,
          borderRadius: 8,
          color: starred ? "#f59e0b" : tokens.textHint,
          display: "inline-flex",
          flexShrink: 0,
        }}
      >
        <StarIcon size={17} filled={starred} />
      </button>
      <DateBlock iso={e.date} accent={accent} />
      <Avatar name={e.company} seed={e.ticker || e.company} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: tokens.textPrimary,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 260,
            }}
          >
            {e.company}
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: tokens.textHint }}>{e.ticker}</span>
          {diff?.isNew && <ChangeBadge kind="new" />}
          {diff?.isRevised && <ChangeBadge kind="moved" />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, fontSize: 12, color: tokens.textMuted }}>
          <span style={{ whiteSpace: "nowrap" }}>{e.subtype}</span>
          {e.sector && (
            <>
              <span style={{ color: tokens.textHint }}>·</span>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.sector}</span>
            </>
          )}
          {e.time && (
            <>
              <span style={{ color: tokens.textHint }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                <ClockIcon size={12} /> {e.time}
              </span>
            </>
          )}
          {diff?.isRevised && diff.prevDate && (
            <span style={{ color: "#f97316", fontWeight: 500, whiteSpace: "nowrap" }}>· was {formatDate(diff.prevDate)}</span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <TypeChip type={e.eventType} />
        <span
          title={`${status.label} · ${e.exchange}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10.5,
            fontWeight: 600,
            color: tokens.textMuted,
            background: tokens.surface2,
            border: `1px solid ${tokens.border}`,
            borderRadius: 7,
            padding: "2px 8px",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: status.hex }} />
          {e.exchange}
        </span>
        {e.sourceUrl && (
          <a
            href={e.sourceUrl}
            target="_blank"
            rel="noreferrer"
            title="View exchange filing"
            onClick={(ev) => ev.stopPropagation()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              borderRadius: 8,
              color: tokens.textMuted,
              border: `1px solid ${tokens.border}`,
              background: tokens.surface,
              flexShrink: 0,
            }}
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
  selectedId,
  ...handlers
}: { events: CorporateEvent[]; diffs?: Map<string, EventDiff>; selectedId?: string | null } & RowHandlers) {
  if (events.length === 0) {
    return <EmptyState message="No events match these filters" hint="Try widening the horizon or switching the universe to All." />;
  }
  const today = todayStart();
  const groups: Record<Bucket, CorporateEvent[]> = { Today: [], Tomorrow: [], "This week": [], "Next week": [], Later: [] };
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
              padding: "7px 16px",
              background: tokens.bucketBg,
              backdropFilter: "blur(6px)",
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: tokens.primaryText,
              borderBottom: `1px solid ${tokens.border}`,
            }}
          >
            {b}
            <span style={{ color: tokens.textHint, fontWeight: 600 }}> · {groups[b].length}</span>
          </div>
          {groups[b].map((e) => (
            <EventRow key={e.id} e={e} diff={diffs?.get(e.id)} selected={selectedId === e.id} {...handlers} />
          ))}
        </div>
      ))}
    </div>
  );
}
