import { useEffect } from "react";
import type { CorporateEvent, FilingCategory } from "../types";
import { tokens } from "../theme";
import { EventDetail } from "./EventDetail";
import { XIcon } from "./icons";

// Centred company-details modal with a blurred backdrop. Clicking a row opens
// the full overview here (the main focus) instead of a cramped side panel;
// everything behind stays in place, just blurred and dimmed.
export function EventModal({
  event,
  allEvents,
  onSelect,
  isStarred,
  onToggleStar,
  onClose,
  initialTab,
}: {
  event: CorporateEvent;
  allEvents: CorporateEvent[];
  onSelect: (e: CorporateEvent) => void;
  isStarred: (ticker: string) => boolean;
  onToggleStar: (ticker: string) => void;
  onClose: () => void;
  initialTab?: FilingCategory | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
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
        aria-label={`${event.company} details`}
        style={{
          position: "relative",
          width: "min(680px, 100%)",
          height: "min(86vh, 760px)",
          background: tokens.cardBg,
          border: `1px solid ${tokens.border}`,
          borderRadius: 18,
          boxShadow: tokens.shadowPop,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          title="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 3,
            width: 30,
            height: 30,
            borderRadius: 8,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            border: `1px solid ${tokens.border}`,
            background: tokens.surface,
            color: tokens.textMuted,
            boxShadow: tokens.shadowCard,
          }}
        >
          <XIcon size={16} />
        </button>
        <EventDetail
          event={event}
          allEvents={allEvents}
          onSelect={onSelect}
          isStarred={isStarred}
          onToggleStar={onToggleStar}
          initialTab={initialTab}
        />
      </div>
    </div>
  );
}
