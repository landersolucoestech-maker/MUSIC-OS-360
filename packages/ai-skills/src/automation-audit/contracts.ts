/**
 * packages/ai-skills/src/automation-audit/contracts.ts
 *
 * Contratos da skill automation-audit (version 1.0.0).
 * Auditoria narrativa da automação do MusicChat (triagem/escalonamento/
 * notificações WhatsApp) a partir de dados REAIS já persistidos em
 * `musicchat_automation_events` e `musicchat_automation_settings` — nunca
 * inspeciona nem audita o WorkflowAutomationService (trigger rules internas,
 * sem persistência/CRUD tenant-scoped, portanto sem substrato real para uma
 * skill de produto auditar).
 *
 * Execução: ON_DEMAND (ver on-demand-skill.runner.ts), disparada por ação
 * explícita do usuário — nunca corre em cada evento novo (isso rodaria sem
 * limite/custo descontrolado a cada mensagem recebida).
 */

import type { SkillLanguage, SkillSeverity, SkillPriority } from "../shared/primitives";

export type AutomationAuditLanguage = SkillLanguage;
export type AutomationAuditHealthStatus = "healthy" | "attention" | "critical";

export interface AutomationAuditEventCount {
  eventType: string;
  count: number;
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface AutomationAuditInput {
  automationEnabled: boolean;
  totalEventsAnalyzed: number;
  eventCounts: AutomationAuditEventCount[];
  invalidOptionCount: number;
  notificationRetryCount: number;
  escalationRulesConfigured: number;
  menuOptionsConfigured: number;
  context?: string;
  language?: AutomationAuditLanguage;
}

// ─── Blocos de saída ──────────────────────────────────────────────────────────

export interface AutomationAuditFinding {
  finding: string;
  severity: SkillSeverity;
  evidence: string;
}

export interface AutomationAuditAction {
  action: string;
  priority: SkillPriority;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface AutomationAuditOutput {
  auditSummary: string;
  healthStatus: AutomationAuditHealthStatus;
  findings: AutomationAuditFinding[];
  recommendedActions: AutomationAuditAction[];
}
