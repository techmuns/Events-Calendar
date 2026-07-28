import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { CorporateEvent } from "../types";
import { eventTypeMeta, tokens } from "../theme";
import { EventTypeChip, StatusBadge } from "./badges";
import {
  WEEKDAY_LABELS,
  buildMonthMatrix,
  formatMonthYear,
  toISO,
  todayStart,
} from "../lib/dates";

export function MonthView({ events }: { events: CorporateEvent[] }) {
  const today = todayStart();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState<string>(toISO(today));

  const byDate = useMemo(() => {
    const map = new Map<string, CorporateEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  const matrix = useMemo(() => buildMonthMatrix(cursor.year, cursor.month), [cursor]);
  const todayISO = toISO(today);
  const selectedEvents = byDate.get(selected) ?? [];

  const shift = (delta: number) => {
    const m = cursor.month + delta;
    const year = cursor.year + Math.floor(m / 12);
    const month = ((m % 12) + 12) % 12;
    setCursor({ year, month });
  };

  const navBtn: CSSProperties = {
    cursor: "pointer",
    border: `1px solid ${tokens.borderSolid}`,
    background: "#fff",
    borderRadius: 8,
    width: 28,
    height: 28,
    fontSize: 15,
    color: tokens.textSecondary,
    lineHeight: 1,
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: tokens.textPrimary }}>
          {formatMonthYear(new Date(cursor.year, cursor.month, 1))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={navBtn} onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <button
            style={{ ...navBtn, width: "auto", padding: "0 10px", fontSize: 12, fontWeight: 600 }}
            onClick={() => {
              setCursor({ year: today.getFullYear(), month: today.getMonth() });
              setSelected(todayISO);
            }}
          >
            Today
          </button>
          <button style={navBtn} onClick={() => shift(1)} aria-label="Next month">›</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: tokens.textHint, padding: "2px 0" }}>
            {w}
          </div>
        ))}
        {matrix.flat().map((d) => {
          const iso = toISO(d);
          const inMonth = d.getMonth() === cursor.month;
          const dayEvents = byDate.get(iso) ?? [];
          const isToday = iso === todayISO;
          const isSelected = iso === selected;
          return (
            <button
              key={iso}
              onClick={() => setSelected(iso)}
              style={{
                cursor: "pointer",
                textAlign: "left",
                minHeight: 62,
                padding: 6,
                borderRadius: 10,
                background: isSelected ? tokens.primaryLight : "#ffffff",
                border: `1px solid ${isSelected ? tokens.primaryBorder : tokens.border}`,
                opacity: inMonth ? 1 : 0.4,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? "#fff" : tokens.textSecondary,
                  background: isToday ? tokens.primary : "transparent",
                  width: isToday ? 20 : "auto",
                  height: isToday ? 20 : "auto",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  alignSelf: "flex-start",
                }}
              >
                {d.getDate()}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {dayEvents.slice(0, 4).map((e) => (
                  <span
                    key={e.id}
                    title={`${e.company} · ${eventTypeMeta[e.eventType].label}`}
                    style={{ width: 6, height: 6, borderRadius: "50%", background: eventTypeMeta[e.eventType].text }}
                  />
                ))}
                {dayEvents.length > 4 && (
                  <span style={{ fontSize: 9, color: tokens.textHint }}>+{dayEvents.length - 4}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 16, borderTop: `1px solid ${tokens.border}`, paddingTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: tokens.textSecondary, marginBottom: 8 }}>
          {selectedEvents.length > 0
            ? `${selectedEvents.length} event${selectedEvents.length > 1 ? "s" : ""} on ${selected}`
            : `No events on ${selected}`}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {selectedEvents.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <EventTypeChip type={e.eventType} />
              <span style={{ fontSize: 13, fontWeight: 600, color: tokens.textPrimary }}>{e.company}</span>
              <span style={{ fontSize: 12, color: tokens.textMuted }}>{e.subtype}</span>
              <StatusBadge status={e.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
