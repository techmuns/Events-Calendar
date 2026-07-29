// Seed dataset for the dashboard UI. Shaped to mirror the real NSE/BSE feed
// (company, ticker, ISIN, purpose -> subtype, date, source link). Dates are
// generated as offsets from *today* so the calendar is always populated while
// we run on sample data. Replaced by the live feed in the next step.

import type { CorporateEvent, ConcallItem, EventType, EventStatus, Exchange, MarketCap } from "../types";
import { addDays, toISO, todayStart } from "../lib/dates";

export const WATCHLIST_TICKERS = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ITC", "TATAMOTORS"];

const NSE_BM = "https://www.nseindia.com/companies-listing/corporate-filings-board-meetings";
const NSE_ANN = "https://www.nseindia.com/companies-listing/corporate-filings-announcements";
const NSE_CA = "https://www.nseindia.com/companies-listing/corporate-filings-actions";

interface Seed {
  company: string;
  ticker: string;
  isin?: string;
  eventType: EventType;
  subtype: string;
  offset: number; // days from today
  time?: string;
  status: EventStatus;
  exchange: Exchange;
  indices: string[];
  sector: string;
  marketCap?: MarketCap;
}

const N50 = ["NIFTY50", "NIFTY500"];
const N500 = ["NIFTY500"];

const SEEDS: Seed[] = [
  { company: "Tata Consultancy Services", ticker: "TCS", isin: "INE467B01029", eventType: "EARNINGS", subtype: "Q1 FY27 Results", offset: 0, time: "16:00", status: "CONFIRMED", exchange: "NSE", indices: N50, sector: "IT", marketCap: "LARGE" },
  { company: "Tata Consultancy Services", ticker: "TCS", isin: "INE467B01029", eventType: "CONCALL", subtype: "Earnings Call", offset: 0, time: "18:00", status: "CONFIRMED", exchange: "NSE", indices: N50, sector: "IT", marketCap: "LARGE" },
  { company: "HDFC Bank", ticker: "HDFCBANK", isin: "INE040A01034", eventType: "EARNINGS", subtype: "Q1 FY27 Results", offset: 1, time: "15:30", status: "CONFIRMED", exchange: "NSE", indices: N50, sector: "Banking", marketCap: "LARGE" },
  { company: "Reliance Industries", ticker: "RELIANCE", isin: "INE002A01018", eventType: "EARNINGS", subtype: "Q1 FY27 Results", offset: 2, status: "TENTATIVE", exchange: "NSE", indices: N50, sector: "Energy", marketCap: "LARGE" },
  { company: "Infosys", ticker: "INFY", isin: "INE009A01021", eventType: "EARNINGS", subtype: "Q1 FY27 Results", offset: 2, time: "15:45", status: "CONFIRMED", exchange: "NSE", indices: N50, sector: "IT", marketCap: "LARGE" },
  { company: "Infosys", ticker: "INFY", isin: "INE009A01021", eventType: "CONCALL", subtype: "Analyst Concall", offset: 3, time: "17:00", status: "CONFIRMED", exchange: "NSE", indices: N50, sector: "IT", marketCap: "LARGE" },
  { company: "ICICI Bank", ticker: "ICICIBANK", isin: "INE090A01021", eventType: "EARNINGS", subtype: "Q1 FY27 Results", offset: 3, status: "CONFIRMED", exchange: "NSE", indices: N50, sector: "Banking", marketCap: "LARGE" },
  { company: "RBZ Jewellers", ticker: "RBZJEWEL", isin: "INE0PEQ01016", eventType: "EARNINGS", subtype: "Q1 FY27 Results", offset: 4, status: "CONFIRMED", exchange: "NSE", indices: [], sector: "Gems & Jewellery", marketCap: "SMALL" },
  { company: "ITC", ticker: "ITC", isin: "INE154A01025", eventType: "DEMERGER", subtype: "ITC Hotels demerger — record date", offset: 5, status: "CONFIRMED", exchange: "NSE", indices: N50, sector: "FMCG", marketCap: "LARGE" },
  { company: "Larsen & Toubro", ticker: "LT", isin: "INE018A01030", eventType: "EARNINGS", subtype: "Q1 FY27 Results", offset: 6, status: "TENTATIVE", exchange: "NSE", indices: N50, sector: "Capital Goods", marketCap: "LARGE" },
  { company: "Axis Bank", ticker: "AXISBANK", isin: "INE238A01034", eventType: "EARNINGS", subtype: "Q1 FY27 Results", offset: 7, time: "14:00", status: "CONFIRMED", exchange: "NSE", indices: N50, sector: "Banking", marketCap: "LARGE" },
  { company: "Bharti Airtel", ticker: "BHARTIARTL", isin: "INE397D01024", eventType: "EARNINGS", subtype: "Q1 FY27 Results", offset: 8, status: "TENTATIVE", exchange: "NSE", indices: N50, sector: "Telecom", marketCap: "LARGE" },
  { company: "Hindustan Unilever", ticker: "HINDUNILVR", isin: "INE030A01027", eventType: "EARNINGS", subtype: "Q1 FY27 Results", offset: 9, status: "CONFIRMED", exchange: "NSE", indices: N50, sector: "FMCG", marketCap: "LARGE" },
  { company: "Maruti Suzuki India", ticker: "MARUTI", isin: "INE585B01010", eventType: "EARNINGS", subtype: "Q1 FY27 Results", offset: 10, time: "16:30", status: "CONFIRMED", exchange: "NSE", indices: N50, sector: "Automobile", marketCap: "LARGE" },
  { company: "Maruti Suzuki India", ticker: "MARUTI", isin: "INE585B01010", eventType: "CONCALL", subtype: "Earnings Conference Call", offset: 10, time: "17:30", status: "CONFIRMED", exchange: "NSE", indices: N50, sector: "Automobile", marketCap: "LARGE" },
  { company: "Asian Paints", ticker: "ASIANPAINT", isin: "INE021A01026", eventType: "EARNINGS", subtype: "Q1 FY27 Results", offset: 12, status: "TENTATIVE", exchange: "NSE", indices: N50, sector: "Consumer", marketCap: "LARGE" },
  { company: "Raymond", ticker: "RAYMOND", isin: "INE301A01014", eventType: "DEMERGER", subtype: "Raymond Realty demerger — record date", offset: 13, status: "TENTATIVE", exchange: "BSE", indices: N500, sector: "Textiles", marketCap: "MID" },
  { company: "Bajaj Finance", ticker: "BAJFINANCE", isin: "INE296A01024", eventType: "EARNINGS", subtype: "Q1 FY27 Results", offset: 15, status: "CONFIRMED", exchange: "NSE", indices: N50, sector: "NBFC", marketCap: "LARGE" },
  { company: "Sun Pharmaceutical", ticker: "SUNPHARMA", isin: "INE044A01036", eventType: "EARNINGS", subtype: "Q1 FY27 Results", offset: 17, status: "TENTATIVE", exchange: "NSE", indices: N50, sector: "Pharma", marketCap: "LARGE" },
  { company: "Tata Motors", ticker: "TATAMOTORS", isin: "INE155A01022", eventType: "EARNINGS", subtype: "Q1 FY27 Results", offset: 20, status: "TENTATIVE", exchange: "NSE", indices: N50, sector: "Automobile", marketCap: "LARGE" },
  { company: "Tata Motors", ticker: "TATAMOTORS", isin: "INE155A01022", eventType: "CONCALL", subtype: "Analyst Concall", offset: 21, time: "18:30", status: "TENTATIVE", exchange: "NSE", indices: N50, sector: "Automobile", marketCap: "LARGE" },
  { company: "Wipro", ticker: "WIPRO", isin: "INE075A01022", eventType: "EARNINGS", subtype: "Q1 FY27 Results", offset: 22, status: "CONFIRMED", exchange: "NSE", indices: N500, sector: "IT", marketCap: "LARGE" },
  { company: "Persistent Systems", ticker: "PERSISTENT", isin: "INE262H01021", eventType: "CONCALL", subtype: "Earnings Call", offset: 24, time: "17:00", status: "CONFIRMED", exchange: "NSE", indices: N500, sector: "IT", marketCap: "MID" },
  { company: "Siemens", ticker: "SIEMENS", isin: "INE003A01024", eventType: "DEMERGER", subtype: "Siemens Energy India demerger — record date", offset: 28, status: "CONFIRMED", exchange: "NSE", indices: N500, sector: "Capital Goods", marketCap: "LARGE" },
  { company: "Nestle India", ticker: "NESTLEIND", isin: "INE239A01024", eventType: "EARNINGS", subtype: "Q2 FY27 Results", offset: 33, status: "TENTATIVE", exchange: "NSE", indices: N50, sector: "FMCG", marketCap: "LARGE" },
  { company: "Titan Company", ticker: "TITAN", isin: "INE280A01028", eventType: "EARNINGS", subtype: "Q2 FY27 Results", offset: 40, status: "TENTATIVE", exchange: "NSE", indices: N50, sector: "Consumer", marketCap: "LARGE" },
  { company: "Adani Enterprises", ticker: "ADANIENT", isin: "INE423A01024", eventType: "EARNINGS", subtype: "Q2 FY27 Results", offset: 52, status: "TENTATIVE", exchange: "NSE", indices: N50, sector: "Conglomerate", marketCap: "LARGE" },
  { company: "UltraTech Cement", ticker: "ULTRACEMCO", isin: "INE481G01011", eventType: "EARNINGS", subtype: "Q2 FY27 Results", offset: 60, status: "REVISED", exchange: "NSE", indices: N50, sector: "Cement", marketCap: "LARGE" },
];

function sourceFor(type: EventType): string {
  if (type === "CONCALL") return NSE_ANN;
  if (type === "DEMERGER") return NSE_CA;
  return NSE_BM;
}

export function buildSampleEvents(): CorporateEvent[] {
  const base = todayStart();
  // Concalls are surfaced separately (they lack structured dates), not on the timeline.
  return SEEDS.filter((s) => s.eventType !== "CONCALL").map((s) => {
    const date = toISO(addDays(base, s.offset));
    const event: CorporateEvent = {
      id: `${s.ticker}_${s.eventType}_${date}`,
      company: s.company,
      ticker: s.ticker,
      eventType: s.eventType,
      subtype: s.subtype,
      date,
      status: s.status,
      exchange: s.exchange,
      indices: s.indices,
      sector: s.sector,
      sourceUrl: sourceFor(s.eventType),
    };
    if (s.isin) event.isin = s.isin;
    if (s.time) event.time = s.time;
    if (s.marketCap) event.marketCap = s.marketCap;
    return event;
  });
}

const SAMPLE_CONCALLS: Array<{ company: string; ticker: string; summary: string; offset: number; exchange: Exchange }> = [
  { company: "Tata Consultancy Services", ticker: "TCS", summary: "Earnings Conference Call", offset: 0, exchange: "NSE" },
  { company: "Infosys", ticker: "INFY", summary: "Investor & Analyst Conference Call", offset: 0, exchange: "NSE" },
  { company: "HDFC Bank", ticker: "HDFCBANK", summary: "Schedule of Analyst / Investor Meet", offset: 0, exchange: "BSE" },
  { company: "Reliance Industries", ticker: "RELIANCE", summary: "Earnings Call intimation", offset: -1, exchange: "NSE" },
  { company: "Maruti Suzuki India", ticker: "MARUTI", summary: "Investor Conference Call", offset: -1, exchange: "NSE" },
  { company: "Persistent Systems", ticker: "PERSISTENT", summary: "Q1 FY27 Earnings Call", offset: -2, exchange: "BSE" },
];

export function buildSampleConcalls(): ConcallItem[] {
  const base = todayStart();
  return SAMPLE_CONCALLS.map((c, i) => ({
    id: `sample_concall_${i}`,
    company: c.company,
    ticker: c.ticker,
    summary: c.summary,
    filedDate: toISO(addDays(base, c.offset)),
    exchange: c.exchange,
    sourceUrl: c.exchange === "NSE" ? NSE_ANN : "https://www.bseindia.com/corporates/ann.html",
  }));
}
