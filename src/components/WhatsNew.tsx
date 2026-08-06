import type { CSSProperties } from "react";
import type { ConcallItem } from "../types";
import { companyAccent, tokens } from "../theme";
import { BellIcon, MicIcon, XIcon } from "./icons";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}

// On-open "what's new" strip: newly announced / rescheduled events since the
// user's last visit, plus a handy row of just-announced earnings calls so they
// don't have to dig into each company.
export function WhatsNew({
  newCount,
  revCount,
  concalls,
  onlyNew,
  onToggleNew,
  onOpenCompany,
  onDismiss,
}: {
  newCount: number;
  revCount: number;
  concalls: ConcallItem[];
  onlyNew: boolean;
  onToggleNew: () => void;
  onOpenCompany: (c: ConcallItem) => void;
  onDismiss: () => void;
}) {
  const hasNews = newCount > 0 || revCount > 0;
  const calls = concalls.slice(0, 12);
  if (!hasNews && calls.length === 0) return null;

  const pill: CSSProperties = {
    cursor: "pointer",
    flexShrink: 0,
    fontSize: 12,
    fontWeight: 600,
    padding: "5px 12px",
    borderRadius: 99,
    whiteSpace: "nowrap",
    border: `1px solid ${onlyNew ? tokens.primary : tokens.primaryBorder}`,
    background: onlyNew ? tokens.primary : tokens.primaryLight,
    color: onlyNew ? "#fff" : tokens.primaryText,
  };

  return (
    <div
      style={{
        background: tokens.cardBg,
        border: `1px solid ${tokens.border}`,
        borderRadius: 16,
        boxShadow: tokens.shadowCard,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "11px 14px",
          borderBottom: calls.length ? `1px solid ${tokens.border}` : "none",
          background: "var(--detail-header-bg)",
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: tokens.primary,
            background: tokens.primaryLight,
            border: `1px solid ${tokens.primaryBorder}`,
            flexShrink: 0,
          }}
        >
          <BellIcon size={17} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: tokens.textPrimary, letterSpacing: "-0.01em" }}>
            {hasNews ? "New since your last visit" : "Earnings calls just announced"}
          </div>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {hasNews && (
              <span style={{ color: "#059669", fontWeight: 600 }}>
                {newCount} newly announced{revCount ? ` · ${revCount} rescheduled` : ""}
              </span>
            )}
            {hasNews && calls.length ? <span style={{ color: tokens.textHint }}> · </span> : null}
            {calls.length ? (
              <span>
                <span style={{ color: "#7c3aed", fontWeight: 600 }}>{concalls.length} earnings call{concalls.length === 1 ? "" : "s"}</span> just announced — tap a company
              </span>
            ) : null}
          </div>
        </div>
        {newCount > 0 && (
          <button onClick={onToggleNew} style={pill} title="Filter the list to newly announced events">
            {onlyNew ? "Show all" : "Show new only"}
          </button>
        )}
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          title="Dismiss"
          style={{ cursor: "pointer", border: "none", background: "transparent", color: tokens.textMuted, display: "inline-flex", padding: 4, flexShrink: 0 }}
        >
          <XIcon size={16} />
        </button>
      </div>

      {calls.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: "10px 14px", overflowX: "auto" }}>
          {calls.map((c) => {
            const accent = companyAccent(c.ticker || c.company);
            return (
              <button
                key={c.id}
                onClick={() => onOpenCompany(c)}
                className="card-hover"
                title={`${c.company} — open earnings calls`}
                style={{
                  cursor: "pointer",
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  textAlign: "left",
                  padding: "8px 12px",
                  borderRadius: 11,
                  border: `1px solid ${tokens.border}`,
                  borderLeft: `3px solid ${accent}`,
                  background: tokens.surface,
                  boxShadow: tokens.shadowCard,
                  maxWidth: 230,
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ color: accent, display: "inline-flex", flexShrink: 0 }}>
                    <MicIcon size={13} />
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: tokens.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.company}
                  </span>
                </span>
                <span style={{ fontSize: 11, color: tokens.textMuted, whiteSpace: "nowrap" }}>
                  {c.ticker} · filed {shortDate(c.filedDate)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
