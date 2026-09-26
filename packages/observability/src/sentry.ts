// ─── Sentry configuration helpers ────────────────────────────────────────────
// This module exports setup functions; the @sentry/* peer dep is resolved
// by the consumer (apps/web uses @sentry/react, apps/api uses @sentry/node).

export interface SentryInitOptions {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
  debug?: boolean;
  ignoreErrors?: (string | RegExp)[];
}

export const DEFAULT_SENTRY_OPTIONS: Partial<SentryInitOptions> = {
  tracesSampleRate: 0.1,
  debug: false,
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Network request failed",
    "Failed to fetch",
    /^ChunkLoadError/,
    /Loading chunk \d+ failed/,
  ],
};

/**
 * Builds the configuration object for Sentry.init().
 * Called by apps/web/src/main.tsx and apps/api/src/main.ts.
 *
 * @example
 * // In main.tsx:
 * import * as Sentry from "@sentry/react";
 * import { buildSentryConfig } from "@music-os-360/observability/sentry";
 * Sentry.init(buildSentryConfig({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: "production" }));
 */
export function buildSentryConfig(options: SentryInitOptions): SentryInitOptions {
  return { ...DEFAULT_SENTRY_OPTIONS, ...options };
}

/**
 * Captures an error with tenant context for better grouping in Sentry.
 */
export function captureWithTenantContext(
  error: unknown,
  tenantId: string,
  extra?: Record<string, unknown>,
): void {
  try {
    // Avoids a static @sentry import so the build does not break when the DSN is empty
    const Sentry = (globalThis as Record<string, unknown>)["__Sentry__"] as
      | { captureException: (e: unknown, ctx: unknown) => void }
      | undefined;
    Sentry?.captureException(error, {
      tags: { tenant_id: tenantId },
      extra,
    });
  } catch {
    // Silent if Sentry is not initialized
  }
}
