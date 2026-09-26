import { describe, it, expect } from "vitest";
import { toNumber, sum } from "./profit-and-loss-calc";

/**
 * Regressão: GET /transactions devolve `valor` como STRING (Postgres NUMERIC
 * sem transform — diferente de /transactions/stats, que agrega via
 * `SUM(t.valor::numeric)` no SQL). Somar strings com `+` faz concatenação em
 * vez de soma ("0" + "500.00" = "0500.00"), e a cadeia de concatenações vira
 * uma string com múltiplos pontos decimais que `Number()` não consegue
 * parsear — daí o "R$ NaN" em Despesa Total / Lucro Líquido na ProfitAndLoss.
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
    // `any` de propósito: reproduz exatamente como `transactions` chega da API
    // (useTransactions() não tipa `valor` como number — ele chega como string).
    const despesas: any[] = [{ valor: "500.00" }, { valor: "100.00" }, { valor: "10.00" }];
    const naiveSum = despesas.reduce((s, t) => s + (t.valor ?? 0), 0);
    // A concatenação de string produz "0500.00100.0010.00" — múltiplos pontos
    // decimais — que Number() não parseia.
    expect(typeof naiveSum).toBe("string");
    expect(Number(naiveSum)).toBeNaN();
  });

  it("correctly sums transactions with string amounts (the real API payload)", () => {
    const despesas = [{ valor: "500.00" }, { valor: "100.00" }, { valor: "10.00" }];
    expect(sum(despesas, "valor")).toBe(610);
  });

  it("the total matches exactly the sum of the rows shown per category", () => {
    const despesas = [
      { categoria: "Equipamentos Task X", valor: "500.00" },
      { categoria: "Aluguel", valor: "100.00" },
      { categoria: "Active Rule Test", valor: "10.00" },
    ];
    const total = sum(despesas, "valor");
    const porCategoria = despesas.reduce((s, t) => s + toNumber(t.valor), 0);
    expect(total).toBe(610);
    expect(porCategoria).toBe(total);
  });

  it("an empty array sums to 0 (the case that masked the bug when only expenses had data)", () => {
    expect(sum([], "valor")).toBe(0);
  });

  it("safely ignores a single corrupted value without breaking the whole total", () => {
    const despesas = [{ valor: "500.00" }, { valor: "não é número" }, { valor: "10.00" }];
    expect(sum(despesas, "valor")).toBe(510);
  });
});
