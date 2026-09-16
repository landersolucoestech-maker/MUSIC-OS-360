/**
 * packages/ai-skills/src/launch-strategy/contracts.ts
 *
 * Contratos da skill launch-strategy (version 1.0.0).
 * Direção estratégica/narrativa de lançamento de um release aprovado —
 * posicionamento, público-alvo, mensagens-chave e sinais de sucesso a
 * observar. Fonte canônica compartilhada (web + api).
 *
 * Distinção de escopo (mesmo release, mesmo evento release.approved, três
 * skills não-sobrepostas):
 *   marketing-calendar-builder — QUANDO/ONDE: calendário tático de posts por
 *                                 plataforma/cadência.
 *   audiovisual-briefing       — briefing de produção audiovisual.
 *   launch-strategy            — POR QUÊ/PARA QUEM/QUAL MENSAGEM: narrativa
 *                                 estratégica e posicionamento do lançamento
 *                                 (mesmo papel que campaign-strategy cumpre
 *                                 para campanhas — ver campaign-strategy/contracts.ts).
 *
 * successSignals é deliberadamente qualitativo (sinal + porquê), nunca uma
 * métrica numérica — números de desempenho fabricados são proibidos pela
 * missão (ver campaign-report/contracts.ts para o mesmo princípio aplicado
 * a métricas).
 */

import type { SkillLanguage, SkillSeverity } from "../shared/primitives";

export type LaunchStrategyLanguage = SkillLanguage;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface LaunchStrategyInput {
  releaseTitle: string;
  releaseType: string;
  artistName?: string;
  genre?: string;
  releaseDate?: string;
  existingCalendarSummary?: string;
  context?: string;
  language?: LaunchStrategyLanguage;
}

// ─── Blocos de saída ──────────────────────────────────────────────────────────

export interface LaunchKeyMessage {
  message: string;
  audience: string;
}

export interface LaunchSuccessSignal {
  signal: string;
  why: string;
}

export interface LaunchRiskFactor {
  risk: string;
  severity: SkillSeverity;
  mitigation: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface LaunchStrategyOutput {
  strategicNarrative: string;
  targetAudience: string;
  competitivePositioning: string;
  keyMessages: LaunchKeyMessage[];
  successSignals: LaunchSuccessSignal[];
  riskFactors: LaunchRiskFactor[];
}
