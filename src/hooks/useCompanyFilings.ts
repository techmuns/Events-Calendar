import { useEffect, useState } from "react";
import type { CompanyFiling } from "../types";
import { getCompanyFilings } from "../data/provider";

interface State {
  filings: CompanyFiling[];
  loading: boolean;
  error: boolean;
}

// Loads a company's recent segregated filings when the opened ticker changes.
// Empty/unreachable results resolve quietly (the Details tab just omits the
// filings section) so a company with no NSE symbol never shows an error.
export function useCompanyFilings(ticker: string | null): State {
  const [state, setState] = useState<State>({ filings: [], loading: false, error: false });

  useEffect(() => {
    if (!ticker) {
      setState({ filings: [], loading: false, error: false });
      return;
    }
    let cancelled = false;
    setState({ filings: [], loading: true, error: false });
    getCompanyFilings(ticker)
      .then((r) => {
        if (!cancelled) setState({ filings: r.filings, loading: false, error: r.ok === false });
      })
      .catch(() => {
        if (!cancelled) setState({ filings: [], loading: false, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return state;
}
