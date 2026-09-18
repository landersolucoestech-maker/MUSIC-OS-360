/**
 * packages/ai-skills/src/seo-audit/contracts.ts
 *
 * Contratos da skill seo-audit (version 1.0.0).
 * Auditoria de higiene de link/discoverability de uma campanha de mídia
 * paga JÁ EM RASCUNHO no Campaign Builder real
 * (MarketingCampaignBuilderService/CampaignEntity type='marketing_builder')
 * — o único "público-alvo com URL configurável" real encontrado no produto
 * (destinationUrl em CampaignBuilderPayload).
 *
 * Escopo deliberadamente limitado a STATIC_ANALYSIS sobre CAMPOS JÁ
 * CONHECIDOS do produto — nunca faz fetch HTTP de uma URL externa
 * arbitrária (destinationUrl é 100% fornecida pelo usuário; buscar seu
 * conteúdo ao vivo exigiria um guard anti-SSRF de propósito geral que não
 * existe hoje — core/resilience/safe-url.ts só suporta allowlist de hosts
 * fixos de integrações conhecidas, não URLs arbitrárias de usuário — construir
 * isso com segurança está fora do escopo desta mudança).
 *
 * EXTERNAL_MEASUREMENT (ranking, volume de busca, domain authority, tráfego,
 * posição em SERP, backlinks, Core Web Vitals, status de indexação) NUNCA é
 * produzido — não há provedor real conectado para nenhuma dessas métricas
 * (confirmado: "Search Console" só existe como rótulo de UI em
 * Configuracoes.tsx, zero capacidade de backend). Todo campo dessa
 * categoria é reportado explicitamente como "unavailable".
 *
 * Execução: ON_DEMAND + STALE_REFRESH (mesma semântica de audience-health).
 */

import type { SkillLanguage, SkillSeverity } from "../shared/primitives";

export type SeoAuditLanguage = SkillLanguage;

export type SeoAuditCheckSource = "static_analysis" | "external_measurement";
export type SeoAuditMetricProvenance = "actual" | "unavailable";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface SeoAuditInput {
  campaignName: string;
  promotedEntityType: string;
  promotedEntityName: string;
  destinationUrl?: string;
  hasUtm: boolean;
  context?: string;
  language?: SeoAuditLanguage;
}

// ─── Blocos de saída ──────────────────────────────────────────────────────────

export interface SeoAuditCheck {
  subject: string;
  source: SeoAuditCheckSource;
  check: string;
  evidence: string;
  result: string;
  severity: SeoAuditSeverityOrInfo;
  recommendation: string;
  metricProvenance: SeoAuditMetricProvenance;
}

export type SeoAuditSeverityOrInfo = SkillSeverity | "info";

// ─── Output ───────────────────────────────────────────────────────────────────

export interface SeoAuditOutput {
  auditSummary: string;
  checks: SeoAuditCheck[];
  unavailableMetrics: string[];
}
