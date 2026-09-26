/**
 * packages/ai-skills/src/analytics-tracking/contracts.ts
 *
 * Contracts of the analytics-tracking skill (version 1.0.0).
 * Audit of analytics tracking COVERAGE — cross-checks the canonical domain
 * event registry (apps/api/src/core/events/events.service.ts DOMAIN_EVENTS,
 * already 100% captured in `domain_event_log` via UniversalEventLogHandler, a
 * real, always-on '**' wildcard listener) against the REAL tracking methods
 * already implemented in PostHogService (trackAIUsage/trackIntegrationConnected/
 * trackContractSigned/trackReleaseCreated) — which exist but are NEVER called
 * by any other service (confirmed by a repo-wide grep).
 *
 * Mandatory distinction (never silently mixed):
 *   BUSINESS EVENT     — DOMAIN_EVENTS (a real product business event)
 *   AUDIT EVENT        — domain_event_log (auditable copy of every BUSINESS EVENT)
 *   ANALYTICS EVENT    — a real call to PostHogService.capture()/trackX()
 *   PROVIDER CONVERSION EVENT — out of scope (no ads provider conversion
 *                         pixel is implemented)
 *
 * This skill NEVER sends sensitive data to a provider, NEVER fabricates a
 * PostHog acknowledgement, and truthfully reports "CONFIGURATION_REQUIRED"
 * when POSTHOG_API_KEY is absent/placeholder (the same real check
 * PostHogService uses).
 *
 * Execution: ON_DEMAND, triggered by the user (e.g. a governance/observability
 * panel).
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

// ─── Output blocks ────────────────────────────────────────────────────────────

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
