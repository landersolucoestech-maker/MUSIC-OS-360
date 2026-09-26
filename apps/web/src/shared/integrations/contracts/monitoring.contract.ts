/**
 * shared/integrations/contracts/monitoring.contract.ts
 *
 * Product and error monitoring contracts.
 *   - IAnalyticsProvider  → PostHog (feature flags, funnels, A/B)
 *   - IErrorMonitorProvider → Sentry (errors, performance, traces)
 *
 * CURRENT STATE: standalone — no real monitoring.
 * FUTURE MIGRATION: providers replace the current log functions.
 *
 * RULE: components NEVER call PostHog or Sentry directly.
 * They use the useAnalytics() and useErrorMonitor() hooks, which delegate to these contracts.
 */

// ─── Analytics (PostHog) ──────────────────────────────────────────────────────

export type AnalyticsEventName =
  // Auth
  | "user.signed_in"
  | "user.signed_out"
  | "user.invited"
  | "user.invite_sent"
  // Catalog
  | "obra.created"
  | "obra.updated"
  | "obra.deleted"
  | "fonograma.created"
  | "fonograma.registered_ecad"
  | "fonograma.imported_abramus"
  // Releases
  | "release.created"
  | "release.submitted"
  | "release.approved"
  | "release.rejected"
  // Contracts
  | "contrato.created"
  | "contrato.sent_for_signing"
  | "contrato.signed"
  | "contrato.expired"
  | "contrato.expiry_alert_sent"
  // CRM
  | "lead.created"
  | "lead.converted"
  // Accounting
  | "transacao.created"
  | "nota_fiscal.emitted"
  // Marketing
  | "campanha.created"
  | "campanha.launched"
  // Integrations
  | "integration.connected"
  | "integration.disconnected"
  | "integration.error";

export interface AnalyticsEventProperties {
  tenant_id?: string;
  user_id?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface FeatureFlagContext {
  user_id: string;
  tenant_id: string;
  plan?: string;
}

/**
 * IAnalyticsProvider — product analytics contract.
 *
 * Planned implementations:
 *   - MockAnalyticsProvider   (standalone — console log in dev)
 *   - PostHogAnalyticsProvider (production — PostHog SDK)
 */
export interface IAnalyticsProvider {
  /** Identifica o utilizador no sistema de analytics */
  identify(userId: string, properties?: AnalyticsEventProperties): void;

  /** Records a product event */
  track(event: AnalyticsEventName, properties?: AnalyticsEventProperties): void;

  /** Records a page view */
  page(name: string, properties?: AnalyticsEventProperties): void;

  /** Checks whether a feature flag is active for the given context */
  isFeatureEnabled(flagKey: string, context: FeatureFlagContext): Promise<boolean>;

  /** Gets a feature flag value (for A/B testing) */
  getFeatureFlagPayload(flagKey: string, context: FeatureFlagContext): Promise<string | null>;

  /** Clears the identity (after sign-out) */
  reset(): void;
}

// ─── Error Monitoring (Sentry) ────────────────────────────────────────────────

export type ErrorSeverity = "fatal" | "error" | "warning" | "info" | "debug";

export interface ErrorContext {
  user_id?: string;
  tenant_id?: string;
  module?: string;
  action?: string;
  extra?: Record<string, unknown>;
}

export interface BreadcrumbEntry {
  category: string;
  message: string;
  level?: ErrorSeverity;
  data?: Record<string, unknown>;
  timestamp?: string;
}

export interface PerformanceTransaction {
  name: string;
  op: string;
  finish(): void;
  setTag(key: string, value: string): void;
  setData(key: string, value: unknown): void;
}

/**
 * IErrorMonitorProvider — error and performance monitoring contract.
 *
 * Planned implementations:
 *   - MockErrorMonitorProvider   (standalone — console.error in dev)
 *   - SentryErrorMonitorProvider (production — Sentry SDK)
 */
export interface IErrorMonitorProvider {
  /** Captures an error and sends it to the monitoring system */
  captureError(error: Error, context?: ErrorContext, severity?: ErrorSeverity): string;

  /** Captures a message (not an Error) */
  captureMessage(message: string, severity?: ErrorSeverity, context?: ErrorContext): string;

  /** Sets the active user for error correlation */
  setUser(user: { id: string; email?: string; tenant_id?: string } | null): void;

  /** Adds a breadcrumb entry for flow tracing */
  addBreadcrumb(entry: BreadcrumbEntry): void;

  /** Starts a performance transaction */
  startTransaction(name: string, op: string): PerformanceTransaction;

  /** Sets a global tag on every occurrence */
  setTag(key: string, value: string): void;

  /** Sets extra context on every occurrence */
  setContext(key: string, context: Record<string, unknown>): void;
}

