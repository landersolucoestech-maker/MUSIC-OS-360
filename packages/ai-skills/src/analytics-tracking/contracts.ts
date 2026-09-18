/**
 * packages/ai-skills/src/analytics-tracking/contracts.ts
 *
 * Contratos da skill analytics-tracking (version 1.0.0).
 * Auditoria de COBERTURA de rastreamento analítico — cruza o registro
 * canônico de eventos de domínio (apps/api/src/core/events/events.service.ts
 * DOMAIN_EVENTS, já 100% capturado em `domain_event_log` via
 * UniversalEventLogHandler, um listener wildcard '**' real e sempre ativo)
 * contra os métodos de rastreamento REAIS já implementados em
 * PostHogService (trackAIUsage/trackIntegrationConnected/
 * trackContractSigned/trackReleaseCreated) — que existem mas NUNCA são
 * chamados por nenhum outro serviço (grep repo-wide confirmado).
 *
 * Distinção obrigatória (nunca misturada silenciosamente):
 *   BUSINESS EVENT     — DOMAIN_EVENTS (evento de negócio real do produto)
 *   AUDIT EVENT        — domain_event_log (cópia auditável de todo BUSINESS EVENT)
 *   ANALYTICS EVENT    — chamada real a PostHogService.capture()/trackX()
 *   PROVIDER CONVERSION EVENT — fora de escopo (nenhum pixel de conversão
 *                         de provedor de ads está implementado)
 *
 * Esta skill NUNCA envia dado sensível a um provedor, NUNCA fabrica um
 * reconhecimento (acknowledgement) do PostHog, e reporta
 * "CONFIGURATION_REQUIRED" de forma verdadeira quando POSTHOG_API_KEY está
 * ausente/placeholder (mesma checagem real usada por PostHogService).
 *
 * Execução: ON_DEMAND, disparada pelo usuário (ex.: painel de
 * governança/observabilidade).
 */

import type { SkillLanguage, SkillSeverity } from "../shared/primitives";

export type AnalyticsTrackingLanguage = SkillLanguage;

export type AnalyticsTrackingProviderState = "configured" | "configuration_required";

export interface AnalyticsTrackingCoverageItem {
  businessEvent: string;
  hasProviderTracking: boolean;
  trackingMethod: string | null;
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface AnalyticsTrackingInput {
  providerName: string;
  providerState: AnalyticsTrackingProviderState;
  totalCanonicalEvents: number;
  coverage: AnalyticsTrackingCoverageItem[];
  context?: string;
  language?: AnalyticsTrackingLanguage;
}

// ─── Blocos de saída ──────────────────────────────────────────────────────────

export interface AnalyticsTrackingGap {
  gap: string;
  severity: SkillSeverity;
}

export interface AnalyticsTrackingRecommendation {
  recommendation: string;
  businessEvent: string | null;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface AnalyticsTrackingOutput {
  coverageSummary: string;
  coveragePercentage: number;
  gaps: AnalyticsTrackingGap[];
  recommendations: AnalyticsTrackingRecommendation[];
}
