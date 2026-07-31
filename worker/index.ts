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

interface ConcallItem {
  id: string;
  company: string;
  ticker: string;
  summary: string;
  filedDate: string;
  exchange: "NSE" | "BSE";
  sourceUrl?: string;
}

type FilingCategory = "PRESS" | "MEET" | "PRESENTATION" | "CONCALL" | "SCHEME";

interface CompanyFiling {
  category: FilingCategory;
  title: string;
  date: string;
  url: string;
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

// NSE's JSON APIs reject requests without the cookies its web pages set. Visit
// the landing page and the filings page so we collect the full set (deduped by
// name — later pages refresh earlier cookies).
async function nseCookie(): Promise<string> {
  const jar = new Map<string, string>();
  for (const path of ["/", "/companies-listing/corporate-filings-announcements"]) {
    try {
      const res = await fetch(`${NSE}${path}`, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const kv = c.split(";")[0];
        const eq = kv.indexOf("=");
        if (eq > 0) jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim());
      }
    } catch {
      /* ignore — a partial jar may still work */
    }
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
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

// Nifty 50 / 500 constituents (free NSE index files) → index membership + sector.
interface Constituent {
  sector: string;
  in50: boolean;
  in500: boolean;
}

// CSV columns: Company Name, Industry, Symbol, Series, ISIN. Parse from the
// right so commas inside company names don't shift the fields.
function addCsvToMap(csv: string, map: Map<string, Constituent>, flag: "in50" | "in500"): void {
  const lines = csv.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(",");
    if (p.length < 5) continue;
    const symbol = p[p.length - 3].trim();
    const industry = p[p.length - 4].trim();
    if (!symbol) continue;
    const cur = map.get(symbol) ?? { sector: "", in50: false, in500: false };
    if (!cur.sector && industry) cur.sector = industry;
    cur[flag] = true;
    map.set(symbol, cur);
  }
}

async function fetchConstituents(): Promise<Map<string, Constituent>> {
  const base = "https://nsearchives.nseindia.com/content/indices";
  const [n500, n50] = await Promise.all([
    fetch(`${base}/ind_nifty500list.csv`, { headers: { "User-Agent": UA } }).then((r) =>
      r.ok ? r.text() : "",
    ),
    fetch(`${base}/ind_nifty50list.csv`, { headers: { "User-Agent": UA } }).then((r) =>
      r.ok ? r.text() : "",
    ),
  ]);
  const map = new Map<string, Constituent>();
  if (n500) addCsvToMap(n500, map, "in500");
  if (n50) addCsvToMap(n50, map, "in50");
  return map;
}

function enrichEvent(e: CorporateEvent, map: Map<string, Constituent>): CorporateEvent {
  const c = map.get(e.ticker);
  if (c) {
    e.indices = c.in50 ? ["NIFTY50", "NIFTY500"] : c.in500 ? ["NIFTY500"] : [];
    if (c.sector) e.sector = c.sector;
  }
  return e;
}

function nseDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

// Post-facto filings we don't want in a "recently announced" concall list.
const CC_EXCLUDE = /transcript|audio|recording|newspaper|outcome of|presentation|proceeding/i;

function cleanSummary(text: string): string {
  return (text ?? "")
    .replace(/^.*?informed the exchange about\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 130);
}

// NSE analyst-meet / concall intimations (the "Analysts/Institutional Investor
// Meet/Con. Call" filings). The exact call date lives in the linked PDF.
function parseNseConcalls(data: unknown): ConcallItem[] {
  if (!Array.isArray(data)) return [];
  const out: ConcallItem[] = [];
  for (const r of data as Array<Record<string, string>>) {
    if (!/con\.? ?call|investor meet|analyst/i.test(r.desc ?? "")) continue;
    const text = r.attchmntText ?? "";
    if (CC_EXCLUDE.test(text)) continue;
    const filedDate = isoDate(r.an_dt) ?? (r.sort_date ?? "").slice(0, 10);
    if (!filedDate) continue;
    const ticker = (r.symbol ?? "").trim();
    out.push({
      id: `NSE_CC_${r.seq_id || ticker + filedDate}`,
      company: titleCase(r.sm_name ?? ticker),
      ticker,
      summary: cleanSummary(text) || "Analyst / Investor Meet",
      filedDate,
      exchange: "NSE",
      sourceUrl: r.attchmntFile || undefined,
    });
  }
  out.sort((a, b) => b.filedDate.localeCompare(a.filedDate));
  return out.slice(0, 40);
}

// ---- Per-company filings (Details tab) --------------------------------------
// NSE announcements carry a category (`desc`) and a body (`attchmntText`); we
// sort each into the buckets the desk cares about and keep the direct PDF link.

// NSE datetimes are "2026-07-30 15:30:00"; fall back to the "29-Jul-2026" parser.
function anyDate(s: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? "");
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return isoDate(s ?? "");
}

function categorizeFiling(desc: string, text: string): FilingCategory | null {
  const d = (desc ?? "").toLowerCase();
  const t = (text ?? "").toLowerCase();
  const s = `${d} ${t}`;
  if (/scheme of arrangement|de-?merg|spin-?off|composite scheme|hive-?off|slump sale/.test(s)) return "SCHEME";
  if (/presentation/.test(s)) return "PRESENTATION";
  // NSE bundles meets + calls under one `desc`; trust the body to spot a call.
  if (/con\.? ?call|conference call|earnings call|analyst call|investor call|dial-?in|audio call|webcast/.test(t))
    return "CONCALL";
  if (/investor meet|analyst|institutional investor|con\.? ?call|investor call/.test(s)) return "MEET";
  if (/press release|media release|press note/.test(s)) return "PRESS";
  return null;
}

function filingTitle(text: string, desc: string): string {
  let t = (text ?? "").replace(/\s+/g, " ").trim();
  // Strip the boilerplate "<Company> has informed the Exchange about ..." lead.
  t = t.replace(/^.*?informed the exchange\s*(?:about|regarding|that|of)?\s*/i, "");
  t = t.replace(/^['"\s:;,.-]+/, "").trim();
  const base = t || (desc ?? "").replace(/\s+/g, " ").trim() || "Filing";
  const label = base.charAt(0).toUpperCase() + base.slice(1);
  return label.slice(0, 90);
}

function parseCompanyFilings(data: unknown): CompanyFiling[] {
  if (!Array.isArray(data)) return [];
  const out: CompanyFiling[] = [];
  const seen = new Set<string>();
  for (const r of data as Array<Record<string, string>>) {
    const cat = categorizeFiling(r.desc ?? "", r.attchmntText ?? "");
    if (!cat) continue;
    const url = (r.attchmntFile ?? "").trim();
    if (!url || seen.has(url)) continue;
    const date = anyDate(r.an_dt) ?? anyDate(r.sort_date ?? "");
    if (!date) continue;
    seen.add(url);
    out.push({ category: cat, title: filingTitle(r.attchmntText ?? "", r.desc ?? ""), date, url });
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  return out.slice(0, 40);
}

async function buildCompanyFilings(symbol: string) {
  const sym = symbol.toUpperCase().trim();
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 150);
  const path = `/api/corporate-announcements?index=equities&symbol=${encodeURIComponent(sym)}&from_date=${nseDate(
    from,
  )}&to_date=${nseDate(now)}`;
  // The symbol's own quote page is the referer NSE expects for a symbol query.
  const referer = `${NSE}/get-quotes/equity?symbol=${encodeURIComponent(sym)}`;

  // NSE intermittently blocks bursts, sometimes by erroring and sometimes by
  // returning an empty 200. Retry with a fresh cookie until we get rows or run
  // out of attempts; `reached` tracks whether NSE actually answered.
  let filings: CompanyFiling[] = [];
  let reached = false;
  for (let attempt = 0; attempt < 3 && filings.length === 0; attempt++) {
    try {
      const cookie = await nseCookie();
      const data = await nseJson(path, referer, cookie);
      reached = true;
      filings = parseCompanyFilings(data);
    } catch {
      /* transient — try again with a fresh cookie */
    }
  }
  return { symbol: sym, filings, generatedAt: new Date().toISOString(), source: "NSE", ok: reached };
}

async function buildLiveResult() {
  const cookie = await nseCookie();
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 4);

  const [constituents, settled, concalls] = await Promise.all([
    fetchConstituents().catch(() => new Map<string, Constituent>()),
    Promise.allSettled([
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
    ]),
    nseJson(
      `/api/corporate-announcements?index=equities&from_date=${nseDate(from)}&to_date=${nseDate(now)}`,
      `${NSE}/companies-listing/corporate-filings-announcements`,
      cookie,
    )
      .then(parseNseConcalls)
      .catch(() => [] as ConcallItem[]),
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
  if (concalls.length) sources.nse = true;

  const enriched = all.map((e) => enrichEvent(e, constituents));
  const today = todayISO();
  const events = dedupe(enriched)
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.company.localeCompare(b.company));

  const label = [sources.bse && "BSE", sources.nse && "NSE"].filter(Boolean).join(" + ");
  return {
    events,
    concalls,
    generatedAt: new Date().toISOString(),
    source: label ? `${label} (live)` : "Exchanges unreachable",
    live: events.length > 0 || concalls.length > 0,
  };
}

// Edge-cached JSON keyed by full URL (so ?symbol= variants cache separately).
async function cachedJson(request: Request, ctx: Ctx, build: () => Promise<unknown>): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  let body: unknown;
  try {
    body = await build();
  } catch (err) {
    body = { error: err instanceof Error ? err.message : "fetch failed" };
  }
  const res = new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${CACHE_SECONDS}` },
  });
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
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
      concalls: [],
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
    if (url.pathname === "/api/company-filings") {
      const symbol = url.searchParams.get("symbol") ?? "";
      if (!symbol.trim()) {
        return new Response(
          JSON.stringify({ symbol: "", filings: [], generatedAt: new Date().toISOString(), source: "NSE" }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      return cachedJson(request, ctx, () => buildCompanyFilings(symbol));
    }
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
