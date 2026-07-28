import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { CorporateEvent } from "../types";
import { tokens } from "../theme";
import { EventTypeChip, StatusBadge } from "./badges";
import { ExternalLinkIcon } from "./icons";
import { formatDate } from "../lib/dates";
import { EmptyState } from "./states";

type SortKey = "date" | "company" | "eventType" | "status" | "exchange";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "company", label: "Company" },
  { key: "eventType", label: "Type" },
  { key: "status", label: "Status" },
  { key: "exchange", label: "Exch." },
];

export function DetailTable({ events }: { events: CorporateEvent[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: 1 });

  const sorted = useMemo(() => {
    const copy = [...events];
    copy.sort((a, b) => {
      const av = String(a[sort.key]);
      const bv = String(b[sort.key]);
      return av.localeCompare(bv) * sort.dir;
    });
    return copy;
  }, [events, sort]);

  if (events.length === 0) {
    return <EmptyState message="Nothing to list" hint="Adjust the filters to see events here." />;
  }

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const th: CSSProperties = {
    position: "sticky",
    top: 0,
    background: tokens.cardHeaderBg,
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    color: tokens.textHint,
    padding: "8px 12px",
    borderBottom: `1px solid ${tokens.border}`,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
  const td: CSSProperties = {
    padding: "9px 12px",
    borderBottom: `1px solid ${tokens.border}`,
    fontSize: 13,
    color: tokens.textSecondary,
    verticalAlign: "middle",
  };

  return (
    <div style={{ maxHeight: 420, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: tokens.font }}>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} style={th} onClick={() => toggle(c.key)}>
                {c.label}
                {sort.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
              </th>
            ))}
            <th style={th}>Source</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => (
            <tr key={e.id}>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{formatDate(e.date)}</td>
              <td style={td}>
                <div style={{ fontWeight: 600, color: tokens.textPrimary }}>{e.company}</div>
                <div style={{ fontSize: 11.5, color: tokens.textHint }}>
                  {e.ticker} · {e.subtype}
                </div>
              </td>
              <td style={td}>
                <EventTypeChip type={e.eventType} />
              </td>
              <td style={td}>
                <StatusBadge status={e.status} />
              </td>
              <td style={{ ...td, color: tokens.textMuted }}>{e.exchange}</td>
              <td style={td}>
                {e.sourceUrl ? (
                  <a
                    href={e.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, color: tokens.primary, textDecoration: "none" }}
                  >
                    Filing <ExternalLinkIcon size={12} />
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
