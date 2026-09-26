/**
 * core/automation/analytics-tracking.automation.ts
 *
 * ON_DEMAND skill (see on-demand-skill.runner.ts): audits the real COVERAGE
 * of analytics tracking — cross-checks the canonical DOMAIN_EVENTS registry
 * (apps/api/src/core/events/events.service.ts, ~100 real BUSINESS EVENTS,
 * already 100% captured in `domain_event_log` via UniversalEventLogHandler,
 * an always-active '**' wildcard listener — that is an AUDIT EVENT, not an
 * ANALYTICS EVENT) against the REAL tracking methods already implemented
 * in PostHogService (real ANALYTICS EVENTs, but never called by any
 * other service — repo-wide grep confirmed).
 *
 * KNOWN_TRACKING_MAP below is the single source of truth on which
 * DOMAIN_EVENT already has a matching tracking method in code —
 * a static, verifiable mapping, never invented by the model.
 *
 * Never sends data to any provider (this skill only reads/analyzes, never
 * calls capture()/identify()). Truthfully reports providerState="configuration_required"
 * when PostHogService.isConfigured() is false.
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

/** Single source of truth: DOMAIN_EVENT -> real PostHogService method. */
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
