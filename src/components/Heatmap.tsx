import { useState } from "react";
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
const BAR_AREA = 96; // px, tallest bar

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

// Blue → violet with the number of events; weekends muted grey.
function barColor(d: Day, max: number): string {
  if (d.count === 0) return `color-mix(in srgb, ${tokens.textHint} 14%, transparent)`;
  if (d.weekend) return `color-mix(in srgb, ${tokens.textHint} ${Math.round(35 + 30 * (d.count / max))}%, transparent)`;
  const t = Math.round((d.count / max) * 100);
  return `color-mix(in srgb, #7c3aed ${t}%, #2563eb)`;
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
  const [hover, setHover] = useState<{ day: Day; x: number; y: number } | null>(null);

  return (
    <div style={{ display: "flex", gap: 20, padding: "10px 6px 6px", flexWrap: "wrap" }}>
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
                onMouseMove={(e) => setHover({ day: d, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover((h) => (h?.day.iso === d.iso ? null : h))}
                style={{
                  flex: "1 0 16px",
                  maxWidth: 42,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 4,
                  cursor: onSelectDay ? "pointer" : "default",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  borderLeft: firstOfMonth ? `1px dashed ${tokens.borderStrong}` : "none",
                  height: BAR_AREA + 42,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: tokens.textSecondary, height: 13, lineHeight: "13px" }}>
                  {d.count >= valThreshold ? d.count : ""}
                </span>
                <span
                  style={{
                    width: "100%",
                    minWidth: 8,
                    height: h,
                    borderRadius: "5px 5px 2px 2px",
                    background: barColor(d, max),
                    outline: selected ? "2px solid #0f172a" : isToday ? `2px solid ${tokens.primaryBorder}` : "none",
                    outlineOffset: 2,
                    boxShadow: selected ? "0 0 0 4px rgba(79,70,229,0.2)" : "none",
                    transition: "filter 0.15s",
                    filter: hover?.day.iso === d.iso ? "brightness(1.12)" : "none",
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
        <div style={{ marginTop: 8, fontSize: 11.5, color: tokens.textMuted, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 22, height: 8, borderRadius: 3, background: "linear-gradient(90deg,#2563eb,#7c3aed)" }} />
            fewer → more events
          </span>
          <span style={{ color: tokens.textHint }}>·</span>
          {selectedDay ? (
            <span>
              Filtered to <span style={{ fontWeight: 600, color: tokens.textSecondary }}>{dayLabel(parseISO(selectedDay))}</span>
              {" "}· click again to clear
            </span>
          ) : (
            <span>click any day to filter</span>
          )}
        </div>
      </div>

      {/* Busiest days ahead — ranked cards with gradient progress */}
      {busiest.length > 0 && (
        <div style={{ flex: "0 1 250px", minWidth: 210 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: tokens.textHint,
              marginBottom: 9,
            }}
          >
            Busiest days ahead
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {busiest.map((d, i) => {
              const selected = selectedDay === d.iso;
              return (
                <button
                  key={d.iso}
                  onClick={() => onSelectDay?.(selected ? null : d.iso)}
                  title={`Filter to ${dayLabel(d.date)}`}
                  className="card-hover"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    padding: "8px 11px",
                    borderRadius: 12,
                    cursor: "pointer",
                    textAlign: "left",
                    border: `1px solid ${selected ? tokens.primaryBorder : tokens.border}`,
                    background: selected ? tokens.primaryLight : tokens.surface,
                    boxShadow: tokens.shadowCard,
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 22,
                      height: 22,
                      borderRadius: 7,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 800,
                      color: i === 0 ? "#fff" : tokens.textMuted,
                      background: i === 0 ? tokens.gradientBrand : tokens.surface2,
                      border: i === 0 ? "none" : `1px solid ${tokens.border}`,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: tokens.textSecondary, whiteSpace: "nowrap" }}>
                        {dayLabel(d.date)}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: tokens.primaryText }}>{d.count}</span>
                    </div>
                    <span
                      style={{
                        display: "block",
                        marginTop: 5,
                        height: 6,
                        background: tokens.surface2,
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          height: "100%",
                          width: `${(d.count / max) * 100}%`,
                          background: tokens.gradientBrand,
                          borderRadius: 4,
                        }}
                      />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating tooltip with the day's event-type breakdown */}
      {hover && (
        <div
          style={{
            position: "fixed",
            left: hover.x + 14,
            top: hover.y - 8,
            zIndex: 50,
            pointerEvents: "none",
            background: "#0f172a",
            color: "#fff",
            borderRadius: 10,
            padding: "8px 11px",
            boxShadow: "0 10px 24px rgba(15,23,42,0.35)",
            fontSize: 11.5,
            minWidth: 150,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{dayLabel(hover.day.date)}</div>
          {hover.day.count === 0 ? (
            <div style={{ color: "#cbd5e1" }}>No events</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#e2e8f0" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#60a5fa" }} />
                {hover.day.earnings} earnings
              </div>
              {hover.day.demerger > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#e2e8f0", marginTop: 2 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fbbf24" }} />
                  {hover.day.demerger} corporate action{hover.day.demerger === 1 ? "" : "s"}
                </div>
              )}
              <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.15)", color: "#94a3b8" }}>
                {hover.day.count} total · click to filter
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
