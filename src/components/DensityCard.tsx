import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { CorporateEvent } from "../types";
import { tokens } from "../theme";
import { Heatmap, computeDensity, dayLabel, type Day } from "./Heatmap";
import { BarChartIcon, SparkIcon } from "./icons";

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
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 1.5, height: 20 }}>
      {days.slice(0, 30).map((d, i) => {
        const r = d.count / max;
        const bg =
          d.count === 0
            ? `color-mix(in srgb, ${tokens.textHint} 22%, transparent)`
            : r >= 0.66
              ? "#7c3aed"
              : r >= 0.33
                ? "#4f46e5"
                : "#a6aedc";
        return <span key={i} style={{ width: 3, height: Math.max(2, r * 20), borderRadius: 1, background: bg }} />;
      })}
    </span>
  );
}

// The "Earnings-season density" chart — a collapsible premium panel.
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
    boxShadow: tokens.shadowCard,
    overflow: "hidden",
    flexShrink: 0,
  };

  const toggleBtn: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 12px",
    borderRadius: 9,
    border: `1px solid ${open ? tokens.border : "color-mix(in srgb, #7c3aed 28%, transparent)"}`,
    background: open ? tokens.surface : "color-mix(in srgb, #7c3aed 10%, transparent)",
    color: open ? tokens.textSecondary : "#7c3aed",
    whiteSpace: "nowrap",
  };

  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          borderBottom: open ? `1px solid ${tokens.border}` : "none",
        }}
      >
        <span
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: 10,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#7c3aed",
            background: "color-mix(in srgb, #7c3aed 12%, transparent)",
            border: "1px solid color-mix(in srgb, #7c3aed 24%, transparent)",
          }}
        >
          <BarChartIcon size={17} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: tokens.textPrimary, letterSpacing: "-0.01em" }}>
            Earnings-season density
          </div>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 1 }}>
            {peak ? (
              <>
                Peak: <span style={{ fontWeight: 600, color: tokens.textSecondary }}>{dayLabel(peak.date)}</span> ({peak.count}{" "}
                companies)
              </>
            ) : (
              "No upcoming events in range"
            )}
          </div>
        </div>
        <span style={{ flex: 1 }} />
        {!open && <MiniBars days={days} max={max} />}
        <button style={toggleBtn} onClick={() => setOpen(!open)}>
          {open ? "Hide" : <><SparkIcon size={13} /> Show insights</>}
        </button>
      </div>

      {open && (
        <div style={{ padding: "14px 16px 16px" }}>
          <div
            style={{
              background: "var(--density-panel-bg)",
              border: "1px solid var(--density-panel-bd)",
              borderRadius: 14,
              padding: "16px 14px 12px",
            }}
          >
            <Heatmap events={events} selectedDay={selectedDay} onSelectDay={onSelectDay} />
          </div>
        </div>
      )}
    </div>
  );
}
