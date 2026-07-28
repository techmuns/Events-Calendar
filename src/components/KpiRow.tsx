import type { CSSProperties } from "react";
import type { CorporateEvent } from "../types";
import { tokens } from "../theme";
import { bucketFor, diffDays, formatDate, parseISO, todayStart } from "../lib/dates";

function KpiTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  const card: CSSProperties = {
    background: tokens.cardBg,
    border: `1px solid ${tokens.border}`,
    borderRadius: 14,
    padding: "14px 16px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minHeight: 82,
  };
  return (
    <div style={card}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: tokens.textHint }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? tokens.textPrimary, lineHeight: 1.15 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: tokens.textMuted }}>{sub}</div>
    </div>
  );
}

function relative(iso: string, today: Date): string {
  const d = diffDays(today, parseISO(iso));
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `in ${d} days · ${formatDate(iso)}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  const next = events[0]; // events arrive sorted by date
  const thisWeek = events.filter((e) => {
    const b = bucketFor(e.date, today);
    return b === "Today" || b === "This week";
  }).length;
  const reporting = new Set(
    events.filter((e) => e.eventType === "EARNINGS").map((e) => e.ticker),
  ).size;

  const grid: CSSProperties = {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  };

  return (
    <div style={grid}>
      <KpiTile
        label="Next event"
        value={next ? next.ticker : "—"}
        sub={next ? `${next.subtype} · ${relative(next.date, today)}` : "Nothing upcoming"}
        accent={tokens.primary}
      />
      <KpiTile label="Events this week" value={String(thisWeek)} sub="Today through Sunday" />
      <KpiTile label="Companies reporting" value={String(reporting)} sub="Earnings in current view" />
      <KpiTile
        label="Data freshness"
        value={live ? "Live" : "Sample"}
        sub={`Updated ${formatTime(generatedAt)}`}
        accent={live ? "#16a34a" : tokens.textSecondary}
      />
    </div>
  );
}
