import { useState } from "react";
import type { CorporateEvent } from "../types";
import { tokens } from "../theme";
import { addDays, diffDays, parseISO, toISO, todayStart } from "../lib/dates";
import { CursorIcon } from "./icons";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Quarterly results cluster over ~45-60 days, so the strip is one bar per day.
const MIN_DAYS = 21;
const MAX_DAYS = 60;
const BAR_AREA = 108; // px, tallest bar

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

// Vertical bar gradients, low → high, plus Today (blue) and the peak/selected
// purple. Theme-aware via CSS vars (light pastels / deep-navy dark).
const BAR = {
  low: "var(--bar-low)",
  med: "var(--bar-med)",
  high: "var(--bar-high)",
  peak: "var(--bar-peak)",
  today: "var(--bar-today)",
};

export function Heatmap({
  events,
  selectedDay,
  onSelectDay,
}: {
  events: CorporateEvent[];
  selectedDay?: string | null;
  onSelectDay?: (dayISO: string | null) => void;
}) {
  const { days, max } = computeDensity(events);
  const labelThreshold = Math.max(10, max * 0.45);
  const [hover, setHover] = useState<{ day: Day; x: number; y: number } | null>(null);

  return (
    <div>
      <div style={{ position: "relative" }}>
        {/* faint horizontal guide lines behind the bars */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 16,
            bottom: 42,
            pointerEvents: "none",
            backgroundImage:
              "repeating-linear-gradient(to top, var(--density-grid) 0, var(--density-grid) 1px, transparent 1px, transparent 27px)",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            gap: 5,
            overflowX: "auto",
            alignItems: "flex-end",
            paddingBottom: 2,
          }}
        >
          {days.map((d, i) => {
          const selected = selectedDay === d.iso;
          const isToday = i === 0;
          const firstOfMonth = d.date.getDate() === 1;
          const zero = d.count === 0;
          const ratio = d.count / max;
          const isPeak = d.count === max && d.count > 0;
          const h = Math.max(10, 6 + ratio * BAR_AREA);

          let bg = BAR.low;
          if (selected) bg = BAR.peak;
          else if (isToday) bg = BAR.today;
          else if (isPeak) bg = BAR.peak;
          else if (ratio >= 0.66) bg = BAR.high;
          else if (ratio >= 0.33) bg = BAR.med;

          const showVal = !zero && (d.count >= labelThreshold || selected || isPeak);
          const labelColor = selected
            ? "var(--density-selected)"
            : isToday
              ? "var(--density-today)"
              : tokens.textMuted;

          return (
            <button
              key={d.iso}
              onClick={() => onSelectDay?.(selected ? null : d.iso)}
              onMouseMove={(e) => setHover({ day: d, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover((h) => (h?.day.iso === d.iso ? null : h))}
              style={{
                flex: "1 0 18px",
                maxWidth: 46,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 3,
                cursor: onSelectDay ? "pointer" : "default",
                border: "none",
                background: "transparent",
                padding: 0,
                height: BAR_AREA + 60,
              }}
            >
              <span style={{ fontSize: 10.5, fontWeight: 800, color: tokens.textPrimary, height: 14, lineHeight: "14px" }}>
                {showVal ? d.count : ""}
              </span>

              {zero ? (
                <span
                  style={{
                    width: "62%",
                    minWidth: 8,
                    height: 9,
                    borderRadius: 5,
                    border: `1.5px dashed ${tokens.borderStrong}`,
                    background: "transparent",
                  }}
                />
              ) : (
                <span
                  style={{
                    width: "100%",
                    minWidth: 9,
                    height: h,
                    borderRadius: "7px 7px 2px 2px",
                    background: bg,
                    outline: selected ? "2px solid #c4b5fd" : "none",
                    outlineOffset: 2,
                    boxShadow: selected ? "0 0 12px rgba(124,58,237,0.45)" : "none",
                    filter: hover?.day.iso === d.iso ? "brightness(1.08)" : "none",
                    transition: "filter 0.15s ease",
                  }}
                />
              )}

              {/* selection caret row (fixed height keeps every baseline aligned) */}
              <span style={{ height: 7, display: "flex", alignItems: "center" }}>
                {selected && (
                  <span
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: "5px solid transparent",
                      borderRight: "5px solid transparent",
                      borderTop: "6px solid var(--density-selected)",
                    }}
                  />
                )}
              </span>

              <span
                style={{
                  fontSize: 10,
                  lineHeight: 1.15,
                  textAlign: "center",
                  color: labelColor,
                  fontWeight: selected || isToday || firstOfMonth ? 700 : 500,
                  whiteSpace: "nowrap",
                }}
              >
                {isToday ? "Today" : d.date.getDate()}
                <br />
                <span style={{ fontSize: 8.5, color: firstOfMonth ? tokens.textHint : "transparent" }}>
                  {firstOfMonth ? MONTHS[d.date.getMonth()] : "·"}
                </span>
              </span>
            </button>
          );
        })}
        </div>
      </div>

      {/* Gradient legend + click hint */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: tokens.textMuted }}>Fewer events</span>
          <span
            style={{
              width: 128,
              height: 8,
              borderRadius: 5,
              background: "linear-gradient(90deg, #dce3f0 0%, #a5b4fc 35%, #6366f1 65%, #7c3aed 100%)",
              border: `1px solid ${tokens.border}`,
            }}
          />
          <span style={{ fontSize: 11, color: tokens.textMuted }}>More events</span>
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: tokens.textHint }}>
          <CursorIcon size={13} /> Click any day to filter events
        </span>
      </div>

      {/* Hover tooltip */}
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
            padding: "9px 12px",
            boxShadow: "0 10px 26px rgba(15,23,42,0.38)",
            fontSize: 11.5,
            minWidth: 168,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 5 }}>{dayLabel(hover.day.date)}</div>
          <TipRow color="#a5b4fc" label="Total events" value={hover.day.count} strong />
          {hover.day.count === 0 ? (
            <div style={{ color: "#94a3b8" }}>No events scheduled</div>
          ) : (
            <>
              <TipRow color="#60a5fa" label="Earnings" value={hover.day.earnings} />
              {hover.day.demerger > 0 && <TipRow color="#fbbf24" label="Corporate actions" value={hover.day.demerger} />}
              <div style={{ marginTop: 5, paddingTop: 5, borderTop: "1px solid rgba(255,255,255,0.14)", color: "#94a3b8", fontSize: 10.5 }}>
                Click to filter events to this day
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TipRow({ color, label, value, strong }: { color: string; label: string; value: number; strong?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 2 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ color: "#e2e8f0", flex: 1 }}>{label}</span>
      <span style={{ fontWeight: strong ? 800 : 600, color: "#fff" }}>{value}</span>
    </div>
  );
}
