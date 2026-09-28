import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatCalendarDateLabel } from "./format-utils";

// The shift bug only shows west of UTC: pin the product's regional timezone.
const originalTz = process.env.TZ;
beforeAll(() => { process.env.TZ = "America/Sao_Paulo"; });
afterAll(() => { process.env.TZ = originalTz; });

describe("formatCalendarDateLabel (calendar days in America/Sao_Paulo)", () => {
  it("runs in a timezone where an instant-based format would shift the day", () => {
    expect(new Date("2026-09-01T00:00:00.000Z").toLocaleDateString("pt-BR")).toBe("31/08/2026");
  });

  it("keeps the stored day for UTC-midnight timestamps and plain dates", () => {
    expect(formatCalendarDateLabel("2026-09-01T00:00:00.000Z")).toBe("01/09/2026");
    expect(formatCalendarDateLabel("2026-10-05")).toBe("05/10/2026");
    expect(formatCalendarDateLabel("2026-01-01T00:00:00.000Z")).toBe("01/01/2026");
  });

  it("uses the caller's empty placeholder for absent values", () => {
    expect(formatCalendarDateLabel(null)).toBe("-");
    expect(formatCalendarDateLabel(undefined, "—")).toBe("—");
    expect(formatCalendarDateLabel("  ", "—")).toBe("—");
  });

  it("shows 'Data inválida' (never 'Invalid Date') for malformed or impossible days", () => {
    expect(formatCalendarDateLabel("not a date")).toBe("Data inválida");
    expect(formatCalendarDateLabel("05/10/2026")).toBe("Data inválida");
    expect(formatCalendarDateLabel("2026-13-45")).toBe("Data inválida");
    expect(formatCalendarDateLabel("2026-02-30")).toBe("Data inválida");
    expect(formatCalendarDateLabel(new Date(Number.NaN))).toBe("Data inválida");
  });
});
