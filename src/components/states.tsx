import type { ReactNode } from "react";
import { tokens } from "../theme";
import { AlertIcon, InboxIcon } from "./icons";

export function ShimmerRows({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="shimmer" style={{ width: 44, height: 44, borderRadius: 10 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="shimmer" style={{ width: "45%", height: 12 }} />
            <div className="shimmer" style={{ width: "70%", height: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Centered({ children, minHeight = 180 }: { children: ReactNode; minHeight?: number }) {
  return (
    <div
      style={{
        minHeight,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 24,
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <Centered>
      <span style={{ color: tokens.textHint }}>
        <InboxIcon size={28} />
      </span>
      <div style={{ fontSize: 14, fontWeight: 600, color: tokens.textSecondary }}>{message}</div>
      {hint && <div style={{ fontSize: 12.5, color: tokens.textHint, maxWidth: 320 }}>{hint}</div>}
    </Centered>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Centered>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: tokens.errorBg,
          color: tokens.errorRed,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AlertIcon size={20} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: tokens.errorRed }}>{message}</div>
      <div style={{ fontSize: 12.5, color: tokens.textHint }}>Please try again in a moment.</div>
    </Centered>
  );
}
