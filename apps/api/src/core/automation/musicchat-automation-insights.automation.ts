/**
 * core/automation/musicchat-automation-insights.automation.ts
 *
 * Duas skills ON_DEMAND (ver on-demand-skill.runner.ts) sobre o MESMO
 * substrato real e já existente — `musicchat_automation_settings` +
 * `musicchat_automation_events` — disparadas por ação explícita do usuário,
 * nunca por evento/mudança de dado:
 *
 *   automation-audit    → auditoria narrativa da saúde operacional da
 *                          automação (contadores reais de eventos).
 *   automation-builder  → SUGESTÕES de menu/escalonamento a partir de
 *                          padrões reais de mensagens sem correspondência.
 *                          NUNCA aplica a sugestão — settings só mudam via
 *                          PATCH .../settings, já existente, inalterado.
 *
 * Não audita/constrói o WorkflowAutomationService (trigger rules internas
 * em memória, sem persistência/CRUD tenant-scoped — sem substrato real para
 * uma skill de produto operar).
 */

import { Injectable } from '@nestjs/common';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import { MusicChatAutomationService } from '../../modules/conversations/musicchat-automation.service';
import {
  AUTOMATION_AUDIT_SYSTEM_PROMPT,
  buildAutomationAuditPrompt,
  parseAutomationAuditResponse,
  validateAutomationAuditInput,
  type AutomationAuditInput,
  type AutomationAuditOutput,
  type AutomationAuditEventCount,
  AUTOMATION_BUILDER_SYSTEM_PROMPT,
  buildAutomationBuilderPrompt,
  parseAutomationBuilderResponse,
  validateAutomationBuilderInput,
  type AutomationBuilderInput,
  type AutomationBuilderOutput,
} from '@music-os-360/ai-skills';
import { runOnDemandSkill, type OnDemandSkillResult } from './on-demand-skill.runner';

const AUDIT_SKILL_NAME = 'automation-audit';
const BUILDER_SKILL_NAME = 'automation-builder';
const AUDIT_FRESHNESS_MINUTES = 24 * 60; // 1 dia

interface MusicChatEventRow {
  event_type: string;
  payload: Record<string, unknown>;
}

interface MusicChatSettingsRow {
  enabled: boolean;
  menu_options: Array<{ label?: string }>;
  escalation_rules: Array<{ level?: string }>;
}

@Injectable()
export class MusicChatAutomationInsightsAutomation {
  constructor(
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
    private readonly automation: MusicChatAutomationService,
  ) {}

  async runAudit(
    tenantId: string,
    userId: string,
    forceRefresh: boolean,
  ): Promise<OnDemandSkillResult<AutomationAuditOutput>> {
    const [settings, events] = await Promise.all([
      this.automation.getSettings(tenantId) as unknown as MusicChatSettingsRow,
      this.automation.listEvents(tenantId) as unknown as MusicChatEventRow[],
    ]);

    const eventCounts = this.countByType(events);

    const input: AutomationAuditInput = {
      automationEnabled: settings.enabled,
      totalEventsAnalyzed: events.length,
      eventCounts,
      invalidOptionCount: eventCounts.find((e) => e.eventType === 'automation.invalid_option')?.count ?? 0,
      notificationRetryCount: eventCounts.find((e) => e.eventType === 'automation.notification_retried')?.count ?? 0,
      escalationRulesConfigured: settings.escalation_rules?.length ?? 0,
      menuOptionsConfigured: settings.menu_options?.length ?? 0,
      language: 'pt-BR',
    };

    return runOnDemandSkill<AutomationAuditInput, AutomationAuditOutput>(
      { skillRun: this.skillRun, ai: this.ai },
      {
        skillName: AUDIT_SKILL_NAME,
        tenantId,
        userId,
        entityType: null,
        entityId: null,
        systemPrompt: AUTOMATION_AUDIT_SYSTEM_PROMPT,
        input,
        buildPrompt: buildAutomationAuditPrompt,
        parseResponse: parseAutomationAuditResponse,
        validateInput: validateAutomationAuditInput,
        freshnessMinutes: AUDIT_FRESHNESS_MINUTES,
        forceRefresh,
      },
    );
  }

  async runBuilderSuggestions(
    tenantId: string,
    userId: string,
  ): Promise<OnDemandSkillResult<AutomationBuilderOutput>> {
    const [settings, events] = await Promise.all([
      this.automation.getSettings(tenantId) as unknown as MusicChatSettingsRow,
      this.automation.listEvents(tenantId) as unknown as MusicChatEventRow[],
    ]);

    const invalidOptionEvents = events.filter((e) => e.event_type === 'automation.invalid_option');
    const recentInvalidOptionSamples = invalidOptionEvents
      .slice(0, 10)
      .map((e) => (typeof e.payload?.body === 'string' ? e.payload.body : ''))
      .filter((body) => body.length > 0);

    const input: AutomationBuilderInput = {
      currentMenuOptionLabels: (settings.menu_options ?? []).map((o) => o.label ?? '').filter((l) => l.length > 0),
      currentEscalationLevels: (settings.escalation_rules ?? []).map((r) => r.level ?? '').filter((l) => l.length > 0),
      invalidOptionCount: invalidOptionEvents.length,
      recentInvalidOptionSamples,
      language: 'pt-BR',
    };

    // Sem cache de frescor deliberadamente: sugestões são baratas e o usuário
    // as pede explicitamente esperando uma nova rodada a cada clique.
    return runOnDemandSkill<AutomationBuilderInput, AutomationBuilderOutput>(
      { skillRun: this.skillRun, ai: this.ai },
      {
        skillName: BUILDER_SKILL_NAME,
        tenantId,
        userId,
        entityType: null,
        entityId: null,
        systemPrompt: AUTOMATION_BUILDER_SYSTEM_PROMPT,
        input,
        buildPrompt: buildAutomationBuilderPrompt,
        parseResponse: parseAutomationBuilderResponse,
        validateInput: validateAutomationBuilderInput,
      },
    );
  }

  private countByType(events: MusicChatEventRow[]): AutomationAuditEventCount[] {
    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.event_type, (counts.get(e.event_type) ?? 0) + 1);
    return Array.from(counts.entries()).map(([eventType, count]) => ({ eventType, count }));
  }
}
