import { useEffect, useState } from "react";
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
const HORIZONS = [7, 14];
const TYPES: EventType[] = ["EARNINGS", "DEMERGER"];

// Dark-mode Event Type palette. Each category owns its accent (Earnings blue,
// Corporate Action amber) so it stays legible on the deep-navy toolbar: a solid
// dot, an accent-tinted border and count badge, near-white labels, and a strong
// category-tinted fill when the toggle is active.
const DARK_ET: Record<
  EventType,
  {
    dot: string;
    base: { bg: string; bd: string };
    hover: { bg: string; bd: string };
    sel: { bg: string; bd: string };
    count: { bg: string; bd: string; text: string };
  }
> = {
  EARNINGS: {
    dot: "#3b82f6",
    base: { bg: "#15213a", bd: "rgba(59,130,246,0.45)" },
    hover: { bg: "#1a2945", bd: "rgba(59,130,246,0.60)" },
    sel: { bg: "rgba(37,99,235,0.24)", bd: "#3b82f6" },
    count: { bg: "rgba(59,130,246,0.16)", bd: "rgba(59,130,246,0.30)", text: "#dbeafe" },
  },
  CONCALL: {
    dot: "#14b8a6",
    base: { bg: "#15213a", bd: "rgba(20,184,166,0.45)" },
    hover: { bg: "#1a2945", bd: "rgba(20,184,166,0.60)" },
    sel: { bg: "rgba(13,148,136,0.22)", bd: "#14b8a6" },
    count: { bg: "rgba(20,184,166,0.16)", bd: "rgba(20,184,166,0.30)", text: "#ccfbf1" },
  },
  DEMERGER: {
    dot: "#f59e0b",
    base: { bg: "#15213a", bd: "rgba(245,158,11,0.45)" },
    hover: { bg: "#1a2945", bd: "rgba(245,158,11,0.60)" },
    sel: { bg: "rgba(217,119,6,0.20)", bd: "#f59e0b" },
    count: { bg: "rgba(245,158,11,0.14)", bd: "rgba(245,158,11,0.28)", text: "#fde68a" },
  },
};

const groupLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: tokens.groupLabel,
  marginBottom: 8,
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
              fontSize: 14,
              fontWeight: active ? 700 : 600,
              padding: "6px 14px",
              borderRadius: 7,
              background: active ? tokens.gradientBrand : "transparent",
              color: active ? "#ffffff" : tokens.textPrimary,
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

// Free-form horizon: type any number of days when the 7/30/90 presets don't fit.
function CustomHorizon({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const isCustom = !HORIZONS.includes(value);
  const [text, setText] = useState(isCustom ? String(value) : "");
  useEffect(() => {
    setText(isCustom ? String(value) : "");
  }, [value, isCustom]);

  return (
    <div
      title="Custom horizon (days)"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        borderRadius: 10,
        padding: "4px 10px",
        border: `1px solid ${isCustom ? tokens.primary : tokens.border}`,
        background: isCustom ? tokens.primaryLight : tokens.surface2,
        boxShadow: isCustom ? `0 0 0 3px color-mix(in srgb, ${tokens.primary} 14%, transparent)` : "none",
        transition: "all 0.2s",
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
          setText(digits);
          const n = parseInt(digits, 10);
          if (!Number.isNaN(n) && n > 0) onChange(Math.min(365, n));
        }}
        onBlur={() => setText(isCustom ? String(value) : "")}
        placeholder="Custom"
        aria-label="Custom horizon in days"
        style={{
          width: 60,
          border: "none",
          outline: "none",
          background: "transparent",
          fontFamily: tokens.font,
          fontSize: 14,
          fontWeight: isCustom ? 700 : 600,
          color: isCustom ? tokens.primaryText : tokens.textSecondary,
          padding: 0,
        }}
      />
      {isCustom && <span style={{ fontSize: 12.5, fontWeight: 600, color: tokens.textMuted }}>d</span>}
    </div>
  );
}

export function FiltersBar({
  filters,
  onChange,
  counts,
  isDark = false,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  counts?: Partial<Record<EventType, number>>;
  isDark?: boolean;
}) {
  const [hovered, setHovered] = useState<EventType | null>(null);
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
        gap: 20,
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
            const dc = DARK_ET[t];
            const isHover = hovered === t;

            const bg = isDark
              ? active
                ? dc.sel.bg
                : isHover
                  ? dc.hover.bg
                  : dc.base.bg
              : active
                ? m.bg
                : tokens.surface;
            const borderColor = isDark
              ? active
                ? dc.sel.bd
                : isHover
                  ? dc.hover.bd
                  : dc.base.bd
              : active
                ? m.border
                : tokens.border;
            const labelColor = isDark ? (active ? "#ffffff" : "#eaf0fa") : active ? m.text : tokens.textSecondary;
            const dotColor = isDark ? dc.dot : active ? m.hex : tokens.textHint;
            const dotOpacity = isDark ? (active ? 1 : 0.9) : active ? 1 : 0.5;
            const countStyle: CSSProperties = isDark
              ? { color: dc.count.text, background: dc.count.bg, border: `1px solid ${dc.count.bd}` }
              : { color: active ? m.text : tokens.textMuted, background: active ? "rgba(255,255,255,0.55)" : tokens.surface2 };

            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                onMouseEnter={isDark ? () => setHovered(t) : undefined}
                onMouseLeave={isDark ? () => setHovered((h) => (h === t ? null : h)) : undefined}
                style={{
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: active ? 700 : 600,
                  padding: "6px 13px",
                  borderRadius: isDark ? 11 : 9,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: bg,
                  color: labelColor,
                  border: `1px solid ${borderColor}`,
                  transition: "all 0.2s",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: dotColor,
                    opacity: dotOpacity,
                  }}
                />
                {m.label}
                {counts?.[t] !== undefined && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 6,
                      padding: "1px 6px",
                      ...countStyle,
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Segmented
            options={HORIZONS.map((h) => ({ key: h, label: `${h}d` }))}
            value={filters.horizonDays}
            onChange={(v) => onChange({ ...filters, horizonDays: v })}
          />
          <CustomHorizon value={filters.horizonDays} onChange={(v) => onChange({ ...filters, horizonDays: v })} />
        </div>
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
              fontSize: 14,
              fontWeight: 500,
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
