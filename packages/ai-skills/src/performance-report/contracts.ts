/**
 * packages/ai-skills/src/performance-report/contracts.ts
 *
 * Contratos da skill performance-report (version 1.0.0).
 * Retrospectiva narrativa de desempenho financeiro (receita/despesa mensal)
 * a partir da série REAL já calculada por
 * AnalyticsService.getRevenueOverview() — cada valor de `monthlyBreakdown`
 * na saída é ECOADO diretamente do input pelo parser, nunca reproduzido
 * pelo modelo (elimina risco de o modelo "arredondar"/alucinar um número).
 * O modelo só produz texto narrativo e classificações qualitativas.
 *
 * Distinção de escopo: campaign-report é a retrospectiva de UMA campanha
 * específica ao encerrar; performance-report é a retrospectiva financeira
 * agregada do NEGÓCIO inteiro em um período — não se sobrepõem.
 *
 * Execução: ON_DEMAND, período explícito (parâmetro `months`) — sem
 * stale-refresh, já que peridos diferentes produzem relatórios diferentes.
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

// ─── Blocos de saída ──────────────────────────────────────────────────────────

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
