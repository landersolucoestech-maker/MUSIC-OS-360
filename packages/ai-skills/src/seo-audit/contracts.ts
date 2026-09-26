/**
 * packages/ai-skills/src/seo-audit/contracts.ts
 *
 * Contracts of the seo-audit skill (version 1.0.0).
 * Link hygiene/discoverability audit of a paid media campaign ALREADY IN DRAFT
 * in the real Campaign Builder (MarketingCampaignBuilderService/CampaignEntity
 * type='marketing_builder') — the only real "target with a configurable URL"
 * found in the product (destinationUrl in CampaignBuilderPayload).
 *
 * Scope deliberately limited to STATIC_ANALYSIS over fields the product ALREADY
 * KNOWS — it never does an HTTP fetch of an arbitrary external URL
 * (destinationUrl is 100% user-supplied; fetching its content live would need a
 * general-purpose anti-SSRF guard that does not exist today —
 * core/resilience/safe-url.ts only supports an allowlist of fixed hosts of known
 * integrations, not arbitrary user URLs — building that safely is out of scope
 * for this change).
 *
 * EXTERNAL_MEASUREMENT (ranking, search volume, domain authority, traffic, SERP
 * position, backlinks, Core Web Vitals, indexing status) is NEVER produced —
 * there is no real provider connected for any of these metrics (confirmed:
 * "Search Console" only exists as a UI label in Configuracoes.tsx, zero backend
 * capability). Every field in that category is explicitly reported as
 * "unavailable".
 *
 * Execution: ON_DEMAND + STALE_REFRESH (same semantics as audience-health).
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

// ─── Output blocks ────────────────────────────────────────────────────────────

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
