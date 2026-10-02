import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAYMENT_FREQUENCY,
  LEGACY_PAYMENT_FREQUENCIES,
  PAYMENT_FREQUENCIES,
  normalizePaymentFrequency,
} from "./contract-service-type-vocabulary";

// [stored value, canonical id]
const FREQUENCY_CASES: ReadonlyArray<readonly [string, string]> = [
  ["anual", "yearly"],
  ["mensal", "monthly"],
  ["yearly", "yearly"],
  ["monthly", "monthly"],
];

describe("payment frequency legacy read-compat (legacy in, canonical out)", () => {
  it.each(FREQUENCY_CASES)("reads %s as %s", (stored, canonical) => {
    expect(normalizePaymentFrequency(stored)).toBe(canonical);
    expect(PAYMENT_FREQUENCIES as readonly string[]).toContain(canonical);
  });

  it("never maps onto a legacy id and defaults only when nothing is stored", () => {
    for (const target of Object.values(LEGACY_PAYMENT_FREQUENCIES)) {
      expect(PAYMENT_FREQUENCIES as readonly string[]).toContain(target);
    }
    expect(normalizePaymentFrequency("")).toBe(DEFAULT_PAYMENT_FREQUENCY);
    expect(normalizePaymentFrequency(undefined)).toBe(DEFAULT_PAYMENT_FREQUENCY);
    expect(normalizePaymentFrequency("semestral")).toBe("semestral");
  });
});
