/** Formatting helpers — Berlin timezone, German locale, EUR. */

const dateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Berlin",
});

const dateTimeFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

const timeFmt = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

const eurFmt = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const numFmt = new Intl.NumberFormat("de-DE");

type DateInput = string | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: DateInput): string {
  const d = toDate(value);
  return d ? dateFmt.format(d) : "—";
}

export function formatDateTime(value: DateInput): string {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : "—";
}

export function formatTime(value: DateInput): string {
  const d = toDate(value);
  return d ? timeFmt.format(d) : "—";
}

export function formatEuroCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return eurFmt.format(cents / 100);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return numFmt.format(value);
}

export function formatRelative(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  if (days < 7) return `vor ${days} Tg.`;
  return dateFmt.format(d);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/**
 * Parse a datetime-local input string ("2026-08-11T14:30") as Europe/Berlin
 * wall time, independent of the server's timezone (Vercel runs UTC).
 */
export function parseBerlinLocal(value: string): Date {
  const utcGuess = new Date(`${value}:00Z`.replace(/:00:00Z$/, ":00Z"));
  if (Number.isNaN(utcGuess.getTime())) return utcGuess;
  // Offset of Berlin at that moment (60 or 120 min)
  const berlinString = utcGuess.toLocaleString("en-US", { timeZone: "Europe/Berlin" });
  const offsetMs = new Date(berlinString + " UTC").getTime() - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}
