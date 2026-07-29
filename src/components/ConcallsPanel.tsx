import type { ConcallItem } from "../types";
import { tokens } from "../theme";
import { ExternalLinkIcon } from "./icons";
import { ExchangePill } from "./badges";
import { formatDate } from "../lib/dates";
import { EmptyState } from "./states";

export function ConcallsPanel({ concalls }: { concalls: ConcallItem[] }) {
  if (concalls.length === 0) {
    return (
      <EmptyState
        message="No recent concall intimations"
        hint="Newly filed analyst / investor calls will appear here."
      />
    );
  }
  return (
    <div>
      <div
        style={{
          padding: "8px 16px",
          fontSize: 11.5,
          color: tokens.textHint,
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        The exact call date &amp; time is inside each filing — open it to see the details.
      </div>
      {concalls.map((c) => (
        <div
          key={c.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            borderBottom: `1px solid ${tokens.border}`,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: tokens.textPrimary }}>{c.company}</span>
              <span style={{ fontSize: 11.5, color: tokens.textHint }}>{c.ticker}</span>
            </div>
            <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>{c.summary}</div>
          </div>
          <span style={{ fontSize: 11.5, color: tokens.textHint, whiteSpace: "nowrap" }}>
            Filed {formatDate(c.filedDate)}
          </span>
          <ExchangePill exchange={c.exchange} />
          {c.sourceUrl && (
            <a
              href={c.sourceUrl}
              target="_blank"
              rel="noreferrer"
              title="Open filing"
              style={{ display: "inline-flex", color: tokens.primary }}
            >
              <ExternalLinkIcon size={14} />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
