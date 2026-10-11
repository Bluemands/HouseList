const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const gbpPrecise = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** £1,240 — pence only when there are any. */
export function formatGBP(value: number): string {
  return Number.isInteger(Math.round(value * 100) / 100) ? gbp.format(value) : gbpPrecise.format(value);
}

/** £1.2k style for tight spots (swatch cards). */
export function formatGBPShort(value: number): string {
  if (Math.abs(value) >= 10_000) return `£${Math.round(value / 1000)}k`;
  if (Math.abs(value) >= 1_000) return `£${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return gbp.format(value);
}

export function formatCost(low: number | null, high: number | null): string | null {
  if (low == null && high == null) return null;
  if (low != null && high != null && high > low) return `${formatGBP(low)}–${formatGBP(high).slice(1)}`;
  return formatGBP((low ?? high)!);
}

// ---- Calendar days. Due dates are plain YYYY-MM-DD strings in local time. ----

export function toDayString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The household's calendar, wherever this runs: the server is on UTC, where
// the first hour of a British summer day is still yesterday.
const ukDay = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function today(): string {
  // From the parts, not the formatted string, whose layout varies by browser.
  const part = Object.fromEntries(ukDay.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${part.year}-${part.month}-${part.day}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return toDayString(new Date(y, m - 1, d + n));
}

/** "Mar 2028", for dates far enough off that the day doesn't matter. */
export function formatMonthYear(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(`${day}T00:00:00`));
}

/** The same calendar day n years on (29 Feb lands on 28 Feb). */
export function addYears(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const last = new Date(y + n, m, 0).getDate();
  return toDayString(new Date(y + n, m - 1, Math.min(d, last)));
}

export function dayDiff(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const dayMonthYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const monthShort = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" });

function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export type DueTone = "overdue" | "soon" | "later";

/** "Overdue 3d", "Today", "Tomorrow", "Fri", "12 Oct". */
export function describeDue(day: string, now = today()): { label: string; tone: DueTone } {
  const diff = dayDiff(now, day);
  if (diff < 0) return { label: diff === -1 ? "Yesterday" : `${-diff} days late`, tone: "overdue" };
  if (diff === 0) return { label: "Today", tone: "soon" };
  if (diff === 1) return { label: "Tomorrow", tone: "soon" };
  if (diff < 7) return { label: weekday.format(parseDay(day)), tone: "soon" };
  const sameYear = day.slice(0, 4) === now.slice(0, 4);
  return { label: (sameYear ? dayMonth : dayMonthYear).format(parseDay(day)), tone: "later" };
}

/** "today", "yesterday", "on 1 Oct" — for things that already happened. */
export function describeDay(day: string, now = today()): string {
  const diff = dayDiff(day, now);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  return `on ${(day.slice(0, 4) === now.slice(0, 4) ? dayMonth : dayMonthYear).format(parseDay(day))}`;
}

export function formatDay(day: string): string {
  return dayMonthYear.format(parseDay(day));
}

export function formatMonth(monthsFromNow: number, long = true): string {
  const [y, m] = today().split("-").map(Number);
  const d = new Date(y, m - 1 + monthsFromNow, 1);
  return (long ? monthYear : monthShort).format(d);
}

/** "just now", "3h ago", "2d ago", "12 Sep". */
export function timeAgo(iso: string): string {
  const then = new Date(iso);
  const mins = Math.round((Date.now() - then.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return dayMonth.format(then);
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Late one";
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

/** A link as typed ("screwfix.com/…") made into a full URL; null if blank. */
export function normaliseLink(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Whether a (normalised) link is a real web address the server will take. */
export function isWebLink(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".") && !/\s/.test(url);
  } catch {
    return false;
  }
}

/** The short name to show for a link: its site, without "www.". */
export function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
