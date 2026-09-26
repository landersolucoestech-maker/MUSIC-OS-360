/**
 * shared/integrations/contracts/monitoring.contract.ts
 *
 * Contratos de monitoramento de produto e erros.
 *   - IAnalyticsProvider  → PostHog (feature flags, funis, A/B)
 *   - IErrorMonitorProvider → Sentry (erros, performance, traces)
 *
 * ESTADO ACTUAL: standalone — sem monitoramento real.
 * MIGRAÇÃO FUTURA: providers substituem as funções de log actuais.
 *
 * REGRA: componentes NUNCA chamam PostHog ou Sentry directamente.
 * Usam os hooks useAnalytics() e useErrorMonitor() que delegam para estes contratos.
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
 * IAnalyticsProvider — contrato de analytics de produto.
 *
 * Implementações previstas:
 *   - MockAnalyticsProvider   (standalone — log em consola em dev)
 *   - PostHogAnalyticsProvider (produção — PostHog SDK)
 */
export interface IAnalyticsProvider {
  /** Identifica o utilizador no sistema de analytics */
  identify(userId: string, properties?: AnalyticsEventProperties): void;

  /** Regista um evento de produto */
  track(event: AnalyticsEventName, properties?: AnalyticsEventProperties): void;

  /** Regista uma visualização de página */
  page(name: string, properties?: AnalyticsEventProperties): void;

  /** Verifica se uma feature flag está activa para o contexto dado */
  isFeatureEnabled(flagKey: string, context: FeatureFlagContext): Promise<boolean>;

  /** Obtém o valor de uma feature flag (para A/B testing) */
  getFeatureFlagPayload(flagKey: string, context: FeatureFlagContext): Promise<string | null>;

  /** Limpa a identidade (após sign out) */
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
 * IErrorMonitorProvider — contrato de monitoramento de erros e performance.
 *
 * Implementações previstas:
 *   - MockErrorMonitorProvider   (standalone — console.error em dev)
 *   - SentryErrorMonitorProvider (produção — Sentry SDK)
 */
export interface IErrorMonitorProvider {
  /** Captura um erro e envia para o sistema de monitoramento */
  captureError(error: Error, context?: ErrorContext, severity?: ErrorSeverity): string;

  /** Captura uma mensagem (não um Error) */
  captureMessage(message: string, severity?: ErrorSeverity, context?: ErrorContext): string;

  /** Define o utilizador activo para correlação de erros */
  setUser(user: { id: string; email?: string; tenant_id?: string } | null): void;

  /** Adiciona uma entrada de breadcrumb para rastreio de fluxo */
  addBreadcrumb(entry: BreadcrumbEntry): void;

  /** Inicia uma transacção de performance */
  startTransaction(name: string, op: string): PerformanceTransaction;

  /** Define uma tag global para todas as ocorrências */
  setTag(key: string, value: string): void;

  /** Define contexto extra para todas as ocorrências */
  setContext(key: string, context: Record<string, unknown>): void;
}

