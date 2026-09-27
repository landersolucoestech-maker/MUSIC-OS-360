/**
 * date-time.test.ts
 *
 * Task S — permanent guard: the Agenda calendar read `evento.start_date`
 * (a field that never existed in the backend — the real column is `data`, a full
 * timestamp) to build each event, so EVERY event fell into the
 * "now" fallback and always showed on the wrong date, for any tenant. splitDateTime/
 * combineDateTime are the two conversions that replace that wrong read
 * (export: real timestamp → spreadsheet columns; import: spreadsheet columns
 * → real timestamp for the DTO payload).
 */
import { describe, it, expect } from "vitest";
import { splitDateTime, combineDateTime } from "./date-time";

describe("splitDateTime", () => {
  it("splits a real ISO datetime into date (YYYY-MM-DD) and time (HH:mm)", () => {
    expect(splitDateTime("2026-08-20T14:30:00.000Z")).toEqual(
      (() => {
        const d = new Date("2026-08-20T14:30:00.000Z");
        return {
          date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
          time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
        };
      })(),
    );
  });

  it("aceita um objeto Date diretamente", () => {
    const result = splitDateTime(new Date(2026, 7, 20, 9, 5));
    expect(result).toEqual({ date: "2026-08-20", time: "09:05" });
  });

  it("returns empty for a null/absent/invalid value — never throws", () => {
    expect(splitDateTime(null)).toEqual({ date: "", time: "" });
    expect(splitDateTime(undefined)).toEqual({ date: "", time: "" });
    expect(splitDateTime("não é uma data")).toEqual({ date: "", time: "" });
  });
});

describe("combineDateTime", () => {
  it("combines date + time into a valid ISO datetime for the backend", () => {
    const iso = combineDateTime("2026-08-20", "14:30");
    expect(iso).toBeDefined();
    const d = new Date(iso!);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(20);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  it("uses 00:00 when no time is given", () => {
    const iso = combineDateTime("2026-08-20", null);
    const d = new Date(iso!);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("returns undefined without a date (does not invent an event without a real date)", () => {
    expect(combineDateTime(null, "14:30")).toBeUndefined();
    expect(combineDateTime(undefined, "14:30")).toBeUndefined();
    expect(combineDateTime("", "14:30")).toBeUndefined();
  });

  it("returns undefined for a combination that does not form a valid date", () => {
    expect(combineDateTime("não é uma data", "14:30")).toBeUndefined();
  });
});
