/**
 * modules/accounting/pages/profit-and-loss-calc.ts
 *
 * `transacoes.valor` chega da API como STRING (Postgres NUMERIC serializado
 * sem transform — ver GET /transactions cru, diferente de /transactions/stats
 * que já agrega via `SUM(t.valor::numeric)` no SQL). `0 + "500.00"` faz
 * concatenação de string (JS só soma numericamente quando os dois operandos
 * já são number), então somar `t.valor` bruto em cadeia produz uma string
 * type "0500.00100.0010.00" — múltiplos pontos decimais, que vira NaN ao
 * passar por `Number()` em formatCurrency. `toNumber` normaliza qualquer
 * valor numérico/string-numérica para number antes de qualquer soma; um
 * valor que não é um número válido vira 0 explicitamente (nunca propaga
 * NaN). Módulo isolado (sem imports de React/providers) para ser testável
 * sem montar toda a árvore de contexto da página.
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
