/**
 * packages/ai-skills/src/automation-audit/contracts.ts
 *
 * Contracts of the automation-audit skill (version 1.0.0).
 * Narrative audit of MusicChat automation (triage/escalation/WhatsApp
 * notifications) from REAL data already persisted in
 * `musicchat_automation_events` and `musicchat_automation_settings` — it never
 * inspects or audits WorkflowAutomationService (internal trigger rules, with no
 * tenant-scoped persistence/CRUD, so there is no real substrate for a product
 * skill to audit).
 *
 * Execution: ON_DEMAND (see on-demand-skill.runner.ts), triggered by an
 * explicit user action — never on every new event (that would run without a
 * limit and with uncontrolled cost for every received message).
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

// ─── Output blocks ────────────────────────────────────────────────────────────

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
