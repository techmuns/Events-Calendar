import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { CorporateEvent } from "../types";
import { tokens } from "../theme";
import { Heatmap, computeDensity, dayLabel, type Day } from "./Heatmap";
import { ChevronRightIcon } from "./icons";

// Remember whether the density chart is expanded, across reloads.
function usePersistedOpen(key: string, def: boolean): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const s = localStorage.getItem(key);
      return s === null ? def : s === "1";
    } catch {
      return def;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [key, open]);
  return [open, setOpen];
}

function MiniBars({ days, max }: { days: Day[]; max: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 1.5, height: 18 }}>
      {days.slice(0, 30).map((d, i) => (
        <span
          key={i}
          style={{
            width: 3,
            height: Math.max(2, (d.count / max) * 18),
            borderRadius: 1,
            background:
              d.count === 0
                ? `color-mix(in srgb, ${tokens.textHint} 22%, transparent)`
                : d.weekend
                  ? `color-mix(in srgb, ${tokens.textHint} 55%, transparent)`
                  : tokens.primary,
          }}
        />
      ))}
    </span>
  );
}

// The "Earnings-season density" chart, collapsed to a one-line summary by
// default (peak day + mini preview) so it never dominates the dashboard.
export function DensityCard({
  events,
  selectedDay,
  onSelectDay,
}: {
  events: CorporateEvent[];
  selectedDay?: string | null;
  onSelectDay?: (dayISO: string | null) => void;
}) {
  const [open, setOpen] = usePersistedOpen("ec_density_open", false);
  const { days, max, busiest } = computeDensity(events);
  const peak = busiest[0];

  const card: CSSProperties = {
    background: tokens.cardBg,
    border: `1px solid ${tokens.border}`,
    borderRadius: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    overflow: "hidden",
    flexShrink: 0,
  };

  return (
    <div style={card}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          cursor: "pointer",
          border: "none",
          background: "transparent",
          textAlign: "left",
          borderBottom: open ? `1px solid ${tokens.border}` : "none",
        }}
      >
        <span
          style={{
            color: tokens.textMuted,
            display: "inline-flex",
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 0.15s",
          }}
        >
          <ChevronRightIcon size={15} />
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: tokens.textPrimary }}>Earnings-season density</span>
        {!open && peak && (
          <span style={{ fontSize: 12, color: tokens.textMuted }}>
            · peak{" "}
            <span style={{ fontWeight: 600, color: tokens.primaryText }}>
              {dayLabel(peak.date)} ({peak.count})
            </span>
          </span>
        )}
        <span style={{ flex: 1 }} />
        {!open && selectedDay && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: tokens.primaryText,
              background: tokens.primaryLight,
              border: `1px solid ${tokens.primaryBorder}`,
              borderRadius: 99,
              padding: "2px 8px",
            }}
          >
            filtered
          </span>
        )}
        {!open && <MiniBars days={days} max={max} />}
        <span style={{ fontSize: 11.5, color: tokens.textHint, marginLeft: 2 }}>{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div>
          <Heatmap events={events} selectedDay={selectedDay} onSelectDay={onSelectDay} />
        </div>
      )}
    </div>
  );
}
