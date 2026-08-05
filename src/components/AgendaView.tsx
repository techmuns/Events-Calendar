import { useState } from "react";
import type { CSSProperties } from "react";
import type { CorporateEvent } from "../types";
import type { EventDiff } from "../hooks/useEventDiff";
import { companyAccent, tokens } from "../theme";
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

function EventRow({
  e,
  diff,
  onSelect,
  isStarred,
  onToggleStar,
  selected,
  isDark,
}: { e: CorporateEvent; diff?: EventDiff; selected: boolean; isDark: boolean } & RowHandlers) {
  const [hovered, setHovered] = useState(false);
  const starred = isStarred(e.ticker);
  const accent = companyAccent(e.ticker || e.company);

  // Three visual states, scoped to the light theme so dark mode is untouched:
  //   default  → neutral, transparent
  //   hover    → a soft preview of the selected accent card (lighter tint + lift)
  //   selected → the existing, stronger persistent accent card
  const hoverPreview = !isDark && hovered && !selected;
  const warm = !isDark && (selected || hovered); // drives child micro-interactions

  const row: CSSProperties = {
    position: "relative",
    zIndex: hoverPreview ? 1 : undefined,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px 10px 18px",
    borderBottom: `1px solid ${selected || hoverPreview ? tokens.borderStrong : tokens.border}`,
    cursor: "pointer",
    background: selected
      ? `linear-gradient(90deg, color-mix(in srgb, ${accent} 18%, transparent) 0%, color-mix(in srgb, ${accent} 7%, transparent) 100%)`
      : hoverPreview
        ? `linear-gradient(90deg, color-mix(in srgb, ${accent} 11%, transparent) 0%, color-mix(in srgb, ${accent} 3%, transparent) 100%)`
        : "transparent",
    boxShadow: hoverPreview ? "0 2px 10px rgba(15, 23, 42, 0.07)" : "none",
    transform: hoverPreview ? "translateY(-1px)" : "none",
    transition: "background 160ms ease, box-shadow 160ms ease, transform 160ms ease, border-color 160ms ease",
  };
  const stop = (fn: () => void) => (ev: { stopPropagation: () => void }) => {
    ev.stopPropagation();
    fn();
  };
  return (
    <div
      className="row-hover"
      style={row}
      onClick={() => onSelect(e)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* company-accent left stripe — strengthens on hover, solid when selected */}
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: accent,
          opacity: selected ? 1 : hoverPreview ? 0.9 : 0.55,
          transition: "opacity 160ms ease",
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
          color: starred ? "#f59e0b" : warm ? tokens.textMuted : tokens.textHint,
          display: "inline-flex",
          flexShrink: 0,
          transition: "color 160ms ease",
        }}
      >
        <StarIcon size={17} filled={starred} />
      </button>
      <DateBlock iso={e.date} accent={accent} />
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
          <span style={{ fontSize: 11.5, fontWeight: 600, color: warm ? tokens.textSecondary : tokens.textHint }}>{e.ticker}</span>
          {diff?.isRevised && <ChangeBadge kind="moved" />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, fontSize: 12, color: warm ? tokens.textSecondary : tokens.textMuted }}>
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
        {diff?.isNew && (
          <span
            title="Newly announced since your last visit"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10.5,
              fontWeight: 700,
              color: "#059669",
              background: "color-mix(in srgb, #10b981 13%, transparent)",
              border: "1px solid color-mix(in srgb, #10b981 34%, transparent)",
              borderRadius: 7,
              padding: "2px 9px",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} /> New
          </span>
        )}
        {e.sourceUrl && (
          <a
            href={e.sourceUrl}
            target="_blank"
            rel="noreferrer"
            title={`Open ${e.exchange} filing`}
            onClick={(ev) => ev.stopPropagation()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              height: 30,
              padding: "0 11px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              color: warm ? accent : tokens.textSecondary,
              border: `1px solid ${warm ? `color-mix(in srgb, ${accent} 40%, transparent)` : tokens.border}`,
              background: warm ? `color-mix(in srgb, ${accent} 10%, ${tokens.surface})` : tokens.surface,
              flexShrink: 0,
              transition: "color 160ms ease, border-color 160ms ease, background 160ms ease",
            }}
          >
            {e.exchange} <ExternalLinkIcon size={13} />
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
  isDark = false,
  ...handlers
}: { events: CorporateEvent[]; diffs?: Map<string, EventDiff>; selectedId?: string | null; isDark?: boolean } & RowHandlers) {
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
            <EventRow key={e.id} e={e} diff={diffs?.get(e.id)} selected={selectedId === e.id} isDark={isDark} {...handlers} />
          ))}
        </div>
      ))}
    </div>
  );
}
