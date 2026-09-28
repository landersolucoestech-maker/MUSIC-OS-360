import { describe, expect, it } from "vitest";
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
