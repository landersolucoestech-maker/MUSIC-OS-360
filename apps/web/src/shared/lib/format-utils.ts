// Utility functions for formatting - replaces functions from data-store.tsx

import { SYSTEM_REGIONAL_SETTINGS } from "./system-regional-settings";

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "R$ 0,00";
  const amount = Number(value);
  const formatted = new Intl.NumberFormat(SYSTEM_REGIONAL_SETTINGS.locale, {
    style: "currency",
    currency: SYSTEM_REGIONAL_SETTINGS.currency,
  }).format(Math.abs(amount));
  if (amount < 0) return `-${formatted}`;
  return formatted;
}

export function getCurrencyToneClass(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  if (amount > 0) return "text-green-600";
  if (amount < 0) return "text-destructive";
  return "text-muted-foreground";
}

export type MonetarySemantic = "positive" | "negative" | "neutral";

export function getMonetarySemanticClass(semantic: MonetarySemantic): string {
  if (semantic === "positive") return "text-green-600";
  if (semantic === "negative") return "text-destructive";
  return "text-muted-foreground";
}

function toDate(date: unknown): Date | null {
  if (!date) return null;
  if (date instanceof Date) return isNaN(date.getTime()) ? null : date;
  if (typeof date === "string") {
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof date === "number") {
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatDate(date: string | Date | null | undefined): string {
  const d = toDate(date);
  if (!d) return "-";
  return new Intl.DateTimeFormat(SYSTEM_REGIONAL_SETTINGS.locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: SYSTEM_REGIONAL_SETTINGS.timezone,
  }).format(d);
}

/**
 * Calendar day ("YYYY-MM-DD") of a value that represents a date, not an instant
 * — e.g. a `timestamp` column holding midnight serialized as UTC ISO
 * ("2026-09-01T00:00:00.000Z"). Taking the prefix avoids the timezone shift
 * that would show the previous day in America/Sao_Paulo. "" when absent/invalid.
 */
export function calendarDay(value: unknown): string {
  const text = value instanceof Date ? (isNaN(value.getTime()) ? "" : value.toISOString()) : String(value ?? "");
  const day = text.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}

/** Today's calendar day (YYYY-MM-DD) in the system timezone (not the browser's, not UTC). */
export function todayCalendarDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: SYSTEM_REGIONAL_SETTINGS.timezone,
  }).format(now);
}

/** Offset (ms) of the system timezone from UTC at instant `at` (e.g. -3h for America/Sao_Paulo). */
function systemTimezoneOffsetMs(at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: SYSTEM_REGIONAL_SETTINGS.timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(at).map((part) => [part.type, part.value]),
  );
  const wallClockAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return wallClockAsUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The first instant of a calendar day (YYYY-MM-DD) in the system timezone:
 * 00:00, or the first existing time when a DST change skips midnight (e.g.
 * 01:00 on the historical America/Sao_Paulo spring-forward days).
 */
export function startOfCalendarDayInSystemTimezone(day: string): Date {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  const midnightUtc = Date.UTC(year, month - 1, dayOfMonth);
  const firstGuess = midnightUtc - systemTimezoneOffsetMs(new Date(midnightUtc));
  // Second pass: the offset at the real instant (differs across a DST change).
  let start = midnightUtc - systemTimezoneOffsetMs(new Date(firstGuess));
  // Midnight skipped by DST: the guess lands on the previous day — move to the first instant of `day`.
  for (let hops = 0; hops < 3 && todayCalendarDay(new Date(start)) < day; hops += 1) start += 3_600_000;
  return new Date(start);
}

/** First and last instant of today and of the current month, in the system timezone. */
export function systemTimezoneDayAndMonthBounds(now: Date = new Date()): {
  dayStart: Date; dayEnd: Date; monthStart: Date; monthEnd: Date;
} {
  const today = todayCalendarDay(now);
  const [year, month, dayOfMonth] = today.split("-").map(Number);
  const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
  const before = (day: string) => new Date(startOfCalendarDayInSystemTimezone(day).getTime() - 1);
  return {
    dayStart: startOfCalendarDayInSystemTimezone(today),
    dayEnd: before(iso(year, month, dayOfMonth + 1)),
    monthStart: startOfCalendarDayInSystemTimezone(iso(year, month, 1)),
    monthEnd: before(iso(year, month + 1, 1)),
  };
}

/** Whole days from calendar day `from` to calendar day `to` (negative when `to` is earlier); NaN when either is not a calendar day. */
export function calendarDaysBetween(from: unknown, to: unknown): number {
  const start = calendarDay(from);
  const end = calendarDay(to);
  if (!start || !end) return Number.NaN;
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

/** DD/MM/AAAA of a calendar day (see calendarDay) without timezone conversion; "-" when absent. */
export function formatCalendarDate(value: unknown): string {
  const day = calendarDay(value);
  if (!day) return "-";
  const [year, month, dayOfMonth] = day.split("-");
  return `${dayOfMonth}/${month}/${year}`;
}

/**
 * DD/MM/AAAA of a calendar-day field for display: `empty` when the value is
 * absent, "Data inválida" when a value is present but is not a real calendar
 * day (never the English "Invalid Date" nor a timezone-shifted day).
 */
export function formatCalendarDateLabel(value: unknown, empty = "-"): string {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return empty;
  const day = calendarDay(value);
  if (!day) return "Data inválida";
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, dayOfMonth));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== dayOfMonth) {
    return "Data inválida";
  }
  return formatCalendarDate(day);
}

/** HH:MM (24h) of an instant in the system timezone; "-" when absent/invalid. */
export function formatTime(date: string | Date | null | undefined): string {
  const d = toDate(date);
  if (!d) return "-";
  return new Intl.DateTimeFormat(SYSTEM_REGIONAL_SETTINGS.locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: SYSTEM_REGIONAL_SETTINGS.timezone,
  }).format(d);
}

export function formatDateTime(date: string | Date | null | undefined): string {
  const d = toDate(date);
  if (!d) return "-";
  return new Intl.DateTimeFormat(SYSTEM_REGIONAL_SETTINGS.locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: SYSTEM_REGIONAL_SETTINGS.timezone,
  }).format(d);
}

/** Date in DD/MM/YYYY format. Returns "—" when empty. */
export function formatDateDashes(date: string | Date | null | undefined): string {
  const d = toDate(date);
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Date and time in the DD/MM/YYYY HH:mm format. Returns "—" when empty. */
export function formatDateTimeDashes(date: string | Date | null | undefined): string {
  const d = toDate(date);
  if (!d) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${formatDateDashes(d)} ${hh}:${mi}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "0%";
  return `${value.toFixed(1)}%`;
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}
