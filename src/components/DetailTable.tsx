import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { CorporateEvent, FilingCategory } from "../types";
import { filingCategoryMeta, tokens } from "../theme";
import { FileTextIcon, MicIcon, PresentationIcon, UsersIcon } from "./icons";
import { formatDate } from "../lib/dates";
import { EmptyState } from "./states";

type SortKey = "date" | "company";
type IconCmp = (p: { size?: number }) => JSX.Element;

const SORTABLE: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "company", label: "Company" },
];
// The materials columns — one click opens the company on that tab.
const MATERIALS: { key: FilingCategory; label: string; Icon: IconCmp }[] = [
  { key: "PRESS", label: "Press Release", Icon: FileTextIcon },
  { key: "MEET", label: "Investor Meet", Icon: UsersIcon },
  { key: "PRESENTATION", label: "Presentations", Icon: PresentationIcon },
  { key: "CONCALL", label: "Concalls", Icon: MicIcon },
];

export function DetailTable({
  events,
  onSelect,
}: {
  events: CorporateEvent[];
  onSelect: (e: CorporateEvent, tab?: FilingCategory) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: 1 });

  const sorted = useMemo(() => {
    const copy = [...events];
    copy.sort((a, b) => String(a[sort.key]).localeCompare(String(b[sort.key])) * sort.dir);
    return copy;
  }, [events, sort]);

  if (events.length === 0) {
    return <EmptyState message="Nothing to list" hint="Adjust the filters to see events here." />;
  }

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const th: CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 1,
    background: tokens.cardHeaderBg,
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    color: tokens.textHint,
    padding: "9px 14px",
    borderBottom: `1px solid ${tokens.border}`,
    whiteSpace: "nowrap",
  };
  const thCenter: CSSProperties = { ...th, textAlign: "center", cursor: "default" };
  const td: CSSProperties = {
    padding: "10px 14px",
    borderBottom: `1px solid ${tokens.border}`,
    fontSize: 13,
    color: tokens.textSecondary,
    verticalAlign: "middle",
  };

  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: tokens.font }}>
        <thead>
          <tr>
            {SORTABLE.map((c) => (
              <th key={c.key} style={{ ...th, cursor: "pointer" }} onClick={() => toggle(c.key)}>
                {c.label}
                {sort.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
              </th>
            ))}
            {MATERIALS.map((m) => (
              <th key={m.key} style={thCenter}>
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => (
            <tr key={e.id} className="row-hover" onClick={() => onSelect(e)} style={{ cursor: "pointer" }}>
              <td style={{ ...td, whiteSpace: "nowrap", color: tokens.textMuted }}>{formatDate(e.date)}</td>
              <td style={td}>
                <div style={{ fontWeight: 700, color: tokens.textPrimary }}>{e.company}</div>
                <div style={{ fontSize: 11.5, color: tokens.textHint, marginTop: 1 }}>
                  {e.ticker} · {e.subtype}
                </div>
              </td>
              {MATERIALS.map((m) => {
                const meta = filingCategoryMeta[m.key];
                return (
                  <td key={m.key} style={{ ...td, textAlign: "center" }}>
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSelect(e, m.key);
                      }}
                      title={`Open ${e.company} — ${m.label}`}
                      className="card-hover"
                      style={{
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        color: meta.hex,
                        background: meta.bg,
                        border: `1px solid ${meta.border}`,
                      }}
                    >
                      <m.Icon size={15} />
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
