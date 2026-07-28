// Reads Munshot host context (session + selected ticker) when the dashboard is
// embedded in the Munshot platform. Degrades safely to nulls when running
// standalone (e.g. opened directly on the Cloudflare URL), so the app works in
// both places.

import { useEffect, useState } from "react";

interface Session {
  token: string | null;
  userName: string | null;
  orgName: string | null;
}

export interface HostContext {
  session: Session;
  ticker: string | null;
  tickerCompany: string | null;
  embedded: boolean;
}

const EMPTY: HostContext = {
  session: { token: null, userName: null, orgName: null },
  ticker: null,
  tickerCompany: null,
  embedded: false,
};

function readContext(): HostContext {
  const sdk = (window as unknown as { munshotDashboard?: { getContext?: () => unknown } })
    .munshotDashboard;
  if (!sdk || typeof sdk.getContext !== "function") return EMPTY;
  try {
    const ctx = sdk.getContext() as
      | {
          session?: { token?: string; userName?: string; orgName?: string };
          market?: { selectedTicker?: string; selectedTickerCompany?: string };
        }
      | undefined;
    if (!ctx) return EMPTY;
    return {
      session: {
        token: ctx.session?.token ?? null,
        userName: ctx.session?.userName ?? null,
        orgName: ctx.session?.orgName ?? null,
      },
      ticker: ctx.market?.selectedTicker ?? null,
      tickerCompany: ctx.market?.selectedTickerCompany ?? null,
      embedded: true,
    };
  } catch {
    return EMPTY;
  }
}

export function useHostContext(): HostContext {
  const [ctx, setCtx] = useState<HostContext>(readContext);
  useEffect(() => {
    const sdk = (
      window as unknown as { munshotDashboard?: { onMessage?: (cb: () => void) => () => void } }
    ).munshotDashboard;
    setCtx(readContext());
    if (sdk && typeof sdk.onMessage === "function") {
      return sdk.onMessage(() => setCtx(readContext()));
    }
    return undefined;
  }, []);
  return ctx;
}
