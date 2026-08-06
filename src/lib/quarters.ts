// Indian fiscal quarters (FY runs Apr→Mar). We key a results-quarter by its
// quarter-END (calendar year + end-month: 3=Mar, 6=Jun, 9=Sep, 12=Dec). This
// lets us map an earnings call — which Screener labels by the month the *call*
// was held, a month or two after the quarter closed — onto the quarter it
// actually discusses, and detect quarters where no call was held.

export interface Quarter {
  key: string; // "2026-06" — zero-padded so it sorts chronologically
  label: string; // "Q1 FY27"
  endY: number;
  endM: 3 | 6 | 9 | 12;
}

// Build a quarter from its closing month. Indian FY27 = Apr 2026 → Mar 2027, so
// the quarter ending Jun 2026 is Q1 FY27, and the one ending Mar 2026 is Q4 FY26.
export function quarterFromEnd(endY: number, endM: 3 | 6 | 9 | 12): Quarter {
  let qNum: number;
  let fy: number;
  if (endM === 3) {
    qNum = 4;
    fy = endY;
  } else if (endM === 6) {
    qNum = 1;
    fy = endY + 1;
  } else if (endM === 9) {
    qNum = 2;
    fy = endY + 1;
  } else {
    qNum = 3;
    fy = endY + 1;
  }
  return {
    key: `${endY}-${String(endM).padStart(2, "0")}`,
    label: `Q${qNum} FY${String(fy % 100).padStart(2, "0")}`,
    endY,
    endM,
  };
}

// A call held in month `callM` (1-12) reports the quarter that closed just
// before it: Apr–Jun→Mar-end, Jul–Sep→Jun-end, Oct–Dec→Sep-end, and Jan–Mar
// closes out December of the *previous* calendar year.
export function callMonthToQuarter(callY: number, callM: number): Quarter {
  if (callM >= 4 && callM <= 6) return quarterFromEnd(callY, 3);
  if (callM >= 7 && callM <= 9) return quarterFromEnd(callY, 6);
  if (callM >= 10 && callM <= 12) return quarterFromEnd(callY, 9);
  return quarterFromEnd(callY - 1, 12); // Jan–Mar
}

// One quarter back from a given quarter-end.
export function prevQuarterEnd(endY: number, endM: 3 | 6 | 9 | 12): { endY: number; endM: 3 | 6 | 9 | 12 } {
  return endM === 3 ? { endY: endY - 1, endM: 12 } : { endY, endM: (endM - 3) as 3 | 6 | 9 | 12 };
}

// The `n` most recent quarters ending at (topEndY, topEndM), newest first.
export function lastNQuarters(topEndY: number, topEndM: 3 | 6 | 9 | 12, n: number): Quarter[] {
  const out: Quarter[] = [];
  let y = topEndY;
  let m: 3 | 6 | 9 | 12 = topEndM;
  for (let i = 0; i < n; i++) {
    out.push(quarterFromEnd(y, m));
    const p = prevQuarterEnd(y, m);
    y = p.endY;
    m = p.endM;
  }
  return out;
}

// Chronological rank for picking the newest of two quarters.
export function quarterRank(q: { endY: number; endM: number }): number {
  return q.endY * 12 + q.endM;
}
