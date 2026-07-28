import type { CorporateEvent } from "../types";
import { tokens } from "../theme";
import { addDays, diffDays, parseISO, todayStart } from "../lib/dates";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKS = 10;

function label(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function Heatmap({ events }: { events: CorporateEvent[] }) {
  const today = todayStart();
  const buckets = Array.from({ length: WEEKS }, (_, i) => {
    const start = addDays(today, i * 7);
    return { start, count: 0, earnings: 0, concall: 0, demerger: 0 };
  });

  for (const e of events) {
    const d = diffDays(today, parseISO(e.date));
    if (d < 0) continue;
    const wi = Math.floor(d / 7);
    if (wi >= WEEKS) continue;
    const b = buckets[wi];
    b.count++;
    if (e.eventType === "EARNINGS") b.earnings++;
    else if (e.eventType === "CONCALL") b.concall++;
    else b.demerger++;
  }

  const max = Math.max(1, ...buckets.map((b) => b.count));
  const busiest = buckets.reduce((a, b) => (b.count > a.count ? b : a), buckets[0]);

  return (
    <div style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {buckets.map((b, i) => {
          const intensity = b.count === 0 ? 0 : 0.16 + 0.72 * (b.count / max);
          return (
            <div
              key={i}
              title={`Week of ${label(b.start)} — ${b.count} events (${b.earnings} earnings, ${b.concall} concalls, ${b.demerger} demergers)`}
              style={{ flex: "1 0 46px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
            >
              <div
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 8,
                  border: `1px solid ${tokens.border}`,
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
              <div style={{ fontSize: 10.5, color: tokens.textHint, whiteSpace: "nowrap" }}>{label(b.start)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: tokens.textMuted }}>
        Busiest week ahead:{" "}
        <span style={{ fontWeight: 600, color: tokens.textSecondary }}>
          {label(busiest.start)}
        </span>{" "}
        · {busiest.count} events
      </div>
    </div>
  );
}
