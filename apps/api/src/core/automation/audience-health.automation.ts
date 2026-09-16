/**
 * core/automation/audience-health.automation.ts
 *
 * Skill ON_DEMAND (ver on-demand-skill.runner.ts): disparada por uma ação
 * explícita do usuário na tela do artista (nunca por um evento de ciclo de
 * vida) — audience-health sintetiza os resultados JÁ CALCULADOS pelo Career
 * Stage Engine e pelo Market Benchmark Engine.
 *
 * Stale-refresh: reaproveita a última síntese de sucesso (skill_runs) dentro
 * de AUDIENCE_HEALTH_FRESHNESS_MINUTES em vez de chamar a IA a cada
 * visualização da tela — evita tanto "nunca atualiza" quanto "atualiza a
 * cada refresh de página" (ver discussão de execução ON_DEMAND vs
 * EVENT_DRIVEN no relatório da missão).
 *
 * Nunca escreve em `artists` nem em nenhuma tabela de produto — apenas lê
 * (via os dois services já existentes) e devolve o resultado ao controller.
 */

import { Injectable } from '@nestjs/common';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
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
    private readonly ai: AIService,
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
