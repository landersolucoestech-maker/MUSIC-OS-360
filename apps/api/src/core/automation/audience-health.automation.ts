/**
 * core/automation/audience-health.automation.ts
 *
 * ON_DEMAND skill (see on-demand-skill.runner.ts): triggered by an explicit
 * user action on the artist screen (never by a lifecycle
 * event) — audience-health synthesizes the results ALREADY COMPUTED by the Career
 * Stage Engine and the Market Benchmark Engine.
 *
 * Stale refresh: reuses the last successful synthesis (skill_runs) within
 * AUDIENCE_HEALTH_FRESHNESS_MINUTES instead of calling the AI on every
 * screen view — avoids both "never updates" and "updates on every
 * page refresh" (see the ON_DEMAND vs EVENT_DRIVEN execution discussion
 * in the mission report).
 *
 * Never writes to `artists` nor any product table — it only reads
 * (via the two existing services) and returns the result to the controller.
 */

import { Injectable } from '@nestjs/common';
import { SkillRunService } from '../skills/skill-run.service';
import { AiService } from '../../modules/ai/ai.service';
import { CareerStageService } from '../../modules/artists/platform-profiles/analytics/career-stage.service';
import { MarketBenchmarkService } from '../../modules/artists/platform-profiles/analytics/market-benchmark.service';
import {
  AUDIENCE_HEALTH_SYSTEM_PROMPT,
  buildAudienceHealthPrompt,
  parseAudienceHealthResponse,
  validateAudienceHealthInput,
  type AudienceHealthInput,
  type AudienceHealthOutput,
} from '@music-os-360/ai-skills';
import { runOnDemandSkill, type OnDemandSkillResult } from './on-demand-skill.runner';

const SKILL_NAME = 'audience-health';
const AUDIENCE_HEALTH_FRESHNESS_MINUTES = 7 * 24 * 60; // 7 dias

@Injectable()
export class AudienceHealthAutomation {
  constructor(
    private readonly skillRun: SkillRunService,
    private readonly ai: AiService,
    private readonly careerStage: CareerStageService,
    private readonly marketBenchmark: MarketBenchmarkService,
  ) {}

  async run(
    tenantId: string,
    userId: string,
    artistId: string,
    artistName: string,
    forceRefresh: boolean,
  ): Promise<OnDemandSkillResult<AudienceHealthOutput>> {
    const [careerStageResult, benchmark] = await Promise.all([
      this.careerStage.calculate(tenantId, artistId),
      this.marketBenchmark.getStatus(tenantId, artistId),
    ]);

    const input: AudienceHealthInput = {
      artistName,
      careerStageStatus: careerStageResult.status,
      careerStageConfidence: careerStageResult.confidence,
      careerStagePositiveFactors: careerStageResult.positiveFactors.map((f) => f.reason),
      careerStageBottlenecks: careerStageResult.bottlenecks.map((f) => f.reason),
      marketBenchmarkReadStatus: benchmark.readStatus,
      language: 'pt-BR',
    };
    if (careerStageResult.score != null) input.careerStageScore = careerStageResult.score;
    if (careerStageResult.classification) input.careerStageClassification = careerStageResult.classification;
    if (benchmark.result?.score != null) input.marketBenchmarkScore = benchmark.result.score;
    if (benchmark.result?.label) input.marketBenchmarkLabel = benchmark.result.label;

    return runOnDemandSkill<AudienceHealthInput, AudienceHealthOutput>(
      { skillRun: this.skillRun, ai: this.ai },
      {
        skillName: SKILL_NAME,
        tenantId,
        userId,
        entityType: 'artist',
        entityId: artistId,
        systemPrompt: AUDIENCE_HEALTH_SYSTEM_PROMPT,
        input,
        buildPrompt: buildAudienceHealthPrompt,
        parseResponse: parseAudienceHealthResponse,
        validateInput: validateAudienceHealthInput,
        freshnessMinutes: AUDIENCE_HEALTH_FRESHNESS_MINUTES,
        forceRefresh,
      },
    );
  }
}
