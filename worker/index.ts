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
type FilingSource = "NSE" | "BSE" | "Screener" | "Web";

interface FilingLink {
  label: string;
  url: string;
  source: FilingSource;
}

interface CompanyFiling {
  category: FilingCategory;
  title: string;
  date: string;
  url?: string; // single-document filings (NSE/BSE announcements)
  links?: FilingLink[]; // multi-document filings (Screener concalls: transcript/PPT/rec)
  source: FilingSource;
}

function hostSource(url: string): FilingSource {
  if (/bseindia\.com/i.test(url)) return "BSE";
  if (/nseindia\.com/i.test(url)) return "NSE";
  if (/screener\.in/i.test(url)) return "Screener";
  return "Web";
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
    out.push({ category: cat, title: filingTitle(r.attchmntText ?? "", r.desc ?? ""), date, url, source: hostSource(url) });
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  return out.slice(0, 40);
}

// NSE announcements for one symbol → categorised filings. NSE intermittently
// blocks bursts (erroring, or an empty 200), so retry with a fresh cookie.
async function fetchNseFilings(sym: string): Promise<{ filings: CompanyFiling[]; reached: boolean }> {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 150);
  const path = `/api/corporate-announcements?index=equities&symbol=${encodeURIComponent(sym)}&from_date=${nseDate(
    from,
  )}&to_date=${nseDate(now)}`;
  const referer = `${NSE}/get-quotes/equity?symbol=${encodeURIComponent(sym)}`;
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
  return { filings, reached };
}

// ---- Screener.in --------------------------------------------------------------
// Screener aggregates BSE + NSE filings and, uniquely, per-quarter concalls with
// direct Transcript / PPT / Recording links. We also use its search to resolve a
// company's canonical symbol (fixes BSE short-names that aren't NSE symbols).
const SCREENER = "https://www.screener.in";

async function screenerFetch(path: string): Promise<string> {
  const res = await fetch(`${SCREENER}${path}`, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/json,*/*",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`Screener ${path} -> ${res.status}`);
  return res.text();
}

function normName(s: string): string {
  return (s ?? "").toLowerCase().replace(/limited|ltd/g, "").replace(/[^a-z0-9]/g, "");
}

// Search returns several matches (e.g. "Vedanta Ltd" vs "Vedanta Aluminium");
// prefer the closest name to the query rather than blindly taking the first.
function pickScreener(arr: Array<{ name: string; url: string }>, query: string): { name: string; url: string } {
  const q = normName(query);
  let best = arr[0];
  let bestScore = -1;
  for (const c of arr) {
    const n = normName(c.name);
    let score: number;
    if (n === q) score = 100;
    else if (n.startsWith(q) || q.startsWith(n)) score = 60 - Math.abs(n.length - q.length);
    else if (n.includes(q) || q.includes(n)) score = 30 - Math.abs(n.length - q.length);
    else score = 0;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

async function resolveScreener(query: string): Promise<{ sym: string; html: string } | null> {
  try {
    const raw = await screenerFetch(`/api/company/search/?q=${encodeURIComponent(query)}`);
    const arr = JSON.parse(raw) as Array<{ name: string; url: string }>;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const hit = pickScreener(arr, query);
    const path = hit.url.startsWith("/") ? hit.url : `/${hit.url}`;
    const sym = (/\/company\/([^/]+)\//.exec(path)?.[1] ?? "").trim();
    const html = await screenerFetch(path);
    return { sym, html };
  } catch {
    return null;
  }
}

function screenerMonthISO(label: string): string | null {
  const m = /([A-Za-z]{3,})\s+(\d{4})/.exec(label ?? "");
  if (!m) return null;
  const key = m[1].slice(0, 3);
  const mon = MONTHS[key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()];
  if (!mon) return null;
  return `${m[2]}-${mon}-01`;
}

// Each concall is one <li> with a "Mon YYYY" label and Transcript/PPT/REC links.
function parseScreenerConcalls(html: string): CompanyFiling[] {
  const start = html.indexOf("documents concalls");
  if (start < 0) return [];
  const block = html.slice(start, start + 24000);
  const out: CompanyFiling[] = [];
  const liRe = /<li class="flex flex-gap-8 flex-wrap-420">([\s\S]*?)<\/li>/g;
  let li: RegExpExecArray | null;
  while ((li = liRe.exec(block))) {
    const seg = li[1];
    const label = (/width:\s*74px">([^<]+)</.exec(seg)?.[1] ?? "").trim();
    const iso = screenerMonthISO(label);
    if (!iso) continue;
    const links: FilingLink[] = [];
    const aRe = /<a\s+href="([^"]+)"[^>]*class="concall-link"[^>]*>\s*([^<]+?)\s*<\/a>/g;
    let a: RegExpExecArray | null;
    while ((a = aRe.exec(seg))) {
      const href = a[1].trim();
      const lbl = a[2].trim();
      if (href && lbl) links.push({ label: lbl, url: href, source: hostSource(href) });
    }
    if (!links.length) continue;
    const primary =
      links.find((l) => /transcript/i.test(l.label)) ?? links.find((l) => /ppt/i.test(l.label)) ?? links[0];
    // Credit Screener as the aggregator that surfaced the concall; the individual
    // links keep their real host (BSE/NSE/company) for provenance.
    out.push({ category: "CONCALL", title: `Concall · ${label}`, date: iso, links, url: primary.url, source: "Screener" });
  }
  return out.slice(0, 12);
}

async function buildCompanyFilings(name: string, symbol: string) {
  const sym0 = (symbol ?? "").toUpperCase().trim();
  const query = (name ?? "").trim() || sym0;
  const filings: CompanyFiling[] = [];
  let canonical = sym0;

  // 1. Screener: canonical symbol + per-quarter concalls (transcript/PPT/rec).
  const scr = await resolveScreener(query).catch(() => null);
  if (scr) {
    if (scr.sym && /^[A-Za-z0-9&_-]+$/.test(scr.sym)) canonical = scr.sym.toUpperCase();
    filings.push(...parseScreenerConcalls(scr.html));
  }

  // 2. NSE announcements via the canonical symbol (fixes BSE short-name misses).
  let reached = false;
  if (canonical && /[A-Za-z]/.test(canonical)) {
    const nse = await fetchNseFilings(canonical);
    reached = nse.reached;
    // Screener already supplies richer concalls, so keep NSE's other categories.
    const hasConcalls = filings.some((f) => f.category === "CONCALL");
    for (const f of nse.filings) {
      if (hasConcalls && f.category === "CONCALL") continue;
      filings.push(f);
    }
  }

  filings.sort((a, b) => b.date.localeCompare(a.date));

  const provs = new Set<FilingSource>();
  for (const f of filings) {
    provs.add(f.source);
    for (const l of f.links ?? []) provs.add(l.source);
  }
  provs.delete("Web");
  const order: FilingSource[] = ["BSE", "NSE", "Screener"];
  const label = order.filter((s) => provs.has(s)).join(" · ") || "NSE";

  return {
    symbol: canonical || sym0,
    filings,
    generatedAt: new Date().toISOString(),
    source: label,
    ok: reached || filings.length > 0,
  };
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
      const name = url.searchParams.get("name") ?? "";
      if (!symbol.trim() && !name.trim()) {
        return new Response(
          JSON.stringify({ symbol: "", filings: [], generatedAt: new Date().toISOString(), source: "" }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      return cachedJson(request, ctx, () => buildCompanyFilings(name, symbol));
    }
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
