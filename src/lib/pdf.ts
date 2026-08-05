// Generate and download a clean one-page PDF summary for one event — a proper
// document (not an .ics import), built by hand so there are no dependencies.

import type { CorporateEvent } from "../types";
import { companyAccent, eventTypeMeta } from "../theme";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type RGB = [number, number, number];
const WHITE: RGB = [1, 1, 1];
const DARK: RGB = [0.06, 0.09, 0.16];
const GREY: RGB = [0.4, 0.45, 0.52];
const FAINT: RGB = [0.88, 0.9, 0.94];

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS[dt.getDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// PDF text strings: keep to Latin-1 and escape the special characters.
function esc(s: string): string {
  return (s ?? "")
    .split("")
    .map((c) => (c.charCodeAt(0) > 255 ? "?" : c))
    .join("")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ");
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 3) + "..." : s;
}

const f3 = (n: number) => n.toFixed(3);
const f2 = (n: number) => n.toFixed(2);

function txt(x: number, y: number, size: number, font: string, [r, g, b]: RGB, str: string): string {
  return `BT /${font} ${size} Tf ${f3(r)} ${f3(g)} ${f3(b)} rg 1 0 0 1 ${f2(x)} ${f2(y)} Tm (${esc(str)}) Tj ET`;
}

function rect(x: number, y: number, w: number, h: number, [r, g, b]: RGB): string {
  return `${f3(r)} ${f3(g)} ${f3(b)} rg ${f2(x)} ${f2(y)} ${f2(w)} ${f2(h)} re f`;
}

function hline(x1: number, x2: number, y: number, [r, g, b]: RGB): string {
  return `${f3(r)} ${f3(g)} ${f3(b)} RG 1 w ${f2(x1)} ${f2(y)} m ${f2(x2)} ${f2(y)} l S`;
}

function contentStream(e: CorporateEvent): string {
  const W = 595.28;
  const H = 841.89;
  const M = 56;
  const accent = hexToRgb(companyAccent(e.ticker || e.company));
  const cmds: string[] = [];

  // Accent header band
  cmds.push(rect(0, H - 108, W, 108, accent));
  cmds.push(txt(M, H - 40, 10, "F2", WHITE, "MUNSHOT  ·  EVENTS CALENDAR".replace("·", "-")));
  cmds.push(txt(M, H - 70, 21, "F2", WHITE, clip(e.company, 42)));
  const sub = [e.ticker, e.sector].filter(Boolean).join("   -   ");
  if (sub) cmds.push(txt(M, H - 92, 11, "F1", WHITE, sub));

  // Event headline block
  let y = H - 150;
  cmds.push(txt(M, y, 10, "F2", GREY, "UPCOMING EVENT"));
  y -= 22;
  cmds.push(txt(M, y, 15, "F2", DARK, clip(`${e.subtype}  -  ${longDate(e.date)}`, 60)));
  y -= 20;
  cmds.push(txt(M, y, 11, "F1", GREY, `${eventTypeMeta[e.eventType].label}  -  ${e.exchange}${e.time ? `  -  ${e.time}` : ""}`));
  y -= 22;
  cmds.push(hline(M, W - M, y, FAINT));

  // Event details table
  y -= 30;
  cmds.push(txt(M, y, 10, "F2", GREY, "EVENT DETAILS"));
  y -= 24;
  const rows: [string, string][] = [["Date", longDate(e.date)]];
  if (e.time) rows.push(["Time", e.time]);
  rows.push(["Exchange", e.exchange]);
  if (e.sector) rows.push(["Sector", e.sector]);
  if (e.indices?.length) rows.push(["Index", e.indices.join(", ")]);
  for (const [label, value] of rows) {
    cmds.push(txt(M, y, 11, "F1", GREY, label));
    cmds.push(txt(M + 130, y, 11, "F2", DARK, clip(value, 48)));
    y -= 12;
    cmds.push(hline(M, W - M, y, FAINT));
    y -= 18;
  }

  if (e.sourceUrl) {
    y -= 8;
    cmds.push(txt(M, y, 10, "F2", GREY, "EXCHANGE FILING"));
    y -= 18;
    cmds.push(txt(M, y, 10, "F1", accent, clip(e.sourceUrl, 78)));
  }

  // Footer
  const gen = new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  cmds.push(hline(M, W - M, 66, FAINT));
  cmds.push(txt(M, 50, 9, "F1", GREY, `Generated ${gen}  -  Data aggregated from BSE, NSE and Screener`));

  return cmds.join("\n");
}

function buildPdf(e: CorporateEvent): Uint8Array {
  const content = contentStream(e);
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => {
    pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const bytes = new Uint8Array(new ArrayBuffer(pdf.length));
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

export function downloadEventPdf(e: CorporateEvent): void {
  const bytes = buildPdf(e);
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(e.ticker || "event").replace(/[^A-Za-z0-9_-]/g, "")}-${e.date}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
