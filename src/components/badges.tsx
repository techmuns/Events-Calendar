import type { CSSProperties } from "react";
import type { EventStatus, EventType } from "../types";
import { eventTypeMeta, statusMeta, tokens } from "../theme";

const chipBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 11,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 6,
  whiteSpace: "nowrap",
};

export function EventTypeChip({ type }: { type: EventType }) {
  const m = eventTypeMeta[type];
  return (
    <span style={{ ...chipBase, background: m.bg, color: m.text, border: `1px solid ${m.border}` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.text }} />
      {m.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: EventStatus }) {
  const m = statusMeta[status];
  return (
    <span
      style={{
        ...chipBase,
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        background: m.bg,
        color: m.text,
        border: `1px solid ${m.border}`,
      }}
    >
      {m.label}
    </span>
  );
}

export function ExchangePill({ exchange }: { exchange: string }) {
  return (
    <span
      style={{
        ...chipBase,
        fontSize: 10,
        fontWeight: 600,
        color: tokens.textMuted,
        background: tokens.surface2,
        border: `1px solid ${tokens.borderSolid}`,
      }}
    >
      {exchange}
    </span>
  );
}
