import type { CSSProperties } from "react";
import type { EventType, Filters, Universe } from "../types";
import { eventTypeMeta, tokens } from "../theme";

const UNIVERSES: { key: Universe; label: string }[] = [
  { key: "WATCHLIST", label: "Watchlist" },
  { key: "NIFTY50", label: "Nifty 50" },
  { key: "NIFTY500", label: "Nifty 500" },
  { key: "ALL", label: "All" },
];
const HORIZONS = [7, 30, 90];
const TYPES: EventType[] = ["EARNINGS", "DEMERGER"];

const groupLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: tokens.textHint,
  marginBottom: 6,
};

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "inline-flex", background: tokens.surface2, borderRadius: 8, padding: 2 }}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={String(o.key)}
            onClick={() => onChange(o.key)}
            style={{
              border: "none",
              cursor: "pointer",
              fontSize: 12.5,
              fontWeight: 600,
              padding: "5px 12px",
              borderRadius: 6,
              background: active ? tokens.surface : "transparent",
              color: active ? tokens.primaryText : tokens.textMuted,
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.2s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function FiltersBar({
  filters,
  onChange,
  counts,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  counts?: Partial<Record<EventType, number>>;
}) {
  const toggleType = (t: EventType) => {
    const has = filters.types.includes(t);
    const next = has ? filters.types.filter((x) => x !== t) : [...filters.types, t];
    onChange({ ...filters, types: next.length ? next : filters.types });
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 24,
        alignItems: "flex-end",
        background: tokens.cardBg,
        border: `1px solid ${tokens.border}`,
        borderRadius: 16,
        padding: "14px 18px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      <div>
        <div style={groupLabel}>Universe</div>
        <Segmented
          options={UNIVERSES}
          value={filters.universe}
          onChange={(v) => onChange({ ...filters, universe: v })}
        />
      </div>

      <div>
        <div style={groupLabel}>Event type</div>
        <div style={{ display: "flex", gap: 6 }}>
          {TYPES.map((t) => {
            const active = filters.types.includes(t);
            const m = eventTypeMeta[t];
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                style={{
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: "5px 11px",
                  borderRadius: 8,
                  background: active ? m.bg : tokens.surface,
                  color: active ? m.text : tokens.textHint,
                  border: `1px solid ${active ? m.border : tokens.borderSolid}`,
                  transition: "all 0.2s",
                }}
              >
                {m.label}
                {counts?.[t] !== undefined && (
                  <span style={{ marginLeft: 5, fontWeight: 700, opacity: 0.7 }}>{counts[t]}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={groupLabel}>Horizon</div>
        <Segmented
          options={HORIZONS.map((h) => ({ key: h, label: `${h}d` }))}
          value={filters.horizonDays}
          onChange={(v) => onChange({ ...filters, horizonDays: v })}
        />
      </div>

      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={groupLabel}>Search</div>
        <input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Company, ticker or sector…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            fontSize: 13,
            padding: "7px 11px",
            borderRadius: 8,
            border: `1px solid ${tokens.borderSolid}`,
            outline: "none",
            fontFamily: tokens.font,
            color: tokens.textPrimary,
          }}
        />
      </div>
    </div>
  );
}
