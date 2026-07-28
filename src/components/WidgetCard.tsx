import type { CSSProperties, ReactNode } from "react";
import { tokens } from "../theme";

export function WidgetCard({
  title,
  subtitle,
  right,
  children,
  span,
  bodyStyle,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  span?: boolean;
  bodyStyle?: CSSProperties;
}) {
  const card: CSSProperties = {
    background: tokens.cardBg,
    border: `1px solid ${tokens.border}`,
    borderRadius: 16,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    backdropFilter: "blur(8px)",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
    gridColumn: span ? "1 / -1" : undefined,
  };
  return (
    <div className="widget-card" style={card}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: `1px solid ${tokens.border}`,
          background: tokens.cardHeaderBg,
          flexShrink: 0,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: tokens.textPrimary }}>
            {title}
          </h3>
          {subtitle && (
            <p style={{ margin: "2px 0 0", fontSize: 11, color: tokens.textHint, lineHeight: 1.3 }}>
              {subtitle}
            </p>
          )}
        </div>
        {right}
      </div>
      <div style={{ flex: 1, position: "relative", background: tokens.cardBodyBg, ...bodyStyle }}>
        {children}
      </div>
    </div>
  );
}
