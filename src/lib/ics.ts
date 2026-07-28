// Generate and download an .ics calendar file for one event, so users can drop
// it into Google/Outlook/Apple Calendar. Events are all-day (dates are what the
// exchange publishes); no timezone math needed.

import type { CorporateEvent } from "../types";
import { eventTypeMeta } from "../theme";

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function eventToIcs(e: CorporateEvent): string {
  const start = e.date.replace(/-/g, "");
  const endDate = new Date(e.date + "T00:00:00");
  endDate.setDate(endDate.getDate() + 1);
  const end = endDate.toISOString().slice(0, 10).replace(/-/g, "");
  const summary = `${e.company} — ${eventTypeMeta[e.eventType].label}: ${e.subtype}`;
  const desc = `${e.eventType} (${e.status}) · ${e.exchange}${e.time ? ` · ${e.time}` : ""}${
    e.sourceUrl ? `\\n${e.sourceUrl}` : ""
  }`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Munshot//Events Calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.id}@munshot-events-calendar`,
    `DTSTAMP:${stamp()}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(desc)}`,
    ...(e.sourceUrl ? [`URL:${e.sourceUrl}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(e: CorporateEvent): void {
  const blob = new Blob([eventToIcs(e)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${e.ticker}-${e.eventType.toLowerCase()}-${e.date}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
