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
  artist: string;
  revenue: number;
  expenses: number;
  result: number;
  margin: number;
}

export async function fetchAccountingSummaryRows(
  ds: DataSource,
  tenantId: string,
): Promise<AccountingSummaryRow[]> {
  const rows = (await ds.query(
    `SELECT
       a.nome_artistico AS artist,
       COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'revenue'), 0) AS revenue,
       COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0) AS expenses
     FROM artists a
     JOIN transactions t ON t.artist_id = a.id AND t.tenant_id = a.tenant_id
     WHERE a.tenant_id = $1 AND t.deleted_at IS NULL
     GROUP BY a.id, a.nome_artistico
     ORDER BY a.nome_artistico ASC`,
    [tenantId],
  )) as { artist: string; revenue: string; expenses: string }[];

  return rows.map((r) => {
    const income = Number(r.revenue);
    const expenses = Number(r.expenses);
    const result = income - expenses;
    const marginPct = income > 0 ? Number(((result / income) * 100).toFixed(2)) : 0;
    return { artist: r.artist, revenue: income, expenses, result, margin: marginPct };
  });
}
