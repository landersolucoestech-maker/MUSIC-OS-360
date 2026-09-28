import { describe, it, expect } from "vitest";
import { artistDisplayName, toNumber, sum } from "./profit-and-loss-calc";

/**
 * Regression: GET /transactions returns `amount` as a STRING (Postgres NUMERIC
 * without a transform — unlike /transactions/stats, which aggregates in SQL). Adding strings with `+` concatenates
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
    // (`amount` is a decimal string on the wire).
    const expenses: any[] = [{ amount: "500.00" }, { amount: "100.00" }, { amount: "10.00" }];
    const naiveSum = expenses.reduce((s, t) => s + (t.amount ?? 0), 0);
    // String concatenation produces "0500.00100.0010.00" — multiple decimal
    // points — which Number() cannot parse.
    expect(typeof naiveSum).toBe("string");
    expect(Number(naiveSum)).toBeNaN();
  });

  it("correctly sums transactions with string amounts (the real API payload)", () => {
    const expenses = [{ amount: "500.00" }, { amount: "100.00" }, { amount: "10.00" }];
    expect(sum(expenses, "amount")).toBe(610);
  });

  it("the total matches exactly the sum of the rows shown per category", () => {
    const expenses = [
      { category: "Equipamentos Task X", amount: "500.00" },
      { category: "Aluguel", amount: "100.00" },
      { category: "Active Rule Test", amount: "10.00" },
    ];
    const total = sum(expenses, "amount");
    const byCategory = expenses.reduce((s, t) => s + toNumber(t.amount), 0);
    expect(total).toBe(610);
    expect(byCategory).toBe(total);
  });

  it("an empty array sums to 0 (the case that masked the bug when only expenses had data)", () => {
    expect(sum([], "amount")).toBe(0);
  });

  it("safely ignores a single corrupted value without breaking the whole total", () => {
    const expenses = [{ amount: "500.00" }, { amount: "não é número" }, { amount: "10.00" }];
    expect(sum(expenses, "amount")).toBe(510);
  });
});

describe("artistDisplayName (per-artist P&L)", () => {
  const names = new Map([["a1", "Banda X"], ["a2", "  "]]);

  it("says it is loading while the artist sweep has not resolved", () => {
    expect(artistDisplayName("a1", new Map(), { isLoading: true, isError: false })).toBe("Carregando…");
  });

  it("reports an unavailable artist on error instead of 'não encontrado'", () => {
    expect(artistDisplayName("a1", new Map(), { isLoading: false, isError: true })).toBe("Artista indisponível");
  });

  it("only claims 'não encontrado' once loaded and absent", () => {
    expect(artistDisplayName("zz", names, { isLoading: false, isError: false })).toBe("Artista não encontrado");
    expect(artistDisplayName("a1", names, { isLoading: false, isError: false })).toBe("Banda X");
    expect(artistDisplayName("a2", names, { isLoading: false, isError: false })).toBe("Sem nome");
  });
});
