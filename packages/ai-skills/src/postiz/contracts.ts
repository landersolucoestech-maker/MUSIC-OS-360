/**
 * packages/ai-skills/src/postiz/contracts.ts
 *
 * Contratos da skill postiz (version 1.0.0).
 * Avaliação de PRONTIDÃO DE PUBLICAÇÃO (publish readiness) de um post de
 * conteúdo (`marketing_content_posts`, já gerado por social-content) —
 * NUNCA publica, agenda ou executa nada em um provedor real.
 *
 * Resolução do nome "postiz": zero referência ao vendor "Postiz" existe no
 * produto (grep repo-wide, zero hits) e uma investigação de missão anterior
 * já registrou explicitamente que nenhuma decisão de vendor foi autorizada
 * (CANDIDATE_SOCIAL_PUBLISHING_GATEWAY only). Esta skill NÃO decide o vendor
 * — implementa o LIMITE (boundary) de prontidão de publicação de forma
 * agnóstica de provedor, reaproveitando:
 *   - IntegrationBaseService.getOAuthStatus(tenantId, userId, provider) —
 *     estado real de conexão OAuth já existente para instagram/tiktok/youtube;
 *   - a ausência de qualquer serviço de integração para facebook/twitter/
 *     threads (reportada como NOT_IMPLEMENTED, nunca fabricada);
 *   - o próprio `MarketingPublishingProcessor.publish()`, que já é um stub
 *     self-documented ("Publicação real para {channel} não configurada")
 *     para TODO canal — esta skill NUNCA implica o contrário.
 *
 * Invariantes obrigatórios (nunca violados por esta skill):
 *   GENERATED != APPROVED != SCHEDULED != PUBLISHED != SUCCESSFULLY_MEASURED
 */

import type { SkillLanguage, SkillPriority } from "../shared/primitives";

export type PostizLanguage = SkillLanguage;

/** Reaproveita ExternalProviderStatus (@music-os-360/types) + NOT_IMPLEMENTED
 * para canais sem nenhum serviço de integração no código. */
export type PostizChannelReadiness =
  | "dependency_not_met"
  | "available_not_connected"
  | "connected"
  | "requires_reauth"
  | "provider_error"
  | "not_implemented";

export interface PostizChannelState {
  channel: string;
  readiness: PostizChannelReadiness;
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface PostizInput {
  postTitle: string;
  channel: string;
  channelReadiness: PostizChannelReadiness;
  hasCopy: boolean;
  copyLength: number;
  context?: string;
  language?: PostizLanguage;
}

// ─── Blocos de saída ──────────────────────────────────────────────────────────

export interface PostizBlocker {
  blocker: string;
  action: string;
}

export interface PostizRecommendedAction {
  action: string;
  priority: SkillPriority;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface PostizOutput {
  readinessSummary: string;
  readyToRequestPublish: boolean;
  blockers: PostizBlocker[];
  recommendedActions: PostizRecommendedAction[];
}
