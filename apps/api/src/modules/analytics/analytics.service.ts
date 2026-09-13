import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { AiUsageLogEntity } from '../../database/entities';

@Injectable()
export class AnalyticsService {
  constructor(@Inject(DATA_SOURCE) private readonly ds: DataSource | null) {}

  // ── AI Usage Governance ────────────────────────────────────────────────────

  async logAiUsage(params: {
    tenantId:     string;
    jobId?:       string;
    model:        string;
    feature:      string;
    tokensInput:  number;
    tokensOutput: number;
    costUsd?:     number;
    latencyMs?:   number;
    outcome?:     string;
    userId?:      string;
  }): Promise<void> {
    if (!this.ds) return;
    const repo = this.ds.getRepository(AiUsageLogEntity);
    await repo.save(repo.create({
      tenant_id:    params.tenantId,
      job_id:       params.jobId ?? null,
      model:        params.model,
      feature:      params.feature,
      tokens_input:  params.tokensInput,
      tokens_output: params.tokensOutput,
      cost_usd:     (params.costUsd ?? 0).toFixed(6),
      latency_ms:   params.latencyMs ?? null,
      outcome:      params.outcome ?? 'success',
      user_id:      params.userId ?? null,
    }));
  }

  async getAiUsageSummary(tenantId: string, days = 30) {
    if (!this.ds) return null;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await this.ds.query<Array<{
      model: string;
      feature: string;
      calls: string;
      tokens_total: string;
      cost_total: string;
    }>>(`
      SELECT
        model,
        feature,
        COUNT(*)::int          AS calls,
        SUM(tokens_input + tokens_output)::bigint AS tokens_total,
        SUM(cost_usd)::numeric(12,6)              AS cost_total
      FROM ai_usage_logs
      WHERE tenant_id = $1 AND created_at >= $2
      GROUP BY model, feature
      ORDER BY cost_total DESC
    `, [tenantId, since]);

    const totals = await this.ds.query<Array<{
      total_calls: string;
      total_tokens: string;
      total_cost: string;
    }>>(`
      SELECT
        COUNT(*)::int          AS total_calls,
        SUM(tokens_input + tokens_output)::bigint AS total_tokens,
        SUM(cost_usd)::numeric(12,6)              AS total_cost
      FROM ai_usage_logs
      WHERE tenant_id = $1 AND created_at >= $2
    `, [tenantId, since]);

    return {
      period_days: days,
      breakdown:   rows,
      totals: totals[0] ?? { total_calls: 0, total_tokens: 0, total_cost: '0.000000' },
    };
  }

  // ── Operational Dashboard ──────────────────────────────────────────────────

  async getDashboard(tenantId: string) {
    if (!this.ds) return null;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [operationalTasksRelation] = await this.ds.query<Array<{ relation_name: string | null }>>(
      `SELECT to_regclass('public.operational_tasks')::text AS relation_name`,
    );
    const hasOperationalTasks = Boolean(operationalTasksRelation?.relation_name);

    const [
      artistCount,
      artistsByStatus,
      contractCount,
      contractsByStatus,
      activeContractsCount,
      contractsExpiringSoonCount,
      leadCount,
      openTickets,
      campaignCount,
      // Financial
      financialCurrentMonth,
      pendingReceivables,
      overdueInvoicesCount,
      paidTxCount,
      cancelledTxCount,
      invoicesByStatus,
      txByStatus,
      txByTipo,
      // Operational
      pendingTasksCount,
      overdueTasksCount,
      onboardingInProgressCount,
      pendingDistributionSetups,
      externalDataStats,
    ] = await Promise.all([
      this.countTable('artists', tenantId),
      this.ds.query<Array<{ status: string; cnt: string }>>(
        `SELECT status, COUNT(*)::int AS cnt FROM artists WHERE tenant_id = $1 AND deleted_at IS NULL GROUP BY status`,
        [tenantId],
      ),
      this.countTable('contracts', tenantId),
      this.ds.query<Array<{ status: string; cnt: string }>>(
        `SELECT status, COUNT(*)::int AS cnt FROM contracts WHERE tenant_id = $1 AND deleted_at IS NULL GROUP BY status`,
        [tenantId],
      ),
      this.ds.query<[{ cnt: string }]>(
        `SELECT COUNT(*)::int AS cnt FROM contracts WHERE tenant_id = $1 AND status IN ('vigente','ativo','assinado') AND deleted_at IS NULL`,
        [tenantId],
      ),
      this.ds.query<[{ cnt: string }]>(
        `SELECT COUNT(*)::int AS cnt FROM contracts WHERE tenant_id = $1 AND end_date BETWEEN NOW() AND NOW() + INTERVAL '30 days' AND deleted_at IS NULL`,
        [tenantId],
      ),
      this.countTable('leads', tenantId),
      this.ds.query<[{ cnt: string }]>(
        `SELECT COUNT(*)::int AS cnt FROM support_tickets WHERE tenant_id = $1 AND status NOT IN ('resolved','closed') AND deleted_at IS NULL`,
        [tenantId],
      ),
      this.countTable('campaigns', tenantId),
      // Revenue and expenses this calendar month
      this.ds.query<[{ receitas: string; despesas: string }]>(`
        SELECT
          COALESCE(SUM(CASE WHEN type = 'receita' AND status != 'cancelled' THEN valor::numeric ELSE 0 END), 0)::numeric AS receitas,
          COALESCE(SUM(CASE WHEN type = 'despesa' AND status != 'cancelled' THEN valor::numeric ELSE 0 END), 0)::numeric AS despesas
        FROM transactions
        WHERE tenant_id = $1 AND deleted_at IS NULL AND data >= $2
      `, [tenantId, monthStart]),
      // Pending receivables (receita pendente/agendada, não cancelada)
      this.ds.query<[{ total: string }]>(`
        SELECT COALESCE(SUM(valor::numeric), 0)::numeric AS total
        FROM transactions
        WHERE tenant_id = $1 AND type = 'receita' AND status IN ('pending','scheduled') AND deleted_at IS NULL
      `, [tenantId]),
      // Overdue invoices count
      this.ds.query<[{ cnt: string }]>(`
        SELECT COUNT(*)::int AS cnt FROM invoices
        WHERE tenant_id = $1 AND status = 'overdue' AND deleted_at IS NULL
      `, [tenantId]),
      // Paid transactions count (all time)
      this.ds.query<[{ cnt: string }]>(`
        SELECT COUNT(*)::int AS cnt FROM transactions
        WHERE tenant_id = $1 AND status IN ('paid','confirmed','completed') AND deleted_at IS NULL
      `, [tenantId]),
      // Cancelled transactions count (all time)
      this.ds.query<[{ cnt: string }]>(`
        SELECT COUNT(*)::int AS cnt FROM transactions
        WHERE tenant_id = $1 AND status = 'cancelled' AND deleted_at IS NULL
      `, [tenantId]),
      // Invoices by status
      this.ds.query<Array<{ status: string; cnt: string }>>(
        `SELECT status, COUNT(*)::int AS cnt FROM invoices WHERE tenant_id = $1 AND deleted_at IS NULL GROUP BY status`,
        [tenantId],
      ),
      // Transactions by status
      this.ds.query<Array<{ status: string; cnt: string }>>(
        `SELECT status, COUNT(*)::int AS cnt FROM transactions WHERE tenant_id = $1 AND deleted_at IS NULL GROUP BY status`,
        [tenantId],
      ),
      // Transactions by type
      this.ds.query<Array<{ type: string; cnt: string }>>(
        `SELECT type, COUNT(*)::int AS cnt FROM transactions WHERE tenant_id = $1 AND deleted_at IS NULL GROUP BY type`,
        [tenantId],
      ),
      hasOperationalTasks
        ? this.ds.query<[{ cnt: string }]>(
            `SELECT COUNT(*)::int AS cnt FROM operational_tasks WHERE tenant_id = $1 AND status = 'pending'`,
            [tenantId],
          )
        : Promise.resolve([] as Array<{ cnt: string }>),
      hasOperationalTasks
        ? this.ds.query<[{ cnt: string }]>(
            `SELECT COUNT(*)::int AS cnt FROM operational_tasks WHERE tenant_id = $1 AND status != 'done' AND due_date < NOW()`,
            [tenantId],
          )
        : Promise.resolve([] as Array<{ cnt: string }>),
      // Artists currently in onboarding (status = contratado)
      this.ds.query<[{ cnt: string }]>(
        `SELECT COUNT(*)::int AS cnt FROM artists WHERE tenant_id = $1 AND status = 'contratado' AND deleted_at IS NULL`,
        [tenantId],
      ),
      // Artists with distribution setup requested but not completed
      this.ds.query<[{ cnt: string }]>(
        `SELECT COUNT(*)::int AS cnt FROM artists WHERE tenant_id = $1 AND deleted_at IS NULL AND (metadata->>'distribution_setup_requested_at') IS NOT NULL AND (metadata->>'distribution_setup_completed_at') IS NULL`,
        [tenantId],
      ),
      this.getExternalDataExchangeStats(tenantId),
    ]);

    const artistStatusMap   = Object.fromEntries(artistsByStatus.map((r)   => [r.status, parseInt(r.cnt)]));
    const contractStatusMap = Object.fromEntries(contractsByStatus.map((r) => [r.status, parseInt(r.cnt)]));
    const invoiceStatusMap  = Object.fromEntries(invoicesByStatus.map((r)  => [r.status, parseInt(r.cnt)]));
    const txStatusMap       = Object.fromEntries(txByStatus.map((r)        => [r.status, parseInt(r.cnt)]));
    const txTipoMap         = Object.fromEntries(txByTipo.map((r)          => [r.type,   parseInt(r.cnt)]));

    const receitas = parseFloat(financialCurrentMonth[0]?.receitas ?? '0');
    const despesas = parseFloat(financialCurrentMonth[0]?.despesas ?? '0');

    return {
      artists:                       artistCount,
      artists_by_status:             artistStatusMap,
      contracts:                     contractCount,
      contracts_by_status:           contractStatusMap,
      active_contracts_count:        parseInt(activeContractsCount[0]?.cnt ?? '0'),
      contracts_expiring_soon_count: parseInt(contractsExpiringSoonCount[0]?.cnt ?? '0'),
      leads:                         leadCount,
      open_tickets:                  parseInt(openTickets[0]?.cnt ?? '0'),
      campaigns:                     campaignCount,
      // Financial
      revenue_current_month:         receitas,
      expenses_current_month:        despesas,
      net_result_current_month:      receitas - despesas,
      pending_receivables:           parseFloat(pendingReceivables[0]?.total ?? '0'),
      overdue_invoices_count:        parseInt(overdueInvoicesCount[0]?.cnt ?? '0'),
      paid_transactions_count:       parseInt(paidTxCount[0]?.cnt ?? '0'),
      cancelled_transactions_count:  parseInt(cancelledTxCount[0]?.cnt ?? '0'),
      invoices_by_status:            invoiceStatusMap,
      transactions_by_status:        txStatusMap,
      transactions_by_tipo:          txTipoMap,
      // Operational
      pending_tasks_count:           parseInt(pendingTasksCount[0]?.cnt ?? '0'),
      overdue_tasks_count:           parseInt(overdueTasksCount[0]?.cnt ?? '0'),
      onboarding_in_progress_count:  parseInt(onboardingInProgressCount[0]?.cnt ?? '0'),
      pending_distribution_setups:   parseInt(pendingDistributionSetups[0]?.cnt ?? '0'),
      pending_external_syncs:        externalDataStats.pending_external_syncs,
      failed_external_syncs:         externalDataStats.failed_external_syncs,
      successful_external_syncs:     externalDataStats.successful_external_syncs,
      distributor_submissions_count: externalDataStats.distributor_submissions_count,
      society_submissions_count:     externalDataStats.society_submissions_count,
      external_validation_errors_count: externalDataStats.external_validation_errors_count,
      pending_provider_requirements_count: externalDataStats.pending_provider_requirements_count,
      generated_at:                  new Date().toISOString(),
    };
  }

  // ── Revenue Overview ───────────────────────────────────────────────────────

  async getRevenueOverview(tenantId: string, months = 6) {
    if (!this.ds) return null;
    const rows = await this.ds.query<Array<{
      month: string;
      receitas: string;
      despesas: string;
    }>>(`
      SELECT
        DATE_TRUNC('month', data)::date AS month,
        SUM(CASE WHEN type = 'receita' THEN valor::numeric ELSE 0 END) AS receitas,
        SUM(CASE WHEN type = 'despesa' THEN valor::numeric ELSE 0 END) AS despesas
      FROM transactions
      WHERE tenant_id = $1
        AND deleted_at IS NULL
        AND data >= NOW() - INTERVAL '${months} months'
      GROUP BY 1
      ORDER BY 1 ASC
    `, [tenantId]);

    return { months, series: rows };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async countTable(table: string, tenantId: string): Promise<number> {
    const [row] = await this.ds!.query<[{ cnt: string }]>(
      `SELECT COUNT(*)::int AS cnt FROM ${table} WHERE tenant_id = $1 AND deleted_at IS NULL`,
      [tenantId],
    );
    return parseInt(row?.cnt ?? '0');
  }

  private async getExternalDataExchangeStats(tenantId: string): Promise<{
    pending_external_syncs: number;
    failed_external_syncs: number;
    successful_external_syncs: number;
    distributor_submissions_count: number;
    society_submissions_count: number;
    external_validation_errors_count: number;
    pending_provider_requirements_count: number;
  }> {
    const [row] = await this.ds!.query<Array<Record<string, string>>>(`
      WITH exchange_entries AS (
        SELECT value AS item
        FROM artists, jsonb_each(COALESCE(metadata->'external_data_exchange', '{}'::jsonb))
        WHERE tenant_id = $1 AND deleted_at IS NULL
        UNION ALL
        SELECT value AS item
        FROM releases, jsonb_each(COALESCE(metadata->'external_data_exchange', '{}'::jsonb))
        WHERE tenant_id = $1 AND deleted_at IS NULL
        UNION ALL
        SELECT value AS item
        FROM works, jsonb_each(COALESCE(metadata->'external_data_exchange', '{}'::jsonb))
        WHERE tenant_id = $1 AND deleted_at IS NULL
        UNION ALL
        SELECT value AS item
        FROM phonograms, jsonb_each(COALESCE(metadata->'external_data_exchange', '{}'::jsonb))
        WHERE tenant_id = $1 AND deleted_at IS NULL
      )
      SELECT
        COUNT(*) FILTER (WHERE item->>'status' IN ('pending','processing'))::int AS pending_external_syncs,
        COUNT(*) FILTER (WHERE item->>'status' IN ('failed','rejected'))::int AS failed_external_syncs,
        COUNT(*) FILTER (WHERE item->>'status' IN ('approved','completed') OR item->>'delivery_status' = 'delivered' OR item->>'registration_status' = 'registered')::int AS successful_external_syncs,
        COUNT(*) FILTER (WHERE item->>'kind' = 'distributor')::int AS distributor_submissions_count,
        COUNT(*) FILTER (WHERE item->>'kind' = 'society')::int AS society_submissions_count,
        COALESCE(SUM(jsonb_array_length(COALESCE(item->'validation_errors', '[]'::jsonb))), 0)::int AS external_validation_errors_count,
        COALESCE(SUM(jsonb_array_length(COALESCE(item->'pending_requirements', '[]'::jsonb))), 0)::int AS pending_provider_requirements_count
      FROM exchange_entries
    `, [tenantId]);

    const num = (key: string) => parseInt(row?.[key] ?? '0');
    return {
      pending_external_syncs: num('pending_external_syncs'),
      failed_external_syncs: num('failed_external_syncs'),
      successful_external_syncs: num('successful_external_syncs'),
      distributor_submissions_count: num('distributor_submissions_count'),
      society_submissions_count: num('society_submissions_count'),
      external_validation_errors_count: num('external_validation_errors_count'),
      pending_provider_requirements_count: num('pending_provider_requirements_count'),
    };
  }
}
