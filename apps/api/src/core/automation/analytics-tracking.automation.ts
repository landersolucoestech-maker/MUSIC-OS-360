/**
 * core/automation/analytics-tracking.automation.ts
 *
 * Skill ON_DEMAND (ver on-demand-skill.runner.ts): audita a COBERTURA real
 * de rastreamento analítico — cruza o registro canônico DOMAIN_EVENTS
 * (apps/api/src/core/events/events.service.ts, ~100 BUSINESS EVENTS reais,
 * já 100% capturados em `domain_event_log` via UniversalEventLogHandler,
 * um listener wildcard '**' sempre ativo — isso é AUDIT EVENT, não
 * ANALYTICS EVENT) contra os métodos de rastreamento REAIS já implementados
 * em PostHogService (ANALYTICS EVENT real, mas nunca chamados por nenhum
 * outro serviço — grep repo-wide confirmado).
 *
 * KNOWN_TRACKING_MAP abaixo é a única fonte de verdade sobre qual
 * DOMAIN_EVENT já tem um método de rastreamento correspondente no código —
 * mapeamento estático, verificável, nunca inventado pelo modelo.
 *
 * Nunca envia dado a nenhum provedor (esta skill só lê/analisa, nunca
 * chama capture()/identify()). Reporta providerState="configuration_required"
 * de forma verdadeira quando PostHogService.isConfigured() é false.
 */

import { Injectable } from '@nestjs/common';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import { PostHogService } from '../analytics/posthog.service';
import { DOMAIN_EVENTS } from '../events/events.service';
import {
  ANALYTICS_TRACKING_SYSTEM_PROMPT,
  buildAnalyticsTrackingPrompt,
  parseAnalyticsTrackingResponse,
  validateAnalyticsTrackingInput,
  type AnalyticsTrackingInput,
  type AnalyticsTrackingOutput,
  type AnalyticsTrackingCoverageItem,
} from '@music-os-360/ai-skills';
import { runOnDemandSkill, type OnDemandSkillResult } from './on-demand-skill.runner';

const SKILL_NAME = 'analytics-tracking';

/** Única fonte de verdade: DOMAIN_EVENT -> método real de PostHogService. */
const KNOWN_TRACKING_MAP: Record<string, string> = {
  [DOMAIN_EVENTS.CONTRACT_SIGNED]: 'trackContractSigned',
  [DOMAIN_EVENTS.RELEASE_CREATED]: 'trackReleaseCreated',
};

@Injectable()
export class AnalyticsTrackingAutomation {
  constructor(
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
    private readonly postHog: PostHogService,
  ) {}

  async run(
    tenantId: string,
    userId: string,
  ): Promise<OnDemandSkillResult<AnalyticsTrackingOutput>> {
    const businessEvents = Array.from(new Set(Object.values(DOMAIN_EVENTS)));
    const coverage: AnalyticsTrackingCoverageItem[] = businessEvents.map((businessEvent) => {
      const trackingMethod = KNOWN_TRACKING_MAP[businessEvent] ?? null;
      return { businessEvent, hasProviderTracking: trackingMethod !== null, trackingMethod };
    });

    const input: AnalyticsTrackingInput = {
      providerName: 'PostHog',
      providerState: this.postHog.isConfigured() ? 'configured' : 'configuration_required',
      totalCanonicalEvents: businessEvents.length,
      coverage,
      language: 'pt-BR',
    };

    return runOnDemandSkill<AnalyticsTrackingInput, AnalyticsTrackingOutput>(
      { skillRun: this.skillRun, ai: this.ai },
      {
        skillName: SKILL_NAME,
        tenantId,
        userId,
        entityType: null,
        entityId: null,
        systemPrompt: ANALYTICS_TRACKING_SYSTEM_PROMPT,
        input,
        buildPrompt: buildAnalyticsTrackingPrompt,
        parseResponse: parseAnalyticsTrackingResponse,
        validateInput: validateAnalyticsTrackingInput,
        freshnessMinutes: 24 * 60,
      },
    );
  }
}
