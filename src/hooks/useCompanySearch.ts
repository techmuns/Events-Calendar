import { useEffect, useState } from "react";
import type { CompanyMatch } from "../types";
import { getCompanySearch } from "../data/provider";

// Debounced free-text company search (any listed firm), so a company with no
// upcoming event still turns up and can be opened for its past filings.
export function useCompanySearch(query: string): { results: CompanyMatch[]; loading: boolean } {
  const [state, setState] = useState<{ results: CompanyMatch[]; loading: boolean }>({ results: [], loading: false });

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setState({ results: [], loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ results: s.results, loading: true }));
    const t = setTimeout(() => {
      getCompanySearch(q).then((results) => {
        if (!cancelled) setState({ results, loading: false });
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return state;
}
