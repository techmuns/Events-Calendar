import { useCallback, useEffect, useState } from "react";
import type { EventsResult } from "../types";
import { eventsProvider } from "../data/provider";

interface State {
  result: EventsResult | null;
  loading: boolean;
  error: string | null;
}

export function useEvents() {
  const [state, setState] = useState<State>({ result: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await eventsProvider.getEvents();
      setState({ result, loading: false, error: null });
    } catch (e) {
      setState({
        result: null,
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load events",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}
