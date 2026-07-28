import type { ReactNode } from "react";
import { tokens } from "../theme";

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
        gap: 6,
      }}
    >
      {children}
    </div>
  );
}

export function EmptyState({ message, hint, icon = "📭" }: { message: string; hint?: string; icon?: string }) {
  return (
    <Centered>
      <div style={{ fontSize: 26 }} aria-hidden>
        {icon}
      </div>
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
        }}
        aria-hidden
      >
        ⚠️
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: tokens.errorRed }}>{message}</div>
      <div style={{ fontSize: 12.5, color: tokens.textHint }}>Please try again in a moment.</div>
    </Centered>
  );
}
