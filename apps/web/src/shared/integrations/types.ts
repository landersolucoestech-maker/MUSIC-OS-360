/**
 * shared/integrations/types.ts
 *
 * Core types of the MUSIC OS 360 integrations system.
 * This file is the source of truth for every integration identifier,
 * category and metadata contract.
 *
 * RULE: domain code NEVER imports from here directly —
 * it uses its own module's adapter.
 */

// ─── Identificadores ──────────────────────────────────────────────────────────

/**
 * Canonical identifier of each integration.
 * Used as the registry key, in queryKeys and in localStorage.
 */
export type IntegrationId =
  // Storage
  | "r2"
  // Email
  | "resend"
  // Pagamentos
  | "stripe"
  // Assinatura digital
  | "autentique"
  | "clicksign"
  | "docusign"
  // Monitoramento de produto / erros
  | "posthog"
  | "sentry"
  // Streaming / metrics
  | "spotify"
  | "youtube"
  | "tiktok"
  | "instagram"
  | "google-ads"
  | "meta_business"
  | "tiktok_business"
  | "google_business"
  | "spotify_ads"
  | "deezer"
  | "apple-music"
  | "soundcloud"
  // Collection / copyright
  | "ecad"
  | "ubc"
  | "abramus"
  // Digital distribution
  | "onerpm"
  | "distrokid"
  | "symphonic"
  | "soundon"
  | "somvibe"
  | "musicpro"
  // Fiscal
  | "nfe"
  // Monitoramento musical (fingerprint)
  | "acrcloud"
  // Internal communication
  | "chat"
  | "musicroomchat";

// ─── Categorias ───────────────────────────────────────────────────────────────

export type IntegrationCategory =
  | "storage"
  | "email"
  | "payments"
  | "signing"
  | "monitoring"
  | "streaming"
  | "marketing"
  | "distribution"
  | "fiscal"
  | "rights"
  | "music-monitoring"
  | "chat";

// ─── Status ──────────────────────────────────────────────────────────────────

export type IntegrationStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "pending"
  | "disabled";

// ─── Metadados ───────────────────────────────────────────────────────────────

/**
 * Descriptive metadata of an integration.
 * Consumed by the registry and the configuration UIs.
 */
export interface IntegrationMeta {
  /** Canonical identifier */
  id: IntegrationId;
  /** Display name */
  name: string;
  /** Categoria funcional */
  category: IntegrationCategory;
  /** Short UI description */
  description: string;
  /** Canonical visual identity used by cards, dialogs and popups. */
  logoId?: import("./logos").IntegrationLogoId;
  /** Official documentation URL */
  docsUrl?: string;
  /**
   * localStorage key where the credentials are stored.
   * Convention: `musicos360_<id>_credentials`
   */
  credentialsKey?: string;
  /**
   * Whether the integration is required for the platform's basic
   * operation.
   */
  required?: boolean;
}

// ─── Generic credentials ─────────────────────────────────────────────────────

/**
 * Generic credentials wrapper.
 * Each integration defines the concrete type of `T`.
 */
export interface IntegrationCredentials<T extends Record<string, string>> {
  integration_id: IntegrationId;
  credentials: T;
  saved_at: string;
}

// ─── Health check ─────────────────────────────────────────────────────────────

export interface IntegrationHealthCheck {
  healthy: boolean;
  latency_ms?: number;
  error?: string;
  checked_at: string;
}

// ─── Estado runtime ──────────────────────────────────────────────────────────

/**
 * Runtime state of an integration (returned by the `use<X>Status` hooks).
 */
export interface IntegrationRuntimeStatus {
  integration_id: IntegrationId;
  status: IntegrationStatus;
  connected: boolean;
  last_error?: string | null;
  last_checked_at?: string | null;
  /** Integration-specific fields are added through extension */
  [key: string]: unknown;
}
