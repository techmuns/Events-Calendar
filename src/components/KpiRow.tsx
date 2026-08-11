import type { CSSProperties } from "react";
import type { CorporateEvent } from "../types";
import { tokens } from "../theme";
import { bucketFor, todayStart } from "../lib/dates";
import { proximityOf, toneChip, toneColor, toneSkin } from "../lib/proximity";
import { callMonthToQuarter, subtypeNamesQuarter } from "../lib/quarters";
import { BuildingIcon, CalendarIcon, LayersIcon } from "./icons";

type IconCmp = (p: { size?: number }) => JSX.Element;

// Results-quarter a report/call covers (announced a month or two after close).
function quarterLabel(iso: string): string | null {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return null;
  return callMonthToQuarter(y, m).label;
}

const heroBase: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  gap: 13,
  padding: "10px 15px",
  borderRadius: 14,
  boxShadow: tokens.shadowCard,
  width: "100%",
};
const iconWrap: CSSProperties = {
  flexShrink: 0,
  width: 40,
  height: 40,
  borderRadius: 11,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
function eyebrow(color: string): CSSProperties {
  return { fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color };
}

// The headline KPI: the single most imminent event as a full sentence, coloured
// by how soon it is, and clickable straight through to its details.
function NextUpHero({ next, onSelect }: { next?: CorporateEvent; onSelect?: (e: CorporateEvent) => void }) {
  const today = todayStart();
  if (!next) {
    return (
      <div className="kpi-hero" style={{ ...heroBase, background: tokens.surface, border: `1px solid ${tokens.border}` }}>
        <span style={{ ...iconWrap, color: tokens.textHint, background: tokens.surface2, border: `1px solid ${tokens.border}` }}>
          <CalendarIcon size={20} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={eyebrow(tokens.textHint)}>Next up</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: tokens.textPrimary, marginTop: 2 }}>Nothing upcoming</div>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>No events match the current view</div>
        </div>
      </div>
    );
  }
  const prox = proximityOf(next.date, today);
  const skin = toneSkin(prox.tone);
  const fg = toneColor(prox.tone);
  const when = prox.days === 0 ? "today" : prox.days === 1 ? "tomorrow" : `in ${prox.days} days`;
  const sentence =
    next.eventType === "EARNINGS"
      ? `${next.company} reports ${when}`
      : next.eventType === "CONCALL"
        ? `${next.company}’s earnings call ${when}`
        : next.company;
  const isEarningsLike = next.eventType === "EARNINGS" || next.eventType === "CONCALL";
  const q = isEarningsLike && !subtypeNamesQuarter(next.subtype) ? quarterLabel(next.date) : null;
  const sub = [q, next.subtype].filter(Boolean).join(" ") + (next.time ? ` · ${next.time}` : "");

  return (
    <button
      className="kpi-hero card-hover"
      onClick={() => onSelect?.(next)}
      title={`Open ${next.company}`}
      style={{
        ...heroBase,
        cursor: onSelect ? "pointer" : "default",
        textAlign: "left",
        border: `1px solid ${skin.bd}`,
        background: `linear-gradient(115deg, ${skin.bg} 0%, transparent 76%), ${tokens.surface}`,
      }}
    >
      <span style={{ ...iconWrap, color: fg, background: skin.bg, border: `1px solid ${skin.bd}` }}>
        <CalendarIcon size={20} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={eyebrow(fg)}>Next up</div>
        <div
          style={{
            fontSize: 16.5,
            fontWeight: 800,
            color: tokens.textPrimary,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
            marginTop: 2,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {sentence}
        </div>
        <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {sub}
        </div>
      </div>
      <span
        style={{
          flexShrink: 0,
          alignSelf: "flex-start",
          fontSize: 12,
          fontWeight: 800,
          borderRadius: 99,
          padding: "5px 12px",
          whiteSpace: "nowrap",
          ...toneChip(prox.tone),
        }}
      >
        {prox.chip}
      </span>
    </button>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
  bg,
  bd,
  Icon,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
  bg: string;
  bd: string;
  Icon: IconCmp;
}) {
  const card: CSSProperties = {
    position: "relative",
    overflow: "hidden",
    background: bg,
    border: `1px solid ${bd}`,
    borderRadius: 14,
    padding: "9px 14px 10px",
    boxShadow: tokens.shadowCard,
    display: "flex",
    alignItems: "center",
    gap: 11,
  };
  return (
    <div className="card-hover" style={card}>
      {/* thin top accent line */}
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${accent} 0%, color-mix(in srgb, ${accent} 45%, transparent) 100%)`,
        }}
      />
      <span
        style={{
          flexShrink: 0,
          width: 34,
          height: 34,
          borderRadius: 10,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: accent,
          background: `color-mix(in srgb, ${accent} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${accent} 26%, transparent)`,
        }}
      >
        <Icon size={17} />
      </span>
      <div style={{ minWidth: 0, position: "relative" }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: tokens.textHint }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: tokens.textPrimary,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

export function KpiRow({ events, onSelect }: { events: CorporateEvent[]; onSelect?: (e: CorporateEvent) => void }) {
  const today = todayStart();
  const next = events[0];
  const thisWeek = events.filter((e) => {
    const b = bucketFor(e.date, today);
    return b === "Today" || b === "Tomorrow" || b === "This week";
  }).length;
  const reporting = new Set(events.filter((e) => e.eventType === "EARNINGS").map((e) => e.ticker)).size;

  return (
    <div className="kpi-grid">
      <NextUpHero next={next} onSelect={onSelect} />
      <KpiCard
        label="Events this week"
        value={String(thisWeek)}
        sub="Today through Sunday"
        accent="#2563eb"
        bg="var(--kpi2-bg)"
        bd="var(--kpi2-bd)"
        Icon={LayersIcon}
      />
      <KpiCard
        label="Companies reporting"
        value={String(reporting)}
        sub="Earnings in current view"
        accent="#06b6d4"
        bg="var(--kpi3-bg)"
        bd="var(--kpi3-bd)"
        Icon={BuildingIcon}
      />
    </div>
  );
}
