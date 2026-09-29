import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calendarDay, formatCalendarDate } from "./format-utils";
import { transactionToFormFields } from "@/modules/accounting/services/entity-to-form.mapper";

describe("calendar-day dates (timestamp midnight serialized as UTC)", () => {
  it("keeps the stored day instead of shifting to the previous day", () => {
    expect(calendarDay("2026-09-01T00:00:00.000Z")).toBe("2026-09-01");
    expect(formatCalendarDate("2026-09-01T00:00:00.000Z")).toBe("01/09/2026");
    expect(formatCalendarDate("2026-09-01")).toBe("01/09/2026");
  });

  it("returns empty/dash for absent or invalid values", () => {
    expect(calendarDay(null)).toBe("");
    expect(calendarDay("not a date")).toBe("");
    expect(formatCalendarDate(undefined)).toBe("-");
  });

  it("hydrates the edit form with the stored calendar day", () => {
    const form = transactionToFormFields({ transaction_date: "2026-09-01T00:00:00.000Z", first_installment_date: "2026-10-05" });
    expect(form.transactionDate).toBe("2026-09-01");
    expect(form.firstInstallmentDate).toBe("2026-10-05");
  });
});

describe("systemTimezoneDayAndMonthBounds (system timezone, whatever the browser timezone)", () => {
  // Browser in UTC, system timezone America/Sao_Paulo: a regression to browser-local bounds fails here.
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "UTC";
  });
  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it("a day whose midnight was skipped by DST starts at its first existing instant", async () => {
    const { startOfCalendarDayInSystemTimezone } = await import("./format-utils");
    // 2018-11-04: America/Sao_Paulo jumped from 00:00 (-03) to 01:00 (-02).
    expect(startOfCalendarDayInSystemTimezone("2018-11-04").toISOString()).toBe("2018-11-04T03:00:00.000Z");
    expect(startOfCalendarDayInSystemTimezone("2018-11-05").toISOString()).toBe("2018-11-05T02:00:00.000Z");
  });

  it("today and this month start/end at 00:00 / 23:59:59.999 in America/Sao_Paulo", async () => {
    const { systemTimezoneDayAndMonthBounds } = await import("./format-utils");
    // 2030-10-11T01:00Z is still 2030-10-10 22:00 in America/Sao_Paulo.
    const bounds = systemTimezoneDayAndMonthBounds(new Date("2030-10-11T01:00:00.000Z"));
    expect(bounds.dayStart.toISOString()).toBe("2030-10-10T03:00:00.000Z");
    expect(bounds.dayEnd.toISOString()).toBe("2030-10-11T02:59:59.999Z");
    expect(bounds.monthStart.toISOString()).toBe("2030-10-01T03:00:00.000Z");
    expect(bounds.monthEnd.toISOString()).toBe("2030-11-01T02:59:59.999Z");
  });

  it("December rolls over to the next year", async () => {
    const { systemTimezoneDayAndMonthBounds } = await import("./format-utils");
    const bounds = systemTimezoneDayAndMonthBounds(new Date("2030-12-31T12:00:00.000Z"));
    expect(bounds.dayEnd.toISOString()).toBe("2031-01-01T02:59:59.999Z");
    expect(bounds.monthEnd.toISOString()).toBe("2031-01-01T02:59:59.999Z");
  });
});
