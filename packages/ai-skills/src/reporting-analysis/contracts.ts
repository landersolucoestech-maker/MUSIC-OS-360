/**
 * packages/ai-skills/src/reporting-analysis/contracts.ts
 *
 * Contracts of the reporting-analysis skill (version 1.0.0).
 * Narrative synthesis of the operational dashboard (real per-entity counters:
 * artists, contracts, leads, tickets, tasks, external syncs) already computed by
 * AnalyticsService.getDashboard() — it never recomputes or invents a counter.
 *
 * Execution: ON_DEMAND (see on-demand-skill.runner.ts), triggered by an explicit
 * user action — GET /analytics/dashboard is already a fast, always-live read;
 * this skill is an optional narrative layer over the same data, with a 1-day
 * stale-refresh so it does not generate on every screen load.
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

// ─── Output blocks ────────────────────────────────────────────────────────────

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
