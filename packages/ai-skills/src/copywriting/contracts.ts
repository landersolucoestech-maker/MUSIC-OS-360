/**
 * packages/ai-skills/src/copywriting/contracts.ts
 *
 * Contratos da skill copywriting (version 1.0.0).
 * Rascunho de texto de marketing GENÉRICO (não estruturado em campos
 * específicos de canal/plataforma) para uma MarketingTaskEntity real cujo
 * `kind` indica um tipo de trabalho textual (copywriting, email, press,
 * etc. — catálogo real em operational-lists.defaults.ts).
 *
 * Distinção de escopo (nunca duplicada):
 *   social-content — copy estruturada para UM POST de conteúdo social já
 *                     existente (headline/cta não aplicável; foco em
 *                     variações de legenda para um canal específico).
 *   ad-creative     — copy estruturada (headline/primaryCopy/description/cta)
 *                     para UM criativo de anúncio pago, platform+placement
 *                     específicos.
 *   copywriting     — rascunho de texto LIVRE (prosa, não estruturado em
 *                     campos de canal) para uma TAREFA de marketing (email,
 *                     press release, landing copy, etc.) — a fonte é a
 *                     TAREFA (marketing_tasks), não um post nem um anúncio.
 *
 * ANTI-FABRICAÇÃO: todo fato sobre artista/release/campanha usado no texto
 * deve vir literalmente do input (sourceFacts) — a skill nunca inventa
 * datas, números, prêmios ou afirmações sobre o artista/projeto. O texto
 * gerado é sempre marcado como RASCUNHO — nunca campanha publicada ou
 * resultado real.
 *
 * Execução: ON_DEMAND, disparada pelo usuário na tela da tarefa de
 * marketing.
 */

import type { SkillLanguage } from "../shared/primitives";

export type CopywritingLanguage = SkillLanguage;

export type CopywritingIntent =
  | "email"
  | "press_release"
  | "landing_copy"
  | "general_draft";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface CopywritingInput {
  taskTitle: string;
  taskDescription?: string;
  intent: CopywritingIntent;
  projectTitle?: string;
  artistName?: string;
  tone?: string;
  sourceFacts?: string[];
  context?: string;
  language?: CopywritingLanguage;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface CopywritingOutput {
  draftTitle: string;
  draftBody: string;
  usedFacts: string[];
  isDraft: true;
}
