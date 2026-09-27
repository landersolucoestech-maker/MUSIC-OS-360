/**
 * events.data/end_date are full timestamps (date + time) — there are no
 * separate time columns. For spreadsheet export/import (more readable
 * as two columns), splits date (YYYY-MM-DD) and time (HH:mm) from a
 * Date/ISO string; and the inverse, recombines both columns back into a
 * single ISO datetime to send to the backend.
 */
export const splitDateTime = (value: unknown): { date: string; time: string } => {
  if (!value) return { date: "", time: "" };
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
};

export const combineDateTime = (date: unknown, time: unknown): string | undefined => {
  if (!date) return undefined;
  const timeStr = typeof time === "string" && time.trim() ? time.trim() : "00:00";
  const parsed = new Date(`${String(date).trim()}T${timeStr}:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};
