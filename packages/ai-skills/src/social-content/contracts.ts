/**
 * packages/ai-skills/src/social-content/contracts.ts
 *
 * Contratos da skill social-content (version 1.0.0).
 * Fonte canônica compartilhada (web + api).
 *
 * Escopo: `marketing_content_posts` é uma entidade estritamente de conteúdo
 * ORGÂNICO (canais: instagram/facebook/tiktok/youtube/twitter/threads — ver
 * MARKETING_CONTENT_CHANNELS em marketing-contents.dto.ts). Não existe hoje
 * nenhuma entidade de mídia paga no schema — por isso `ad-creative` e
 * `paid-ads` NÃO reusam este contrato (ver NEEDS_PRODUCT_DECISION no
 * relatório da missão).
 *
 * Não-objetivo crítico: esta skill NUNCA gera o `copy` publicado nem altera
 * status de publicação. O usuário já fornece `copy` na criação do post
 * (campo obrigatório). A saída daqui é uma SUGESTÃO (variações de legenda,
 * hashtags, checklist do canal) gravada em metadata — nunca aplicada
 * automaticamente ao post nem tratada como publicada (generated != published).
 */

import type { SkillLanguage } from "../shared/primitives";

export type SocialContentLanguage = SkillLanguage;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface SocialContentInput {
  title: string;
  targetType: string;
  targetName: string;
  channel: string;
  contentType: string;
  draftCopy?: string;
  relatedCampaign?: string;
  context?: string;
  language?: SocialContentLanguage;
}

// ─── Blocos de saída ──────────────────────────────────────────────────────────

export interface SocialContentCaptionVariant {
  variant: string;
  tone: string;
}

export interface SocialContentChecklistItem {
  item: string;
  reason: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface SocialContentOutput {
  captionVariants: SocialContentCaptionVariant[];
  hashtags: string[];
  toneNotes: string;
  channelChecklist: SocialContentChecklistItem[];
}
