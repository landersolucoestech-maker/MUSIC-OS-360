/**
 * packages/ai-skills/src/reporting-analysis/contracts.ts
 *
 * Contratos da skill reporting-analysis (version 1.0.0).
 * Síntese narrativa do dashboard operacional (contadores reais por
 * entidade: artistas, contratos, leads, tickets, tarefas, sincronizações
 * externas) já calculado por AnalyticsService.getDashboard() — nunca
 * recalcula, nunca inventa um contador.
 *
 * Execução: ON_DEMAND (ver on-demand-skill.runner.ts), disparada por ação
 * explícita do usuário — GET /analytics/dashboard já é uma leitura rápida e
 * sempre viva; esta skill é uma camada narrativa opcional sobre o mesmo
 * dado, com stale-refresh de 1 dia para não gerar a cada carregamento de
 * tela.
 */

import type { SkillLanguage, SkillSeverity, SkillPriority } from "../shared/primitives";

export type ReportingAnalysisLanguage = SkillLanguage;
export type ReportingAnalysisHealthStatus = "healthy" | "attention" | "critical";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface ReportingAnalysisInput {
  artists: number;
  activeContractsCount: number;
  contractsExpiringSoonCount: number;
  leads: number;
  openTickets: number;
  campaigns: number;
  revenueCurrentMonth: number;
  expensesCurrentMonth: number;
  netResultCurrentMonth: number;
  pendingReceivables: number;
  overdueInvoicesCount: number;
  pendingTasksCount: number;
  overdueTasksCount: number;
  pendingExternalSyncs: number;
  failedExternalSyncs: number;
  context?: string;
  language?: ReportingAnalysisLanguage;
}

// ─── Blocos de saída ──────────────────────────────────────────────────────────

export interface ReportingAnalysisHighlight {
  highlight: string;
  evidence: string;
}

export interface ReportingAnalysisConcern {
  concern: string;
  severity: SkillSeverity;
  evidence: string;
}

export interface ReportingAnalysisAction {
  action: string;
  priority: SkillPriority;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface ReportingAnalysisOutput {
  analysisSummary: string;
  healthStatus: ReportingAnalysisHealthStatus;
  highlights: ReportingAnalysisHighlight[];
  concerns: ReportingAnalysisConcern[];
  recommendedActions: ReportingAnalysisAction[];
}
