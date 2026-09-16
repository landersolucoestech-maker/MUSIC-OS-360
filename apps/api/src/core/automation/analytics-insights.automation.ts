/**
 * core/automation/analytics-insights.automation.ts
 *
 * Duas skills ON_DEMAND (ver on-demand-skill.runner.ts) sobre dados REAIS já
 * expostos por AnalyticsService — nunca recalculam, nunca inventam um
 * contador ou um valor financeiro:
 *
 *   reporting-analysis  → síntese narrativa do dashboard operacional
 *                          (AnalyticsService.getDashboard) — contadores por
 *                          entidade, financeiro do mês, tarefas, syncs
 *                          externos. Stale-refresh de 1 dia.
 *   performance-report   → retrospectiva narrativa de receita/despesa por
 *                          período (AnalyticsService.getRevenueOverview) —
 *                          monthlyBreakdown é SEMPRE o dado real (garantido
 *                          no parser da skill, nunca reproduzido pelo
 *                          modelo). Sem stale-refresh: períodos diferentes
 *                          (`months`) produzem relatórios diferentes.
 */

import { Injectable } from '@nestjs/common';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import { AnalyticsService } from '../../modules/analytics/analytics.service';
import {
  REPORTING_ANALYSIS_SYSTEM_PROMPT,
  buildReportingAnalysisPrompt,
  parseReportingAnalysisResponse,
  validateReportingAnalysisInput,
  type ReportingAnalysisInput,
  type ReportingAnalysisOutput,
  PERFORMANCE_REPORT_SYSTEM_PROMPT,
  buildPerformanceReportPrompt,
  parsePerformanceReportResponse,
  validatePerformanceReportInput,
  type PerformanceReportInput,
  type PerformanceReportOutput,
} from '@music-os-360/ai-skills';
import { runOnDemandSkill, type OnDemandSkillResult } from './on-demand-skill.runner';

const REPORTING_ANALYSIS_SKILL_NAME = 'reporting-analysis';
const PERFORMANCE_REPORT_SKILL_NAME = 'performance-report';
const REPORTING_ANALYSIS_FRESHNESS_MINUTES = 24 * 60; // 1 dia

interface DashboardSnapshot {
  artists: number;
  active_contracts_count: number;
  contracts_expiring_soon_count: number;
  leads: number;
  open_tickets: number;
  campaigns: number;
  revenue_current_month: number;
  expenses_current_month: number;
  net_result_current_month: number;
  pending_receivables: number;
  overdue_invoices_count: number;
  pending_tasks_count: number;
  overdue_tasks_count: number;
  pending_external_syncs: number;
  failed_external_syncs: number;
}

@Injectable()
export class AnalyticsInsightsAutomation {
  constructor(
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
    private readonly analytics: AnalyticsService,
  ) {}

  async runReportingAnalysis(
    tenantId: string,
    userId: string,
    forceRefresh: boolean,
  ): Promise<OnDemandSkillResult<ReportingAnalysisOutput>> {
    const dashboard = (await this.analytics.getDashboard(tenantId)) as DashboardSnapshot | null;
    if (!dashboard) throw new Error('Dashboard operacional indisponível');

    const input: ReportingAnalysisInput = {
      artists: dashboard.artists,
      activeContractsCount: dashboard.active_contracts_count,
      contractsExpiringSoonCount: dashboard.contracts_expiring_soon_count,
      leads: dashboard.leads,
      openTickets: dashboard.open_tickets,
      campaigns: dashboard.campaigns,
      revenueCurrentMonth: dashboard.revenue_current_month,
      expensesCurrentMonth: dashboard.expenses_current_month,
      netResultCurrentMonth: dashboard.net_result_current_month,
      pendingReceivables: dashboard.pending_receivables,
      overdueInvoicesCount: dashboard.overdue_invoices_count,
      pendingTasksCount: dashboard.pending_tasks_count,
      overdueTasksCount: dashboard.overdue_tasks_count,
      pendingExternalSyncs: dashboard.pending_external_syncs,
      failedExternalSyncs: dashboard.failed_external_syncs,
      language: 'pt-BR',
    };

    return runOnDemandSkill<ReportingAnalysisInput, ReportingAnalysisOutput>(
      { skillRun: this.skillRun, ai: this.ai },
      {
        skillName: REPORTING_ANALYSIS_SKILL_NAME,
        tenantId,
        userId,
        entityType: null,
        entityId: null,
        systemPrompt: REPORTING_ANALYSIS_SYSTEM_PROMPT,
        input,
        buildPrompt: buildReportingAnalysisPrompt,
        parseResponse: parseReportingAnalysisResponse,
        validateInput: validateReportingAnalysisInput,
        freshnessMinutes: REPORTING_ANALYSIS_FRESHNESS_MINUTES,
        forceRefresh,
      },
    );
  }

  async runPerformanceReport(
    tenantId: string,
    userId: string,
    months: number,
  ): Promise<OnDemandSkillResult<PerformanceReportOutput>> {
    const overview = await this.analytics.getRevenueOverview(tenantId, months);
    if (!overview) throw new Error('Visão de receita indisponível');

    const input: PerformanceReportInput = {
      months: overview.months,
      series: overview.series.map((p) => ({
        month: String(p.month),
        revenue: Number(p.receitas),
        expenses: Number(p.despesas),
      })),
      language: 'pt-BR',
    };

    return runOnDemandSkill<PerformanceReportInput, PerformanceReportOutput>(
      { skillRun: this.skillRun, ai: this.ai },
      {
        skillName: PERFORMANCE_REPORT_SKILL_NAME,
        tenantId,
        userId,
        entityType: null,
        entityId: null,
        systemPrompt: PERFORMANCE_REPORT_SYSTEM_PROMPT,
        input,
        buildPrompt: buildPerformanceReportPrompt,
        parseResponse: parsePerformanceReportResponse,
        validateInput: validatePerformanceReportInput,
      },
    );
  }
}
