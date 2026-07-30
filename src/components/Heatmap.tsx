import type { CorporateEvent } from "../types";
import { tokens } from "../theme";
import { addDays, diffDays, parseISO, toISO, todayStart } from "../lib/dates";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKS = 10;

function label(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function Heatmap({
  events,
  selectedWeek,
  onSelectWeek,
}: {
  events: CorporateEvent[];
  selectedWeek?: string | null;
  onSelectWeek?: (weekStartISO: string | null) => void;
}) {
  const today = todayStart();
  const buckets = Array.from({ length: WEEKS }, (_, i) => {
    const start = addDays(today, i * 7);
    return { start, iso: toISO(start), count: 0, earnings: 0, demerger: 0 };
  });

  for (const e of events) {
    const d = diffDays(today, parseISO(e.date));
    if (d < 0) continue;
    const wi = Math.floor(d / 7);
    if (wi >= WEEKS) continue;
    const b = buckets[wi];
    b.count++;
    if (e.eventType === "DEMERGER") b.demerger++;
    else b.earnings++;
  }

  const max = Math.max(1, ...buckets.map((b) => b.count));
  const busiest = buckets.reduce((a, b) => (b.count > a.count ? b : a), buckets[0]);

  return (
    <div style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {buckets.map((b) => {
          const intensity = b.count === 0 ? 0 : 0.16 + 0.72 * (b.count / max);
          const selected = selectedWeek === b.iso;
          return (
            <button
              key={b.iso}
              onClick={() => onSelectWeek?.(selected ? null : b.iso)}
              title={`Week of ${label(b.start)} — ${b.count} events (${b.earnings} earnings, ${b.demerger} demergers) · click to filter`}
              style={{
                flex: "1 0 46px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                cursor: onSelectWeek ? "pointer" : "default",
                border: "none",
                background: "transparent",
                padding: 0,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 8,
                  border: selected ? `2px solid ${tokens.primary}` : `1px solid ${tokens.border}`,
                  boxShadow: selected ? `0 0 0 3px ${tokens.primaryLight}` : "none",
                  background:
                    b.count === 0
                      ? "transparent"
                      : `color-mix(in srgb, ${tokens.primary} ${Math.round(intensity * 100)}%, transparent)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  fontWeight: 700,
                  color: intensity > 0.55 ? "#fff" : tokens.textSecondary,
                }}
              >
                {b.count || ""}
              </div>
              <div style={{ fontSize: 10.5, color: selected ? tokens.primaryText : tokens.textHint, fontWeight: selected ? 700 : 400, whiteSpace: "nowrap" }}>
                {label(b.start)}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: tokens.textMuted }}>
        {selectedWeek ? (
          <>
            Filtered to week of{" "}
            <span style={{ fontWeight: 600, color: tokens.textSecondary }}>
              {label(parseISO(selectedWeek))}
            </span>{" "}
            · click it again to clear
          </>
        ) : (
          <>
            Busiest week ahead:{" "}
            <span style={{ fontWeight: 600, color: tokens.textSecondary }}>{label(busiest.start)}</span> ·{" "}
            {busiest.count} events · click any week to filter
          </>
        )}
      </div>
    </div>
  );
}
