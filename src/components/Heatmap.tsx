import type { CorporateEvent } from "../types";
import { tokens } from "../theme";
import { addDays, diffDays, parseISO, toISO, todayStart } from "../lib/dates";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Quarterly results cluster over ~45-60 days, so the strip is one bar per day.
// The window hugs the actual data (today → last event) but is clamped so it is
// never a lonely few bars nor an endless scroll.
const MIN_DAYS = 21;
const MAX_DAYS = 60;
const BAR_AREA = 92; // px, tallest bar

export interface Day {
  date: Date;
  iso: string;
  count: number;
  earnings: number;
  demerger: number;
  weekend: boolean;
}

export function dayLabel(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Daily buckets over an adaptive window (today → last event, clamped), plus the
// peak and the busiest days. Shared by the full chart and its collapsed summary.
export function computeDensity(events: CorporateEvent[]): { days: Day[]; max: number; busiest: Day[] } {
  const today = todayStart();

  let lastOffset = 0;
  for (const e of events) {
    const d = diffDays(today, parseISO(e.date));
    if (d >= 0 && d > lastOffset) lastOffset = d;
  }
  const span = Math.min(MAX_DAYS, Math.max(MIN_DAYS, lastOffset + 2));

  const days: Day[] = Array.from({ length: span }, (_, i) => {
    const date = addDays(today, i);
    const dow = date.getDay();
    return { date, iso: toISO(date), count: 0, earnings: 0, demerger: 0, weekend: dow === 0 || dow === 6 };
  });
  const byIso = new Map(days.map((d) => [d.iso, d]));

  for (const e of events) {
    const b = byIso.get(e.date);
    if (!b) continue;
    b.count++;
    if (e.eventType === "DEMERGER") b.demerger++;
    else b.earnings++;
  }

  const max = Math.max(1, ...days.map((d) => d.count));
  const busiest = days
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count || a.iso.localeCompare(b.iso))
    .slice(0, 5);

  return { days, max, busiest };
}

export function Heatmap({
  events,
  selectedDay,
  onSelectDay,
}: {
  events: CorporateEvent[];
  selectedDay?: string | null;
  onSelectDay?: (dayISO: string | null) => void;
}) {
  const { days, max, busiest } = computeDensity(events);
  const valThreshold = Math.max(10, max * 0.3);

  const barColor = (d: Day): string => {
    if (d.count === 0) return `color-mix(in srgb, ${tokens.textHint} 12%, transparent)`;
    const t = 0.32 + 0.58 * (d.count / max);
    const base = d.weekend ? tokens.textHint : tokens.primary;
    return `color-mix(in srgb, ${base} ${Math.round(t * 100)}%, transparent)`;
  };

  return (
    <div style={{ display: "flex", gap: 18, padding: "8px 4px 4px", flexWrap: "wrap" }}>
      {/* Daily bar strip */}
      <div style={{ flex: "1 1 460px", minWidth: 0 }}>
        <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4, alignItems: "flex-end" }}>
          {days.map((d, i) => {
            const h = 3 + (d.count / max) * BAR_AREA;
            const selected = selectedDay === d.iso;
            const isToday = i === 0;
            const firstOfMonth = d.date.getDate() === 1;
            return (
              <button
                key={d.iso}
                onClick={() => onSelectDay?.(selected ? null : d.iso)}
                title={`${dayLabel(d.date)} — ${d.count} event${d.count === 1 ? "" : "s"}${
                  d.count ? ` (${d.earnings} earnings, ${d.demerger} demergers)` : ""
                } · click to filter`}
                style={{
                  flex: "1 0 16px",
                  maxWidth: 40,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 4,
                  cursor: onSelectDay ? "pointer" : "default",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  borderLeft: firstOfMonth ? `1px dashed ${tokens.border}` : "none",
                  height: BAR_AREA + 40,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: tokens.primaryText, height: 13, lineHeight: "13px" }}>
                  {d.count >= valThreshold ? d.count : ""}
                </span>
                <span
                  style={{
                    width: "100%",
                    minWidth: 8,
                    height: h,
                    borderRadius: "4px 4px 0 0",
                    background: barColor(d),
                    outline: selected ? `2px solid ${tokens.primary}` : isToday ? `2px solid ${tokens.primaryBorder}` : "none",
                    outlineOffset: 2,
                  }}
                />
                <span
                  style={{
                    fontSize: 9.5,
                    lineHeight: 1.15,
                    textAlign: "center",
                    color: isToday || selected ? tokens.primaryText : tokens.textHint,
                    fontWeight: isToday || selected || firstOfMonth ? 700 : 400,
                    whiteSpace: "nowrap",
                  }}
                >
                  {isToday ? "Today" : d.date.getDate()}
                  {firstOfMonth && !isToday && (
                    <>
                      <br />
                      {MONTHS[d.date.getMonth()]}
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 6, fontSize: 11.5, color: tokens.textMuted }}>
          {selectedDay ? (
            <>
              Filtered to{" "}
              <span style={{ fontWeight: 600, color: tokens.textSecondary }}>{dayLabel(parseISO(selectedDay))}</span> · click
              the day again to clear
            </>
          ) : (
            <>
              Weekdays <span style={{ color: tokens.primaryText, fontWeight: 600 }}>indigo</span>, weekends grey · click any day
              to filter
            </>
          )}
        </div>
      </div>

      {/* Busiest days ahead */}
      {busiest.length > 0 && (
        <div style={{ flex: "0 1 240px", minWidth: 200 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: tokens.textHint,
              marginBottom: 8,
            }}
          >
            Busiest days ahead
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {busiest.map((d) => {
              const selected = selectedDay === d.iso;
              return (
                <button
                  key={d.iso}
                  onClick={() => onSelectDay?.(selected ? null : d.iso)}
                  title={`Filter to ${dayLabel(d.date)}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 9px",
                    borderRadius: 9,
                    cursor: "pointer",
                    textAlign: "left",
                    border: `1px solid ${selected ? tokens.primaryBorder : tokens.border}`,
                    background: selected ? tokens.primaryLight : tokens.surface,
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: tokens.textSecondary, width: 84, flexShrink: 0 }}>
                    {dayLabel(d.date)}
                  </span>
                  <span style={{ flex: 1, height: 7, background: tokens.surface2, borderRadius: 4, overflow: "hidden" }}>
                    <span
                      style={{
                        display: "block",
                        height: "100%",
                        width: `${(d.count / max) * 100}%`,
                        background: tokens.primary,
                        borderRadius: 4,
                      }}
                    />
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: tokens.primaryText, width: 30, textAlign: "right" }}>
                    {d.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
