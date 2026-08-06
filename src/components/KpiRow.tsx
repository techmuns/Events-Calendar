import type { CSSProperties } from "react";
import type { CorporateEvent } from "../types";
import { tokens } from "../theme";
import { bucketFor, diffDays, formatDate, parseISO, todayStart } from "../lib/dates";
import { ActivityIcon, BuildingIcon, CalendarIcon, LayersIcon } from "./icons";

type IconCmp = (p: { size?: number }) => JSX.Element;

function relative(iso: string, today: Date): string {
  const d = diffDays(today, parseISO(iso));
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return formatDate(iso);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

export function KpiRow({
  events,
  generatedAt,
  live,
}: {
  events: CorporateEvent[];
  generatedAt: string;
  live: boolean;
}) {
  const today = todayStart();
  const next = events[0];
  const thisWeek = events.filter((e) => {
    const b = bucketFor(e.date, today);
    return b === "Today" || b === "Tomorrow" || b === "This week";
  }).length;
  const reporting = new Set(events.filter((e) => e.eventType === "EARNINGS").map((e) => e.ticker)).size;

  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(184px, 1fr))" }}>
      <KpiCard
        label="Next event"
        value={next ? next.ticker : "—"}
        sub={next ? `${next.subtype} · ${relative(next.date, today)}` : "Nothing upcoming"}
        accent="#4f46e5"
        bg="var(--kpi1-bg)"
        bd="var(--kpi1-bd)"
        Icon={CalendarIcon}
      />
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
      <KpiCard
        label="Data freshness"
        value={live ? "Live" : "Sample"}
        sub={`Updated ${formatTime(generatedAt)}`}
        accent="#10b981"
        bg="var(--kpi4-bg)"
        bd="var(--kpi4-bd)"
        Icon={ActivityIcon}
      />
    </div>
  );
}
