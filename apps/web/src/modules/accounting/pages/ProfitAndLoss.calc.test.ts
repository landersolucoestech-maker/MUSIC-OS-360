import { describe, it, expect } from "vitest";
import { toNumber, sum } from "./profit-and-loss-calc";

/**
 * Regression: GET /transactions returns `valor` as a STRING (Postgres NUMERIC
 * without a transform — unlike /transactions/stats, which aggregates via
 * `SUM(t.valor::numeric)` in SQL). Adding strings with `+` concatenates
 * instead of summing ("0" + "500.00" = "0500.00"), and the chain of concatenations becomes
 * a string with multiple decimal points that `Number()` cannot
 * parse — hence the "R$ NaN" in total expense / net profit in ProfitAndLoss.
 */
describe("toNumber", () => {
  it("normalizes a numeric string (the format the API actually sends)", () => {
    expect(toNumber("500.00")).toBe(500);
    expect(toNumber("10")).toBe(10);
  });

  it("keeps a valid number unchanged", () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(0)).toBe(0);
  });

  it("normalizes invalid values to 0 explicitly (never propagates NaN)", () => {
    expect(toNumber("não é número")).toBe(0);
    expect(toNumber(Number.NaN)).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("")).toBe(0);
  });
});

describe("sum — reproduces and proves the fix for the ProfitAndLoss bug", () => {
  it("reproduces the bug: a naive reduce over strings produces a value that becomes NaN", () => {
    // `any` on purpose: reproduces exactly how `transactions` arrives from the API
    // (useTransactions() does not type `valor` as number — it arrives as a string).
    const expenses: any[] = [{ valor: "500.00" }, { valor: "100.00" }, { valor: "10.00" }];
    const naiveSum = expenses.reduce((s, t) => s + (t.valor ?? 0), 0);
    // String concatenation produces "0500.00100.0010.00" — multiple decimal
    // points — which Number() cannot parse.
    expect(typeof naiveSum).toBe("string");
    expect(Number(naiveSum)).toBeNaN();
  });

  it("correctly sums transactions with string amounts (the real API payload)", () => {
    const expenses = [{ valor: "500.00" }, { valor: "100.00" }, { valor: "10.00" }];
    expect(sum(expenses, "valor")).toBe(610);
  });

  it("the total matches exactly the sum of the rows shown per category", () => {
    const expenses = [
      { categoria: "Equipamentos Task X", valor: "500.00" },
      { categoria: "Aluguel", valor: "100.00" },
      { categoria: "Active Rule Test", valor: "10.00" },
    ];
    const total = sum(expenses, "valor");
    const byCategory = expenses.reduce((s, t) => s + toNumber(t.valor), 0);
    expect(total).toBe(610);
    expect(byCategory).toBe(total);
  });

  it("an empty array sums to 0 (the case that masked the bug when only expenses had data)", () => {
    expect(sum([], "valor")).toBe(0);
  });

  it("safely ignores a single corrupted value without breaking the whole total", () => {
    const expenses = [{ valor: "500.00" }, { valor: "não é número" }, { valor: "10.00" }];
    expect(sum(expenses, "valor")).toBe(510);
  });
});
