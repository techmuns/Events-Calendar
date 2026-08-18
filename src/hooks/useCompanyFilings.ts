import { useEffect, useState } from "react";
import type { CompanyFiling } from "../types";
import { getCompanyFilings } from "../data/provider";

interface State {
  filings: CompanyFiling[];
  source: string; // provenance label, e.g. "BSE · NSE · Screener"
  resultsUrl?: string; // the company's latest actual results document (PDF)
  loading: boolean;
  error: boolean;
}

// Loads a company's segregated filings (NSE + Screener + BSE-hosted docs) when
// the opened company changes. Empty/unreachable results resolve quietly so a
// company with no filings never shows an error.
export function useCompanyFilings(ticker: string | null, name = ""): State {
  const [state, setState] = useState<State>({ filings: [], source: "", loading: false, error: false });

  useEffect(() => {
    if (!ticker && !name) {
      setState({ filings: [], source: "", loading: false, error: false });
      return;
    }
    let cancelled = false;
    setState({ filings: [], source: "", loading: true, error: false });
    getCompanyFilings(ticker ?? "", name)
      .then((r) => {
        if (!cancelled) setState({ filings: r.filings, source: r.source ?? "", resultsUrl: r.resultsUrl, loading: false, error: r.ok === false });
      })
      .catch(() => {
        if (!cancelled) setState({ filings: [], source: "", loading: false, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, name]);

  return state;
}
