import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { CorporateEvent, EventType } from "../types";
import { eventTypeMeta, tokens } from "../theme";
import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, XIcon } from "./icons";
import { WEEKDAY_LABELS, buildMonthMatrix, parseISO, toISO, todayStart } from "../lib/dates";

const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function longDate(iso: string): string {
  const d = parseISO(iso);
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}
const TYPE_ORDER: EventType[] = ["EARNINGS", "CONCALL", "DEMERGER"];

// Group a day's events by type, most-common type first, for a tidy segregated list.
function groupByType(events: CorporateEvent[]): (readonly [EventType, CorporateEvent[]])[] {
  const g = new Map<EventType, CorporateEvent[]>();
  for (const e of events) (g.get(e.eventType) ?? g.set(e.eventType, []).get(e.eventType)!).push(e);
  return TYPE_ORDER.filter((t) => g.has(t)).map((t) => [t, g.get(t)!] as const);
}

// Popup that lists every event on a clicked day, segregated by type.
function DayEventsModal({
  iso,
  events,
  onSelect,
  onClose,
}: {
  iso: string;
  events: CorporateEvent[];
  onSelect: (e: CorporateEvent) => void;
  onClose: () => void;
}) {
  const groups = groupByType(events);
  return (
    <div
      onClick={onClose}
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(8, 12, 22, 0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        animation: "fadeIn 0.16s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          width: "min(560px, 100%)",
          maxHeight: "min(82vh, 720px)",
          background: tokens.cardBg,
          border: `1px solid ${tokens.border}`,
          borderRadius: 18,
          boxShadow: tokens.shadowPop,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 18px", borderBottom: `1px solid ${tokens.border}`, background: "var(--detail-header-bg)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: tokens.textPrimary, letterSpacing: "-0.01em" }}>{longDate(iso)}</div>
            <div style={{ fontSize: 12.5, color: tokens.textMuted, marginTop: 1 }}>
              {events.length} event{events.length === 1 ? "" : "s"} scheduled
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ width: 30, height: 30, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: `1px solid ${tokens.border}`, background: tokens.surface, color: tokens.textMuted, flexShrink: 0 }}
          >
            <XIcon size={16} />
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map(([type, list]) => {
            const m = eventTypeMeta[type];
            return (
              <div key={type}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.hex }} />
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: tokens.textMuted }}>{m.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: tokens.textHint }}>{list.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {list.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => onSelect(e)}
                      className="card-hover"
                      style={{
                        cursor: "pointer",
                        border: `1px solid ${tokens.border}`,
                        borderLeft: `3px solid ${m.hex}`,
                        background: tokens.surface,
                        borderRadius: 10,
                        padding: "9px 12px",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: tokens.textPrimary, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.company}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: tokens.textHint, flexShrink: 0 }}>{e.ticker}</span>
                      <span style={{ fontSize: 12, color: tokens.textMuted, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.subtype}</span>
                      {e.sourceUrl && (
                        <a
                          href={e.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(ev) => ev.stopPropagation()}
                          title={`Open ${e.exchange} filing`}
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: tokens.textSecondary, textDecoration: "none", flexShrink: 0 }}
                        >
                          {e.exchange} <ExternalLinkIcon size={12} />
                        </a>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function MonthView({
  events,
  onSelect,
}: {
  events: CorporateEvent[];
  onSelect: (e: CorporateEvent) => void;
}) {
  const today = todayStart();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState<string>(toISO(today));
  const [dayModal, setDayModal] = useState<string | null>(null);

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

  const shift = (delta: number) => {
    const m = cursor.month + delta;
    setCursor({ year: cursor.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 });
  };

  const navBtn: CSSProperties = {
    cursor: "pointer",
    border: `1px solid ${tokens.border}`,
    background: tokens.surface,
    borderRadius: 8,
    width: 30,
    height: 30,
    color: tokens.textSecondary,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: tokens.textPrimary, letterSpacing: "-0.01em" }}>
          {MONTHS_LONG[cursor.month]} {cursor.year}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={navBtn} onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronLeftIcon size={16} />
          </button>
          <button
            style={{ ...navBtn, width: "auto", padding: "0 12px", fontSize: 12, fontWeight: 600 }}
            onClick={() => {
              setCursor({ year: today.getFullYear(), month: today.getMonth() });
              setSelected(todayISO);
            }}
          >
            Today
          </button>
          <button style={navBtn} onClick={() => shift(1)} aria-label="Next month">
            <ChevronRightIcon size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5, flexShrink: 0 }}>
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: tokens.textHint, paddingBottom: 4 }}>
            {w}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: "repeat(6, 1fr)", gap: 5, flex: 1, minHeight: 320 }}>
        {matrix.flat().map((d) => {
          const iso = toISO(d);
          const inMonth = d.getMonth() === cursor.month;
          const dayEvents = byDate.get(iso) ?? [];
          const isToday = iso === todayISO;
          const isSelected = iso === selected;
          const dominant = TYPE_ORDER.find((t) => dayEvents.some((e) => e.eventType === t));
          const meta = dominant ? eventTypeMeta[dominant] : null;
          return (
            <button
              key={iso}
              onClick={() => {
                setSelected(iso);
                if (dayEvents.length) setDayModal(iso);
              }}
              title={dayEvents.length ? `${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""} — click to view` : undefined}
              style={{
                cursor: dayEvents.length ? "pointer" : "default",
                textAlign: "left",
                minHeight: 62,
                padding: "6px 7px",
                borderRadius: 10,
                background: isSelected ? tokens.primaryLight : dayEvents.length ? tokens.surface : "transparent",
                border: `1px solid ${isSelected ? tokens.primary : dayEvents.length ? tokens.border : "transparent"}`,
                opacity: inMonth ? 1 : 0.35,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transition: "background 0.12s, border-color 0.12s",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: isToday ? 800 : 600,
                  color: isToday ? "#fff" : tokens.textSecondary,
                  background: isToday ? tokens.primary : "transparent",
                  minWidth: 21,
                  height: 21,
                  padding: "0 5px",
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  alignSelf: "flex-start",
                }}
              >
                {d.getDate()}
              </span>
              {dayEvents.length > 0 && meta && (
                <span
                  style={{
                    alignSelf: "flex-start",
                    fontSize: 11,
                    fontWeight: 800,
                    color: meta.text,
                    background: meta.bg,
                    border: `1px solid ${meta.border}`,
                    borderRadius: 7,
                    padding: "1px 7px",
                    lineHeight: 1.5,
                  }}
                >
                  {dayEvents.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {dayModal && (
        <DayEventsModal
          iso={dayModal}
          events={byDate.get(dayModal) ?? []}
          onSelect={(e) => {
            setDayModal(null);
            onSelect(e);
          }}
          onClose={() => setDayModal(null)}
        />
      )}
    </div>
  );
}
