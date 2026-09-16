/**
 * packages/ai-skills/src/audience-health/contracts.ts
 *
 * Contratos da skill audience-health (version 1.0.0).
 * Síntese narrativa do estado de audiência de um artista, a partir de
 * resultados JÁ COMPUTADOS pelo Career Stage Engine e pelo Market Benchmark
 * Engine (Fase 3/3.2) — nunca chama provedores ao vivo, nunca recalcula
 * métricas, nunca fabrica um número que os engines não produziram.
 *
 * Execução: ON_DEMAND + stale-refresh (ver
 * apps/api/src/core/automation/on-demand-skill.runner.ts) — disparada por
 * ação explícita do usuário na tela do artista, reaproveitando o último
 * resultado dentro de uma janela de frescor em vez de gerar a cada
 * visualização.
 *
 * Não-sobreposição: artist-profile-analysis lê apenas a tabela `artists`
 * (perfil básico); audience-health lê exclusivamente os ENGINES de
 * analytics (career stage + market benchmark) — nenhum dos dois duplica o
 * outro.
 */

import type { SkillLanguage, SkillSeverity, SkillPriority } from "../shared/primitives";

export type AudienceHealthLanguage = SkillLanguage;

export type AudienceHealthStatus = "healthy" | "attention" | "critical" | "insufficient_data";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface AudienceHealthInput {
  artistName: string;
  careerStageStatus: "OK" | "INSUFFICIENT_DATA";
  careerStageScore?: number;
  careerStageClassification?: string;
  careerStageConfidence: number;
  careerStagePositiveFactors: string[];
  careerStageBottlenecks: string[];
  marketBenchmarkReadStatus: "READY" | "STALE" | "REFRESHING" | "INTEGRATION_UNAVAILABLE" | "ERROR";
  marketBenchmarkScore?: number;
  marketBenchmarkLabel?: string;
  context?: string;
  language?: AudienceHealthLanguage;
}

// ─── Blocos de saída ──────────────────────────────────────────────────────────

export interface AudienceHealthStrength {
  strength: string;
  evidence: string;
}

export interface AudienceHealthConcern {
  concern: string;
  severity: SkillSeverity;
  evidence: string;
}

export interface AudienceHealthAction {
  action: string;
  priority: SkillPriority;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface AudienceHealthOutput {
  healthSummary: string;
  healthStatus: AudienceHealthStatus;
  strengths: AudienceHealthStrength[];
  concerns: AudienceHealthConcern[];
  recommendedActions: AudienceHealthAction[];
  dataGaps: string[];
}
