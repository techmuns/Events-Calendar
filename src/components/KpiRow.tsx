import type { CSSProperties } from "react";
import type { CorporateEvent } from "../types";
import { tokens } from "../theme";
import { bucketFor, diffDays, formatDate, parseISO, todayStart } from "../lib/dates";

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

// Compact one-line stat strip (four segments) so the events list stays the hero.
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
  const reporting = new Set(events.filter((e) => e.eventType === "EARNINGS").map((e) => e.ticker)).size;

  const items: { label: string; value: string; sub?: string; accent?: string }[] = [
    {
      label: "Next event",
      value: next ? next.ticker : "—",
      sub: next ? relative(next.date, today) : "Nothing upcoming",
      accent: tokens.primaryText,
    },
    { label: "This week", value: String(thisWeek), sub: "Today–Sun" },
    { label: "Reporting", value: String(reporting), sub: "in view" },
    {
      label: "Freshness",
      value: live ? "Live" : "Sample",
      sub: formatTime(generatedAt),
      accent: live ? "#16a34a" : undefined,
    },
  ];

  const strip: CSSProperties = {
    display: "flex",
    background: tokens.cardBg,
    border: `1px solid ${tokens.border}`,
    borderRadius: 12,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    overflow: "hidden",
  };

  return (
    <div style={strip}>
      {items.map((it, i) => (
        <div
          key={it.label}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "8px 14px",
            borderRight: i < items.length - 1 ? `1px solid ${tokens.border}` : "none",
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: tokens.textHint,
            }}
          >
            {it.label}
          </span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: it.accent ?? tokens.textPrimary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {it.value}
            </span>
            {it.sub && (
              <span style={{ fontSize: 11, color: tokens.textHint, whiteSpace: "nowrap" }}>{it.sub}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
