import type { CSSProperties } from "react";
import type { EventType, Filters, Universe } from "../types";
import { eventTypeMeta, tokens } from "../theme";
import { SearchIcon } from "./icons";

const UNIVERSES: { key: Universe; label: string }[] = [
  { key: "WATCHLIST", label: "Watchlist" },
  { key: "NIFTY50", label: "Nifty 50" },
  { key: "NIFTY500", label: "Nifty 500" },
  { key: "ALL", label: "All" },
];
const HORIZONS = [7, 30, 90];
const TYPES: EventType[] = ["EARNINGS", "DEMERGER"];

const groupLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: tokens.textHint,
  marginBottom: 7,
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
    <div
      style={{
        display: "inline-flex",
        background: tokens.surface2,
        borderRadius: 10,
        padding: 3,
        gap: 2,
        border: `1px solid ${tokens.border}`,
      }}
    >
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
              borderRadius: 7,
              background: active ? tokens.gradientBrand : "transparent",
              color: active ? "#ffffff" : tokens.textMuted,
              boxShadow: active ? "0 1px 3px rgba(37,60,190,0.35)" : "none",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, alignSelf: "stretch", background: tokens.border, margin: "0 2px" }} />;
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
        gap: 18,
        alignItems: "flex-end",
        background: tokens.cardBg,
        border: `1px solid ${tokens.border}`,
        borderRadius: tokens.radiusCard,
        padding: "13px 18px",
        boxShadow: tokens.shadowCard,
      }}
    >
      <div>
        <div style={groupLabel}>Universe</div>
        <Segmented options={UNIVERSES} value={filters.universe} onChange={(v) => onChange({ ...filters, universe: v })} />
      </div>

      <Divider />

      <div>
        <div style={groupLabel}>Event type</div>
        <div style={{ display: "flex", gap: 7 }}>
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
                  padding: "6px 12px",
                  borderRadius: 9,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: active ? m.bg : tokens.surface,
                  color: active ? m.text : tokens.textHint,
                  border: `1px solid ${active ? m.border : tokens.border}`,
                  transition: "all 0.2s",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: active ? m.hex : tokens.textHint,
                    opacity: active ? 1 : 0.5,
                  }}
                />
                {m.label}
                {counts?.[t] !== undefined && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: active ? m.text : tokens.textHint,
                      background: active ? "rgba(255,255,255,0.5)" : tokens.surface2,
                      borderRadius: 6,
                      padding: "0 5px",
                    }}
                  >
                    {counts[t]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Divider />

      <div>
        <div style={groupLabel}>Horizon</div>
        <Segmented
          options={HORIZONS.map((h) => ({ key: h, label: `${h}d` }))}
          value={filters.horizonDays}
          onChange={(v) => onChange({ ...filters, horizonDays: v })}
        />
      </div>

      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={groupLabel}>Search</div>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: 11, color: tokens.textHint, display: "inline-flex", pointerEvents: "none" }}>
            <SearchIcon size={15} />
          </span>
          <input
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Company, ticker or sector…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontSize: 13,
              padding: "8px 12px 8px 34px",
              borderRadius: 10,
              border: `1px solid ${tokens.border}`,
              outline: "none",
              fontFamily: tokens.font,
              color: tokens.textPrimary,
              background: tokens.surface,
            }}
          />
        </div>
      </div>
    </div>
  );
}
