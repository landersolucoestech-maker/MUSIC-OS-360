/**
 * modules/accounting/pages/profit-and-loss-calc.ts
 *
 * `transacoes.valor` arrives from the API as a STRING (Postgres NUMERIC serialized
 * without a transform — see the raw GET /transactions, unlike /transactions/stats
 * which already aggregates via `SUM(t.valor::numeric)` in SQL). `0 + "500.00"` does
 * string concatenation (JS only sums numerically when both operands
 * are already numbers), so summing the raw `t.valor` in a chain produces a string
 * like "0500.00100.0010.00" — multiple decimal points, which becomes NaN when
 * passing through `Number()` in formatCurrency. `toNumber` normalizes any
 * numeric/numeric-string value to a number before any sum; a
 * value that is not a valid number explicitly becomes 0 (it never propagates
 * NaN). An isolated module (no React/provider imports) so it is testable
 * without mounting the page's whole context tree.
 */

export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function sum(arr: any[], field: string): number {
  return arr.reduce((s, t) => s + toNumber(t[field]), 0);
}
