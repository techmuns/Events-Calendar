// Small date utilities. All calendar math is done at local midnight so that
// day-bucketing and "days from today" are stable regardless of clock time.

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function todayStart(): Date {
  return startOfDay(new Date());
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const c = startOfDay(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function diffDays(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDate(iso: string): string {
  const d = parseISO(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatMonthYear(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export type Bucket = "Today" | "This week" | "Next week" | "Later";

export function bucketFor(eventISO: string, today: Date): Bucket {
  const d = parseISO(eventISO);
  const diff = diffDays(today, d);
  if (diff === 0) return "Today";
  const dow = today.getDay(); // 0 Sun .. 6 Sat
  const daysToSunday = (7 - dow) % 7;
  const thisWeekEnd = addDays(today, daysToSunday);
  if (d.getTime() <= thisWeekEnd.getTime()) return "This week";
  const nextWeekEnd = addDays(thisWeekEnd, 7);
  if (d.getTime() <= nextWeekEnd.getTime()) return "Next week";
  return "Later";
}

// A 6x7 matrix of dates for the given month, weeks starting on Monday.
export function buildMonthMatrix(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const firstDow = (first.getDay() + 6) % 7; // Monday = 0
  const gridStart = addDays(first, -firstDow);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(addDays(gridStart, w * 7 + d));
    }
    weeks.push(row);
  }
  return weeks;
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
