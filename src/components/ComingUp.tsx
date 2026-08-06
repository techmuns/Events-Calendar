import type { CSSProperties } from "react";
import type { ConcallItem, CorporateEvent } from "../types";
import { companyAccent, eventTypeMeta, tokens } from "../theme";
import { BellIcon, MicIcon, StarIcon } from "./icons";
import { diffDays, parseISO, todayStart } from "../lib/dates";
import { usePersistedOpen } from "../hooks/usePersistedOpen";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}

type Tone = "today" | "soon" | "later";
// How near is this event? Drives the reminder pill's wording and urgency colour.
function proximity(iso: string): { label: string; tone: Tone } {
  const d = diffDays(todayStart(), parseISO(iso));
  if (d <= 0) return { label: "Today", tone: "today" };
  if (d === 1) return { label: "Tomorrow", tone: "soon" };
  if (d <= 3) return { label: `In ${d} days`, tone: "soon" };
  return { label: `In ${d} days`, tone: "later" };
}
const TONE: Record<Tone, { color: string; bg: string; border: string }> = {
  today: { color: "#dc2626", bg: "color-mix(in srgb, #dc2626 13%, transparent)", border: "color-mix(in srgb, #dc2626 32%, transparent)" },
  soon: { color: "#b45309", bg: "color-mix(in srgb, #f59e0b 15%, transparent)", border: "color-mix(in srgb, #f59e0b 36%, transparent)" },
  later: { color: tokens.primaryText, bg: tokens.primaryLight, border: tokens.primaryBorder },
};

// On-open reminder strip, collapsible so it never buries the agenda: the header
// (with the next event) is always visible; the soonest upcoming events and the
// just-announced earnings calls expand on click, like the density panel.
export function ComingUp({
  events,
  watchlistCount,
  concalls,
  isStarred,
  onOpenEvent,
  onOpenConcall,
}: {
  events: CorporateEvent[];
  watchlistCount: number;
  concalls: ConcallItem[];
  isStarred: (ticker: string) => boolean;
  onOpenEvent: (e: CorporateEvent) => void;
  onOpenConcall: (c: ConcallItem) => void;
}) {
  const [open, setOpen] = usePersistedOpen("ec_comingup_open", false);
  const reminders = events.slice(0, 12);
  const calls = concalls.slice(0, 12);
  const hasContent = reminders.length > 0 || calls.length > 0;

  // Watchlist has nothing coming up — show a quiet one-line hint instead of the
  // full panel, so the feature stays discoverable without taking space.
  if (!hasContent) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: tokens.cardBg,
          border: `1px solid ${tokens.border}`,
          borderRadius: 16,
          boxShadow: tokens.shadowCard,
          padding: "11px 14px",
          flexShrink: 0,
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
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: tokens.textPrimary, letterSpacing: "-0.01em" }}>Coming up</div>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 1 }}>
            {watchlistCount === 0
              ? "Tap the ☆ on any company to watchlist it and get its events here."
              : "No upcoming events for your watchlisted companies right now."}
          </div>
        </div>
      </div>
    );
  }

  const next = reminders[0];
  const nextProx = next ? proximity(next.date) : null;

  const toggleBtn: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 12px",
    borderRadius: 9,
    border: `1px solid ${open ? tokens.border : tokens.primaryBorder}`,
    background: open ? tokens.surface : tokens.primaryLight,
    color: open ? tokens.textSecondary : tokens.primaryText,
    whiteSpace: "nowrap",
    flexShrink: 0,
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
      {/* Always-visible header — click to expand/collapse */}
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={open ? "Hide upcoming reminders" : "Show upcoming reminders"}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "11px 14px",
          border: "none",
          borderBottom: open ? `1px solid ${tokens.border}` : "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
          font: "inherit",
          color: "inherit",
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
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: tokens.textPrimary, letterSpacing: "-0.01em" }}>Coming up</div>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {next && nextProx ? (
              <>
                Next: <span style={{ color: tokens.textSecondary, fontWeight: 600 }}>{next.company}</span>
                <span style={{ color: nextProx.tone === "today" ? "#dc2626" : nextProx.tone === "soon" ? "#b45309" : tokens.textSecondary, fontWeight: 600 }}>
                  {" "}
                  · {nextProx.label.toLowerCase()}
                </span>
              </>
            ) : (
              "Earnings calls from your watchlist"
            )}
            <span style={{ color: tokens.textHint }}> · from your watchlist</span>
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <span style={toggleBtn}>{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <>
          {/* Nearest upcoming events — tap to open the event (with full details) */}
          {reminders.length > 0 && (
            <div style={{ display: "flex", gap: 8, padding: "10px 14px", overflowX: "auto" }}>
              {reminders.map((e) => {
                const accent = companyAccent(e.ticker || e.company);
                const meta = eventTypeMeta[e.eventType];
                const prox = proximity(e.date);
                const tone = TONE[prox.tone];
                const star = isStarred(e.ticker);
                return (
                  <button
                    key={e.id}
                    onClick={() => onOpenEvent(e)}
                    className="card-hover"
                    title={`${e.company} — ${prox.label.toLowerCase()}`}
                    style={{
                      cursor: "pointer",
                      flexShrink: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                      textAlign: "left",
                      padding: "9px 12px",
                      borderRadius: 11,
                      border: `1px solid ${tokens.border}`,
                      borderLeft: `3px solid ${accent}`,
                      background: tokens.surface,
                      boxShadow: tokens.shadowCard,
                      minWidth: 158,
                      maxWidth: 220,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: tone.color,
                          background: tone.bg,
                          border: `1px solid ${tone.border}`,
                          borderRadius: 6,
                          padding: "1px 7px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {prox.label}
                      </span>
                      {star && (
                        <span style={{ color: "#f59e0b", display: "inline-flex", flexShrink: 0 }}>
                          <StarIcon size={11} filled />
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: tokens.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {e.company}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: meta.hex, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: tokens.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.subtype}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Handy earnings-call intimations */}
          {calls.length > 0 && (
            <div style={{ borderTop: `1px solid ${tokens.border}`, padding: "9px 14px 11px", background: "var(--detail-header-bg)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ color: "#7c3aed", display: "inline-flex" }}>
                  <MicIcon size={13} />
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: tokens.textHint }}>
                  Earnings calls just announced
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
                {calls.map((c) => {
                  const accent = companyAccent(c.ticker || c.company);
                  return (
                    <button
                      key={c.id}
                      onClick={() => onOpenConcall(c)}
                      className="card-hover"
                      title={`${c.company} — open earnings calls`}
                      style={{
                        cursor: "pointer",
                        flexShrink: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        textAlign: "left",
                        padding: "7px 11px",
                        borderRadius: 10,
                        border: `1px solid ${tokens.border}`,
                        borderLeft: `3px solid ${accent}`,
                        background: tokens.surface,
                        maxWidth: 220,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: tokens.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.company}
                      </span>
                      <span style={{ fontSize: 10.5, color: tokens.textMuted, whiteSpace: "nowrap" }}>
                        {c.ticker} · filed {shortDate(c.filedDate)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
