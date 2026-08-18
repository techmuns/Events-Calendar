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

// Retry a flaky upstream a few times so a transient network blip doesn't drop a
// whole source (and its earnings) for the entire cache window.
async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
    }
  }
  throw last;
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
    // Any results board meeting (Financial/Quarterly/Audited/…), but not the
    // AGM/voting/buyback meetings that also contain the word "results".
    if (!/result/i.test(desc)) continue;
    if (/postal ballot|voting|scrutini|buy.?back/i.test(desc)) continue;
    const date = isoDate(r.bm_date);
    if (!date) continue;
    const ticker = (r.bm_symbol ?? "").trim();
    out.push({
      id: `NSE_${ticker}_EARNINGS_${date}`,
      company: titleCase(r.sm_name ?? ticker),
      ticker,
      isin: r.sm_isin || undefined,
      eventType: "EARNINGS",
      subtype: "Results",
      date,
      status: "CONFIRMED",
      exchange: "NSE",
      // Link to the company's readable NSE page — never the raw XBRL/XML the
      // board-meeting intimation ships as (an unstyled document tree otherwise).
      sourceUrl:
        r.attachment && /\.pdf($|\?)/i.test(r.attachment)
          ? r.attachment
          : `${NSE}/get-quotes/equity?symbol=${encodeURIComponent(ticker)}`,
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

// Dedupe across exchanges (keep first — BSE wins). A company reports earnings
// once in the window, so earnings key on company alone (BSE and NSE can list
// slightly different meeting dates); other actions keep the date.
function normKey(e: CorporateEvent): string {
  const c = e.company.toLowerCase().replace(/ltd|limited/g, "").replace(/[^a-z0-9]/g, "");
  return e.eventType === "EARNINGS" ? `EARNINGS_${c}` : `${e.eventType}_${c}_${e.date}`;
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

// Just-reported results pulled from the last few days of NSE announcements, so a
// company that reported today/yesterday still appears (as "Recent") even though
// the forthcoming-results feed has already dropped it.
function parseNseRecentResults(data: unknown): CorporateEvent[] {
  if (!Array.isArray(data)) return [];
  const out: CorporateEvent[] = [];
  const seen = new Set<string>();
  for (const r of data as Array<Record<string, string>>) {
    const desc = (r.desc ?? "").toLowerCase();
    // A presentation, a con-call / analyst-meet intimation, a notice, a newspaper
    // ad or an advance schedule is NOT the results being declared — it must never
    // create a "reported" row (that's what surfaced a deck as an 11-Aug result
    // when the actual board meeting was days later). Skip those categories.
    if (/presentation|analyst|investor meet|con\.? ?call|intimation|notice|newspaper|advertisement|record date|schedule of|prior intimation|advance/.test(desc)) continue;
    let fname = "";
    try {
      fname = decodeURIComponent(r.attchmntFile ?? "").toLowerCase();
    } catch {
      fname = (r.attchmntFile ?? "").toLowerCase();
    }
    if (/presentation|\bppt\b|investor[\s-]?deck/.test(fname)) continue;
    const text = (r.attchmntText ?? "").toLowerCase();
    const blob = `${desc} ${text}`;
    // Genuine quarterly/annual results outcomes only (not dividends, ratings…).
    const isResults =
      /financial results?|quarterly results?|(?:un)?audited (?:standalone|consolidated|financial)/.test(blob) ||
      (/outcome of (?:the )?board meeting/.test(desc) && /\bresults?\b/.test(blob));
    if (!isResults) continue;
    const date = anyDate(r.an_dt) ?? anyDate(r.sort_date ?? "");
    const ticker = (r.symbol ?? "").trim();
    if (!date || !ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    out.push({
      id: `NSE_RES_${r.seq_id || ticker + date}`,
      company: titleCase(r.sm_name ?? ticker),
      ticker,
      eventType: "EARNINGS",
      subtype: "Results",
      date,
      status: "CONFIRMED",
      exchange: "NSE",
      sourceUrl: r.attchmntFile || undefined,
      indices: [],
      sector: "",
    });
  }
  return out.slice(0, 60);
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

function categorizeFiling(desc: string, text: string, url = ""): FilingCategory | null {
  const d = (desc ?? "").toLowerCase();
  const t = (text ?? "").toLowerCase();
  let fname = "";
  try {
    fname = decodeURIComponent(url ?? "").toLowerCase();
  } catch {
    fname = (url ?? "").toLowerCase();
  }
  const s = `${d} ${t}`;
  const sf = `${s} ${fname}`; // include the attachment filename in the signal
  if (/scheme of arrangement|scheme of amalgamation|amalgamat|de-?merg|spin-?off|composite scheme|hive-?off|slump sale/.test(s)) return "SCHEME";
  // Investor/results presentation. Companies routinely file the deck under a bare
  // "Con. Call" intimation, so the body says "call" while the *attachment* is the
  // presentation — the filename ("… Investor presentation …") is the giveaway.
  // Checking it here keeps a deck out of the earnings-call bucket.
  if (/presentation|\bppt\b|investor[\s-]?deck/.test(sf)) return "PRESENTATION";
  // NSE bundles meets + calls under one `desc`; trust the body to spot a call.
  if (/con\.? ?call|conference call|earnings call|earnings conference|analyst call|investor call|dial-?in|audio call|webcast/.test(t))
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

const MONTH_NUM: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

// Derive a compact "Q1 FY27" / "Q4 & FY26" label from a results filing's text
// ("… for the quarter ended June 30, 2026"). Indian FY runs Apr→Mar.
function resultsPeriod(raw: string): string | null {
  const t = (raw ?? "").toLowerCase();
  const m = /ended\s+(?:on\s+)?(?:the\s+)?(?:\d{1,2}(?:st|nd|rd|th)?\s+)?([a-z]{3,9})\.?[\s,]+(?:\d{1,2}(?:st|nd|rd|th)?[\s,]+)?(\d{4})/.exec(t);
  if (!m) return null;
  const mon = MONTH_NUM[m[1]];
  const yr = parseInt(m[2], 10);
  if (!mon || !yr || yr < 2015 || yr > 2100) return null;
  const q = mon <= 3 ? "Q4" : mon <= 6 ? "Q1" : mon <= 9 ? "Q2" : "Q3";
  const fyEnd = mon <= 3 ? yr : yr + 1;
  const fy = `FY${String(fyEnd).slice(2)}`;
  const fullYear = mon === 3 && /(?:and\s+year|full\s+year|annual|for the year|year\s+ended)/.test(t);
  return fullYear ? `Q4 & ${fy}` : `${q} ${fy}`;
}

// Decode the HTML entities BSE/NSE embed in filing text — the rupee sign arrives
// as "&#8377;", ampersands as "&amp;", smart quotes as numeric refs, etc.
function decodeEntities(s: string): string {
  return (s ?? "")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      const n = parseInt(h, 16);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    })
    .replace(/&#(\d+);/g, (_, d) => {
      const n = parseInt(d, 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&(?:rsquo|lsquo|apos);/gi, "'")
    .replace(/&(?:rdquo|ldquo|quot);/gi, '"')
    .replace(/&(?:ndash|mdash);/gi, "–")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

// Map a press release onto a short, proper topic heading (never a full sentence),
// keyword-first so the most salient topic wins. Returns "" when nothing matches.
function pressTopic(text: string): string {
  const t = text.toLowerCase();
  if (/\bcapex\b|capital expenditure/.test(t)) return "Capex Plan";
  if (/capacity expansion|expansion plan|new (?:plant|facility|unit|capacity)|greenfield|brownfield|debottleneck|commission(?:ing|ed)/.test(t)) return "Capacity Expansion";
  if (/bagg?ed|secured (?:an?|the|a fresh)?\s*(?:order|contract|project)|(?:new|fresh|repeat|large) order|order (?:worth|of|book|win|inflow|intake)|letter of (?:award|intent)|\bloa\b|work order|contract (?:win|worth|award)|won (?:a |the )?(?:contract|order|project|bid)/.test(t)) return "Order Win";
  if (/acquisit|acquir(?:e|ing|ed)|majority stake|controlling (?:stake|interest)|joint venture|\bjv\b|amalgamat|\bmerger\b|strategic (?:invest|stake|partnership)/.test(t)) return "Acquisition / JV";
  if (/buy-?back/.test(t)) return "Share Buyback";
  if (/\bdividend\b/.test(t)) return "Dividend Update";
  if (/credit rating|\brating\b[^.]*(?:action|revis|assign|reaffirm|upgrad|downgrad|withdraw)|\bicra\b|crisil|care ratings|india ratings|\bfitch\b|acuit/.test(t)) return "Credit Rating Update";
  if (/fund[\s-]?rais|\bqip\b|preferential (?:issue|allotment)|rights issue|\bncd\b|debenture|commercial paper|bond issue|\bwarrant/.test(t)) return "Fund Raising";
  if (/\baward(?:ed|s)?\b|recognit|accolade|honou?red|\branked\b|certif|\bwins?\b[^.]*award/.test(t)) return "Award & Recognition";
  if (/launch(?:es|ed|ing)?|unveil|introduc|new product|foray|partnership|collaborat|tie-?up|\bmou\b|alliance/.test(t)) return "Business Update";
  if (/resign|appoint|cessation|(?:re)?designat|\bkmp\b|board of directors?|change in director|directorate|managing director|\bceo\b|\bcfo\b|company secretary/.test(t)) return "Board / Management Update";
  if (/investor (?:meet|conference|day|presentation)|analyst meet|road ?show|earnings call|con(?:ference)? ?call/.test(t)) return "Investor Update";
  if (/force majeure|plant shutdown|monthly (?:sales|business)|(?:total|provisional|wholesale|retail) sales|sales (?:volume|update|figures|for the month)|dispatches|production (?:volume|update)|operational update|business update/.test(t)) return "Operational Update";
  return "";
}

// Compress a non-results filing into a short Title-ish heading (no full stop,
// no lead boilerplate) so cards read as headings, not sentences.
function shortHeading(raw: string): string {
  let s = decodeEntities(raw ?? "").replace(/\s+/g, " ").trim();
  // Prefer the document's own title when the filing quotes it — first the fully
  // quoted form ("… titled 'X'"), then an unclosed/trailing "titled X".
  const quoted = /(?:titled|entitled)\s*[:\-]?\s*['"“”‘’]([^'"“”‘’]{4,}?)['"“”‘’]/i.exec(s);
  const tailing = /(?:titled|entitled)\s*[:'"“”‘’]?\s*(.+)$/i.exec(s);
  if (quoted) s = quoted[1];
  else if (tailing) s = tailing[1];
  else s = s.replace(/^.*?informed the exchange\s*(?:about|regarding|that|of|:)?\s*/i, "");
  s = s
    .replace(/\((?:formerly|erstwhile)[^)]*\)/gi, "") // drop "(formerly … Limited)"
    .replace(/^['"“”‘’\s\-–—]+/, "") // leading quotes/dashes (e.g. "titled - X")
    .replace(/^[A-Z0-9&.\-]{2,14}:\s*/, "") // leading all-caps ticker prefix "AFSL:"
    // "Intimation/Disclosure under Regulation 30 [read with …] [of … Regulations, 2015] for …"
    .replace(
      /^(?:intimation|disclosure|information|notice|announcement|update|submission)\s+(?:under|pursuant to|as per|in terms of|u\/[sr])\s+regulation[s]?\s+[0-9][0-9()a-z]*(?:\s*(?:,|and|&|\/|to)\s*[0-9][0-9()a-z]*)*\s*(?:\([^)]*\)\s*)?(?:read with\s+[^,]*?\s+)?(?:of\s+(?:the\s+)?(?:sebi\s+)?[^,]*?regulations?(?:\s*,?\s*\d{4})?\s*)?[,:\-\s]*(?:for|regarding|in respect of|w\.?r\.?t\.?|of|about|:)?\s+/i,
      "",
    )
    .replace(/^['"“”‘’\s\-–—:]+/, "")
    .replace(/^submission of\s+(?:the\s+)?(?:press release|newspaper (?:advertisement|publication)|disclosure|intimation)\s*/i, "")
    .replace(/^(?:titled|entitled)\b\s*[:\-–—]*\s*['"“”‘’]?\s*/i, "") // residual "Titled - X"
    .replace(/^(?:sub|subject|re|ref)\s*[:\-]\s*/i, "")
    .replace(/^(?:copy of\s+)?(?:the\s+)?(?:newspaper\s+)?(?:advertisement|publication|intimation|disclosure)\s+(?:dated|for|of)?\s*/i, "")
    .replace(/^dated\s+[a-z0-9 ,.\-]*?\d{4}[,:\-\s]*/i, "") // "Dated June 15, 2026,"
    .replace(
      /^(?:please find (?:attached|enclosed)(?:\s+(?:herewith|a copy of))?|kindly find|we (?:wish|would like) to inform(?:\s+you)?|this is to inform|we hereby inform|pursuant to|with reference to|in reference to)\s*(?:that|of|about|the|:|,|-|—)?\s*/i,
      "",
    )
    .replace(
      /^(?:a\s+)?(?:media release|press release|press note|intimation|disclosure|announcement|update|corrigendum|clarification)\s*(?:by|relating to|regarding|of|on|under|about|for|from|:|-|—|,)?\s*/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim()
    .replace(/['"“”‘’.;:,\s]+$/, "");
  const words = s.split(" ").filter(Boolean);
  if (words.length > 9) s = words.slice(0, 9).join(" ") + "…";
  s = s.trim();
  if (s.length < 3 || !/[a-z]/i.test(s)) return ""; // reject junk / punctuation-only
  // Reject leftovers that still read as truncated boilerplate, not a title
  // (source text cut off right after "titled", stray "Dated …", etc.).
  const low = s.toLowerCase();
  if (/^(?:dated|sub|ref|re|copy of)\b/.test(low) || /\btitled…?$/.test(low) || /informed the exchange|please find|kindly find/.test(low)) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Corporate-action schemes → a short, proper heading (so "…Intimation under
// Regulation 30 for proposed scheme of amalgamation…" reads as a heading).
function schemeTopic(text: string): string {
  const t = text.toLowerCase();
  if (/de-?merg/.test(t)) return "Demerger";
  if (/amalgamat/.test(t)) return "Scheme of Amalgamation";
  if (/composite scheme/.test(t)) return "Composite Scheme";
  if (/scheme of arrangement/.test(t)) return "Scheme of Arrangement";
  if (/slump sale/.test(t)) return "Slump Sale";
  if (/hive-?off|spin-?off/.test(t)) return "Spin-off";
  if (/reduction of (?:share )?capital|capital reduction/.test(t)) return "Capital Reduction";
  if (/buy-?back/.test(t)) return "Share Buyback";
  if (/\bmerger\b/.test(t)) return "Merger";
  if (/\bscheme\b/.test(t)) return "Scheme of Arrangement";
  return "";
}

// Turn a terse/sentence filing text into a proper, short heading — never a full
// sentence — consistently across every company, event and tab.
function friendlyTitle(cat: FilingCategory, rawText: string, desc: string): string {
  const raw = decodeEntities(rawText || desc || "");
  const t = raw.toLowerCase();
  const period = resultsPeriod(raw);
  const isResults =
    /financial result|results for|quarter ended|year ended|unaudited|audited (?:financial|standalone|consolidated)|quarterly result/.test(t);

  if (cat === "PRESENTATION") return period ? `${period} Results Presentation` : "Investor Presentation";
  if (cat === "CONCALL") return period ? `Earnings Call · ${period}` : "Earnings Call";
  if (cat === "SCHEME") return schemeTopic(raw) || shortHeading(raw) || "Corporate Action";
  if (cat === "MEET") {
    if (/transcript/.test(t)) return period ? `Earnings Call Transcript · ${period}` : "Earnings Call — Transcript";
    if (/recording|audio|\brec\b/.test(t)) return period ? `Earnings Call Audio · ${period}` : "Earnings Call — Audio";
    if (/presentation|\bppt\b/.test(t)) return period ? `${period} Results Presentation` : "Investor Presentation";
    return "Analyst / Investor Meeting";
  }
  // PRESS (and any default): results → period heading; else a topic heading; else
  // a cleaned short heading. Never the raw sentence, never a raw HTML entity.
  if (isResults) return period ? `${period} Financial Results` : "Financial Results";
  return pressTopic(raw) || shortHeading(raw) || "Press Release";
}

function parseCompanyFilings(data: unknown): CompanyFiling[] {
  if (!Array.isArray(data)) return [];
  const out: CompanyFiling[] = [];
  const seen = new Set<string>();
  for (const r of data as Array<Record<string, string>>) {
    const url = (r.attchmntFile ?? "").trim();
    const cat = categorizeFiling(r.desc ?? "", r.attchmntText ?? "", url);
    if (!cat) continue;
    if (!url || seen.has(url)) continue;
    const date = anyDate(r.an_dt) ?? anyDate(r.sort_date ?? "");
    if (!date) continue;
    seen.add(url);
    out.push({ category: cat, title: friendlyTitle(cat, r.attchmntText ?? "", r.desc ?? ""), date, url, source: hostSource(url) });
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  return out.slice(0, 90);
}

// NSE announcements for one symbol → categorised filings. NSE intermittently
// blocks bursts (erroring, or an empty 200), so retry with a fresh cookie.
// The company's most recent *actual results document* (a PDF) from its NSE
// announcements — the file a client wants when they click "Results". Presentations,
// intimations, notices and non-PDF attachments are excluded, so this is never a
// deck or a quote page.
function latestResultsDoc(data: unknown): string | undefined {
  if (!Array.isArray(data)) return undefined;
  // Only a *current-season* results document counts — never a stale one from two
  // quarters ago. If we can't find this cycle's results, we show nothing rather
  // than a misleadingly old PDF.
  const cutoff = Date.now() - 75 * 86_400_000;
  let best: { date: string; url: string } | undefined;
  for (const r of data as Array<Record<string, string>>) {
    const url = (r.attchmntFile ?? "").trim();
    if (!url || !/\.pdf($|\?)/i.test(url)) continue;
    let fname = "";
    try {
      fname = decodeURIComponent(url).toLowerCase();
    } catch {
      fname = url.toLowerCase();
    }
    if (/presentation|\bppt\b|investor[\s-]?deck|query|clarification|reply|response|corrigendum|newspaper/.test(fname)) continue;
    const desc = (r.desc ?? "").toLowerCase();
    if (/presentation|analyst|investor meet|con\.? ?call|intimation|notice|newspaper|advertisement|record date|schedule of|prior intimation|advance|query|clarification|reply|response to|corrigendum|withdrawal/.test(desc)) continue;
    const blob = `${desc} ${(r.attchmntText ?? "").toLowerCase()}`;
    // Match the results *category* (desc), not stray "financial results" mentions
    // in a query reply's body — plus board-meeting outcomes that declare results.
    const isResults =
      /financial results?|(?:un)?audited (?:standalone|consolidated|financial)|statement of (?:standalone|consolidated)/.test(desc) ||
      (/outcome of (?:the )?board meeting/.test(desc) && /\bresults?\b/.test(blob));
    if (!isResults) continue;
    const date = anyDate(r.an_dt) ?? anyDate(r.sort_date ?? "");
    if (!date) continue;
    if (new Date(`${date}T00:00:00Z`).getTime() < cutoff) continue; // too old to be this cycle's results
    if (!best || date > best.date) best = { date, url };
  }
  return best?.url;
}

async function fetchNseFilings(sym: string): Promise<{ filings: CompanyFiling[]; reached: boolean; resultsUrl?: string }> {
  const now = new Date();
  const from = new Date(now);
  // ~15 months back so the details tabs carry several past quarters of press
  // releases, investor meets and presentations, not just the latest one or two.
  from.setDate(from.getDate() - 460);
  const path = `/api/corporate-announcements?index=equities&symbol=${encodeURIComponent(sym)}&from_date=${nseDate(
    from,
  )}&to_date=${nseDate(now)}`;
  const referer = `${NSE}/get-quotes/equity?symbol=${encodeURIComponent(sym)}`;
  let filings: CompanyFiling[] = [];
  let reached = false;
  let resultsUrl: string | undefined;
  for (let attempt = 0; attempt < 3 && filings.length === 0; attempt++) {
    try {
      const cookie = await nseCookie();
      const data = await nseJson(path, referer, cookie);
      reached = true;
      filings = parseCompanyFilings(data);
      resultsUrl = latestResultsDoc(data);
    } catch {
      /* transient — try again with a fresh cookie */
    }
  }
  return { filings, reached, resultsUrl };
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

// Free-text company search (any NSE/BSE-listed name), so a user can pull up a
// company that has no upcoming board meeting (CDSL, an already-reported firm)
// and still read its past filings & calls. Backed by Screener's search.
async function searchCompanies(q: string): Promise<Array<{ name: string; symbol: string; exchange: string }>> {
  const query = (q ?? "").trim();
  if (query.length < 2) return [];
  try {
    const raw = await screenerFetch(`/api/company/search/?q=${encodeURIComponent(query)}`);
    const arr = JSON.parse(raw) as Array<{ name: string; url: string }>;
    if (!Array.isArray(arr)) return [];
    const out: Array<{ name: string; symbol: string; exchange: string }> = [];
    const seen = new Set<string>();
    for (const c of arr) {
      const sym = (/\/company\/([^/]+)\//.exec(c.url ?? "")?.[1] ?? "").trim();
      const name = (c.name ?? "").trim();
      if (!sym || !name || seen.has(sym.toUpperCase())) continue;
      seen.add(sym.toUpperCase());
      out.push({ name, symbol: sym, exchange: /^\d+$/.test(sym) ? "BSE" : "NSE" });
      if (out.length >= 7) break;
    }
    return out;
  } catch {
    return [];
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
    // A genuine earnings call has a transcript or an audio recording. Screener
    // also lists rows that only carry a PPT or an intimation — those are decks /
    // notices, not the call itself, so we skip them entirely rather than surface
    // a presentation under "Earnings Call".
    const call = links.find((l) => /transcript|recording|\brec\b|audio/i.test(l.label));
    if (!call) continue;
    // Keep only real call materials (never the slide deck) so nothing downstream
    // can resolve the call to a presentation.
    const callLinks = links.filter((l) => !/ppt|slide|deck|presentation/i.test(l.label) && !/presentation/i.test(l.url));
    out.push({ category: "CONCALL", title: `Earnings Call · ${label}`, date: iso, links: callLinks, url: call.url, source: "Screener" });
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
  let resultsUrl: string | undefined;
  if (canonical && /[A-Za-z]/.test(canonical)) {
    const nse = await fetchNseFilings(canonical);
    reached = nse.reached;
    resultsUrl = nse.resultsUrl;
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
    resultsUrl,
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
  // Keep a few days of just-reported events so a same-day/2-3-day-old result is
  // still surfaced (as "Recent") rather than vanishing the moment it happens.
  const recentFrom = new Date(now);
  recentFrom.setDate(recentFrom.getDate() - 4);
  const recentCutoff = recentFrom.toISOString().slice(0, 10);
  // NSE board-meetings returns only a tiny default window without dates, so ask
  // for the whole upcoming horizon — this is what surfaces NSE-only companies.
  const bmTo = new Date(now);
  bmTo.setDate(bmTo.getDate() + 120);

  const [constituents, settled, annRaw] = await Promise.all([
    fetchConstituents().catch(() => new Map<string, Constituent>()),
    Promise.allSettled([
      retry(() => bseJson("/Corpforthresults/w")).then(parseBseForthResults),
      retry(() =>
        nseJson(
          `/api/corporate-board-meetings?index=equities&from_date=${nseDate(recentFrom)}&to_date=${nseDate(bmTo)}`,
          `${NSE}/companies-listing/corporate-filings-board-meetings`,
          cookie,
        ),
      ).then(parseBoardMeetings),
      retry(() =>
        nseJson(
          "/api/corporates-corporateActions?index=equities",
          `${NSE}/companies-listing/corporate-filings-actions`,
          cookie,
        ),
      ).then(parseCorporateActions),
    ]),
    nseJson(
      `/api/corporate-announcements?index=equities&from_date=${nseDate(from)}&to_date=${nseDate(now)}`,
      `${NSE}/companies-listing/corporate-filings-announcements`,
      cookie,
    ).catch(() => null),
  ]);

  // The announcements feed drives both the concall list and just-reported results.
  const concalls = annRaw ? parseNseConcalls(annRaw) : [];
  const recentResults = annRaw ? parseNseRecentResults(annRaw) : [];

  const sources = { bse: false, nse: false };
  const all: CorporateEvent[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      all.push(...r.value);
      if (i === 0 && r.value.length) sources.bse = true;
      if (i > 0 && r.value.length) sources.nse = true;
    }
  });
  all.push(...recentResults);
  if (concalls.length || recentResults.length) sources.nse = true;

  const enriched = all.map((e) => enrichEvent(e, constituents));
  const events = dedupe(enriched)
    .filter((e) => e.date >= recentCutoff)
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
    if (url.pathname === "/api/company-search") {
      const q = url.searchParams.get("q") ?? "";
      if (q.trim().length < 2) {
        return new Response(JSON.stringify({ results: [] }), { headers: { "Content-Type": "application/json" } });
      }
      return cachedJson(request, ctx, async () => ({ results: await searchCompanies(q) }));
    }
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
