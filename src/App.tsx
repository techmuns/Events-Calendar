/**
 * Events Calendar — application shell (scaffold).
 *
 * This is the minimal Layer 3 shell described in docs/EVENTS_CALENDAR_SPEC.md.
 * It renders the mandated Munshot 3-zone iframe layout with a placeholder empty
 * state. Widgets (filters, KPIs, agenda/month calendar, detail table, sources)
 * are wired up in later steps once the events API (Layer 2) is available.
 */

const shell: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  overflow: "hidden",
  background: "linear-gradient(to bottom, rgba(249, 250, 251, 0.8), #ffffff)",
  fontFamily: "system-ui, -apple-system, sans-serif",
  color: "#111827",
};

const header: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 24px",
  height: 48,
  background: "rgba(255, 255, 255, 0.95)",
  backdropFilter: "blur(8px)",
  borderBottom: "1px solid #e5e7eb",
  flexShrink: 0,
};

const main: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "24px 32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const emptyCard: React.CSSProperties = {
  maxWidth: 460,
  textAlign: "center",
  background: "rgba(255, 255, 255, 0.9)",
  border: "1px solid rgba(229, 231, 235, 0.8)",
  borderRadius: 16,
  padding: "40px 32px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
};

export default function App() {
  return (
    <div style={shell}>
      <header style={header}>
        <h1 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>
          Events Calendar
        </h1>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            padding: "2px 8px",
            borderRadius: 6,
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#d97706",
          }}
        >
          India · NSE/BSE
        </span>
      </header>

      <main id="dashboard-main" data-dashboard-capture-root="true" style={main}>
        <div style={emptyCard}>
          <div
            style={{
              width: 44,
              height: 44,
              margin: "0 auto 16px",
              borderRadius: 12,
              background: "#eef2ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
            aria-hidden
          >
            📅
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
            Events Calendar — coming together
          </h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#6b7280" }}>
            Upcoming earnings, concalls, and demergers for Indian listed companies.
            This is the app scaffold; the calendar widgets are wired up once the
            events API is in place. See{" "}
            <code style={{ fontSize: 13 }}>docs/EVENTS_CALENDAR_SPEC.md</code>.
          </p>
        </div>
      </main>
    </div>
  );
}
