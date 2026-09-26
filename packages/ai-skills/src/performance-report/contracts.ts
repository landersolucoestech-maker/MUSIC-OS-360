/**
 * packages/ai-skills/src/performance-report/contracts.ts
 *
 * Contracts of the performance-report skill (version 1.0.0).
 * Narrative retrospective of financial performance (monthly revenue/expense)
 * from the REAL series already computed by AnalyticsService.getRevenueOverview()
 * — every `monthlyBreakdown` value in the output is ECHOED straight from the
 * input by the parser, never reproduced by the model (removing the risk of the
 * model "rounding"/hallucinating a number). The model only produces narrative
 * text and qualitative classifications.
 *
 * Scope distinction: campaign-report is the retrospective of ONE specific
 * campaign when it closes; performance-report is the aggregated financial
 * retrospective of the WHOLE business over a period — they do not overlap.
 *
 * Execution: ON_DEMAND, explicit period (`months` parameter) — no
 * stale-refresh, since different periods produce different reports.
 */

import type { SkillLanguage, SkillPriority } from "../shared/primitives";

export type PerformanceReportLanguage = SkillLanguage;
export type PerformanceReportTrend = "growing" | "declining" | "stable" | "volatile";

export interface PerformanceReportMonthPoint {
  month: string;
  revenue: number;
  expenses: number;
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface PerformanceReportInput {
  months: number;
  series: PerformanceReportMonthPoint[];
  context?: string;
  language?: PerformanceReportLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface PerformanceReportMonthlyBreakdown {
  month: string;
  revenue: number;
  expenses: number;
  netResult: number;
}

export interface PerformanceReportObservation {
  observation: string;
  evidence: string;
}

export interface PerformanceReportAction {
  action: string;
  priority: SkillPriority;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface PerformanceReportOutput {
  periodSummary: string;
  trend: PerformanceReportTrend;
  monthlyBreakdown: PerformanceReportMonthlyBreakdown[];
  keyObservations: PerformanceReportObservation[];
  recommendedActions: PerformanceReportAction[];
}
