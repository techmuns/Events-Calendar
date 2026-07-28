import type { EventsResult } from "../types";
import { tokens } from "../theme";

function Row({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{ padding: "10px 16px", borderBottom: `1px solid ${tokens.border}` }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: tokens.textPrimary }}>{title}</div>
      <div style={{ fontSize: 12, color: tokens.textHint, marginTop: 2 }}>{detail}</div>
    </div>
  );
}

export function SourcesWidget({ result }: { result: EventsResult }) {
  const when = new Date(result.generatedAt).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <div>
      <div
        style={{
          margin: 16,
          marginBottom: 8,
          padding: "8px 12px",
          borderRadius: 10,
          fontSize: 12.5,
          fontWeight: 600,
          background: result.live ? "#f0fdf4" : "#fffbeb",
          color: result.live ? "#16a34a" : "#d97706",
          border: `1px solid ${result.live ? "#bbf7d0" : "#fde68a"}`,
        }}
      >
        {result.live
          ? "Live feed — exchange filings"
          : "Sample dataset — live NSE/BSE feed wires in next"}
      </div>
      <Row title={result.source} detail={`Generated ${when}`} />
      <Row
        title="NSE — Board Meetings & Announcements"
        detail="Results dates and concall intimations (SEBI LODR filings)"
      />
      <Row
        title="BSE — Corporate Announcements & Actions"
        detail="Demerger schemes, record dates and corporate actions"
      />
      <div style={{ padding: "10px 16px", fontSize: 11.5, color: tokens.textHint }}>
        Dates are shown as Confirmed / Tentative / Revised, mirroring how companies
        file and revise them.
      </div>
    </div>
  );
}
