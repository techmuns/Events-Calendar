/**
 * Cloudflare Worker for the Events Calendar.
 *
 * Serves the built SPA (static assets) and a live corporate-events API at
 * /api/corporate-calendar, sourced server-side from the exchanges' free public
 * endpoints (browsers can't call them directly — CORS):
 *   - Earnings  <- BSE Forthcoming Results (Result Calendar) + NSE board meetings
 *   - Demergers <- NSE corporate actions
 * Results are merged, deduped, filtered to upcoming, and edge-cached. If the
 * exchanges are unreachable from Cloudflare, the API returns an empty live
 * result and the frontend falls back to sample data, so nothing breaks.
 */

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}
interface Ctx {
  waitUntil: (p: Promise<unknown>) => void;
}

type EventType = "EARNINGS" | "CONCALL" | "DEMERGER";
type EventStatus = "CONFIRMED" | "TENTATIVE" | "REVISED";

interface CorporateEvent {
  id: string;
  company: string;
  ticker: string;
  isin?: string;
  eventType: EventType;
  subtype: string;
  date: string;
  time?: string;
  status: EventStatus;
  exchange: "NSE" | "BSE";
  sourceUrl?: string;
  indices: string[];
  sector: string;
}

const NSE = "https://www.nseindia.com";
const BSE_API = "https://api.bseindia.com/BseIndiaAPI/api";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const CACHE_SECONDS = 900;

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

// Compact Nifty 50 membership so the universe filter works on live data.
const NIFTY50 = new Set([
  "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK", "BAJAJ-AUTO",
  "BAJFINANCE", "BAJAJFINSV", "BEL", "BHARTIARTL", "BPCL", "CIPLA", "COALINDIA",
  "DRREDDY", "EICHERMOT", "GRASIM", "HCLTECH", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO",
  "HINDALCO", "HINDUNILVR", "ICICIBANK", "INDUSINDBK", "INFY", "ITC", "JSWSTEEL",
  "KOTAKBANK", "LT", "LTIM", "M&M", "MARUTI", "NESTLEIND", "NTPC", "ONGC",
  "POWERGRID", "RELIANCE", "SBILIFE", "SBIN", "SHRIRAMFIN", "SUNPHARMA", "TCS",
  "TATACONSUM", "TATAMOTORS", "TATASTEEL", "TECHM", "TITAN", "TRENT", "ULTRACEMCO",
  "WIPRO",
]);

// Handles "29 Jul 2026" (BSE) and "29-Jul-2026" (NSE).
function isoDate(s: string): string | null {
  const m = /(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{4})/.exec(s ?? "");
  if (!m) return null;
  const mon = MONTHS[m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()];
  if (!mon) return null;
  return `${m[3]}-${mon}-${m[1].padStart(2, "0")}`;
}

function indicesFor(ticker: string): string[] {
  return NIFTY50.has(ticker) ? ["NIFTY50", "NIFTY500"] : [];
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

// BSE Long_Name sometimes carries trailing markers like "Ltd-$".
function cleanName(s: string): string {
  return (s ?? "").replace(/-\$?\s*$/, "").trim();
}

async function nseCookie(): Promise<string> {
  try {
    const res = await fetch(`${NSE}/`, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    });
    const jar = res.headers.getSetCookie?.() ?? [];
    return jar.map((c) => c.split(";")[0]).join("; ");
  } catch {
    return "";
  }
}

async function nseJson(path: string, referer: string, cookie: string): Promise<unknown> {
  const res = await fetch(`${NSE}${path}`, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      Referer: referer,
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  if (!res.ok) throw new Error(`NSE ${path} -> ${res.status}`);
  return res.json();
}

async function bseJson(path: string): Promise<unknown> {
  const res = await fetch(`${BSE_API}${path}`, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      Origin: "https://www.bseindia.com",
      Referer: "https://www.bseindia.com/",
    },
  });
  if (!res.ok) throw new Error(`BSE ${path} -> ${res.status}`);
  return res.json();
}

// BSE Forthcoming Results (the Result Calendar) — the primary earnings source.
function parseBseForthResults(data: unknown): CorporateEvent[] {
  if (!Array.isArray(data)) return [];
  const out: CorporateEvent[] = [];
  for (const r of data as Array<Record<string, string>>) {
    const date = isoDate(r.meeting_date);
    if (!date) continue;
    const ticker = (r.short_name ?? "").trim();
    out.push({
      id: `BSE_${ticker || r.scrip_Code}_EARNINGS_${date}`,
      company: cleanName(r.Long_Name || ticker),
      ticker,
      eventType: "EARNINGS",
      subtype: "Results",
      date,
      status: "CONFIRMED",
      exchange: "BSE",
      sourceUrl: r.URL || "https://www.bseindia.com/corporates/Forth_Results",
      indices: indicesFor(ticker),
      sector: "",
    });
  }
  return out;
}

// NSE board meetings called to consider financial results.
function parseBoardMeetings(data: unknown): CorporateEvent[] {
  if (!Array.isArray(data)) return [];
  const out: CorporateEvent[] = [];
  for (const r of data as Array<Record<string, string>>) {
    const desc = (r.bm_desc ?? "") + " " + (r.bm_purpose ?? "");
    if (!/financial result/i.test(desc)) continue;
    const date = isoDate(r.bm_date);
    if (!date) continue;
    const ticker = (r.bm_symbol ?? "").trim();
    out.push({
      id: `NSE_${ticker}_EARNINGS_${date}`,
      company: titleCase(r.sm_name ?? ticker),
      ticker,
      isin: r.sm_isin || undefined,
      eventType: "EARNINGS",
      subtype: "Board Meeting — Results",
      date,
      status: "CONFIRMED",
      exchange: "NSE",
      sourceUrl: r.attachment || `${NSE}/companies-listing/corporate-filings-board-meetings`,
      indices: indicesFor(ticker),
      sector: "",
    });
  }
  return out;
}

// NSE corporate actions filtered to demerger / scheme of arrangement.
function parseCorporateActions(data: unknown): CorporateEvent[] {
  if (!Array.isArray(data)) return [];
  const out: CorporateEvent[] = [];
  for (const r of data as Array<Record<string, string>>) {
    const subject = r.subject ?? "";
    if (!/demerg|arrangement|spin-?off|scheme of/i.test(subject)) continue;
    const date = isoDate(r.recDate) ?? isoDate(r.exDate);
    if (!date) continue;
    const ticker = (r.symbol ?? "").trim();
    out.push({
      id: `NSE_${ticker}_DEMERGER_${date}`,
      company: titleCase(r.comp ?? ticker),
      ticker,
      isin: r.isin || undefined,
      eventType: "DEMERGER",
      subtype: subject.trim(),
      date,
      status: "CONFIRMED",
      exchange: "NSE",
      sourceUrl: `${NSE}/companies-listing/corporate-filings-actions`,
      indices: indicesFor(ticker),
      sector: "",
    });
  }
  return out;
}

// Dedupe across exchanges by company + type + date (keep first — BSE wins).
function normKey(e: CorporateEvent): string {
  const c = e.company.toLowerCase().replace(/ltd|limited/g, "").replace(/[^a-z0-9]/g, "");
  return `${e.eventType}_${c}_${e.date}`;
}

function dedupe(events: CorporateEvent[]): CorporateEvent[] {
  const seen = new Map<string, CorporateEvent>();
  for (const e of events) {
    const k = normKey(e);
    if (!seen.has(k)) seen.set(k, e);
  }
  return [...seen.values()];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function buildLiveResult() {
  const cookie = await nseCookie();
  const settled = await Promise.allSettled([
    bseJson("/Corpforthresults/w").then(parseBseForthResults),
    nseJson(
      "/api/corporate-board-meetings?index=equities",
      `${NSE}/companies-listing/corporate-filings-board-meetings`,
      cookie,
    ).then(parseBoardMeetings),
    nseJson(
      "/api/corporates-corporateActions?index=equities",
      `${NSE}/companies-listing/corporate-filings-actions`,
      cookie,
    ).then(parseCorporateActions),
  ]);

  const sources = { bse: false, nse: false };
  const all: CorporateEvent[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      all.push(...r.value);
      if (i === 0 && r.value.length) sources.bse = true;
      if (i > 0 && r.value.length) sources.nse = true;
    }
  });

  const today = todayISO();
  const events = dedupe(all)
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.company.localeCompare(b.company));

  const label = [sources.bse && "BSE", sources.nse && "NSE"].filter(Boolean).join(" + ");
  return {
    events,
    generatedAt: new Date().toISOString(),
    source: label ? `${label} (live)` : "Exchanges unreachable",
    live: events.length > 0,
  };
}

async function handleApi(request: Request, ctx: Ctx): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let body: unknown;
  try {
    body = await buildLiveResult();
  } catch (err) {
    body = {
      events: [],
      generatedAt: new Date().toISOString(),
      source: "Exchanges unreachable",
      live: false,
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }

  const res = new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
    },
  });
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/corporate-calendar") return handleApi(request, ctx);
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
