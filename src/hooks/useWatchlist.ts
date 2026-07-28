import { useCallback, useEffect, useMemo, useState } from "react";

const KEY = "ec-watchlist";
// Seed a few well-known names on first run so the Watchlist filter isn't empty.
const SEED = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ITC"];

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* ignore */
  }
  return SEED;
}

export function useWatchlist() {
  const [tickers, setTickers] = useState<string[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(tickers));
    } catch {
      /* ignore */
    }
  }, [tickers]);

  const set = useMemo(() => new Set(tickers), [tickers]);
  const has = useCallback((t: string) => set.has(t), [set]);
  const toggle = useCallback(
    (t: string) =>
      setTickers((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t])),
    [],
  );

  return { tickers, set, has, toggle, count: tickers.length };
}
