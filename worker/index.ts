/**
 * Cloudflare Worker for the Events Calendar.
 *
 * Serves the built SPA (static assets) and exposes a live corporate-events API
 * at /api/corporate-calendar, sourced server-side from NSE's free public
 * endpoints (browsers can't call NSE directly — CORS). Results are cached at
 * the edge for a few minutes. If NSE is unreachable from Cloudflare, the API
 * returns an empty live result and the frontend falls back to sample data, so
 * the dashboard never breaks.
 *
 * No secrets, no D1 yet — on-demand fetch + Cache API. Persistence and
 * date-change history (for the New/Revised features) come with D1 next.
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
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const CACHE_SECONDS = 600;

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

// A compact Nifty 50 membership list, used to tag events so the universe
// filters work on live data. Nifty 500 tagging (via the constituents CSV)
// follows.
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

function isoDate(dmy: string): string | null {
  const m = /(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(dmy ?? "");
  if (!m) return null;
  const mon = MONTHS[m[2]];
  if (!mon) return null;
  return `${m[3]}-${mon}-${m[1].padStart(2, "0")}`;
}

function indicesFor(ticker: string): string[] {
  return NIFTY50.has(ticker) ? ["NIFTY50", "NIFTY500"] : [];
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
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

function parseBoardMeetings(data: unknown): CorporateEvent[] {
  if (!Array.isArray(data)) return [];
  const out: CorporateEvent[] = [];
  for (const r of data as Array<Record<string, string>>) {
    const desc = (r.bm_desc ?? "") + " " + (r.bm_purpose ?? "");
    if (!/financial result|financial results/i.test(desc)) continue;
    const date = isoDate(r.bm_date);
    if (!date) continue;
    const ticker = (r.bm_symbol ?? "").trim();
    const company = titleCase(r.sm_name ?? ticker);
    const quarter = /Q[1-4]\s*FY?\s*\d{2,4}/i.exec(desc)?.[0];
    out.push({
      id: `NSE_${ticker}_EARNINGS_${date}`,
      company,
      ticker,
      isin: r.sm_isin || undefined,
      eventType: "EARNINGS",
      subtype: quarter ? quarter.toUpperCase() : "Board Meeting — Financial Results",
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

function dedupe(events: CorporateEvent[]): CorporateEvent[] {
  const seen = new Map<string, CorporateEvent>();
  for (const e of events) if (!seen.has(e.id)) seen.set(e.id, e);
  return [...seen.values()];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function buildLiveResult(): Promise<{
  events: CorporateEvent[];
  generatedAt: string;
  source: string;
  live: boolean;
}> {
  const cookie = await nseCookie();
  const results = await Promise.allSettled([
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

  const events = dedupe(
    results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
  );
  const today = todayISO();
  const upcoming = events
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    events: upcoming,
    generatedAt: new Date().toISOString(),
    source: "NSE (live)",
    live: upcoming.length > 0,
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
      source: "NSE unreachable",
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
    if (url.pathname === "/api/corporate-calendar") {
      return handleApi(request, ctx);
    }
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
