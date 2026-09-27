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
