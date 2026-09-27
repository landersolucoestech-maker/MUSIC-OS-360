/**
 * modules/reports/computed-fields/accounting-summary.report.ts  ·  Part 89
 *
 * "Contabilidade" (Block 19) — a 100% computed report: P&L per artist,
 * aggregated over `transactions` (same logic as apps/web/.../Contabilidade.tsx,
 * "P&L por Artista" tab). No physical table of its own, no import — export
 * only, with an explicit contract (see ACCOUNTING_SUMMARY_CONTRACT).
 */
import type { DataSource } from 'typeorm';

interface AccountingSummaryRow {
  artista: string;
  receitas: number;
  despesas: number;
  resultado: number;
  margem: number;
}

export async function fetchAccountingSummaryRows(
  ds: DataSource,
  tenantId: string,
): Promise<AccountingSummaryRow[]> {
  const rows = (await ds.query(
    `SELECT
       a.nome_artistico AS artista,
       COALESCE(SUM(t.valor) FILTER (WHERE t.type = 'receita'), 0) AS receitas,
       COALESCE(SUM(t.valor) FILTER (WHERE t.type = 'despesa'), 0) AS despesas
     FROM artists a
     JOIN transactions t ON t.artist_id = a.id AND t.tenant_id = a.tenant_id
     WHERE a.tenant_id = $1 AND t.deleted_at IS NULL
     GROUP BY a.id, a.nome_artistico
     ORDER BY a.nome_artistico ASC`,
    [tenantId],
  )) as { artista: string; receitas: string; despesas: string }[];

  return rows.map((r) => {
    const income = Number(r.receitas);
    const expenses = Number(r.despesas);
    const resultado = income - expenses;
    const margem = income > 0 ? Number(((resultado / income) * 100).toFixed(2)) : 0;
    return { artista: r.artista, receitas: income, despesas: expenses, resultado, margem };
  });
}
