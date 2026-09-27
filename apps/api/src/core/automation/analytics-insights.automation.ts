/**
 * core/automation/analytics-insights.automation.ts
 *
 * Two ON_DEMAND skills (see on-demand-skill.runner.ts) over REAL data already
 * exposed by AnalyticsService — they never recompute, never invent a
 * counter or a financial value:
 *
 *   reporting-analysis  → narrative synthesis of the operational dashboard
 *                          (AnalyticsService.getDashboard) — counters per
 *                          entity, the month's financials, tasks, external
 *                          syncs. 1-day stale refresh.
 *   performance-report   → narrative retrospective of revenue/expense per
 *                          period (AnalyticsService.getRevenueOverview) —
 *                          monthlyBreakdown is ALWAYS the real data (guaranteed
 *                          in the skill's parser, never reproduced by the
 *                          model). No stale refresh: different periods
 *                          (`months`) produce different reports.
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
const REPORTING_ANALYSIS_FRESHNESS_MINUTES = 24 * 60; // 1 day

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
    if (!dashboard) throw new Error('Operational dashboard unavailable');

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
    if (!overview) throw new Error('Revenue overview unavailable');

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
